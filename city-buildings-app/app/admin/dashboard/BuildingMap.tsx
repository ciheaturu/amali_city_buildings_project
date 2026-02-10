"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// -----------------------------
// Fix default Leaflet marker icon
// -----------------------------
const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// -----------------------------
// Types
// -----------------------------
type MapPoint = {
  id: string;
  building_name: string;
  street_address: string;
  city_id: string;
  latitude: number;
  longitude: number;
  classification: string;
  occupants?: number | null;
};

type Props = {
  points: MapPoint[];
  fallbackCenter: [number, number];
  fallbackZoom: number;
  cityNameById: Map<string, string>;
};

// -----------------------------
// Component
// -----------------------------
export default function BuildingMap({
  points,
  fallbackCenter,
  fallbackZoom,
  cityNameById,
}: Props) {
  return (
    <MapContainer
      center={fallbackCenter}
      zoom={fallbackZoom}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {points.map((p) => (
        <Marker
          key={p.id}
          position={[p.latitude, p.longitude]}
          icon={icon}
        >
          <Popup>
            <div style={{ minWidth: 200 }}>
              <div
                style={{
                  fontWeight: 900,
                  fontSize: 14,
                  marginBottom: 4,
                }}
              >
                {p.building_name}
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: "#6b7280",
                  marginBottom: 4,
                }}
              >
                {p.street_address}
              </div>

              {cityNameById.size > 0 && (
                <div
                  style={{
                    fontSize: 12,
                    color: "#6b7280",
                    marginBottom: 4,
                  }}
                >
                  {cityNameById.get(p.city_id) ?? "Unknown City"}
                </div>
              )}

              <div style={{ fontSize: 12, marginTop: 6 }}>
                <span
                  style={{
                    padding: "2px 8px",
                    background: "#e0e7ff",
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#3730a3",
                  }}
                >
                  {p.classification}
                </span>

                {p.occupants != null && (
                  <span
                    style={{
                      marginLeft: 6,
                      padding: "2px 8px",
                      background: "#dcfce7",
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#14532d",
                    }}
                  >
                    {p.occupants}
                  </span>
                )}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
