"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

type BuildingPoint = {
  id: string;
  building_name: string;
  street_address: string;
  city_id: string;
  latitude: number;
  longitude: number;
  occupants: number | null;
  condition?: string | null;
};

type BuildingMapProps = {
  points: BuildingPoint[];
  fallbackCenter: [number, number];
  fallbackZoom: number;
  cityNameById: Map<string, string>;
};

export default function BuildingMap({ points, fallbackCenter, fallbackZoom, cityNameById }: BuildingMapProps) {
  return (
    <MapContainer
      center={fallbackCenter}
      zoom={fallbackZoom}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {points.map((point) => (
        <Marker key={point.id} position={[point.latitude, point.longitude]}>
          <Popup>
            <div style={{ minWidth: 200 }}>
              <div style={{ fontWeight: 800, marginBottom: 4 }}>{point.building_name}</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{point.street_address}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#38bdf8", marginBottom: 4 }}>
                {cityNameById.get(point.city_id) || "Unknown City"}
              </div>
              {point.occupants !== null && (
                <div style={{ fontSize: 12 }}>{point.occupants} occupants</div>
              )}
              {point.condition && (
                <div style={{ fontSize: 12 }}>{point.condition}</div>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
