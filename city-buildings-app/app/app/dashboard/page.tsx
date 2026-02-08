"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { PieChart, Pie, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import dynamic from "next/dynamic";

// Dynamically import the map to disable SSR
const CityMap = dynamic(() => import("./CityMap"), { ssr: false });

type Building = {
  id: string;
  building_name: string;
  classification: string;
  occupants: number | null;
  latitude: number | null;
  longitude: number | null;
};

const PIE_COLORS = ["#38bdf8", "#22c55e", "#f97316", "#e11d48", "#a78bfa", "#facc15"];

// Styles
const styles = {
  navBtn: {
    padding: "10px 16px",
    borderRadius: 10,
    background: "#111827",
    color: "white",
    border: "1px solid #1f2937",
    fontWeight: 800,
    cursor: "pointer",
    transition: "all 0.2s",
  } as React.CSSProperties,

  btnGreen: {
    padding: "10px 16px",
    borderRadius: 10,
    background: "#22c55e",
    border: "none",
    color: "#052e16",
    fontWeight: 900,
    cursor: "pointer",
    transition: "all 0.2s",
  } as React.CSSProperties,
};

// Card Component
function Card({ title, value, subtitle, accent }: { 
  title: string; 
  value: string; 
  subtitle?: string; 
  accent?: string;
}) {
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
        {title}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 900,
          marginTop: 8,
          color: accent ?? "#38bdf8",
        }}
      >
        {value}
      </div>
      {subtitle && (
        <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>{subtitle}</div>
      )}
    </div>
  );
}

// Utility Functions
function toCsv(rows: any[]): string {
  if (rows.length === 0) return "";
  
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = (v ?? "").toString().replace(/"/g, '""');
    return `"${s}"`;
  };

  const headerLine = headers.join(",");
  const dataLines = rows.map((row) => 
    headers.map((header) => escape(row[header])).join(",")
  );

  return [headerLine, ...dataLines].join("\n");
}

