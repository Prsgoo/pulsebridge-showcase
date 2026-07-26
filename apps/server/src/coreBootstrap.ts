import {
  PulseBridgeCore,
  PluginKinds,
  createRedisClient,
  RedisRecordStore,
  RedisStateStore,
  RedisSecretBackend,
  InMemoryRecordStore,
  InMemoryViewStore,
  type PulseLogger,
  type IntegrationPlugin,
  type ProcessorPlugin,
} from "pulsebridge";
import type { ServerConfig } from "./configLoader.js";
import { loadPluginsFromPackage } from "./pluginLoader.js";

export interface BootResult {
  core: PulseBridgeCore;
}

/** Master key that encrypts the secret store. Without it, secret-requiring plugins run in auth_error. */
const MASTER_KEY_ENV = "PB_MASTER_KEY";

/**
 * Default convention this example host uses to source secret values from the
 * environment: `PB_SECRET__<SANITIZED_PLUGIN_ID>__<DECLARED_KEY>`. The core never
 * sees these names — it only receives the plugin's declared key via `provision()`.
 * A different host (form, file, vault) can source values however it likes.
 */
const SECRET_ENV_PREFIX = "PB_SECRET__";

function secretEnvName(pluginId: string, key: string): string {
  const sanitized = pluginId
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${SECRET_ENV_PREFIX}${sanitized}__${key}`;
}

/**
 * Provisions each registered plugin's declared secrets from the environment.
 * Must run before `start()` so the initial integration pass sees the values.
 * Plugins missing a required secret are left for the core to fail closed
 * (auth_error) rather than aborting the whole boot.
 */
async function provisionFromEnv(
  core: PulseBridgeCore,
  logger: PulseLogger,
): Promise<void> {
  const specs = await core.listProvisioningSpecs();

  for (const spec of specs) {
    const values: Record<string, string> = {};
    const missingRequired: string[] = [];

    for (const secret of spec.secrets) {
      const value = process.env[secretEnvName(spec.pluginId, secret.key)];
      if (value !== undefined && value.trim() !== "") {
        values[secret.key] = value;
      } else if (secret.required) {
        missingRequired.push(secret.key);
      }
    }

    const provisionedKeys = Object.keys(values);
    if (provisionedKeys.length > 0) {
      await core.provision(spec.pluginId, values);
      logger.info("Provisioned secrets from environment.", {
        pluginId: spec.pluginId,
        keys: provisionedKeys,
      });
    }

    if (missingRequired.length > 0) {
      logger.warn(
        "Plugin is missing required secrets — it will run in auth_error until provisioned.",
        {
          pluginId: spec.pluginId,
          missing: missingRequired,
          expectedEnv: missingRequired.map((key) =>
            secretEnvName(spec.pluginId, key),
          ),
        },
      );
    }
  }
}

/**
 * Instantiates `PulseBridgeCore`, loads all plugins declared in the config,
 * registers them, provisions their declared secrets, and starts the platform.
 *
 * The core never reads `process.env`. This host is the adapter that sources
 * secret values (from `PB_SECRET__*` env vars) and hands each plugin only the
 * keys it declares in its manifest via `core.provision()`. Secrets are encrypted
 * at rest by the core; the master key comes from `PB_MASTER_KEY`.
 */
export async function bootCore(
  config: ServerConfig,
  logger: PulseLogger,
): Promise<BootResult> {
  let redisStores:
    | {
        recordStore: RedisRecordStore;
        stateStore: RedisStateStore;
        secretBackend: RedisSecretBackend;
      }
    | undefined;

  if (config.redis) {
    logger.info("Connecting to Redis…", { url: config.redis.url });
    const redisOpts = { url: config.redis.url, commandTimeout: 2000 };
    const [recordRedis, stateRedis, secretRedis] = await Promise.all([
      createRedisClient(redisOpts),
      createRedisClient(redisOpts),
      createRedisClient(redisOpts),
    ]);
    redisStores = {
      recordStore: new RedisRecordStore({
        client: recordRedis,
        fallback: new InMemoryRecordStore(),
      }),
      stateStore: new RedisStateStore({ client: stateRedis }),
      secretBackend: new RedisSecretBackend({ client: secretRedis }),
    };
    logger.info("Redis stores ready.");
  }

  const masterKey = process.env[MASTER_KEY_ENV];
  if (masterKey === undefined || masterKey === "") {
    logger.warn(
      `${MASTER_KEY_ENV} is not configured — plugins that require secrets will run in auth_error. Set it to enable secret provisioning.`,
    );
  }

  const core = new PulseBridgeCore({
    logger,
    ...(masterKey !== undefined && masterKey !== "" ? { masterKey } : {}),
    ...(redisStores
      ? {
          store: {
            records: redisStores.recordStore,
            views: new InMemoryViewStore(),
          },
          stateStore: redisStores.stateStore,
          secretBackend: redisStores.secretBackend,
        }
      : {}),
    ...(config.core.executionTimeoutMs !== undefined
      ? { executionTimeoutMs: config.core.executionTimeoutMs }
      : {}),
    ...(config.core.processorTimeoutMs !== undefined
      ? { processorTimeoutMs: config.core.processorTimeoutMs }
      : {}),
    ...(config.core.maxConsecutiveFailures !== undefined
      ? { maxConsecutiveFailures: config.core.maxConsecutiveFailures }
      : {}),
  });

  core.on(
    "plugin:status-changed",
    ({ pluginId, previousStatus, newStatus }) => {
      logger.info("Plugin status changed.", {
        pluginId,
        previousStatus,
        newStatus,
      });
    },
  );

  // Load and register each declared plugin package.
  for (const entry of config.plugins) {
    let plugins: Array<IntegrationPlugin | ProcessorPlugin>;
    try {
      plugins = await loadPluginsFromPackage(entry.package, entry.entry);
    } catch (cause) {
      throw new Error(
        `Failed to load plugin from package "${entry.package}".`,
        { cause },
      );
    }

    for (const plugin of plugins) {
      if (plugin.manifest.kind === PluginKinds.INTEGRATION) {
        const pollOpts =
          entry.pollIntervalMs !== undefined
            ? { pollIntervalMs: entry.pollIntervalMs }
            : undefined;
        await core.registerIntegration(
          plugin as IntegrationPlugin,
          entry.config ?? {},
          pollOpts,
        );
      } else if (plugin.manifest.kind === PluginKinds.PROCESSOR) {
        await core.registerProcessor(plugin as ProcessorPlugin);
      }
    }
  }

  // Provision declared secrets before the initial pass runs.
  if (masterKey !== undefined && masterKey !== "") {
    await provisionFromEnv(core, logger);
  }

  logger.info("Starting platform — running initial integration pass…");
  await core.start();

  return { core };
}
