"use client";

import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { PjpPosition } from "@/lib/pjp-geometry";

type Stop = { id: string; title: string; type: "site" | "task"; location: PjpPosition };

function MapClick({ active, onPick }: { active: boolean; onPick: (point: PjpPosition) => void }) {
  useMapEvents({
    click: (event) => {
      if (active) onPick({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });
  return null;
}

function FitMap({ points }: { points: PjpPosition[] }) {
  const map = useMap();
  const key = points.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(";");
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 12);
      return;
    }
    map.fitBounds(points.map((p) => [p.lat, p.lng] as [number, number]), {
      padding: [35, 35], maxZoom: 13,
    });
    // The points key intentionally changes only when the geometry changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
}

export default function PjpMap({ origin, stops, pickStart, onPickStart }: {
  origin: PjpPosition | null;
  stops: Stop[];
  pickStart: boolean;
  onPickStart: (position: PjpPosition) => void;
}) {
  const coords = [
    ...(origin ? [origin] : []),
    ...stops.map((stop) => stop.location),
  ];
  const center = coords[0] ?? { lat: 26.1445, lng: 91.7362 };
  return (
    <div className="relative overflow-hidden rounded-xl border">
      {pickStart && (
        <div className="pointer-events-none absolute left-3 top-3 z-[1000] rounded-lg bg-card px-3 py-2 text-xs font-semibold shadow">
          Click anywhere on the map to set the starting point
        </div>
      )}
      <MapContainer center={[center.lat, center.lng]} zoom={11} scrollWheelZoom className="h-[480px] w-full">
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />
        <MapClick active={pickStart} onPick={onPickStart} />
        <FitMap points={coords} />
        {origin && (
          <CircleMarker center={[origin.lat, origin.lng]} radius={13} pathOptions={{ color: "#205c56", weight: 3, fillColor: "#e3f0ed", fillOpacity: 0.95 }}>
            <Tooltip direction="top" permanent>Start</Tooltip>
            <Popup>Selected starting location</Popup>
          </CircleMarker>
        )}
        {stops.map((stop, index) => (
          <CircleMarker
            key={stop.id}
            center={[stop.location.lat, stop.location.lng]}
            radius={10}
            pathOptions={{ color: stop.type === "site" ? "#235f94" : "#9c581b", weight: 2, fillOpacity: 0.9 }}
          >
            <Tooltip direction="top" permanent>{index + 1}</Tooltip>
            <Popup><strong>{stop.title}</strong><div>{stop.type === "site" ? "CRM site" : "Task stop"}</div></Popup>
          </CircleMarker>
        ))}
        {coords.length > 1 && (
          <Polyline
            positions={coords.map((point) => [point.lat, point.lng] as [number, number])}
            pathOptions={{ color: "#256c61", weight: 3, dashArray: "6 6" }}
          />
        )}
      </MapContainer>
      <div className="border-t bg-card px-3 py-2 text-xs text-muted-foreground">
        Dashed path indicates straight-line stop order—not a navigable road route. Open Google Maps for road directions.
      </div>
    </div>
  );
}