function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// Main Component
export default function DashboardPage() {
  const router = useRouter();

  const [rows, setRows] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [cityName, setCityName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Fix Leaflet icons on client side only
  useEffect(() => {
    if (typeof window !== "undefined") {
      import("@/lib/leafletFix")
        .then(({ fixLeafletIcons }) => {
          fixLeafletIcons();
        })
        .catch((err) => {
          console.error("Failed to load leaflet fix:", err);
        });
    }
  }, []);

  // Load data
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        // Check authentication
        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;

        if (!user) {
          router.replace("/login");
          return;
        }

        // Get user profile
        const { data: profile, error: profErr } = await supabase
          .from("profiles")
          .select("role, city_id")
          .eq("user_id", user.id)
          .single();

        if (profErr) throw profErr;

        // Redirect admins to admin dashboard
        if (profile?.role === "admin") {
          router.replace("/admin/dashboard");
          return;
        }

        // Validate city assignment
        if (!profile?.city_id) {
          setError("Your profile has no city assigned.");
          setLoading(false);
          return;
        }

        // Get city name
        const { data: cityRow, error: cityErr } = await supabase
          .from("cities")
          .select("name")
          .eq("id", profile.city_id)
          .single();

        setCityName(cityErr ? "" : cityRow?.name ?? "");

        // Get buildings
        const { data: buildings, error: bErr } = await supabase
          .from("buildings")
          .select("id, building_name, classification, occupants, latitude, longitude");

        if (bErr) throw bErr;

        setRows((buildings ?? []) as Building[]);
      } catch (err: any) {
        setError(err.message || "An error occurred while loading data");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router]);

  // Calculate totals and analytics
  const totals = useMemo(() => {
    const totalBuildings = rows.length;
    const totalOccupants = rows.reduce((sum, row) => sum + (row.occupants ?? 0), 0);
    const avgOccupants = totalBuildings ? totalOccupants / totalBuildings : 0;
    const missingCoords = rows.filter((r) => r.latitude == null || r.longitude == null).length;

    // Group by classification
    const byClass: Record<string, number> = {};
    rows.forEach((row) => {
      byClass[row.classification] = (byClass[row.classification] ?? 0) + 1;
    });

    const chart = Object.entries(byClass).map(([name, value]) => ({ name, value }));

    // Filter valid coordinates
    const points = rows
      .filter((r) => r.latitude != null && r.longitude != null)
      .map((r) => ({ 
        ...r, 
        latitude: r.latitude as number, 
        longitude: r.longitude as number 
      }));

    // Calculate map center
    let center: [number, number] = [-26.2041, 28.0473]; // Default to Johannesburg
    if (points.length > 0) {
      const latAvg = points.reduce((sum, p) => sum + p.latitude, 0) / points.length;
      const lonAvg = points.reduce((sum, p) => sum + p.longitude, 0) / points.length;
      center = [latAvg, lonAvg];
    }

    return { 
      totalBuildings, 
      totalOccupants, 
      avgOccupants, 
      missingCoords, 
      chart, 
      points, 
      center 
    };
  }, [rows]);

  // Export to CSV
  async function handleExportCsv() {
    setError(null);

    try {
      const { data, error } = await supabase
        .from("buildings")
        .select(
          "id, building_name, street_address, latitude, longitude, classification, occupants, photo_url, created_at, updated_at"
        );

      if (error) throw error;

      const filename = cityName
        ? `${cityName.toLowerCase().replace(/\s+/g, "_")}_buildings.csv`
        : "city_buildings.csv";

      downloadCsv(filename, toCsv(data ?? []));
    } catch (err: any) {
      setError(err.message || "Failed to export CSV");
    }
  }

  // Sign out
  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  // Loading state
  if (loading) {
    return (
      <main 
        style={{ 
          background: "#020617", 
          minHeight: "100vh", 
          color: "white", 
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          fontWeight: 600
        }}
      >
        Loading dashboard...
      </main>
    );
  }

  // Main render
  return (
    <main style={{ background: "#020617", minHeight: "100vh", color: "white" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: 24 }}>
        {/* Header */}
        <div
          style={{
            borderRadius: 16,
            padding: 20,
            background: "linear-gradient(135deg, #1d4ed8, #0ea5e9)",
            marginBottom: 18,
          }}
        >
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>
            {cityName ? `${cityName} Dashboard` : "City Dashboard"}
          </h1>
          <p style={{ opacity: 0.85, marginTop: 6, margin: 0 }}>
            Buildings, occupants and spatial coverage overview
          </p>

          {/* Navigation */}
          <div
            style={{
              marginTop: 16,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => router.push("/app")} style={styles.navBtn}>
                Home
              </button>
              <button onClick={() => router.push("/app/buildings")} style={styles.navBtn}>
                Buildings
              </button>
              <button onClick={() => router.push("/app/buildings/new")} style={styles.btnGreen}>
                + Add Building
              </button>
              <button onClick={handleExportCsv} style={styles.navBtn}>
                Export CSV
              </button>
            </div>

            <button onClick={handleSignOut} style={styles.navBtn}>
              Sign Out
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div 
            style={{ 
              marginBottom: 16, 
              padding: 12, 
              background: "#7f1d1d",
              border: "1px solid #991b1b",
              borderRadius: 8,
              color: "#fca5a5" 
            }}
          >
            {error}
          </div>
        )}

        {/* Stats Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: 14,
            marginBottom: 18,
          }}
        >
          <Card 
            title="Total Buildings" 
            value={`${totals.totalBuildings}`} 
            accent="#38bdf8" 
          />
          <Card 
            title="Total Occupants" 
            value={totals.totalOccupants.toLocaleString()} 
            accent="#22c55e" 
          />
          <Card 
            title="Avg Occupants" 
            value={totals.avgOccupants.toFixed(1)} 
            accent="#f97316" 
          />
          <Card 
            title="Missing Coords" 
            value={`${totals.missingCoords}`} 
            accent="#a78bfa" 
          />
        </div>

        {/* Charts */}
        <div 
          style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", 
            gap: 14 
          }}
        >
          {/* Pie Chart */}
          <section
            style={{
              borderRadius: 14,
              background: "#111827",
              border: "1px solid #1f2937",
              padding: 16,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, marginBottom: 12 }}>
              Buildings by Classification
            </h2>

            <div style={{ height: 320 }}>
              {totals.chart.length > 0 ? (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie 
                      dataKey="value" 
                      data={totals.chart} 
                      label 
                      stroke="#111827"
                    >
                      {totals.chart.map((_, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={PIE_COLORS[index % PIE_COLORS.length]} 
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  height: "100%",
                  color: "#6b7280"
                }}>
                  No classification data available
                </div>
              )}
            </div>
          </section>

          {/* Map */}
          <section
            style={{
              borderRadius: 14,
              background: "#111827",
              border: "1px solid #1f2937",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: 12, borderBottom: "1px solid #1f2937" }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                Building Locations
              </h2>
            </div>

            <div style={{ height: 340 }}>
              <CityMap points={totals.points} center={totals.center} />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}