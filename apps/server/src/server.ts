import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import type { Context, MiddlewareHandler } from "hono";
import {
  MasterKeyRequiredError,
  PluginAuthError,
  PluginInputError,
  PulseBridgeError,
  RateLimitError,
  ReauthRequiredError,
  TransientError,
} from "pulsebridge";
import type { PluginState, PulseBridgeCore, PulseLogger } from "pulsebridge";
import type { SseManager } from "./sseManager.js";
import {
  npmInstall,
  npmUninstall,
  addPluginToConfig,
  removePluginFromConfig,
  syncPackageJsonVersion,
  removeFromPackageJson,
} from "./pluginInstaller.js";
import { checkForUpdates } from "./updateChecker.js";

function err(message: string): { error: { message: string } } {
  return { error: { message } };
}

// `lastError` is plugin-authored free text surfaced on /health and /plugins.
// A careless plugin could embed a secret or a long stack trace; cap and collapse
// it so the dashboard stays useful without becoming a leak/DoS vector.
const MAX_LAST_ERROR_LEN = 300;

// Cap inbound webhook bodies. The endpoint is public, so an unbounded body is a
// trivial memory-exhaustion vector; 1 MiB comfortably fits real webhook events.
const MAX_WEBHOOK_BODY_BYTES = 1_048_576;

function redactLastError(state: PluginState): PluginState {
  if (state.lastError === undefined) return state;
  const collapsed = state.lastError.replace(/\s+/g, " ").trim();
  const lastError =
    collapsed.length > MAX_LAST_ERROR_LEN
      ? `${collapsed.slice(0, MAX_LAST_ERROR_LEN)}…`
      : collapsed;
  return { ...state, lastError };
}

// Maps a thrown plugin error onto an HTTP response for the action/webhook
// channels. A client fault (PluginInputError) returns the plugin's own message
// so the caller can fix their request. System faults return a generic message
// (the real detail is logged) with a status code that reflects the failure.
// Returns undefined for unrecognised errors so the route re-throws into onError.
function channelErrorResponse(
  c: Context,
  cause: unknown,
): Response | undefined {
  if (cause instanceof PluginInputError) {
    return c.json(err(cause.message), 400);
  }
  if (cause instanceof PluginAuthError) {
    return c.json(err("Plugin rejected the request (authentication)."), 401);
  }
  if (cause instanceof ReauthRequiredError) {
    return c.json(err("Plugin requires re-authentication."), 401);
  }
  if (cause instanceof RateLimitError) {
    return c.json(err("Upstream rate limited the request."), 429);
  }
  if (cause instanceof TransientError) {
    return c.json(err("Upstream temporarily unavailable."), 502);
  }
  return undefined;
}

// A package spec passed to `npm install`: optional "@scope/", a package name,
// and an optional "@version|tag|range". This is a strict allowlist — not just a
// flag/whitespace reject — because on Windows the install runs via
// `cmd.exe /c npm …`, and cmd.exe re-parses the command line Node builds. A
// shell-free execFile is therefore not enough on its own; we must keep cmd
// metacharacters (& | ^ < > % ( ) ") out of the spec entirely. The version part
// allows only the characters real semver ranges/tags use.
const NPM_PACKAGE_SPEC =
  /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*(?:@[a-zA-Z0-9._~^*+-]+)?$/;

const packageSpecSchema = z
  .string()
  .min(1)
  .max(214) // npm's maximum package-name length
  .refine((spec) => NPM_PACKAGE_SPEC.test(spec), {
    message: "Invalid package spec.",
  });

// Secret values to provision. Keys must be declared in the plugin's manifest;
// the core rejects undeclared or empty values. Never echoed back in responses.
const provisionBodySchema = z.object({
  values: z
    .record(z.string(), z.string())
    .refine((v) => Object.keys(v).length > 0, {
      message: "At least one secret value is required.",
    }),
});

const installBodySchema = z.object({
  package: packageSpecSchema,
  entry: z.string().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  pollIntervalMs: z.number().int().positive().optional(),
});

