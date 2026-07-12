import { useState } from "react";

import type { ConnectionState } from "../types.ts";

const DOT_STYLES: Record<ConnectionState, string> = {
  connecting: "bg-muted",
  live: "bg-green-500 shadow-[0_0_8px] shadow-green-500",
  down: "bg-red-500",
};

const DOT_LABELS: Record<ConnectionState, string> = {
  connecting: "connecting…",
  live: "live",
  down: "disconnected — retrying",
};

interface HeaderProps {
  baseUrl: string;
  connection: ConnectionState;
  coreVersion: string | null;
  onBaseUrlChange: (url: string) => void;
}

export function Header({
  baseUrl,
  connection,
  coreVersion,
  onBaseUrlChange,
}: HeaderProps) {
  const [draft, setDraft] = useState(baseUrl);

  const commit = () => {
    const next = draft.trim().replace(/\/$/, "");
    if (next && next !== baseUrl) onBaseUrlChange(next);
  };

  return (
    <header className="sticky top-0 z-10 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-edge bg-panel px-4 py-3 sm:px-6 sm:py-4">
      <div className="flex items-baseline gap-2">
        <h1 className="m-0 text-base font-semibold sm:text-lg">
          ⚡ PulseBridge
        </h1>
        {coreVersion && (
          <span className="font-mono text-xs text-muted" title="core version">
            v{coreVersion}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm text-muted">
        <span
          className={`h-2.5 w-2.5 rounded-full ${DOT_STYLES[connection]}`}
        />
        <span>{DOT_LABELS[connection]}</span>
      </div>

      <div className="hidden flex-1 sm:block" />

      <label className="flex w-full items-center gap-2 text-sm text-muted sm:w-auto">
        server
        <input
          className="min-w-0 flex-1 rounded-md border border-edge bg-panel-2 px-2.5 py-1.5 text-ink outline-none focus:border-blue-500 sm:w-64 sm:flex-none"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
        />
      </label>
    </header>
  );
}
