import type { WeatherItem } from "../types.ts";
import { formatNumber } from "../lib/format.ts";

const ICON_BASE = "https://openweathermap.org/img/wn";

interface WeatherCardProps {
  item: WeatherItem;
}

export function WeatherCard({ item }: WeatherCardProps) {
  return (
    <div className="rounded-xl border border-edge bg-panel p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-semibold">{item.city}</div>
          <div className="text-xs text-muted">{item.country}</div>
        </div>
        <img
          src={`${ICON_BASE}/${item.icon}@2x.png`}
          alt={item.description}
          width={56}
          height={56}
          className="-my-2 shrink-0"
        />
      </div>

      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-3xl font-semibold tabular-nums">
          {Math.round(item.temp)}°
        </span>
        <span className="truncate text-xs capitalize text-muted">
          {item.description}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <Stat label="feels" value={`${Math.round(item.feelsLike)}°`} />
        <Stat label="humidity" value={`${item.humidity}%`} />
        <Stat label="wind" value={`${formatNumber(item.windSpeed)} m/s`} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-panel-2 py-1.5">
      <div className="tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted">
        {label}
      </div>
    </div>
  );
}
