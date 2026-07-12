import type { TickerItem } from "../types.ts";
import { formatNumber } from "../lib/format.ts";

const ARROWS: Record<TickerItem["direction"], string> = {
  up: "▲",
  down: "▼",
  flat: "—",
};

interface TickerCardProps {
  item: TickerItem;
}

export function TickerCard({ item }: TickerCardProps) {
  const change = Number(item.change24hPercent ?? 0);
  const tone =
    change > 0 ? "text-green-400" : change < 0 ? "text-red-400" : "text-muted";

  return (
    <div className="rounded-xl border border-edge bg-panel p-4">
      <div className="flex items-baseline justify-between">
        <div>
          <span className="font-semibold">{item.symbol}</span>
          <span className="ml-1.5 text-xs text-muted">{item.name}</span>
        </div>
        <span className="text-base tabular-nums">
          ${formatNumber(item.priceUsd)}
        </span>
      </div>
      <div className={`mt-1 text-xs tabular-nums ${tone}`}>
        {ARROWS[item.direction]} {change.toFixed(2)}% (24h)
      </div>
    </div>
  );
}
