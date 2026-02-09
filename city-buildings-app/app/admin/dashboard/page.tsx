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
  PieChart,
  Pie,
  Cell,
} from "recharts";
import dynamic from "next/dynamic";

// Dynamically import the Leaflet map to disable SSR
const BuildingMap = dynamic(() => import("./BuildingMap"), { ssr: false });

type Profile = { role: "city" | "admin"; city_id: string | null };
type City = { id: string; name: string };
type BuildingRow = {
  id: string;
  city_id: string;
  classification: string;
  occupants: number | null;
  latitude?: number | null;
  longitude?: number | null;
  // NEW FIELDS
  condition?: string | null;
  year_built?: number | null;
  floors?: number | null;
  ownership_type?: string | null;
  compliance_status?: string | null;
  has_electricity?: boolean;
  has_water?: boolean;
  has_sewerage?: boolean;
  floor_area_sqm?: number | null;
};

const PIE_COLORS = ["#38bdf8", "#22c55e", "#f97316", "#e11d48", "#a78bfa", "#facc15"];

function toCsv(rows: any[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => `"${(v ?? "").toString().replace(/"/g, '""')}"`;
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
      <div style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase" }}>
        {props.title}
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, marginTop: 8, color: props.accent ?? "#38bdf8" }}>
        {props.value}
      </div>
      {props.subtitle && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>{props.subtitle}</div>}
    </div>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();

  const [cities, setCities] = useState<City[]>([]);
  const [buildings, setBuildings] = useState<BuildingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminEmail, setAdminEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Load all data
  useEffect(() => {
    async function guardAndLoad() {
      setLoading(true);
      setError(null);

      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return router.replace("/login");

      setAdminEmail(user.email ?? "");

      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("role, city_id")
        .eq("user_id", user.id)
        .single();

      if (profErr || !profile) return router.replace("/login");

      const p = profile as Profile;
      if (p.role !== "admin") return router.replace("/app/dashboard");

      const { data: cityRows, error: cityErr } = await supabase
        .from("cities")
        .select("id, name")
        .order("name", { ascending: true });
      if (cityErr) return setError(cityErr.message);

      setCities((cityRows ?? []) as City[]);

      const { data: buildingRows, error: bErr } = await supabase
        .from("buildings")
        .select(`
          id, city_id, classification, occupants, latitude, longitude,
          condition, year_built, floors, ownership_type, compliance_status,
          has_electricity, has_water, has_sewerage, floor_area_sqm
        `);
      if (bErr) return setError(bErr.message);

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
    const classCounts = Object.entries(byClass).map(([classification, count]) => ({ classification, count }));

    // NEW ANALYTICS: Building Condition Distribution
    const byCondition: Record<string, number> = {};
    buildings.forEach((b) => {
      if (b.condition) {
        byCondition[b.condition] = (byCondition[b.condition] ?? 0) + 1;
      }
    });
    const conditionData = Object.entries(byCondition).map(([name, value]) => ({ name, value }));

    // NEW ANALYTICS: Compliance Status
    const byCompliance: Record<string, number> = {};
    buildings.forEach((b) => {
      if (b.compliance_status) {
        byCompliance[b.compliance_status] = (byCompliance[b.compliance_status] ?? 0) + 1;
      }
    });
    const complianceData = Object.entries(byCompliance).map(([status, count]) => ({ status, count }));

    // NEW ANALYTICS: Ownership Distribution
    const byOwnership: Record<string, number> = {};
    buildings.forEach((b) => {
      if (b.ownership_type) {
        byOwnership[b.ownership_type] = (byOwnership[b.ownership_type] ?? 0) + 1;
      }
    });
    const ownershipData = Object.entries(byOwnership).map(([name, value]) => ({ name, value }));

    // NEW ANALYTICS: Utility Coverage
    const withElectricity = buildings.filter((b) => b.has_electricity === true).length;
    const withWater = buildings.filter((b) => b.has_water === true).length;
    const withSewerage = buildings.filter((b) => b.has_sewerage === true).length;
    const utilityCoverage = [
      { utility: "Electricity", count: withElectricity, percentage: totalBuildings ? (withElectricity / totalBuildings) * 100 : 0 },
      { utility: "Water", count: withWater, percentage: totalBuildings ? (withWater / totalBuildings) * 100 : 0 },
      { utility: "Sewerage", count: withSewerage, percentage: totalBuildings ? (withSewerage / totalBuildings) * 100 : 0 },
    ];

    // NEW ANALYTICS: Average Building Age
    const buildingsWithAge = buildings.filter((b) => b.year_built != null);
    const currentYear = new Date().getFullYear();
    const avgAge = buildingsWithAge.length
      ? buildingsWithAge.reduce((sum, b) => sum + (currentYear - (b.year_built ?? currentYear)), 0) / buildingsWithAge.length
      : 0;

    // NEW ANALYTICS: Average Floors
    const buildingsWithFloors = buildings.filter((b) => b.floors != null);
    const avgFloors = buildingsWithFloors.length
      ? buildingsWithFloors.reduce((sum, b) => sum + (b.floors ?? 0), 0) / buildingsWithFloors.length
      : 0;

    // NEW ANALYTICS: Total Floor Area
    const totalFloorArea = buildings.reduce((sum, b) => sum + (b.floor_area_sqm ?? 0), 0);

    // Infrastructure Health Score (0-100)
    const healthScore = totalBuildings
      ? ((withElectricity + withWater + withSewerage) / (totalBuildings * 3)) * 100
      : 0;

    const points = buildings
      .filter((b) => b.latitude != null && b.longitude != null)
      .map((b) => ({ ...b, latitude: b.latitude as number, longitude: b.longitude as number }));

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
      // NEW METRICS
      conditionData,
      complianceData,
      ownershipData,
      utilityCoverage,
      avgAge,
      avgFloors,
      totalFloorArea,
      healthScore,
    };
  }, [cities, buildings]);

  async function exportAllCsv() {
    setError(null);

    const cityNameById = new Map<string, string>();
    cities.forEach((c) => cityNameById.set(c.id, c.name));

    const { data, error } = await supabase
      .from("buildings")
      .select(`
        id, city_id, building_name, street_address, latitude, longitude, 
        classification, occupants, photo_url, created_at, updated_at,
        condition, year_built, floors, ownership_type, compliance_status,
        has_electricity, has_water, has_sewerage, floor_area_sqm
      `);
    if (error) return setError(error.message);

    const rows = (data ?? []).map((r: any) => ({ ...r, city_name: cityNameById.get(r.city_id) ?? "" }));
    const filename = `all_cities_buildings_${new Date().toISOString().split("T")[0]}.csv`;
    downloadCsv(filename, toCsv(rows));
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <main style={{ background: "#020617", minHeight: "100vh", color: "white", padding: 24 }}>
        <div style={{ textAlign: "center", paddingTop: 100 }}>
          <div
            style={{
              width: 48,
              height: 48,
              border: "4px solid #1f2937",
              borderTop: "4px solid #38bdf8",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 16px",
            }}
          />
          <div style={{ fontSize: 18, fontWeight: 600, color: "#9ca3af" }}>Loading dashboard...</div>
        </div>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </main>
    );
  }

  return (
    <main style={{ background: "#020617", minHeight: "100vh", color: "white" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: 24 }}>
        {/* Header */}
        <div
          style={{
            borderRadius: 16,
            padding: 20,
            background: "linear-gradient(135deg,#1d4ed8,#0ea5e9)",
            marginBottom: 18,
          }}
        >
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>🏛️ Admin Dashboard</h1>
          <p style={{ opacity: 0.85, marginTop: 6 }}>Cross-city overview and analytics • Signed in as {adminEmail}</p>

          <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => router.push("/admin")} style={btnDark}>🏠 Home</button>
              <button onClick={() => router.push("/admin/buildings")} style={btnDark}>🏢 Buildings</button>
              <button onClick={exportAllCsv} style={btnDark}>📊 Export CSV</button>
              <button onClick={() => router.push("/admin/buildings/new")} style={btnGreen}>➕ Add Building</button>
            </div>
            <button onClick={signOut} style={btnDark}>🚪 Sign Out</button>
          </div>
        </div>

        {error && <p style={{ marginTop: 8, color: "#fca5a5", padding: 12, background: "#7f1d1d", borderRadius: 8 }}>{error}</p>}

        {/* Key Metrics Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 18 }}>
          <Card title="Total Cities" value={`${cities.length}`} accent="#38bdf8" />
          <Card title="Total Buildings" value={`${summary.totalBuildings}`} accent="#22c55e" />
          <Card title="Avg Occupants" value={`${summary.avgOccupants.toFixed(1)}`} accent="#f97316" />
          <Card 
            title="Avg Building Age" 
            value={`${summary.avgAge.toFixed(0)} yrs`} 
            accent="#a78bfa"
            subtitle={summary.avgAge > 0 ? "Based on available data" : "No data"}
          />
          <Card 
            title="Infrastructure Score" 
            value={`${summary.healthScore.toFixed(0)}%`} 
            accent={summary.healthScore > 70 ? "#22c55e" : summary.healthScore > 40 ? "#f97316" : "#e11d48"}
            subtitle="Utility coverage"
          />
          <Card 
            title="Total Floor Area" 
            value={`${(summary.totalFloorArea / 1000).toFixed(1)}k m²`} 
            accent="#facc15"
          />
        </div>

        {/* Buildings Per City */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <section style={{ borderRadius: 14, background: "#111827", border: "1px solid #1f2937", padding: 14 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>📊 Buildings per City</h2>
            <div style={{ height: 300, marginTop: 10 }}>
              <ResponsiveContainer>
                <BarChart data={summary.buildingsPerCity}>
                  <XAxis dataKey="city" tick={{ fill: "#e5e7eb", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#e5e7eb", fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }} />
                  <Legend />
                  <Bar dataKey="buildings" fill="#38bdf8" name="Buildings" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section style={{ borderRadius: 14, background: "#111827", border: "1px solid #1f2937", padding: 14 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>👥 Average Occupants per City</h2>
            <div style={{ height: 300, marginTop: 10 }}>
              <ResponsiveContainer>
                <BarChart data={summary.avgOccPerCity}>
                  <XAxis dataKey="city" tick={{ fill: "#e5e7eb", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#e5e7eb", fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }} />
                  <Legend />
                  <Bar dataKey="avg_occupants" fill="#22c55e" name="Avg Occupants" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        {/* Classification & Condition */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <section style={{ borderRadius: 14, background: "#111827", border: "1px solid #1f2937", padding: 14 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>🏗️ Building Classification</h2>
            <div style={{ height: 280, marginTop: 10 }}>
              <ResponsiveContainer>
                <BarChart data={summary.classCounts}>
                  <XAxis dataKey="classification" tick={{ fill: "#e5e7eb", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#e5e7eb", fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }} />
                  <Legend />
                  <Bar dataKey="count" fill="#f97316" name="Buildings" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section style={{ borderRadius: 14, background: "#111827", border: "1px solid #1f2937", padding: 14 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>🔧 Building Condition</h2>
            <div style={{ height: 280, marginTop: 10 }}>
              {summary.conditionData.length > 0 ? (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie dataKey="value" data={summary.conditionData} label stroke="#111827">
                      {summary.conditionData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#6b7280" }}>
                  No condition data available
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Ownership & Compliance */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <section style={{ borderRadius: 14, background: "#111827", border: "1px solid #1f2937", padding: 14 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>🏛️ Ownership Distribution</h2>
            <div style={{ height: 280, marginTop: 10 }}>
              {summary.ownershipData.length > 0 ? (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie dataKey="value" data={summary.ownershipData} label stroke="#111827">
                      {summary.ownershipData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#6b7280" }}>
                  No ownership data available
                </div>
              )}
            </div>
          </section>

          <section style={{ borderRadius: 14, background: "#111827", border: "1px solid #1f2937", padding: 14 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>✅ Compliance Status</h2>
            <div style={{ height: 280, marginTop: 10 }}>
              {summary.complianceData.length > 0 ? (
                <ResponsiveContainer>
                  <BarChart data={summary.complianceData}>
                    <XAxis dataKey="status" tick={{ fill: "#e5e7eb", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#e5e7eb", fontSize: 12 }} />
                    <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }} />
                    <Legend />
                    <Bar dataKey="count" fill="#a78bfa" name="Buildings" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#6b7280" }}>
                  No compliance data available
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Utility Coverage */}
        <div style={{ marginBottom: 14 }}>
          <section style={{ borderRadius: 14, background: "#111827", border: "1px solid #1f2937", padding: 14 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>⚡ Utility Coverage</h2>
            <div style={{ height: 280, marginTop: 10 }}>
              <ResponsiveContainer>
                <BarChart data={summary.utilityCoverage}>
                  <XAxis dataKey="utility" tick={{ fill: "#e5e7eb", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#e5e7eb", fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
                    formatter={(value: any, name?: string) => {
                      if (name === "percentage") return `${value.toFixed(1)}%`;
                      return value;
                    }}
                  />
                  <Legend />
                  <Bar dataKey="count" fill="#22c55e" name="Buildings with Utility" />
                  <Bar dataKey="percentage" fill="#38bdf8" name="Coverage %" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        {/* Map */}
        <div style={{ marginTop: 14 }}>
          <section style={{ borderRadius: 14, background: "#111827", border: "1px solid #1f2937", overflow: "hidden" }}>
            <div style={{ padding: 12, borderBottom: "1px solid #1f2937" }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>🗺️ Building Locations Across All Cities</h2>
              <div style={{ marginTop: 6, color: "#9ca3af", fontSize: 12 }}>
                Showing {summary.points.length.toLocaleString()} buildings with coordinates
              </div>
            </div>

            <div style={{ height: 420 }}>
              <BuildingMap
                points={summary.points.map((p) => ({
                  ...p,
                  latitude: p.latitude as number,
                  longitude: p.longitude as number,
                  occupants: p.occupants ?? undefined,
                }))}
                fallbackCenter={summary.center}
                fallbackZoom={5}
                cityNameById={summary.cityNameById}
              />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}