import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";

import type { SeismicAlert, SeismicItem } from "../types.ts";

// PAGER alert colors, with a neutral slate for events that carry no alert.
const ALERT_COLORS: Record<NonNullable<SeismicAlert>, string> = {
  green: "#22c55e",
  yellow: "#eab308",
  orange: "#f97316",
  red: "#ef4444",
};
const NO_ALERT_COLOR = "#94a3b8";

const MAP_HEIGHT = 480;
const MAP_CENTER: [number, number] = [20, 0];
const MAP_ZOOM = 2;
const MIN_RADIUS = 4;
const RADIUS_PER_MAGNITUDE = 2.6;

interface SeismicMapProps {
  items: SeismicItem[];
}

function MapResizer() {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
  }, [map]);
  return null;
}

export function SeismicMap({ items }: SeismicMapProps) {
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
            radius={markerRadius(item.magnitude)}
            pathOptions={{
              color: markerColor(item.alert),
              fillColor: markerColor(item.alert),
              fillOpacity: 0.6,
              weight: 1,
            }}
          >
            <Popup>
              <SeismicPopup item={item} />
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      <Legend />
    </div>
  );
}

function SeismicPopup({ item }: { item: SeismicItem }) {
  return (
    <div className="space-y-1 text-xs">
      <div className="text-sm font-semibold">
        M{item.magnitude.toFixed(1)} · {item.place}
      </div>
      <div>Depth: {item.depth.toFixed(0)} km</div>
      <div>Alert: {item.alert ?? "none"}</div>
      {item.tsunami && (
        <div className="font-semibold text-blue-600">Tsunami</div>
      )}
      <div>{new Date(item.eventTime).toLocaleString()}</div>
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        className="text-blue-600 underline"
      >
        USGS details
      </a>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-edge bg-panel px-3 py-2 text-[10px] text-muted">
      <span className="uppercase tracking-wider">Alert</span>
      {(["green", "yellow", "orange", "red"] as const).map((level) => (
        <span key={level} className="flex items-center gap-1">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: ALERT_COLORS[level] }}
          />
          {level}
        </span>
      ))}
      <span className="flex items-center gap-1">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ background: NO_ALERT_COLOR }}
        />
        none
      </span>
      <span className="ml-auto">size = magnitude</span>
    </div>
  );
}

function markerColor(alert: SeismicAlert): string {
  return alert ? ALERT_COLORS[alert] : NO_ALERT_COLOR;
}

function markerRadius(magnitude: number): number {
  return Math.max(MIN_RADIUS, magnitude * RADIUS_PER_MAGNITUDE);
}
