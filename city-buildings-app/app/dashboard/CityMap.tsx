"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

type BuildingPoint = {
  id: string;
  building_name: string;
  street_address: string;
  latitude: number;
  longitude: number;
  classification: string;
  occupants?: number | null;
};

type Props = {
  buildings: BuildingPoint[];
  center: [number, number];
};

export default function CityMap({ buildings, center }: Props) {
  return (
    // @ts-ignore - react-leaflet type definitions issue
    <MapContainer
      center={center}
      zoom={12}
      style={{ height: "100%", width: "100%" }}
    >
      {/* @ts-ignore */}
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {buildings.map((b) => (
        // @ts-ignore
        <Marker key={b.id} position={[b.latitude, b.longitude]} icon={icon}>
          <Popup>
            <div style={{ minWidth: 180 }}>
              <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 4 }}>
                {b.building_name}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
                {b.street_address}
              </div>
              <div style={{ fontSize: 12 }}>
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
                  {b.classification}
                </span>
                {b.occupants && (
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
                    {b.occupants}
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