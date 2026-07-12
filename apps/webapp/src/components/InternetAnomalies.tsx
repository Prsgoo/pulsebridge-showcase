import type { InternetAnomalyData, PulseRecord } from "../types.ts";
import { formatRelativeTime } from "../lib/format.ts";

interface InternetAnomaliesProps {
  records: ReadonlyArray<PulseRecord<InternetAnomalyData>>;
}

const HOTSPOT_LIMIT = 6;
const FEED_LIMIT = 8;

export function InternetAnomalies({ records }: InternetAnomaliesProps) {
  const traffic = records.filter((r) => r.data.anomalyType === "traffic");
  const bgp = records.filter((r) => r.data.anomalyType === "bgp_hijack");
  const hotspots = topCountries(traffic);
  const recent = [...records].sort(byStartDateDesc).slice(0, FEED_LIMIT);

  return (
    <div className="grid gap-4 rounded-xl border border-edge bg-panel p-4 lg:grid-cols-[1fr_1.2fr]">
      <div className="min-w-0">
        <div className="mb-3 flex gap-2">
          <Stat label="total" value={records.length} />
          <Stat label="traffic" value={traffic.length} />
          <Stat label="bgp" value={bgp.length} />
        </div>
        <Hotspots hotspots={hotspots} />
      </div>
      <Feed records={recent} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex-1 rounded-lg bg-panel-2 py-2 text-center">
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted">
        {label}
      </div>
    </div>
  );
}

interface CountryCount {
  country: string;
  count: number;
}

function Hotspots({ hotspots }: { hotspots: CountryCount[] }) {
  if (hotspots.length === 0) {
    return <p className="text-xs text-muted italic">No located anomalies.</p>;
  }

  const max = hotspots[0]?.count ?? 1;

  return (
    <div>
      <div className="mb-1.5 text-[10px] uppercase tracking-wider text-muted">
        Traffic hotspots
      </div>
      <div className="grid gap-1.5">
        {hotspots.map(({ country, count }) => (
          <div key={country} className="flex items-center gap-2 text-xs">
            <span className="w-28 shrink-0 truncate">{country}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-panel-2">
              <div
                className="h-full rounded-full bg-blue-500"
                style={{ width: `${(count / max) * 100}%` }}
              />
            </div>
            <span className="w-5 shrink-0 text-right tabular-nums text-muted">
              {count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Feed({
  records,
}: {
  records: ReadonlyArray<PulseRecord<InternetAnomalyData>>;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1.5 text-[10px] uppercase tracking-wider text-muted">
        Recent
      </div>
      <ul className="m-0 grid list-none gap-1.5 p-0">
        {records.map((record) => (
          <FeedRow key={record.entityKey} record={record} />
        ))}
      </ul>
    </div>
  );
}

function FeedRow({ record }: { record: PulseRecord<InternetAnomalyData> }) {
  const { data } = record;
  const isHijack = data.anomalyType === "bgp_hijack";
  const subject = isHijack
    ? data.asn != null
      ? `AS${data.asn}${data.asnName ? ` · ${data.asnName}` : ""}`
      : "unknown ASN"
    : (data.location ?? "global");

  return (
    <li className="flex items-center gap-2 rounded-lg bg-panel-2 px-2.5 py-1.5 text-xs">
      <span
        className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] ${
          isHijack
            ? "border-red-700 text-red-400"
            : "border-blue-700 text-blue-400"
        }`}
      >
        {isHijack ? "BGP" : "Traffic"}
      </span>
      <span className="min-w-0 flex-1 truncate">{subject}</span>
      <span className="shrink-0 text-[11px] text-muted">
        {formatRelativeTime(data.startDate)}
      </span>
    </li>
  );
}

function topCountries(
  records: ReadonlyArray<PulseRecord<InternetAnomalyData>>,
): CountryCount[] {
  const counts = new Map<string, number>();
  for (const record of records) {
    const country = record.data.location;
    if (!country) continue;
    counts.set(country, (counts.get(country) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, HOTSPOT_LIMIT);
}

function byStartDateDesc(
  a: PulseRecord<InternetAnomalyData>,
  b: PulseRecord<InternetAnomalyData>,
): number {
  return (
    new Date(b.data.startDate).getTime() - new Date(a.data.startDate).getTime()
  );
}
