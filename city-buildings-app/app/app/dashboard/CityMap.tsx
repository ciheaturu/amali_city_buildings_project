"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

if (typeof window !== "undefined") {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  });
}

type MapPoint = {
  id: string;
  building_name: string;
  classification: string;
  occupants: number | null;
  latitude: number;
  longitude: number;
};

function FitBounds({ points }: { points: { latitude: number; longitude: number }[] }) {
  const map = useMap();

  useEffect(() => {
    if (!points || points.length === 0) return;

    const bounds = L.latLngBounds(points.map((p) => [p.latitude, p.longitude] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [points, map]);

  return null;
}

export default function CityMap({
  points,
  center,
}: {
  points: MapPoint[];
  center: [number, number];
}) {
  return (
    <MapContainer center={center} zoom={12} style={{ height: "100%", width: "100%" }}>
      <FitBounds points={points.map((p) => ({ latitude: p.latitude, longitude: p.longitude }))} />

      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {points.map((b) => (
        <Marker key={b.id} position={[b.latitude, b.longitude]}>
          <Popup>
            <strong>{b.building_name}</strong>
            <div>{b.classification}</div>
            {b.occupants != null ? <div>Occupants: {b.occupants}</div> : null}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}