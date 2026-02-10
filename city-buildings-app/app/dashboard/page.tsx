"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { PieChart, Pie, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import dynamic from "next/dynamic";

// Dynamically import the map to disable SSR
const CityMap = dynamic(() => import("./CityMap"), { ssr: false });

// Types
type Building = {
  id: string;
  building_name: string;
  classification: string;
  occupants: number | null;
  latitude: number | null;
  longitude: number | null;
};

type DashboardTotals = {
  totalBuildings: number;
  totalOccupants: number;
  avgOccupants: number;
  missingCoords: number;
  chart: Array<{ name: string; value: number }>;
  points: Array<Building & { latitude: number; longitude: number }>;
  center: [number, number];
};

// Constants
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

  btnRed: {
    padding: "10px 16px",
    borderRadius: 10,
    background: "#dc2626",
    border: "none",
    color: "white",
    fontWeight: 800,
    cursor: "pointer",
    transition: "all 0.2s",
  } as React.CSSProperties,
};

// Card Component
function StatCard({
  title,
  value,
  subtitle,
  accent = "#38bdf8",
}: {
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
        transition: "transform 0.2s",
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: "#9ca3af",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 32,
          fontWeight: 900,
          marginTop: 8,
          color: accent,
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
  const escape = (value: unknown): string => {
    const stringValue = (value ?? "").toString().replace(/"/g, '""');
    return `"${stringValue}"`;
  };

  const headerLine = headers.join(",");
  const dataLines = rows.map((row) => headers.map((header) => escape(row[header])).join(","));

  return [headerLine, ...dataLines].join("\n");
}

function downloadCsv(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Main Dashboard Component
export default function DashboardPage() {
  const router = useRouter();

  // State
  const [buildings, setBuildings] = useState<Building[]>([]);
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

  // Load dashboard data
  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);
      setError(null);

      try {
        // 1. Check authentication
        const { data: userData, error: authError } = await supabase.auth.getUser();

        if (authError || !userData.user) {
          router.replace("/login");
          return;
        }

        // 2. Get user profile
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role, city_id")
          .eq("user_id", userData.user.id)
          .single();

        if (profileError) throw profileError;

        // 3. Redirect admins to admin dashboard
        if (profile?.role === "admin") {
          router.replace("/admin/dashboard");
          return;
        }

        // 4. Validate city assignment
        if (!profile?.city_id) {
          setError("Your profile is not assigned to a city. Please contact an administrator.");
          setLoading(false);
          return;
        }

        // 5. Get city information
        const { data: cityData, error: cityError } = await supabase
          .from("cities")
          .select("name")
          .eq("id", profile.city_id)
          .single();

        if (!cityError && cityData) {
          setCityName(cityData.name);
        }

        // 6. Get all buildings
        const { data: buildingsData, error: buildingsError } = await supabase
          .from("buildings")
          .select("id, building_name, classification, occupants, latitude, longitude")
          .order("building_name", { ascending: true });

        if (buildingsError) throw buildingsError;

        setBuildings((buildingsData ?? []) as Building[]);
      } catch (err: any) {
        console.error("Dashboard load error:", err);
        setError(err.message || "An error occurred while loading dashboard data");
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, [router]);

  // Calculate dashboard analytics
  const analytics = useMemo((): DashboardTotals => {
    const totalBuildings = buildings.length;
    const totalOccupants = buildings.reduce((sum, building) => sum + (building.occupants ?? 0), 0);
    const avgOccupants = totalBuildings > 0 ? totalOccupants / totalBuildings : 0;
    const missingCoords = buildings.filter(
      (building) => building.latitude == null || building.longitude == null
    ).length;

    // Group buildings by classification
    const classificationCounts: Record<string, number> = {};
    buildings.forEach((building) => {
      const classification = building.classification || "Unclassified";
      classificationCounts[classification] = (classificationCounts[classification] ?? 0) + 1;
    });

    const chartData = Object.entries(classificationCounts).map(([name, value]) => ({
      name,
      value,
    }));

    // Filter buildings with valid coordinates
    const validPoints = buildings
      .filter((building) => building.latitude != null && building.longitude != null)
      .map((building) => ({
        ...building,
        latitude: building.latitude as number,
        longitude: building.longitude as number,
      }));

    // Calculate map center (default to Johannesburg)
    let mapCenter: [number, number] = [-26.2041, 28.0473];
    if (validPoints.length > 0) {
      const avgLat = validPoints.reduce((sum, point) => sum + point.latitude, 0) / validPoints.length;
      const avgLon = validPoints.reduce((sum, point) => sum + point.longitude, 0) / validPoints.length;
      mapCenter = [avgLat, avgLon];
    }

    return {
      totalBuildings,
      totalOccupants,
      avgOccupants,
      missingCoords,
      chart: chartData,
      points: validPoints,
      center: mapCenter,
    };
  }, [buildings]);

  // Export buildings to CSV
  async function handleExportCsv() {
    setError(null);

    try {
      const { data, error } = await supabase
        .from("buildings")
        .select(
          "id, building_name, street_address, latitude, longitude, classification, occupants, photo_url, created_at, updated_at"
        )
        .order("building_name", { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        setError("No buildings to export");
        return;
      }

      const filename = cityName
        ? `${cityName.toLowerCase().replace(/\s+/g, "_")}_buildings_${new Date().toISOString().split("T")[0]}.csv`
        : `city_buildings_${new Date().toISOString().split("T")[0]}.csv`;

      downloadCsv(filename, toCsv(data));
    } catch (err: any) {
      console.error("Export error:", err);
      setError(err.message || "Failed to export CSV");
    }
  }

  // Sign out handler
  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
      router.replace("/login");
    } catch (err: any) {
      console.error("Sign out error:", err);
      setError("Failed to sign out");
    }
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
        }}
      >
        <div style={{ textAlign: "center" }}>
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
          <div style={{ fontSize: 18, fontWeight: 600, color: "#9ca3af" }}>
            Loading dashboard...
          </div>
        </div>
        <style jsx>{`
          @keyframes spin {
            0% {
              transform: rotate(0deg);
            }
            100% {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </main>
    );
  }

  // Main render
  return (
    <main style={{ background: "#020617", minHeight: "100vh", color: "white" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: 24 }}>
        {/* Header Section */}
        <header
          style={{
            borderRadius: 16,
            padding: 24,
            background: "linear-gradient(135deg, #1d4ed8, #0ea5e9)",
            marginBottom: 24,
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          <h1 style={{ fontSize: 32, fontWeight: 900, margin: 0, marginBottom: 8 }}>
            {cityName ? `${cityName} Dashboard` : "City Dashboard"}
          </h1>
          <p style={{ opacity: 0.9, margin: 0, fontSize: 16 }}>
            Buildings, occupants and spatial coverage overview
          </p>

          {/* Navigation Buttons */}
          <nav
            style={{
              marginTop: 20,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button onClick={() => router.push("/app")} style={styles.navBtn}>
                Home
              </button>
              <button onClick={() => router.push("/app/buildings")} style={styles.navBtn}>
                Buildings
              </button>
              <button onClick={() => router.push("/app/buildings/new")} style={styles.btnGreen}>
                Add Building
              </button>
              <button onClick={handleExportCsv} style={styles.navBtn}>
                Export CSV
              </button>
            </div>

            <button onClick={handleSignOut} style={styles.btnRed}>
              Sign Out
            </button>
          </nav>
        </header>

        {/* Error Message */}
        {error && (
          <div
            style={{
              marginBottom: 20,
              padding: 16,
              background: "#7f1d1d",
              border: "1px solid #991b1b",
              borderRadius: 12,
              color: "#fca5a5",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span style={{ fontSize: 20 }}></span>
            <span style={{ flex: 1 }}>{error}</span>
            <button
              onClick={() => setError(null)}
              style={{
                background: "transparent",
                border: "none",
                color: "#fca5a5",
                cursor: "pointer",
                fontSize: 20,
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Statistics Cards */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <StatCard
            title="Total Buildings"
            value={analytics.totalBuildings.toString()}
            accent="#38bdf8"
          />
          <StatCard
            title="Total Occupants"
            value={analytics.totalOccupants.toLocaleString()}
            accent="#22c55e"
          />
          <StatCard
            title="Avg Occupants"
            value={analytics.avgOccupants.toFixed(1)}
            accent="#f97316"
          />
          <StatCard
            title="Missing Coords"
            value={analytics.missingCoords.toString()}
            accent="#a78bfa"
            subtitle={
              analytics.missingCoords > 0
                ? `${((analytics.missingCoords / analytics.totalBuildings) * 100).toFixed(1)}% of total`
                : "All buildings mapped"
            }
          />
        </section>

        {/* Charts Section */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(450px, 1fr))",
            gap: 16,
          }}
        >
          {/* Pie Chart - Classification */}
          <div
            style={{
              borderRadius: 14,
              background: "#111827",
              border: "1px solid #1f2937",
              padding: 20,
              boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
            }}
          >
            <h2
              style={{
                margin: 0,
                marginBottom: 16,
                fontSize: 18,
                fontWeight: 800,
                color: "#f3f4f6",
              }}
            >
              Buildings by Classification
            </h2>

            <div style={{ height: 340 }}>
              {analytics.chart.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      dataKey="value"
                      data={analytics.chart}
                      label={(entry) => `${entry.name}: ${entry.value}`}
                      stroke="#111827"
                      strokeWidth={2}
                    >
                      {analytics.chart.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "#1f2937",
                        border: "1px solid #374151",
                        borderRadius: 8,
                        color: "white",
                      }}
                    />
                    <Legend
                      wrapperStyle={{
                        paddingTop: 10,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    color: "#6b7280",
                    fontSize: 16,
                  }}
                >
                  No classification data available
                </div>
              )}
            </div>
          </div>

          {/* Map - Building Locations */}
          <div
            style={{
              borderRadius: 14,
              background: "#111827",
              border: "1px solid #1f2937",
              overflow: "hidden",
              boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
            }}
          >
            <div style={{ padding: 16, borderBottom: "1px solid #1f2937" }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#f3f4f6" }}>
                Building Locations
              </h2>
              <p style={{ margin: 0, marginTop: 4, fontSize: 14, color: "#9ca3af" }}>
                {analytics.points.length} buildings mapped
              </p>
            </div>

            <div style={{ height: 380 }}>
              <CityMap points={analytics.points} center={analytics.center} />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}