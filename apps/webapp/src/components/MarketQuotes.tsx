import type { MarketQuoteData, PulseRecord } from "../types.ts";
import { formatNumber } from "../lib/format.ts";

interface MarketQuotesProps {
  records: ReadonlyArray<PulseRecord<MarketQuoteData>>;
}

export function MarketQuotes({ records }: MarketQuotesProps) {
  const quotes = [...records].sort((a, b) =>
    a.data.symbol.localeCompare(b.data.symbol),
  );

  return (
    <div className="overflow-hidden rounded-xl border border-edge bg-panel">
      <div className="overflow-x-auto">
        {quotes.map((record, index) => (
          <QuoteRow
            key={record.entityKey}
            data={record.data}
            divider={index > 0}
          />
        ))}
      </div>
    </div>
  );
}

function QuoteRow({
  data,
  divider,
}: {
  data: MarketQuoteData;
  divider: boolean;
}) {
  const tone =
    data.changePercent > 0
      ? "text-green-400"
      : data.changePercent < 0
        ? "text-red-400"
        : "text-muted";

  return (
    <div
      className={`grid min-w-[26rem] grid-cols-[4rem_5.5rem_1fr_5rem] items-center gap-3 px-4 py-2.5 ${
        divider ? "border-t border-edge" : ""
      }`}
    >
      <span className="font-semibold">{data.symbol}</span>
      <span className="text-right tabular-nums">
        ${formatNumber(data.currentPrice)}
      </span>
      <DayRange data={data} />
      <span className={`text-right text-xs tabular-nums ${tone}`}>
        {data.changePercent >= 0 ? "+" : ""}
        {data.changePercent.toFixed(2)}%
      </span>
    </div>
  );
}

function DayRange({ data }: { data: MarketQuoteData }) {
  const span = data.high - data.low;
  const position =
    span > 0 ? ((data.currentPrice - data.low) / span) * 100 : 50;
  const clamped = Math.min(100, Math.max(0, position));

  return (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-right text-[10px] tabular-nums text-muted">
        {formatNumber(data.low)}
      </span>
      <div className="relative h-1.5 flex-1 rounded-full bg-panel-2">
        <span
          className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-400"
          style={{ left: `${clamped}%` }}
        />
      </div>
      <span className="w-12 shrink-0 text-[10px] tabular-nums text-muted">
        {formatNumber(data.high)}
      </span>
    </div>
  );
}
