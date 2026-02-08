"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { fixLeafletIcons } from "@/lib/leafletFix";

type Profile = { role: "city" | "admin"; city_id: string | null };

type City = { id: string; name: string };
type BuildingRow = {
  id: string;
  city_id: string;
  classification: string;
  occupants: number | null;
  latitude?: number | null;
  longitude?: number | null;
};

function toCsv(rows: any[]) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);

  const escape = (v: unknown) => {
    const s = (v ?? "").toString().replace(/"/g, '""');
    return `"${s}"`;
  };

  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ];

  return lines.join("\n");
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const btnDark: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  background: "#111827",
  color: "white",
  border: "1px solid #1f2937",
  fontWeight: 800,
  cursor: "pointer",
};

const btnGreen: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  background: "#22c55e",
  border: "none",
  color: "#052e16",
  fontWeight: 900,
  cursor: "pointer",
};

function Card(props: { title: string; value: string; subtitle?: string }) {
  return (
    <div
      style={{
        borderRadius: 14,
        padding: 16,
        background: "#111827",
        border: "1px solid #1f2937",
        boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
      }}
    >
      <div style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600 }}>
        {props.title}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 900,
          marginTop: 8,
          color: "#38bdf8",
        }}
      >
        {props.value}
      </div>
      {props.subtitle ? (
        <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>
          {props.subtitle}
        </div>
      ) : null}
    </div>
  );
}

function FitBounds({
  points,
  fallbackCenter,
  fallbackZoom,
}: {
  points: { latitude: number; longitude: number }[];
  fallbackCenter: [number, number];
  fallbackZoom: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!points || points.length === 0) {
      map.setView(fallbackCenter, fallbackZoom);
      return;
    }

    const bounds = L.latLngBounds(
      points.map((p) => [p.latitude, p.longitude] as [number, number])
    );

    map.fitBounds(bounds, { padding: [40, 40] });
  }, [points, map, fallbackCenter, fallbackZoom]);

  return null;
}

