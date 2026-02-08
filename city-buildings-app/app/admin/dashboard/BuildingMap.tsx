"use client";

import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { fixLeafletIcons } from "@/lib/leafletFix";
import { useEffect } from "react";

type BuildingPoint = { id: string; latitude: number; longitude: number; city_id: string; classification: string; occupants?: number };

type FitBoundsProps = {
  points: BuildingPoint[];
  fallbackCenter: [number, number];
  fallbackZoom: number;
};

function FitBounds({ points, fallbackCenter, fallbackZoom }: FitBoundsProps) {
  const map = useMap();

  useEffect(() => {
    if (!points || points.length === 0) {
      map.setView(fallbackCenter, fallbackZoom);
      return;
    }

    const bounds = L.latLngBounds(points.map((p) => [p.latitude, p.longitude] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [points, map, fallbackCenter, fallbackZoom]);

  return null;
}

type Props = {
  points: BuildingPoint[];
  fallbackCenter: [number, number];
  fallbackZoom: number;
  cityNameById: Map<string, string>;
};

export default function BuildingMap({ points, fallbackCenter, fallbackZoom, cityNameById }: Props) {
  useEffect(() => {
    fixLeafletIcons();
  }, []);

  return (
    <MapContainer center={fallbackCenter} zoom={fallbackZoom} style={{ height: "100%", width: "100%" }}>
      <FitBounds points={points} fallbackCenter={fallbackCenter} fallbackZoom={fallbackZoom} />

      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {points.map((b) => (
        <Marker key={b.id} position={[b.latitude, b.longitude]}>
          <Popup>
            <div style={{ fontWeight: 800 }}>Building</div>
            <div style={{ marginTop: 4 }}>
              <div>City: {cityNameById.get(b.city_id) ?? b.city_id}</div>
              <div>Class: {b.classification}</div>
              {b.occupants != null ? <div>Occupants: {b.occupants}</div> : null}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
