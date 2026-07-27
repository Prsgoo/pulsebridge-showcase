import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { PulseBridgeCore, PulseLogger } from "pulsebridge";

const STATUS_EXPORT_INTERVAL_MS = 30 * 60 * 1000;

function logPath(serverRoot: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return join(serverRoot, "logs", `stress-${date}.jsonl`);
}

async function writeSnapshot(
  core: PulseBridgeCore,
  logger: PulseLogger,
  serverRoot: string,
  startedAt: Date,
): Promise<void> {
  const health = core.getHealth();
  const pluginStates = core.listPluginStates();
  const views = await core.getViews();

  const pluginCounts: Record<string, number> = {};
  for (const p of pluginStates) {
    pluginCounts[p.status] = (pluginCounts[p.status] ?? 0) + 1;
  }

  const unhealthyPlugins = pluginStates
    .filter((p) => p.status !== "enabled" && p.status !== "disabled")
    .map((p) => ({
      pluginId: p.pluginId,
      status: p.status,
      lastError: p.lastError ?? null,
      lastRunAt: p.lastRunAt ?? null,
    }));

  const viewSummary = views.map((v) => ({
    view: v.view,
    itemCount: v.items.length,
    generatedAt: v.generatedAt,
  }));

  const entry = {
    timestamp: new Date().toISOString(),
    uptimeSecs: Math.round((Date.now() - startedAt.getTime()) / 1000),
    health: { status: health.status, running: health.running },
    pluginCounts,
    totalPlugins: pluginStates.length,
    unhealthyPlugins,
    views: viewSummary,
  };

  const file = logPath(serverRoot);
  await mkdir(join(serverRoot, "logs"), { recursive: true });
  await appendFile(file, JSON.stringify(entry) + "\n", "utf-8");

  logger.info("Status snapshot written.", {
    file,
    health: health.status,
    pluginCounts,
    views: viewSummary.length,
    unhealthy: unhealthyPlugins.length,
  });
}

export function startStatusExporter(
  core: PulseBridgeCore,
  logger: PulseLogger,
  serverRoot: string,
): () => void {
  const startedAt = new Date();

  const run = () => {
    void writeSnapshot(core, logger, serverRoot, startedAt).catch(
      (err: unknown) => {
        logger.error("Status export failed.", { error: String(err) });
      },
    );
  };

  // Write an initial snapshot right away so there's always at least one entry.
  run();

  const timer = setInterval(run, STATUS_EXPORT_INTERVAL_MS);
  return () => clearInterval(timer);
}
