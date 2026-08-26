import { useEffect, useState } from "react";

import type { PulseBridgeClient } from "../../api.ts";
import type { PluginInfo, ProvisioningSpec } from "../../types.ts";

interface SecretsPanelProps {
  client: PulseBridgeClient;
  plugins: PluginInfo[];
  apiKey: string;
}

export function SecretsPanel({ client, plugins, apiKey }: SecretsPanelProps) {
  const [specs, setSpecs] = useState<Record<string, ProvisioningSpec>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    for (const plugin of plugins) {
      client
        .getPluginSecrets(plugin.pluginId, apiKey)
        .then((spec) =>
          setSpecs((prev) => ({ ...prev, [plugin.pluginId]: spec })),
        )
        .catch((err: unknown) =>
          setErrors((prev) => ({
            ...prev,
            [plugin.pluginId]:
              err instanceof Error ? err.message : "Failed to load",
          })),
        );
    }
  }, [client, plugins, apiKey]);

  const pluginsWithSecrets = plugins.filter(
    (p) => (specs[p.pluginId]?.secrets.length ?? 0) > 0,
  );
  const loading = plugins.some(
    (p) => !specs[p.pluginId] && !errors[p.pluginId],
  );

  if (loading) {
    return <p className="text-xs text-muted italic">Loading secrets…</p>;
  }

  if (pluginsWithSecrets.length === 0) {
    return (
      <p className="text-xs text-muted italic">No plugins declare secrets.</p>
    );
  }

  return (
    <div className="grid gap-3">
      {pluginsWithSecrets.map((plugin) => (
        <PluginSecrets
          key={plugin.pluginId}
          plugin={plugin}
          spec={specs[plugin.pluginId] as ProvisioningSpec}
          client={client}
          apiKey={apiKey}
          onUpdate={(updated) =>
            setSpecs((prev) => ({ ...prev, [plugin.pluginId]: updated }))
          }
        />
      ))}
    </div>
  );
}

function PluginSecrets({
  plugin,
  spec,
  client,
  apiKey,
  onUpdate,
}: {
  plugin: PluginInfo;
  spec: ProvisioningSpec;
  client: PulseBridgeClient;
  apiKey: string;
  onUpdate: (spec: ProvisioningSpec) => void;
}) {
  return (
    <div className="rounded-xl border border-edge bg-panel p-4">
      <p className="m-0 mb-3 text-sm font-medium text-ink">{plugin.pluginId}</p>
      <div className="grid gap-2">
        {spec.secrets.map((secret) => (
          <SecretRow
            key={secret.key}
            pluginId={plugin.pluginId}
            secret={secret}
            client={client}
            apiKey={apiKey}
            onUpdate={onUpdate}
          />
        ))}
      </div>
    </div>
  );
}

function SecretRow({
  pluginId,
  secret,
  client,
  apiKey,
  onUpdate,
}: {
  pluginId: string;
  secret: ProvisioningSpec["secrets"][number];
  client: PulseBridgeClient;
  apiKey: string;
  onUpdate: (spec: ProvisioningSpec) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "ok" | "err">(
    "idle",
  );
  const [errMsg, setErrMsg] = useState("");

  const save = async () => {
    if (!value.trim()) return;
    setStatus("saving");
    try {
      const updated = await client.setPluginSecrets(
        pluginId,
        { [secret.key]: value.trim() },
        apiKey,
      );
      onUpdate(updated);
      setValue("");
      setEditing(false);
      setStatus("ok");
      setTimeout(() => setStatus("idle"), 2000);
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "Failed");
      setStatus("err");
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs text-ink">{secret.key}</code>
        {secret.required && (
          <span className="rounded border border-edge px-1.5 py-0.5 text-[10px] text-muted">
            required
          </span>
        )}
        <span
          className={`text-[10px] font-medium ${secret.isSet ? "text-green-400" : "text-muted"}`}
        >
          {secret.isSet ? "set" : "unset"}
        </span>
        <button
          onClick={() => setEditing((e) => !e)}
          className="text-[10px] text-blue-400 hover:underline"
        >
          {editing ? "cancel" : "set"}
        </button>
        {status === "ok" && (
          <span className="text-[10px] text-green-400">saved</span>
        )}
      </div>
      {editing && (
        <div className="mt-1.5 flex gap-2">
          <input
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="new value"
            autoComplete="new-password"
            className="flex-1 rounded border border-edge bg-panel-2 px-2 py-1 text-xs text-ink outline-none focus:border-blue-500"
            onKeyDown={(e) => e.key === "Enter" && void save()}
          />
          <button
            onClick={() => void save()}
            disabled={status === "saving" || !value.trim()}
            className="rounded border border-edge bg-panel-2 px-2 py-1 text-xs text-ink hover:border-blue-500 disabled:opacity-50"
          >
            {status === "saving" ? "…" : "save"}
          </button>
        </div>
      )}
      {status === "err" && (
        <p className="mt-1 text-[10px] text-red-400">{errMsg}</p>
      )}
    </div>
  );
}
