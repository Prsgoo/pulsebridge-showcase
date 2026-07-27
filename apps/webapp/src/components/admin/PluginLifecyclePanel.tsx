import { useState } from "react";

import type { PulseBridgeClient } from "../../api.ts";
import type { PluginInfo, UpdateInfo } from "../../types.ts";

interface PluginLifecyclePanelProps {
  client: PulseBridgeClient;
  plugins: PluginInfo[];
  apiKey: string;
}

export function PluginLifecyclePanel({
  client,
  plugins,
  apiKey,
}: PluginLifecyclePanelProps) {
  const [updates, setUpdates] = useState<UpdateInfo[] | null>(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [installPkg, setInstallPkg] = useState("");
  const [installStatus, setInstallStatus] = useState<
    "idle" | "running" | "ok" | "err"
  >("idle");
  const [installMsg, setInstallMsg] = useState("");
  const [uninstallStatus, setUninstallStatus] = useState<
    Record<string, "idle" | "running" | "ok" | "err">
  >({});
  const [restartStep, setRestartStep] = useState<
    "idle" | "confirm" | "running"
  >("idle");
  const [restartMsg, setRestartMsg] = useState("");

  const checkUpdates = async () => {
    setCheckingUpdates(true);
    try {
      setUpdates(await client.getPluginUpdates(apiKey));
    } catch {
      setUpdates([]);
    } finally {
      setCheckingUpdates(false);
    }
  };

  const install = async () => {
    const pkg = installPkg.trim();
    if (!pkg) return;
    setInstallStatus("running");
    setInstallMsg("");
    try {
      await client.installPlugin(pkg, apiKey);
      setInstallStatus("ok");
      setInstallMsg(`Installed. Call restart to load it.`);
      setInstallPkg("");
    } catch (err) {
      setInstallStatus("err");
      setInstallMsg(err instanceof Error ? err.message : "Install failed");
    }
  };

  const uninstall = async (pluginId: string) => {
    setUninstallStatus((prev) => ({ ...prev, [pluginId]: "running" }));
    try {
      await client.uninstallPlugin(pluginId, apiKey);
      setUninstallStatus((prev) => ({ ...prev, [pluginId]: "ok" }));
    } catch {
      setUninstallStatus((prev) => ({ ...prev, [pluginId]: "err" }));
    }
  };

  const restart = async () => {
    setRestartStep("running");
    try {
      const res = await client.restartServer(apiKey);
      setRestartMsg(res.message);
    } catch (err) {
      setRestartMsg(err instanceof Error ? err.message : "Restart failed");
      setRestartStep("idle");
    }
  };

  const updateMap = new Map(updates?.map((u) => [u.package, u]) ?? []);

  return (
    <div className="grid gap-6">
      <div>
        <div className="mb-2 flex items-center gap-3">
          <h3 className="m-0 text-xs font-semibold uppercase tracking-wider text-muted">
            Installed plugins
          </h3>
          <button
            onClick={() => void checkUpdates()}
            disabled={checkingUpdates}
            className="rounded border border-edge bg-panel-2 px-2 py-0.5 text-[10px] text-ink hover:border-blue-500 disabled:opacity-50"
          >
            {checkingUpdates ? "Checking…" : "Check for updates"}
          </button>
        </div>
        <div className="grid gap-2">
          {plugins.map((plugin) => {
            const update = updateMap.get(plugin.pluginId);
            const uStatus = uninstallStatus[plugin.pluginId] ?? "idle";
            return (
              <div
                key={plugin.pluginId}
                className="flex items-center gap-3 rounded-lg border border-edge bg-panel px-3 py-2"
              >
                <span className="flex-1 truncate text-sm text-ink">
                  {plugin.pluginId}
                </span>
                {plugin.version && (
                  <span className="text-[10px] text-muted">
                    v{plugin.version}
                  </span>
                )}
                {update?.hasUpdate && (
                  <span className="rounded border border-blue-500/40 bg-blue-500/10 px-1.5 py-0.5 text-[10px] text-blue-400">
                    → {update.latest}
                  </span>
                )}
                {uStatus === "ok" ? (
                  <span className="text-[10px] text-green-400">removed</span>
                ) : uStatus === "err" ? (
                  <span className="text-[10px] text-red-400">failed</span>
                ) : (
                  <button
                    onClick={() => void uninstall(plugin.pluginId)}
                    disabled={uStatus === "running"}
                    className="text-[10px] text-muted hover:text-red-400 disabled:opacity-50"
                  >
                    {uStatus === "running" ? "…" : "remove"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="m-0 mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
          Install plugin
        </h3>
        <div className="flex gap-2">
          <input
            value={installPkg}
            onChange={(e) => setInstallPkg(e.target.value)}
            placeholder="@scope/package-name"
            className="flex-1 rounded border border-edge bg-panel-2 px-3 py-1.5 text-sm text-ink outline-none focus:border-blue-500"
            onKeyDown={(e) => e.key === "Enter" && void install()}
          />
          <button
            onClick={() => void install()}
            disabled={installStatus === "running" || !installPkg.trim()}
            className="rounded border border-edge bg-panel-2 px-3 py-1.5 text-sm text-ink hover:border-blue-500 disabled:opacity-50"
          >
            {installStatus === "running" ? "Installing…" : "Install"}
          </button>
        </div>
        {installMsg && (
          <p
            className={`mt-1.5 text-xs ${installStatus === "err" ? "text-red-400" : "text-green-400"}`}
          >
            {installMsg}
          </p>
        )}
      </div>

      <div>
        <h3 className="m-0 mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
          Server
        </h3>
        {restartStep === "running" ? (
          <p className="text-xs text-muted">{restartMsg || "Restarting…"}</p>
        ) : restartStep === "confirm" ? (
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted">
              This will cause a brief outage. Proceed?
            </span>
            <button
              onClick={() => void restart()}
              className="rounded border border-red-700 bg-red-950/40 px-3 py-1 text-xs text-red-300 hover:bg-red-900/40"
            >
              Restart now
            </button>
            <button
              onClick={() => setRestartStep("idle")}
              className="text-xs text-muted hover:text-ink"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setRestartStep("confirm")}
            className="rounded border border-edge bg-panel-2 px-3 py-1.5 text-sm text-ink hover:border-red-500 hover:text-red-400"
          >
            Restart server
          </button>
        )}
      </div>
    </div>
  );
}
