import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";

import "leaflet/dist/leaflet.css";

import { MapResizer } from "../lib/MapResizer.tsx";
import type { FlightFeedItem } from "../types.ts";

const MAP_CENTER: [number, number] = [20, 0];
const MAP_ZOOM = 2;
const MAP_HEIGHT = 480;

const COLOR_AIRBORNE = "#3b82f6";
const COLOR_GROUND = "#64748b";

interface FlightMapProps {
  items: FlightFeedItem[];
}

export function FlightMap({ items }: FlightMapProps) {
  const airborne = items.filter((f) => !f.onGround);
  const onGround = items.filter((f) => f.onGround);

  return (
    <div className="overflow-hidden rounded-xl border border-edge">
      {items.length === 0 && (
        <div className="border-b border-edge bg-panel px-4 py-2 text-xs text-muted">
          No flight data — OpenSky rate limits may reduce coverage.
        </div>
      )}
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
        {onGround.map((item) => (
          <CircleMarker
            key={item.id}
            center={[item.latitude, item.longitude]}
            radius={3}
            pathOptions={{
              color: COLOR_GROUND,
              fillColor: COLOR_GROUND,
              fillOpacity: 0.5,
              weight: 1,
            }}
          >
            <Popup>
              <FlightPopup item={item} />
            </Popup>
          </CircleMarker>
        ))}
        {airborne.map((item) => (
          <CircleMarker
            key={item.id}
            center={[item.latitude, item.longitude]}
            radius={5}
            pathOptions={{
              color: COLOR_AIRBORNE,
              fillColor: COLOR_AIRBORNE,
              fillOpacity: 0.7,
              weight: 1,
            }}
          >
            <Popup>
              <FlightPopup item={item} />
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      <Legend airborne={airborne.length} onGround={onGround.length} />
    </div>
  );
}

function FlightPopup({ item }: { item: FlightFeedItem }) {
  return (
    <div className="space-y-1 text-xs">
      <div className="text-sm font-semibold">
        {item.callsign ?? item.icao24}
      </div>
      <div>ICAO24: {item.icao24}</div>
      {item.altitudeM !== null && (
        <div>Altitude: {Math.round(item.altitudeM)} m</div>
      )}
      {item.speedKt !== null && <div>Speed: {Math.round(item.speedKt)} kt</div>}
      {item.heading !== null && <div>Heading: {Math.round(item.heading)}°</div>}
      <div>{item.onGround ? "On ground" : "Airborne"}</div>
    </div>
  );
}

function Legend({
  airborne,
  onGround,
}: {
  airborne: number;
  onGround: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-edge bg-panel px-3 py-2 text-[10px] text-muted">
      <span className="flex items-center gap-1">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ background: COLOR_AIRBORNE }}
        />
        airborne ({airborne})
      </span>
      <span className="flex items-center gap-1">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ background: COLOR_GROUND }}
        />
        on ground ({onGround})
      </span>
    </div>
  );
}
