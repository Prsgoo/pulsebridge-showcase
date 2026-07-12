import type {
  AirQualityData,
  CveData,
  EconomicIndicatorData,
  InternetAnomalyData,
  MarketQuoteData,
  NewsEventData,
  PulseRecord,
  SolarFlareData,
} from "../../types.ts";
import { formatNumber, formatRelativeTime } from "../../lib/format.ts";

interface RecordCardProps {
  record: PulseRecord;
}

export function RecordCard({ record }: RecordCardProps) {
  return (
    <div className="flex flex-col rounded-xl border border-edge bg-panel p-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate font-mono text-[11px] text-muted">
          {record.entityKey}
        </span>
        <span className="shrink-0 text-[11px] text-muted">
          {formatRelativeTime(record.timestamp)}
        </span>
      </div>
      <RecordBody record={record} />
    </div>
  );
}

function RecordBody({ record }: RecordCardProps) {
  const data = record.data as unknown;
  switch (record.type) {
    case "air.quality":
      return <AirQualityBody data={data as AirQualityData} />;
    case "internet.anomaly":
      return <InternetAnomalyBody data={data as InternetAnomalyData} />;
    case "cve":
      return <CveBody data={data as CveData} />;
    case "news.event":
      return <NewsEventBody data={data as NewsEventData} />;
    case "space.solar-flare":
      return <SolarFlareBody data={data as SolarFlareData} />;
    case "economic.indicator":
      return <EconomicIndicatorBody data={data as EconomicIndicatorData} />;
    case "market.quote":
      return <MarketQuoteBody data={data as MarketQuoteData} />;
    default:
      return <GenericBody data={record.data} />;
  }
}

// ---------------------------------------------------------------------------
// Typed bodies
// ---------------------------------------------------------------------------

function AirQualityBody({ data }: { data: AirQualityData }) {
  return (
    <>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums">
          {formatNumber(data.value)}
        </span>
        <span className="text-xs text-muted">{data.unit}</span>
        <span className="ml-auto rounded-full bg-panel-2 px-2 py-0.5 text-[11px] uppercase tracking-wider">
          {data.parameter}
        </span>
      </div>
      <div className="mt-2 truncate text-sm">{data.locationName}</div>
      {data.country && <div className="text-xs text-muted">{data.country}</div>}
    </>
  );
}

const ANOMALY_LABELS: Record<InternetAnomalyData["anomalyType"], string> = {
  traffic: "Traffic",
  bgp_hijack: "BGP hijack",
};

function InternetAnomalyBody({ data }: { data: InternetAnomalyData }) {
  return (
    <>
      <div className="flex items-center gap-2">
        <Badge tone={data.anomalyType === "bgp_hijack" ? "red" : "blue"}>
          {ANOMALY_LABELS[data.anomalyType]}
        </Badge>
        {data.status && (
          <span className="text-xs text-muted">{data.status}</span>
        )}
      </div>
      {data.location && <div className="mt-2 text-sm">{data.location}</div>}
      {data.asn != null && (
        <div className="text-xs text-muted">
          AS{data.asn}
          {data.asnName ? ` · ${data.asnName}` : ""}
        </div>
      )}
      <div className="mt-2 text-[11px] text-muted">
        {formatRelativeTime(data.startDate)}
        {data.endDate ? ` → ${formatRelativeTime(data.endDate)}` : ""}
      </div>
    </>
  );
}

const SEVERITY_TONE: Record<string, BadgeTone> = {
  CRITICAL: "red",
  HIGH: "red",
  MEDIUM: "amber",
  LOW: "blue",
};

function CveBody({ data }: { data: CveData }) {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm">{data.cveId}</span>
        <Badge tone={SEVERITY_TONE[data.severity] ?? "muted"}>
          {data.severity} {formatNumber(data.baseScore)}
        </Badge>
      </div>
      <p className="mt-2 line-clamp-3 text-xs text-muted">{data.description}</p>
      <div className="mt-2 text-[11px] text-muted">
        published {formatRelativeTime(data.published)}
      </div>
    </>
  );
}

function NewsEventBody({ data }: { data: NewsEventData }) {
  return (
    <>
      {data.socialImage && (
        <img
          src={data.socialImage}
          alt=""
          className="mb-2 h-28 w-full rounded-lg object-cover"
          loading="lazy"
        />
      )}
      <a
        href={data.url}
        target="_blank"
        rel="noreferrer"
        className="line-clamp-2 text-sm font-medium hover:underline"
      >
        {data.title}
      </a>
      <div className="mt-2 truncate text-xs text-muted">
        {data.domain} · {data.sourceCountry} · {data.language}
      </div>
    </>
  );
}

function SolarFlareBody({ data }: { data: SolarFlareData }) {
  return (
    <>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold">{data.classType}</span>
        <span className="text-xs capitalize text-muted">{data.severity}</span>
      </div>
      <div className="mt-2 text-[11px] text-muted">
        peak {formatRelativeTime(data.peakTime ?? data.beginTime)}
      </div>
      {data.sourceLocation && (
        <div className="text-xs text-muted">
          {data.sourceLocation}
          {data.activeRegionNum ? ` · AR${data.activeRegionNum}` : ""}
        </div>
      )}
    </>
  );
}

function EconomicIndicatorBody({ data }: { data: EconomicIndicatorData }) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-sm">{data.seriesId}</span>
        <span className="text-2xl font-semibold tabular-nums">
          {formatNumber(data.value)}
        </span>
      </div>
      <div className="mt-2 text-[11px] text-muted">as of {data.date}</div>
    </>
  );
}

function MarketQuoteBody({ data }: { data: MarketQuoteData }) {
  const tone =
    data.changePercent > 0
      ? "text-green-400"
      : data.changePercent < 0
        ? "text-red-400"
        : "text-muted";

  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">{data.symbol}</span>
        <span className="text-base tabular-nums">
          ${formatNumber(data.currentPrice)}
        </span>
      </div>
      <div className={`mt-1 text-xs tabular-nums ${tone}`}>
        {data.change >= 0 ? "+" : ""}
        {formatNumber(data.change)} ({data.changePercent.toFixed(2)}%)
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Fallback — a key/value grid beats a raw JSON dump for unknown record types
// ---------------------------------------------------------------------------

function GenericBody({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).slice(0, 8);
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
      {entries.map(([key, value]) => (
        <div key={key} className="contents">
          <dt className="text-muted">{key}</dt>
          <dd className="m-0 min-w-0 truncate tabular-nums">
            {toDisplay(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function toDisplay(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

type BadgeTone = "red" | "amber" | "blue" | "muted";

const BADGE_TONE: Record<BadgeTone, string> = {
  red: "text-red-400 border-red-700",
  amber: "text-amber-400 border-amber-700",
  blue: "text-blue-400 border-blue-700",
  muted: "text-muted border-edge",
};

function Badge({
  tone,
  children,
}: {
  tone: BadgeTone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[11px] ${BADGE_TONE[tone]}`}
    >
      {children}
    </span>
  );
}
