import type { ViewSnapshot } from "../types.ts";
import {
  isDigestItem,
  isFlightFeedItem,
  isNewsFeedItem,
  isSeismicItem,
  isTickerItem,
  isWeatherItem,
  isWildfireFeedItem,
} from "../types.ts";
import { DigestCard } from "./DigestCard.tsx";
import { FlightMap } from "./FlightMap.tsx";
import { NewsFeedPanel } from "./NewsFeedPanel.tsx";
import { SeismicMap } from "./SeismicMap.tsx";
import { TickerCard } from "./TickerCard.tsx";
import { WeatherCard } from "./WeatherCard.tsx";
import { WildfireMap } from "./WildfireMap.tsx";

interface ViewPanelProps {
  view: ViewSnapshot;
}

const CARD_GRID = "grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3";

export function ViewPanel({ view }: ViewPanelProps) {
  const items = Array.isArray(view.items) ? view.items : [];

  return (
    <section>
      <div className="mb-3 flex items-baseline gap-2">
        <h3 className="m-0 text-sm font-semibold">{view.view}</h3>
        <span className="text-xs text-muted">{items.length} items</span>
      </div>
      {renderItems(items)}
    </section>
  );
}

function renderItems(items: unknown[]) {
  if (items.length === 0) {
    return <p className="text-muted italic">No items yet.</p>;
  }

  if (items.every(isTickerItem)) {
    return (
      <div className={CARD_GRID}>
        {items.map((item) => (
          <TickerCard key={item.coinId} item={item} />
        ))}
      </div>
    );
  }

  if (items.every(isWeatherItem)) {
    return (
      <div className={CARD_GRID}>
        {items.map((item) => (
          <WeatherCard key={`${item.city}-${item.country}`} item={item} />
        ))}
      </div>
    );
  }

  if (items.every(isSeismicItem)) {
    return <SeismicMap items={items} />;
  }

  if (items.every(isNewsFeedItem)) {
    return <NewsFeedPanel items={items} />;
  }

  if (items.every(isWildfireFeedItem)) {
    return <WildfireMap items={items} />;
  }

  if (items.every(isFlightFeedItem)) {
    return <FlightMap items={items} />;
  }

  if (items.every(isDigestItem)) {
    return (
      <div className="grid gap-4">
        {items.map((item, index) => (
          <DigestCard key={item.spaceOfTheDay.date ?? index} item={item} />
        ))}
      </div>
    );
  }

  return (
    <pre className="m-0 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-edge bg-panel-2 p-3 text-xs">
      {JSON.stringify(items, null, 2)}
    </pre>
  );
}
