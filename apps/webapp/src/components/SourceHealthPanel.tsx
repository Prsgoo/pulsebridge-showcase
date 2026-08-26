import type { PluginInfo, PluginStatus } from "../types.ts";
import { formatRelativeTime } from "../lib/format.ts";

interface SourceHealthPanelProps {
  plugins: PluginInfo[];
}

const STATUS_DOT: Record<PluginStatus, string> = {
  enabled: "bg-green-500 shadow-[0_0_6px] shadow-green-500",
  degraded: "bg-amber-400",
  error: "bg-red-500",
  disabled: "bg-muted",
};

const STATUS_LABEL: Record<PluginStatus, string> = {
  enabled: "live",
  degraded: "degraded",
  error: "error",
  disabled: "disabled",
};

const STATUS_TEXT: Record<PluginStatus, string> = {
  enabled: "text-green-400",
  degraded: "text-amber-400",
  error: "text-red-400",
  disabled: "text-muted",
};

const STATUS_ORDER: Record<PluginStatus, number> = {
  enabled: 0,
  degraded: 1,
  error: 2,
  disabled: 3,
};

export function SourceHealthPanel({ plugins }: SourceHealthPanelProps) {
  const integrations = plugins
    .filter((p) => p.kind === "integration")
    .slice()
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  if (integrations.length === 0) {
    return <p className="text-muted italic">No integrations registered.</p>;
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
      {integrations.map((plugin) => (
        <SourceCard key={plugin.pluginId} plugin={plugin} />
      ))}
    </div>
  );
}

function SourceCard({ plugin }: { plugin: PluginInfo }) {
  return (
    <div className="rounded-xl border border-edge bg-panel p-4">
      <div className="flex items-start gap-3">
        <span
          className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT[plugin.status]}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="m-0 truncate text-sm font-medium text-ink">
              {plugin.pluginId}
            </p>
            <span
              className={`shrink-0 text-xs font-medium ${STATUS_TEXT[plugin.status]}`}
            >
              {STATUS_LABEL[plugin.status]}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-[10px] text-muted">
            {plugin.version && <span>v{plugin.version}</span>}
            {plugin.lastRunAt && (
              <span>ran {formatRelativeTime(plugin.lastRunAt)}</span>
            )}
          </div>
          {plugin.lastError && plugin.status !== "enabled" && (
            <p className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-red-400">
              {plugin.lastError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
