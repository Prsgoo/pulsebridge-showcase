import GlobeGl from "react-globe.gl";
import type { GlobeMethods } from "react-globe.gl";
import { useEffect, useMemo, useRef, useState } from "react";

import type { ViewSnapshot } from "../types.ts";
import {
  isFlightFeedItem,
  isSeismicItem,
  isWildfireFeedItem,
} from "../types.ts";

interface GlobeViewProps {
  views: ViewSnapshot[];
}

type Layer = "earthquakes" | "wildfires" | "flights";

interface GlobePoint {
  lat: number;
  lng: number;
  color: string;
  altitude: number;
  label: string;
}

const SEISMIC_ALERT_COLORS: Record<string, string> = {
  green: "#22c55e",
  yellow: "#eab308",
  orange: "#f97316",
  red: "#ef4444",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "#ef4444",
  nominal: "#f97316",
  low: "#eab308",
};

const LAYERS: { id: Layer; label: string; color: string }[] = [
  { id: "earthquakes", label: "Earthquakes", color: "#94a3b8" },
  { id: "wildfires", label: "Wildfires", color: "#f97316" },
  { id: "flights", label: "Flights", color: "#3b82f6" },
];

const GLOBE_IMAGE =
  "//cdn.jsdelivr.net/npm/three-globe/example/img/earth-dark.jpg";

export function GlobeView({ views }: GlobeViewProps) {
  const [activeLayers, setActiveLayers] = useState<Set<Layer>>(
    () => new Set<Layer>(["earthquakes", "wildfires", "flights"]),
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const globeRef = useRef<GlobeMethods>(undefined!);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!globeRef.current) return;
    const controls = globeRef.current.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.4;
  });

  const seismicItems = useMemo(() => {
    for (const view of views) {
      const items = Array.isArray(view.items) ? view.items : [];
      if (items.length > 0 && items.every(isSeismicItem)) return items;
    }
    return [];
  }, [views]);

  const wildfireItems = useMemo(() => {
    for (const view of views) {
      const items = Array.isArray(view.items) ? view.items : [];
      if (items.length > 0 && items.every(isWildfireFeedItem)) return items;
    }
    return [];
  }, [views]);

  const flightItems = useMemo(() => {
    for (const view of views) {
      const items = Array.isArray(view.items) ? view.items : [];
      if (items.length > 0 && items.every(isFlightFeedItem)) return items;
    }
    return [];
  }, [views]);

  const points = useMemo<GlobePoint[]>(() => {
    const result: GlobePoint[] = [];

    if (activeLayers.has("earthquakes")) {
      for (const item of seismicItems) {
        result.push({
          lat: item.latitude,
          lng: item.longitude,
          color: item.alert
            ? (SEISMIC_ALERT_COLORS[item.alert] ?? "#94a3b8")
            : "#94a3b8",
          altitude: Math.max(0.003, item.magnitude * 0.006),
          label: `M${item.magnitude.toFixed(1)} · ${item.place}`,
        });
      }
    }

    if (activeLayers.has("wildfires")) {
      for (const item of wildfireItems) {
        result.push({
          lat: item.latitude,
          lng: item.longitude,
          color: CONFIDENCE_COLORS[item.confidence.toLowerCase()] ?? "#f97316",
          altitude: 0.01,
          label: `${item.satellite} · FRP ${item.frp.toFixed(0)} MW · ${item.confidence}`,
        });
      }
    }

    if (activeLayers.has("flights")) {
      for (const item of flightItems) {
        if (item.onGround) continue;
        result.push({
          lat: item.latitude,
          lng: item.longitude,
          color: "#3b82f6",
          altitude: item.altitudeM ? item.altitudeM / 400_000 : 0.005,
          label: `${item.callsign ?? item.icao24}${item.altitudeM ? ` · ${Math.round(item.altitudeM)} m` : ""}`,
        });
      }
    }

    return result;
  }, [activeLayers, seismicItems, wildfireItems, flightItems]);

  const toggleLayer = (id: Layer) => {
    setActiveLayers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {LAYERS.map((layer) => (
          <button
            key={layer.id}
            onClick={() => toggleLayer(layer.id)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              activeLayers.has(layer.id)
                ? "border-transparent bg-panel-2 text-ink"
                : "border-edge bg-transparent text-muted"
            }`}
          >
            <span
              className="mr-1.5 inline-block h-2 w-2 rounded-full"
              style={{
                background: activeLayers.has(layer.id)
                  ? layer.color
                  : "transparent",
                border: activeLayers.has(layer.id)
                  ? "none"
                  : `1px solid ${layer.color}`,
              }}
            />
            {layer.label}
          </button>
        ))}
        <span className="ml-auto self-center text-[10px] text-muted">
          {points.length} points
        </span>
      </div>

      <div
        ref={containerRef}
        className="overflow-hidden rounded-xl border border-edge"
        style={{ background: "#0b1220" }}
      >
        <GlobeGl
          ref={globeRef}
          width={width}
          height={500}
          backgroundColor="#0b1220"
          globeImageUrl={GLOBE_IMAGE}
          pointsData={points}
          pointLat="lat"
          pointLng="lng"
          pointColor="color"
          pointAltitude="altitude"
          pointRadius={0.3}
          pointLabel="label"
        />
      </div>
    </div>
  );
}
