import { useCallback, useMemo, useState } from "react";

import { PulseBridgeClient } from "./api.ts";
import { Header } from "./components/Header.tsx";
import { InternetAnomalies } from "./components/InternetAnomalies.tsx";
import { MarketQuotes } from "./components/MarketQuotes.tsx";
import { PluginList, PluginStatusSummary } from "./components/PluginList.tsx";
import { RecordCounts } from "./components/RecordCounts.tsx";
import { ViewPanel } from "./components/ViewPanel.tsx";
import type { InternetAnomalyData, MarketQuoteData } from "./types.ts";
import { useDashboard } from "./useDashboard.ts";
import { useRecords } from "./useRecords.ts";

const SERVER_PORT = 3000;
const STORAGE_KEY = "pb-base";

// Default to the same host the app is served from (so a phone hitting the
// machine's Tailscale IP targets that IP's server, not the phone itself).
const DEFAULT_BASE = `${location.protocol}//${location.hostname}:${SERVER_PORT}`;

export function App() {
  const [baseUrl, setBaseUrl] = useState(
    () => localStorage.getItem(STORAGE_KEY) ?? DEFAULT_BASE,
  );

  const { plugins, views, records, coreVersion, connection, reachable } =
    useDashboard(baseUrl);
  const anomalies = useRecords<InternetAnomalyData>(
    baseUrl,
    "internet.anomaly",
  );
  const quotes = useRecords<MarketQuoteData>(baseUrl, "market.quote");
  const client = useMemo(() => new PulseBridgeClient(baseUrl), [baseUrl]);

  const updateBaseUrl = useCallback((url: string) => {
    localStorage.setItem(STORAGE_KEY, url);
    setBaseUrl(url);
  }, []);

  const fetchRecords = useCallback(
    (type: string) => client.getRecords(type),
    [client],
  );

  return (
    <>
      <Header
        baseUrl={baseUrl}
        connection={connection}
        coreVersion={coreVersion}
        onBaseUrlChange={updateBaseUrl}
      />

      <main className="mx-auto grid max-w-[1200px] gap-6 p-4 sm:gap-8 sm:p-6">
        {!reachable && (
          <p className="rounded-lg border border-red-800 bg-red-950/40 px-4 py-3 text-red-300">
            Can't reach the server at <code>{baseUrl}</code>. Is it running?
          </p>
        )}

        <Section
          title="Plugins"
          collapsible
          defaultOpen={false}
          summary={<PluginStatusSummary plugins={plugins} />}
        >
          <PluginList plugins={plugins} />
        </Section>

        {anomalies.length > 0 && (
          <Section title="Internet Anomalies">
            <InternetAnomalies records={anomalies} />
          </Section>
        )}

        {quotes.length > 0 && (
          <Section title="Markets">
            <MarketQuotes records={quotes} />
          </Section>
        )}

        <Section title="Views">
          {views.length === 0 ? (
            <p className="text-muted italic">
              No views yet — waiting for processors to run.
            </p>
          ) : (
            <div className="grid gap-6">
              {views.map((view) => (
                <ViewPanel key={view.view} view={view} />
              ))}
            </div>
          )}
        </Section>

        <Section title="Records">
          <RecordCounts records={records} onSelect={fetchRecords} />
        </Section>
      </main>
    </>
  );
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
  summary?: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

function Section({
  title,
  children,
  summary,
  collapsible = false,
  defaultOpen = true,
}: SectionProps) {
  if (!collapsible) {
    return (
      <section className="min-w-0">
        <h2 className="m-0 mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
          {title}
        </h2>
        {children}
      </section>
    );
  }

  return (
    <section className="min-w-0">
      <details open={defaultOpen} className="group">
        <summary className="mb-3 flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
          <span className="text-[10px] text-muted transition-transform group-open:rotate-90">
            ▶
          </span>
          <h2 className="m-0 text-xs font-semibold uppercase tracking-wider text-muted">
            {title}
          </h2>
          {summary && (
            <span className="ml-auto group-open:hidden">{summary}</span>
          )}
        </summary>
        {children}
      </details>
    </section>
  );
}
