import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import type { PulseLogger } from "pulsebridge";
import { loadConfig } from "./configLoader.js";
import { bootCore } from "./coreBootstrap.js";
import { SseManager } from "./sseManager.js";
import { RuleEngine } from "./ruleEngine.js";
import { buildApp } from "./server.js";

function buildSeismicPayload(item: unknown): {
  title: string;
  message: string;
  priority: "high" | "normal";
  tags: string[];
} {
  const ev = item as {
    magnitude: number;
    place: string;
    depth: number;
    significance: number;
    tsunami: boolean;
    alert: "green" | "yellow" | "orange" | "red" | null;
  };
  const priority =
    ev.alert === "red" || ev.alert === "orange" ? "high" : "normal";
  const parts = [`Depth: ${ev.depth}km`, `Sig: ${ev.significance}`];
  if (ev.tsunami) parts.push("Tsunami warning");
  return {
    title: `M${ev.magnitude.toFixed(1)} - ${ev.place}`,
    message: parts.join(" | "),
    priority,
    tags: ["earthquake"],
  };
}
import { createAuthGuard } from "./auth.js";
import { getInstalledVersion } from "./updateChecker.js";

function ts(): string {
  return new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
    hour12: false,
  });
}

const logger: PulseLogger = {
  info: (msg, meta?) =>
    console.log(
      `[${ts()}] INFO  ${msg}`,
      ...(meta !== undefined ? [meta] : []),
    ),
  warn: (msg, meta?) =>
    console.warn(
      `[${ts()}] WARN  ${msg}`,
      ...(meta !== undefined ? [meta] : []),
    ),
  error: (msg, meta?) =>
    console.error(
      `[${ts()}] ERROR ${msg}`,
      ...(meta !== undefined ? [meta] : []),
    ),
  debug: (_msg, _meta?) => {},
};

async function main(): Promise<void> {
  // Go up one level from dist/ to reach the project root where package.json lives.
  const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const configPath = resolve(process.argv[2] ?? "pulsebridge.config.json");
  logger.info(`Loading config from ${configPath}`);

  const config = await loadConfig(configPath);

  const coreVersion =
    (await getInstalledVersion("pulsebridge", serverRoot)) ?? "unknown";

  const { core } = await bootCore(config, logger);

  const sse = new SseManager();
  sse.attachToCore(core);

  const rules = new RuleEngine();

  rules.registerPredicate("significant-quake", (item) => {
    if (typeof item !== "object" || item === null) return false;
    const ev = item as { magnitude?: unknown };
    return typeof ev.magnitude === "number" && ev.magnitude >= 6.0;
  });

  rules.registerEffect("notify-ntfy", async (item, core) => {
    await core.invokeAction(
      "@prsgoo/integration-ntfy",
      "send",
      buildSeismicPayload(item),
    );
  });

  rules.attach(config.rules, core, sse, logger);

  // Assigned once serve() is called below; shutdown() is only ever invoked
  // after the server is listening, so the reference is always set by then.
  let server: ReturnType<typeof serve> | undefined;
  let shuttingDown = false;

  // Graceful shutdown: stop accepting connections, drain in-flight plugin work
  // and run plugin destroy(), then exit. /restart and SIGINT/SIGTERM share it.
  const shutdown = async (reason: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`Shutting down… (${reason})`);
    server?.close();
    await core.stop();
    logger.info("Stopped.");
    process.exit(0);
  };

  const auth = createAuthGuard(logger);
  const app = buildApp({
    core,
    sse,
    configPath,
    serverRoot,
    coreVersion,
    authGuard: auth.middleware,
    onRestart: () => void shutdown("restart requested"),
    logger,
    ...(config.server.corsOrigins
      ? { corsOrigins: config.server.corsOrigins }
      : {}),
  });

  if (!auth.isConfigured) {
    logger.warn(
      "PULSEBRIDGE_API_KEY is not configured — write endpoints (install, update, delete, restart) are disabled and return 503.",
    );
  }

  const { port, host } = config.server;

  server = serve({ fetch: app.fetch, port, hostname: host }, () => {
    logger.info(`PulseBridge server running.`, {
      url: `http://${host}:${port}`,
    });
    logger.info(`  GET /health       — platform status`);
    logger.info(`  GET /plugins      — plugin states`);
    logger.info(`  GET /views        — list available views`);
    logger.info(`  GET /views/:id    — get a view snapshot`);
    logger.info(`  GET /events       — SSE stream (view updates)`);
  });

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
