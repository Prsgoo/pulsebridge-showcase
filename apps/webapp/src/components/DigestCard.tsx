import { useState } from "react";

import type { DigestItem } from "../types.ts";
import { formatNumber } from "../lib/format.ts";

const ARROWS = { up: "▲", down: "▼", flat: "—" } as const;

interface DigestCardProps {
  item: DigestItem;
}

export function DigestCard({ item }: DigestCardProps) {
  const { weather, crypto, spaceOfTheDay } = item;
  const [imageOk, setImageOk] = useState(true);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <article className="overflow-hidden rounded-xl border border-edge bg-panel md:row-span-2">
        {spaceOfTheDay.imageUrl && imageOk && (
          <div className="aspect-video w-full overflow-hidden">
            <img
              src={spaceOfTheDay.imageUrl}
              alt={spaceOfTheDay.title}
              className="h-full w-full object-cover"
              onError={() => setImageOk(false)}
            />
          </div>
        )}
        <div className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted">
            Space · {spaceOfTheDay.date}
          </div>
          <h4 className="mt-1 font-semibold">{spaceOfTheDay.title}</h4>
          <p className="mt-2 line-clamp-4 text-xs leading-relaxed text-muted">
            {spaceOfTheDay.explanation}
          </p>
          {spaceOfTheDay.copyright && (
            <div className="mt-2 text-[10px] text-muted">
              © {spaceOfTheDay.copyright}
            </div>
          )}
        </div>
      </article>

      <Panel title="Weather" subtitle={`${weather.locationCount} locations`}>
        <ul className="grid gap-1.5">
          {weather.highlights.map((h) => (
            <li
              key={`${h.city}-${h.country}`}
              className="flex items-baseline justify-between gap-2"
            >
              <span className="truncate">
                {h.city}
                <span className="ml-1 text-xs text-muted">{h.country}</span>
              </span>
              <span className="shrink-0 tabular-nums">
                {Math.round(h.temp)}°
                <span className="ml-1.5 text-xs capitalize text-muted">
                  {h.description}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Crypto" subtitle={`${crypto.coinCount} coins`}>
        <ul className="grid gap-1.5">
          {crypto.highlights.map((c) => {
            const tone =
              c.change24hPercent > 0
                ? "text-green-400"
                : c.change24hPercent < 0
                  ? "text-red-400"
                  : "text-muted";
            return (
              <li
                key={c.symbol}
                className="flex items-baseline justify-between gap-2"
              >
                <span className="font-semibold">{c.symbol}</span>
                <span className="shrink-0 tabular-nums">
                  ${formatNumber(c.priceUsd)}
                  <span className={`ml-1.5 text-xs ${tone}`}>
                    {ARROWS[c.direction]} {c.change24hPercent.toFixed(2)}%
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-xl border border-edge bg-panel p-4">
      <div className="mb-3 flex items-baseline gap-2">
        <h4 className="m-0 text-sm font-semibold">{title}</h4>
        <span className="text-xs text-muted">{subtitle}</span>
      </div>
      {children}
    </article>
  );
}