export interface BuildAppOptions {
  core: PulseBridgeCore;
  sse: SseManager;
  configPath: string;
  serverRoot: string;
  /** Installed version of the `pulsebridge` core, surfaced on /health. */
  coreVersion: string;
  authGuard: MiddlewareHandler;
  /** Invoked by POST /restart to trigger graceful shutdown + process exit. */
  onRestart: () => void;
  logger: PulseLogger;
  /** When set, restricts CORS to these origins; omit to allow any origin. */
  corsOrigins?: string[];
}

export function buildApp(options: BuildAppOptions): Hono {
  const {
    core,
    sse,
    configPath,
    serverRoot,
    coreVersion,
    authGuard,
    onRestart,
    logger,
    corsOrigins,
  } = options;

  const app = new Hono();

  // Default to allowing any origin (convenient for local dashboards); a
  // configured allowlist locks cross-origin access down for production.
  app.use("*", cors(corsOrigins ? { origin: corsOrigins } : undefined));

  // Catch-all error boundary: log the real error server-side, return a generic
  // message so stack traces and internal paths never reach the client.
  app.onError((cause, c) => {
    logger.error("Unhandled error in request handler.", {
      path: c.req.path,
      method: c.req.method,
      error: cause instanceof Error ? cause.message : String(cause),
    });
    return c.json(err("Internal server error."), 500);
  });

  app.notFound((c) => c.json(err("Not found."), 404));

  app.get("/health", (c) => {
    const health = core.getHealth();
    return c.json({
      ...health,
      version: coreVersion,
      plugins: health.plugins.map(redactLastError),
    });
  });

  // Maps each plugin id to its manifest version so the dashboard can show what
  // version of every integration/processor is running.
  const pluginVersionsById = (): Map<string, string> => {
    const versions = new Map<string, string>();
    for (const manifest of [
      ...core.listIntegrationManifests(),
      ...core.listProcessorManifests(),
    ]) {
      versions.set(manifest.id, manifest.version);
    }
    return versions;
  };

  app.get("/plugins", (c) => {
    const versions = pluginVersionsById();
    return c.json(
      core.listPluginStates().map((state) => {
        const version = versions.get(state.pluginId);
        return {
          ...redactLastError(state),
          ...(version !== undefined ? { version } : {}),
        };
      }),
    );
  });

  // Returns which declared secrets are set/unset — never the values themselves.
  app.get("/plugins/:id/secrets", authGuard, async (c) => {
    const id = c.req.param("id");
    const spec = await core.getProvisioningSpec(id);
    if (!spec) {
      return c.json(err(`Plugin "${id}" is not registered.`), 404);
    }
    return c.json(spec);
  });

  // Stores secret values for a plugin. Values are encrypted at rest and can only
  // ever be written here, never read back.
  app.put("/plugins/:id/secrets", authGuard, async (c) => {
    const id = c.req.param("id");

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(err("Request body must be JSON."), 400);
    }

    const parsed = provisionBodySchema.safeParse(body);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join(", ");
      return c.json(err(`Invalid request body: ${issues}`), 400);
    }

    try {
      await core.provision(id, parsed.data.values);
    } catch (cause) {
      if (cause instanceof MasterKeyRequiredError) {
        return c.json(
          err("Server has no master key configured; secrets cannot be stored."),
          503,
        );
      }
      if (cause instanceof PulseBridgeError) {
        return c.json(err(cause.message), 400);
      }
      throw cause;
    }

    const spec = await core.getProvisioningSpec(id);
    return c.json(spec);
  });

  app.get("/views", async (c) => {
    const views = await core.getViews();
    return c.json(views.map((v) => v.view));
  });

  app.get("/views/:id", async (c) => {
    const id = c.req.param("id");
    const view = await core.getView(id);
    if (!view) {
      return c.json(err(`View "${id}" not found.`), 404);
    }
    const limitParam = c.req.query("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 500;
    const items = Number.isFinite(limit) && limit > 0 && view.items.length > limit
      ? view.items.slice(0, limit)
      : view.items;
    return c.json({ ...view, items });
  });

  app.get("/records", (c) => {
    const types = core
      .listIntegrationManifests()
      .flatMap((m) => m.operations.map((op) => op.recordType))
      .filter((type, i, arr) => arr.indexOf(type) === i); // deduplicate
    return c.json(types);
  });

  app.get("/records/:type", async (c) => {
    const type = c.req.param("type");
    const records = await core.getRecordsByType(type);
    return c.json(records);
  });

  // Lists the outbound actions a plugin declares. Public — discovery only,
  // invoking is what requires auth.
  app.get("/plugins/:id/actions", (c) => {
    const id = c.req.param("id");
    const manifest = core.getIntegrationManifest(id);
    if (!manifest) {
      return c.json(err(`Plugin "${id}" is not registered.`), 404);
    }
    return c.json(manifest.actions ?? []);
  });

  // Invokes an action. Authed because actions can mutate the upstream system.
  app.post("/plugins/:id/actions/:actionId", authGuard, async (c) => {
    const id = c.req.param("id");
    const actionId = c.req.param("actionId");

    const manifest = core.getIntegrationManifest(id);
    if (!manifest) {
      return c.json(err(`Plugin "${id}" is not registered.`), 404);
    }
    if (!(manifest.actions ?? []).some((a) => a.id === actionId)) {
      return c.json(
        err(`Plugin "${id}" does not declare action "${actionId}".`),
        404,
      );
    }

    // Body is optional — an action may take no payload.
    let payload: unknown;
    const raw = await c.req.text();
    if (raw.trim() !== "") {
      try {
        payload = JSON.parse(raw);
      } catch {
        return c.json(err("Request body must be JSON."), 400);
      }
    }

    try {
      const result = await core.invokeAction(id, actionId, payload);
      return c.json({ data: result.data ?? null });
    } catch (cause) {
      const mapped = channelErrorResponse(c, cause);
      if (!mapped) throw cause;
      logger.warn("Action invocation failed.", {
        pluginId: id,
        actionId,
        error: cause instanceof Error ? cause.message : String(cause),
      });
      return mapped;
    }
  });

  // Receives an inbound webhook. Public: external systems can't carry the
  // server's API key, so authentication is the plugin's job — it verifies the
  // sender's signature from the raw body inside ingest(). The raw body is read
  // as text (never pre-parsed) so the signature check sees exactly what was sent.
  app.post("/plugins/:id/webhook", async (c) => {
    const id = c.req.param("id");

    const manifest = core.getIntegrationManifest(id);
    if (!manifest) {
      return c.json(err(`Plugin "${id}" is not registered.`), 404);
    }
    if (!manifest.webhook) {
      return c.json(err(`Plugin "${id}" does not accept webhooks.`), 404);
    }

    const raw = await c.req.text();
    if (raw.length > MAX_WEBHOOK_BODY_BYTES) {
      return c.json(err("Webhook payload too large."), 413);
    }

    try {
      const result = await core.ingest(id, {
        body: raw,
        headers: c.req.header(),
      });
      return c.json(result.data ?? { ok: true });
    } catch (cause) {
      const mapped = channelErrorResponse(c, cause);
      if (!mapped) throw cause;
      logger.warn("Webhook ingestion failed.", {
        pluginId: id,
        error: cause instanceof Error ? cause.message : String(cause),
      });
      return mapped;
    }
  });

  app.post("/plugins/install", authGuard, async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(err("Request body must be JSON."), 400);
    }

    const parsed = installBodySchema.safeParse(body);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join(", ");
      return c.json(err(`Invalid request body: ${issues}`), 400);
    }

    const entry = parsed.data;

    try {
      await npmInstall(entry.package, serverRoot);
      await syncPackageJsonVersion(serverRoot, entry.package);
    } catch (cause) {
      // npm's stderr can carry registry URLs and local paths — log it, don't
      // return it.
      logger.error("npm install failed.", {
        package: entry.package,
        error: cause instanceof Error ? cause.message : String(cause),
      });
      return c.json(
        err(
          `Failed to install "${entry.package}". See server logs for details.`,
        ),
        500,
      );
    }

    const addedToConfig = await addPluginToConfig(configPath, entry);

    return c.json({
      installed: entry.package,
      addedToConfig,
      next: "Call POST /restart to load the new plugin.",
    });
  });

  const uninstallBodySchema = z.object({ package: packageSpecSchema });

  app.delete("/plugins", authGuard, async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(err("Request body must be JSON."), 400);
    }

    const parsed = uninstallBodySchema.safeParse(body);
    if (!parsed.success) {
      return c.json(err('Body must be { "package": "..." }.'), 400);
    }

    const { package: packageName } = parsed.data;

    try {
      await npmUninstall(packageName, serverRoot);
      await removeFromPackageJson(serverRoot, packageName);
    } catch (cause) {
      logger.error("npm uninstall failed.", {
        package: packageName,
        error: cause instanceof Error ? cause.message : String(cause),
      });
      return c.json(
        err(
          `Failed to uninstall "${packageName}". See server logs for details.`,
        ),
        500,
      );
    }

    const removedFromConfig = await removePluginFromConfig(
      configPath,
      packageName,
    );

    return c.json({
      uninstalled: packageName,
      removedFromConfig,
      next: "Call POST /restart to apply changes.",
    });
  });

  app.get("/plugins/updates", authGuard, async (c) => {
    const updates = await checkForUpdates(configPath, serverRoot);
    return c.json(updates);
  });

  const updateBodySchema = z.union([
    z.object({ package: packageSpecSchema }),
    z.object({ all: z.literal(true) }),
  ]);

  app.post("/plugins/update", authGuard, async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(err("Request body must be JSON."), 400);
    }

    const parsed = updateBodySchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        err('Body must be { "package": "..." } or { "all": true }.'),
        400,
      );
    }

    const updates = await checkForUpdates(configPath, serverRoot);
    const toUpdate =
      "all" in parsed.data
        ? updates.filter((u) => u.hasUpdate).map((u) => u.package)
        : [parsed.data.package];

    if (toUpdate.length === 0) {
      return c.json({
        updated: [],
        message: "Everything is already up to date.",
      });
    }

    const succeeded: string[] = [];
    const failed: Array<{ package: string; error: string }> = [];

    for (const pkg of toUpdate) {
      try {
        await npmInstall(`${pkg}@latest`, serverRoot);
        await syncPackageJsonVersion(serverRoot, pkg);
        succeeded.push(pkg);
      } catch (cause) {
        logger.error("npm update failed.", {
          package: pkg,
          error: cause instanceof Error ? cause.message : String(cause),
        });
        failed.push({ package: pkg, error: "Update failed. See server logs." });
      }
    }

    return c.json({
      updated: succeeded,
      failed,
      next:
        succeeded.length > 0
          ? "Call POST /restart to apply changes."
          : undefined,
    });
  });

  app.post("/restart", authGuard, (c) => {
    // Hand off to graceful shutdown once this response is queued. Shutdown
    // drains in-flight work and calls each plugin's destroy(), then exits;
    // server.close() still lets this response finish, so no flush race. The
    // process does not relaunch itself — a supervisor (systemd, pm2, docker
    // restart policy) must bring it back up to load plugin changes installed
    // since boot. ESM caches already-imported plugin modules for the life of
    // the process, so a full restart is the only way to pick up updates.
    queueMicrotask(onRestart);
    return c.json({
      message: "Restart requested — draining in-flight work and exiting.",
    });
  });

  app.get("/events", (c) => {
    return streamSSE(c, async (stream) => {
      let alive = true;

      stream.onAbort(() => {
        alive = false;
      });

      const sender = async (event: string, data: unknown): Promise<void> => {
        try {
          await stream.writeSSE({ event, data: JSON.stringify(data) });
        } catch {
          alive = false;
        }
      };

      const unsub = sse.subscribe(sender);

      await sender("connected", {
        message: "Connected to PulseBridge event stream.",
        clients: sse.clientCount,
      });

      while (alive) {
        await stream.sleep(30_000);
        if (!alive) break;
        try {
          await stream.writeSSE({ event: "ping", data: "" });
        } catch {
          break;
        }
      }

      unsub();
    });
  });

  return app;
}
