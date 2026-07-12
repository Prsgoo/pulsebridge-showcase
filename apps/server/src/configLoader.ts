import { readFile } from "node:fs/promises";
import { z } from "zod";

// Secrets are no longer part of the config file. Plugins declare their secret
// keys in their manifest; the host provisions values out-of-band (env vars,
// `PB_SECRET__*`) and the core encrypts them at rest. See coreBootstrap.ts.

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const pluginEntrySchema = z.object({
  /** npm package name, e.g. "@prsgoo/integration-openweather" */
  package: z.string().min(1),
  /**
   * Named export to use as the plugin class.
   * When omitted the loader scans all exports and picks the first plugin found.
   */
  entry: z.string().optional(),
  /** Config passed to plugin.configure(). Shape depends on the plugin. */
  config: z.record(z.string(), z.unknown()).optional(),
  /** Override the plugin's default poll interval (integration plugins only). */
  pollIntervalMs: z.number().int().positive().optional(),
});

const serverConfigSchema = z.object({
  server: z
    .object({
      port: z.number().int().min(1).max(65535).default(3000),
      // Bind to loopback by default — exposing on all interfaces (0.0.0.0)
      // must be an explicit opt-in. Containers set "0.0.0.0" in their config.
      host: z.string().default("127.0.0.1"),
      /**
       * Allowed CORS origins. Omit to allow any origin (convenient for local
       * dashboards); set an explicit list to lock cross-origin access down in
       * production.
       */
      corsOrigins: z.array(z.string()).optional(),
    })
    .default({ port: 3000, host: "127.0.0.1" }),
  core: z
    .object({
      executionTimeoutMs: z.number().int().positive().optional(),
      processorTimeoutMs: z.number().int().positive().optional(),
      maxConsecutiveFailures: z.number().int().positive().optional(),
    })
    .default({}),
  /**
   * Redis connection. When present, the platform uses Redis-backed record,
   * view, and state stores instead of the default in-memory stores.
   * Omit entirely to run without Redis (data is lost on restart).
   */
  redis: z
    .object({
      url: z.string().url(),
    })
    .optional(),
  plugins: z.array(pluginEntrySchema).min(1),
});

export type ServerConfig = z.infer<typeof serverConfigSchema>;
export type PluginEntry = z.infer<typeof pluginEntrySchema>;

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loadConfig(configPath: string): Promise<ServerConfig> {
  let raw: string;
  try {
    raw = await readFile(configPath, "utf-8");
  } catch (cause) {
    throw new Error(`Cannot read config file: ${configPath}`, { cause });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new Error(`Config file is not valid JSON: ${configPath}`, { cause });
  }

  const result = serverConfigSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Config validation failed:\n${issues}`);
  }

  return result.data;
}