export default function AdminDashboardPage() {
  const router = useRouter();

  const [cities, setCities] = useState<City[]>([]);
  const [buildings, setBuildings] = useState<BuildingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminEmail, setAdminEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fixLeafletIcons();
  }, []);

  useEffect(() => {
    async function guardAndLoad() {
      setLoading(true);
      setError(null);

      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      setAdminEmail(user.email ?? "");

      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("role, city_id")
        .eq("user_id", user.id)
        .single();

      if (profErr || !profile) {
        router.replace("/login");
        return;
      }

      const p = profile as Profile;
      if (p.role !== "admin") {
        router.replace("/app/dashboard");
        return;
      }

      const { data: cityRows, error: cityErr } = await supabase
        .from("cities")
        .select("id, name")
        .order("name", { ascending: true });

      if (cityErr) {
        setError(cityErr.message);
        setLoading(false);
        return;
      }

      setCities((cityRows ?? []) as City[]);

      const { data: buildingRows, error: bErr } = await supabase
        .from("buildings")
        .select("id, city_id, classification, occupants, latitude, longitude");

      if (bErr) {
        setError(bErr.message);
        setLoading(false);
        return;
      }

      setBuildings((buildingRows ?? []) as BuildingRow[]);
      setLoading(false);
    }

    guardAndLoad();
  }, [router]);

  const summary = useMemo(() => {
    const totalBuildings = buildings.length;
    const totalOccupants = buildings.reduce((s, b) => s + (b.occupants ?? 0), 0);
    const avgOccupants = totalBuildings ? totalOccupants / totalBuildings : 0;

    const cityNameById = new Map<string, string>();
    cities.forEach((c) => cityNameById.set(c.id, c.name));

    const byCity: Record<string, { city: string; buildings: number; occupants: number }> = {};
    buildings.forEach((b) => {
      const name = cityNameById.get(b.city_id) ?? b.city_id;
      if (!byCity[b.city_id]) byCity[b.city_id] = { city: name, buildings: 0, occupants: 0 };
      byCity[b.city_id].buildings += 1;
      byCity[b.city_id].occupants += b.occupants ?? 0;
    });

    const buildingsPerCity = Object.values(byCity).sort((a, b) => b.buildings - a.buildings);

    const avgOccPerCity = buildingsPerCity.map((c) => ({
      city: c.city,
      avg_occupants: c.buildings ? c.occupants / c.buildings : 0,
    }));

    const byClass: Record<string, number> = {};
    buildings.forEach((b) => {
      const cls = b.classification ?? "unknown";
      byClass[cls] = (byClass[cls] ?? 0) + 1;
    });

    const classCounts = Object.entries(byClass).map(([classification, count]) => ({
      classification,
      count,
    }));

    const points = buildings
      .filter((b) => b.latitude != null && b.longitude != null)
      .map((b) => ({
        ...b,
        latitude: b.latitude as number,
        longitude: b.longitude as number,
      }));

    let center: [number, number] = [-26.2041, 28.0473];
    if (points.length > 0) {
      const latAvg = points.reduce((s, p) => s + p.latitude, 0) / points.length;
      const lonAvg = points.reduce((s, p) => s + p.longitude, 0) / points.length;
      center = [latAvg, lonAvg];
    }

    return {
      totalBuildings,
      totalOccupants,
      avgOccupants,
      buildingsPerCity,
      avgOccPerCity,
      classCounts,
      points,
      center,
      cityNameById,
    };
  }, [cities, buildings]);

  async function exportAllCsv() {
    setError(null);

    const cityNameById = new Map<string, string>();
    cities.forEach((c) => cityNameById.set(c.id, c.name));

    const { data, error } = await supabase
      .from("buildings")
      .select(
        "id, city_id, building_name, street_address, latitude, longitude, classification, occupants, photo_url, created_at, updated_at"
      );

    if (error) {
      setError(error.message);
      return;
    }

    const rows = (data ?? []).map((r: any) => ({
      ...r,
      city_name: cityNameById.get(r.city_id) ?? "",
    }));

    downloadCsv("all_cities_buildings.csv", toCsv(rows));
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <main style={{ background: "#020617", minHeight: "100vh", color: "white", padding: 24 }}>
        Loading...
      </main>
    );
  }

  return (
    <main style={{ background: "#020617", minHeight: "100vh", color: "white" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: 24 }}>
        <div
          style={{
            borderRadius: 16,
            padding: 20,
            background: "linear-gradient(135deg,#1d4ed8,#0ea5e9)",
            marginBottom: 18,
          }}
        >
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>Admin dashboard</h1>
          <p style={{ opacity: 0.85, marginTop: 6 }}>
            Cross city overview. Signed in as {adminEmail}
          </p>

          <div
            style={{
              marginTop: 12,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => router.push("/admin")} style={btnDark}>
                Home
              </button>

              <button onClick={() => router.push("/admin/buildings")} style={btnDark}>
                Buildings
              </button>

              <button onClick={exportAllCsv} style={btnDark}>
                Export CSV
              </button>

              <button onClick={() => router.push("/admin/buildings/new")} style={btnGreen}>
                Add new building
              </button>
            </div>

            <button onClick={signOut} style={btnDark}>
              Sign out
            </button>
          </div>
        </div>

        {error ? <p style={{ marginTop: 8, color: "#fca5a5" }}>{error}</p> : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 14,
            marginBottom: 18,
          }}
        >
          <Card title="Total cities" value={`${cities.length}`} />
          <Card title="Total buildings" value={`${summary.totalBuildings}`} />
          <Card title="Average occupants per building" value={`${summary.avgOccupants.toFixed(1)}`} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <section
            style={{
              borderRadius: 14,
              background: "#020617",
              border: "1px solid #1f2937",
              padding: 14,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Buildings per city</h2>
            <div style={{ height: 320, marginTop: 10 }}>
              <ResponsiveContainer>
                <BarChart data={summary.buildingsPerCity}>
                  <XAxis dataKey="city" tick={{ fill: "#e5e7eb", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#e5e7eb", fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="buildings" fill="#38bdf8" name="Buildings" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section
            style={{
              borderRadius: 14,
              background: "#020617",
              border: "1px solid #1f2937",
              padding: 14,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Average occupants per city</h2>
            <div style={{ height: 320, marginTop: 10 }}>
              <ResponsiveContainer>
                <BarChart data={summary.avgOccPerCity}>
                  <XAxis dataKey="city" tick={{ fill: "#e5e7eb", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#e5e7eb", fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="avg_occupants" fill="#22c55e" name="Average occupants" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        <div style={{ marginTop: 14 }}>
          <section
            style={{
              borderRadius: 14,
              background: "#020617",
              border: "1px solid #1f2937",
              padding: 14,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
              Buildings by classification across all cities
            </h2>
            <div style={{ height: 280, marginTop: 10 }}>
              <ResponsiveContainer>
                <BarChart data={summary.classCounts}>
                  <XAxis dataKey="classification" tick={{ fill: "#e5e7eb", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#e5e7eb", fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#f97316" name="Buildings" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        <div style={{ marginTop: 14 }}>
          <section
            style={{
              borderRadius: 14,
              background: "#020617",
              border: "1px solid #1f2937",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: 12, borderBottom: "1px solid #1f2937" }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                Building locations across all cities
              </h2>
              <div style={{ marginTop: 6, color: "#9ca3af", fontSize: 12 }}>
                Showing {summary.points.length.toLocaleString()} buildings with coordinates
              </div>
            </div>

            <div style={{ height: 420 }}>
              <MapContainer center={summary.center} zoom={5} style={{ height: "100%", width: "100%" }}>
                <FitBounds
                  points={summary.points.map((p) => ({
                    latitude: p.latitude as number,
                    longitude: p.longitude as number,
                  }))}
                  fallbackCenter={summary.center}
                  fallbackZoom={5}
                />

                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {summary.points.map((b) => (
                  <Marker key={b.id} position={[b.latitude as number, b.longitude as number]}>
                    <Popup>
                      <div style={{ fontWeight: 800 }}>Building</div>
                      <div style={{ marginTop: 4 }}>
                        <div>City: {summary.cityNameById.get(b.city_id) ?? b.city_id}</div>
                        <div>Class: {b.classification}</div>
                        {b.occupants != null ? <div>Occupants: {b.occupants}</div> : null}
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
