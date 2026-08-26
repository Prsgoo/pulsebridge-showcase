import { useState } from "react";

import type { PulseBridgeClient } from "../../api.ts";
import type { PluginInfo } from "../../types.ts";
import { PluginLifecyclePanel } from "./PluginLifecyclePanel.tsx";
import { SecretsPanel } from "./SecretsPanel.tsx";

interface AdminPanelProps {
  client: PulseBridgeClient;
  plugins: PluginInfo[];
  apiKey: string | null;
  onApiKeyChange: (key: string | null) => void;
}

type Tab = "secrets" | "plugins";

export function AdminPanel({
  client,
  plugins,
  apiKey,
  onApiKeyChange,
}: AdminPanelProps) {
  if (!apiKey) {
    return <LoginForm client={client} onLogin={onApiKeyChange} />;
  }

  return (
    <AuthedPanel
      client={client}
      plugins={plugins}
      apiKey={apiKey}
      onLogout={() => onApiKeyChange(null)}
    />
  );
}

function LoginForm({
  client,
  onLogin,
}: {
  client: PulseBridgeClient;
  onLogin: (key: string) => void;
}) {
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = key.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      await client.getPluginUpdates(trimmed);
      onLogin(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid API key");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="max-w-sm">
      <p className="mb-3 text-sm text-muted">
        Enter the <code>PULSEBRIDGE_API_KEY</code> set on the server.
      </p>
      <div className="flex gap-2">
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="API key"
          autoComplete="current-password"
          className="flex-1 rounded-md border border-edge bg-panel-2 px-3 py-2 text-sm text-ink outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={loading || !key.trim()}
          className="rounded-md border border-edge bg-panel-2 px-4 py-2 text-sm text-ink hover:border-blue-500 disabled:opacity-50"
        >
          {loading ? "…" : "Sign in"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </form>
  );
}

function AuthedPanel({
  client,
  plugins,
  apiKey,
  onLogout,
}: {
  client: PulseBridgeClient;
  plugins: PluginInfo[];
  apiKey: string;
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<Tab>("secrets");

  const TABS: { id: Tab; label: string }[] = [
    { id: "secrets", label: "Secrets" },
    { id: "plugins", label: "Plugin Lifecycle" },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t.id ? "bg-panel-2 text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
        <button
          onClick={onLogout}
          className="ml-auto text-xs text-muted hover:text-ink"
        >
          Sign out
        </button>
      </div>

      {tab === "secrets" && (
        <SecretsPanel client={client} plugins={plugins} apiKey={apiKey} />
      )}
      {tab === "plugins" && (
        <PluginLifecyclePanel
          client={client}
          plugins={plugins}
          apiKey={apiKey}
        />
      )}
    </div>
  );
}
