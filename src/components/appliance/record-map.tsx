"use client";

import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
} from "react-leaflet";

export type MapPoint = {
  id: string;
  position: [number, number];
  title: string;
  subtitle?: string;
};

export type MapRoute = {
  id: string;
  positions: [number, number][];
  title: string;
};

export default function RecordMap({
  points = [],
  routes = [],
}: {
  points?: MapPoint[];
  routes?: MapRoute[];
}) {
  const center =
    points[0]?.position ??
    routes[0]?.positions[0] ??
    [22.9734, 78.6569] as [number, number];

  return (
    <MapContainer
      center={center}
      zoom={points.length || routes.length ? 11 : 5}
      className="h-[620px] w-full"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {points.map((point) => (
        <CircleMarker
          key={point.id}
          center={point.position}
          radius={8}
        >
          <Popup>
            <div className="text-sm">
              <div className="font-semibold">{point.title}</div>
              {point.subtitle && <div>{point.subtitle}</div>}
            </div>
          </Popup>
        </CircleMarker>
      ))}

      {routes.map((route) => (
        <Polyline
          key={route.id}
          positions={route.positions}
        >
          <Popup>{route.title}</Popup>
        </Polyline>
      ))}
    </MapContainer>
  );
}
