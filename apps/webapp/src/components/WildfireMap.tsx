import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";

import "leaflet/dist/leaflet.css";

import { MapResizer } from "../lib/MapResizer.tsx";
import type { WildfireFeedItem } from "../types.ts";

const MAP_CENTER: [number, number] = [20, 0];
const MAP_ZOOM = 2;
const MAP_HEIGHT = 480;

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "#ef4444",
  nominal: "#f97316",
  low: "#eab308",
};
const DEFAULT_COLOR = "#94a3b8";

interface WildfireMapProps {
  items: WildfireFeedItem[];
}

export function WildfireMap({ items }: WildfireMapProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-edge">
      <MapContainer
        center={MAP_CENTER}
        zoom={MAP_ZOOM}
        scrollWheelZoom
        style={{ height: MAP_HEIGHT, width: "100%", background: "#0b1220" }}
      >
        <MapResizer />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        {items.map((item) => (
          <CircleMarker
            key={item.id}
            center={[item.latitude, item.longitude]}
            radius={Math.max(3, item.frp / 15)}
            pathOptions={{
              color: confidenceColor(item.confidence),
              fillColor: confidenceColor(item.confidence),
              fillOpacity: 0.7,
              weight: 1,
            }}
          >
            <Popup>
              <WildfirePopup item={item} />
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      <Legend />
    </div>
  );
}

function WildfirePopup({ item }: { item: WildfireFeedItem }) {
  return (
    <div className="space-y-1 text-xs">
      <div className="text-sm font-semibold">
        {item.satellite} · {item.instrument}
      </div>
      <div>Brightness: {item.brightness.toFixed(1)} K</div>
      <div>FRP: {item.frp.toFixed(1)} MW</div>
      <div>Confidence: {item.confidence}</div>
      <div>
        {item.acquisitionDate} {item.acquisitionTime}
      </div>
      <div>
        {item.latitude.toFixed(3)}, {item.longitude.toFixed(3)}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-edge bg-panel px-3 py-2 text-[10px] text-muted">
      <span className="uppercase tracking-wider">Confidence</span>
      {(["high", "nominal", "low"] as const).map((level) => (
        <span key={level} className="flex items-center gap-1">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: CONFIDENCE_COLORS[level] }}
          />
          {level}
        </span>
      ))}
      <span className="ml-auto">size = fire radiative power</span>
    </div>
  );
}

function confidenceColor(confidence: string): string {
  return CONFIDENCE_COLORS[confidence.toLowerCase()] ?? DEFAULT_COLOR;
}
