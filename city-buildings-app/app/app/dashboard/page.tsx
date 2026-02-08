"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { PieChart, Pie, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { fixLeafletIcons } from "@/lib/leafletFix";

type Building = {
  id: string;
  building_name: string;
  classification: string;
  occupants: number | null;
  latitude: number | null;
  longitude: number | null;
};

const PIE_COLORS = ["#38bdf8", "#22c55e", "#f97316", "#e11d48", "#a78bfa", "#facc15"];

function Card(props: { title: string; value: string; subtitle?: string; accent?: string }) {
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
      <div style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600 }}>{props.title}</div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 900,
          marginTop: 8,
          color: props.accent ?? "#38bdf8",
        }}
      >
        {props.value}
      </div>
      {props.subtitle ? (
        <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>{props.subtitle}</div>
      ) : null}
    </div>
  );
}

function toCsv(rows: any[]) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);

  const escape = (v: unknown) => {
    const s = (v ?? "").toString().replace(/"/g, '""');
    return `"${s}"`;
  };

  const lines = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))];
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

const navBtn: React.CSSProperties = {
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

function FitBounds({ points }: { points: { latitude: number; longitude: number }[] }) {
  const map = useMap();

  useEffect(() => {
    if (!points || points.length === 0) return;

    const bounds = L.latLngBounds(points.map((p) => [p.latitude, p.longitude] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [points, map]);

  return null;
}

export default function DashboardPage() {
  const router = useRouter();

  const [rows, setRows] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [cityName, setCityName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fixLeafletIcons();
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("role, city_id")
        .eq("user_id", user.id)
        .single();

      if (profErr) {
        setLoading(false);
        setError(profErr.message);
        return;
      }

      if (profile?.role === "admin") {
        router.replace("/admin/dashboard");
        return;
      }

      if (!profile?.city_id) {
        setLoading(false);
        setError("Your profile has no city id.");
        return;
      }

      const { data: cityRow, error: cityErr } = await supabase
        .from("cities")
        .select("name")
        .eq("id", profile.city_id)
        .single();

      if (cityErr) setCityName("");
      else setCityName(cityRow?.name ?? "");

      const { data: buildings, error: bErr } = await supabase
        .from("buildings")
        .select("id, building_name, classification, occupants, latitude, longitude");

      if (bErr) {
        setLoading(false);
        setError(bErr.message);
        return;
      }

      setRows((buildings ?? []) as Building[]);
      setLoading(false);
    }

    load();
  }, [router]);

  const totals = useMemo(() => {
    const totalBuildings = rows.length;
    const totalOccupants = rows.reduce((s, r) => s + (r.occupants ?? 0), 0);
    const avgOccupants = totalBuildings ? totalOccupants / totalBuildings : 0;

    const missingCoords = rows.filter((r) => r.latitude == null || r.longitude == null).length;

    const byClass: Record<string, number> = {};
    rows.forEach((r) => {
      byClass[r.classification] = (byClass[r.classification] ?? 0) + 1;
    });

    const chart = Object.entries(byClass).map(([name, value]) => ({ name, value }));

    const points = rows
      .filter((r) => r.latitude != null && r.longitude != null)
      .map((r) => ({ ...r, latitude: r.latitude as number, longitude: r.longitude as number }));

    let center: [number, number] = [-26.2041, 28.0473];
    if (points.length > 0) {
      const latAvg = points.reduce((s, p) => s + p.latitude, 0) / points.length;
      const lonAvg = points.reduce((s, p) => s + p.longitude, 0) / points.length;
      center = [latAvg, lonAvg];
    }

    return { totalBuildings, totalOccupants, avgOccupants, missingCoords, chart, points, center };
  }, [rows]);

  async function exportCsv() {
    setError(null);

    const { data, error } = await supabase
      .from("buildings")
      .select(
        "id, building_name, street_address, latitude, longitude, classification, occupants, photo_url, created_at, updated_at"
      );

    if (error) {
      setError(error.message);
      return;
    }

    const filename = cityName
      ? `${cityName.toLowerCase().replace(/\s+/g, "_")}_buildings.csv`
      : "city_buildings.csv";

    downloadCsv(filename, toCsv(data ?? []));
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
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>
            {cityName ? `${cityName} dashboard` : "City dashboard"}
          </h1>
          <p style={{ opacity: 0.85, marginTop: 6 }}>Buildings, occupants and spatial coverage overview</p>

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
              <button onClick={() => router.push("/app")} style={navBtn}>
                Home
              </button>

              <button onClick={() => router.push("/app/buildings")} style={navBtn}>
                Buildings
              </button>

              <button onClick={() => router.push("/app/buildings/new")} style={btnGreen}>
                Add new building
              </button>

              <button onClick={exportCsv} style={navBtn}>
                Export CSV
              </button>
            </div>

            <button onClick={signOut} style={navBtn}>
              Sign out
            </button>
          </div>
        </div>

        {error ? <p style={{ marginTop: 8, color: "#fca5a5" }}>{error}</p> : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4,1fr)",
            gap: 14,
            marginBottom: 18,
          }}
        >
          <Card title="Total buildings" value={`${totals.totalBuildings}`} accent="#38bdf8" />
          <Card title="Total occupants" value={`${totals.totalOccupants.toLocaleString()}`} accent="#22c55e" />
          <Card title="Average occupants" value={`${totals.avgOccupants.toFixed(1)}`} accent="#f97316" />
          <Card title="Missing coordinates" value={`${totals.missingCoords}`} accent="#a78bfa" />
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
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Buildings by classification</h2>

            <div style={{ height: 320, marginTop: 10 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie dataKey="value" data={totals.chart} label stroke="#020617">
                    {totals.chart.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section
            style={{
              borderRadius: 14,
              background: "#020617",
              border: "1px solid #1f2937",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: 12, borderBottom: "1px solid #1f2937" }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Building locations</h2>
            </div>

            <div style={{ height: 340 }}>
              <MapContainer center={totals.center} zoom={12} style={{ height: "100%", width: "100%" }}>
                <FitBounds points={totals.points.map((p) => ({ latitude: p.latitude, longitude: p.longitude }))} />

                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {totals.points.map((b) => (
                  <Marker key={b.id} position={[b.latitude, b.longitude]}>
                    <Popup>
                      <strong>{b.building_name}</strong>
                      <div>{b.classification}</div>
                      {b.occupants != null ? <div>Occupants: {b.occupants}</div> : null}
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
