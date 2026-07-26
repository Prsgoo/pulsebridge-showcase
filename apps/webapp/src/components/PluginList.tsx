import type { PluginInfo, PluginStatus } from "../types.ts";
import { formatRelativeTime } from "../lib/format.ts";

const BADGE_STYLES: Record<PluginStatus, string> = {
  enabled: "text-green-400 border-green-700",
  disabled: "text-amber-400 border-amber-700",
  degraded: "text-amber-400 border-amber-700",
  error: "text-red-400 border-red-700",
};

interface PluginListProps {
  plugins: PluginInfo[];
}

const STATUS_ORDER: PluginStatus[] = [
  "enabled",
  "degraded",
  "disabled",
  "error",
];

export function PluginStatusSummary({ plugins }: PluginListProps) {
  const counts = STATUS_ORDER.map((status) => ({
    status,
    count: plugins.filter((plugin) => plugin.status === status).length,
  })).filter((entry) => entry.count > 0);

  return (
    <span className="flex items-center gap-1.5">
      {counts.map(({ status, count }) => (
        <span
          key={status}
          className={`rounded-full border px-2 py-0.5 text-[11px] tabular-nums ${BADGE_STYLES[status]}`}
        >
          {count} {status}
        </span>
      ))}
    </span>
  );
}

export function PluginList({ plugins }: PluginListProps) {
  if (plugins.length === 0) {
    return <p className="text-muted italic">No plugins registered.</p>;
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
      {plugins.map((plugin) => (
        <div
          key={plugin.pluginId}
          className="rounded-xl border border-edge bg-panel p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-baseline gap-1.5">
              <span className="min-w-0 break-all font-mono text-xs">
                {plugin.pluginId}
              </span>
              {plugin.version && (
                <span className="shrink-0 font-mono text-[11px] text-muted">
                  v{plugin.version}
                </span>
              )}
            </span>
            <span
              className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${BADGE_STYLES[plugin.status]}`}
            >
              {plugin.status}
            </span>
          </div>
          <div className="mt-2 text-xs text-muted">
            ran {formatRelativeTime(plugin.lastRunAt)}
          </div>
          {plugin.status !== "enabled" &&
            plugin.status !== "disabled" &&
            plugin.lastError && (
              <div className="mt-1.5 break-words text-xs text-red-400">
                {plugin.lastError}
              </div>
            )}
        </div>
      ))}
    </div>
  );
}
