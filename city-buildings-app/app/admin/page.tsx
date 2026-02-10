"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type AdminStats = {
  totalCities: number;
  totalBuildings: number;
  totalOccupants: number;
  avgInfrastructureScore: number;
};

function StatCard({ title, value, color }: { title: string; value: string; color: string }) {
  return (
    <div
      style={{
        borderRadius: 14,
        padding: 20,
        background: "#111827",
        border: "1px solid #1f2937",
        boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
      }}
    >
      <div style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ fontSize: 32, fontWeight: 900, color }}>{value}</div>
    </div>
  );
}

export default function AdminHomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [adminEmail, setAdminEmail] = useState("");
  const [stats, setStats] = useState<AdminStats>({
    totalCities: 0,
    totalBuildings: 0,
    totalOccupants: 0,
    avgInfrastructureScore: 0,
  });

  useEffect(() => {
    async function loadAdminDashboard() {
      setLoading(true);

      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!user) {
        router.push("/login");
        return;
      }

      setAdminEmail(user.email || "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (profile?.role !== "admin") {
        router.push("/app");
        return;
      }

      // Load cities
      const { data: cities } = await supabase.from("cities").select("id");
      const totalCities = cities?.length || 0;

      // Load buildings
      const { data: buildings } = await supabase
        .from("buildings")
        .select("occupants, has_electricity, has_water, has_sewerage");

      if (buildings) {
        const totalBuildings = buildings.length;
        const totalOccupants = buildings.reduce((sum, b) => sum + (b.occupants || 0), 0);

        // Calculate infrastructure score
        const withElectricity = buildings.filter((b) => b.has_electricity).length;
        const withWater = buildings.filter((b) => b.has_water).length;
        const withSewerage = buildings.filter((b) => b.has_sewerage).length;
        const avgInfrastructureScore = totalBuildings
          ? ((withElectricity + withWater + withSewerage) / (totalBuildings * 3)) * 100
          : 0;

        setStats({
          totalCities,
          totalBuildings,
          totalOccupants,
          avgInfrastructureScore: Math.round(avgInfrastructureScore),
        });
      } else {
        setStats({
          totalCities,
          totalBuildings: 0,
          totalOccupants: 0,
          avgInfrastructureScore: 0,
        });
      }

      setLoading(false);
    }

    loadAdminDashboard();
  }, [router]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
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
          <div style={{ fontSize: 18, fontWeight: 600, color: "#9ca3af" }}>Loading admin dashboard...</div>
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

  return (
    <main style={{ background: "#020617", minHeight: "100vh", color: "white" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: 24 }}>
        {/* Header */}
        <div
          style={{
            borderRadius: 16,
            padding: 24,
            background: "linear-gradient(135deg, #1d4ed8, #0ea5e9)",
            marginBottom: 24,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div>
            <h1 style={{ fontSize: 36, fontWeight: 900, margin: 0, marginBottom: 8 }}>
              Admin Control Center
            </h1>
            <p style={{ opacity: 0.9, margin: 0, fontSize: 16 }}>
              Cross-city building management and analytics • {adminEmail}
            </p>
          </div>

          <button
            onClick={signOut}
            style={{
              padding: "12px 20px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.2)",
              border: "1px solid rgba(255,255,255,0.3)",
              color: "white",
              fontWeight: 800,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Sign Out
          </button>
        </div>

        {/* Quick Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
            marginBottom: 32,
          }}
        >
          <StatCard
            title="Total Cities"
            value={stats.totalCities.toString()}
            color="#a78bfa"
          />
          <StatCard
            title="Total Buildings"
            value={stats.totalBuildings.toLocaleString()}
            color="#38bdf8"
          />
          <StatCard
            title="Total Occupants"
            value={stats.totalOccupants.toLocaleString()}
            color="#22c55e"
          />
          <StatCard
            title="Infrastructure Score"
            value={`${stats.avgInfrastructureScore}%`}
            color={
              stats.avgInfrastructureScore > 70
                ? "#22c55e"
                : stats.avgInfrastructureScore > 40
                ? "#f97316"
                : "#e11d48"
            }
          />
        </div>

        {/* Quick Actions */}
        <div
          style={{
            borderRadius: 16,
            background: "#111827",
            border: "1px solid #1f2937",
            padding: 24,
            marginBottom: 24,
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, marginBottom: 16 }}>
            Quick Actions
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: 16,
            }}
          >
            <div
              onClick={() => router.push("/admin/buildings/new")}
              style={{
                textAlign: "left",
                padding: 20,
                borderRadius: 10,
                background: "#38bdf8",
                border: "none",
                color: "#0b1220",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(56, 189, 248, 0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 6 }}>Add New Building</div>
              <div style={{ fontSize: 13, opacity: 0.8 }}>
                Create building for any city
              </div>
            </div>

            <div
              onClick={() => router.push("/admin/buildings")}
              style={{
                textAlign: "left",
                padding: 20,
                borderRadius: 10,
                background: "#111827",
                border: "1px solid #1f2937",
                color: "white",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#1f2937";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#111827";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 6 }}>Manage Buildings</div>
              <div style={{ fontSize: 13, opacity: 0.7 }}>
                View, edit, and export all buildings
              </div>
            </div>

            <div
              onClick={() => router.push("/admin/dashboard")}
              style={{
                textAlign: "left",
                padding: 20,
                borderRadius: 10,
                background: "#111827",
                border: "1px solid #1f2937",
                color: "white",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#1f2937";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#111827";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 6 }}>Analytics Dashboard</div>
              <div style={{ fontSize: 13, opacity: 0.7 }}>
                Cross-city insights and charts
              </div>
            </div>
          </div>
        </div>

        {/* Admin Capabilities */}
        <div
          style={{
            borderRadius: 16,
            background: "#111827",
            border: "1px solid #1f2937",
            padding: 24,
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, marginBottom: 20 }}>
            Admin Capabilities
          </h2>

          <div style={{ display: "grid", gap: 20 }}>
            <div style={{ paddingLeft: 16, borderLeft: "3px solid #38bdf8" }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, marginBottom: 6 }}>
                Multi-City Management
              </h3>
              <p style={{ margin: 0, fontSize: 14, color: "#9ca3af", lineHeight: 1.6 }}>
                Manage buildings across all cities from a single interface with full CRUD capabilities
              </p>
            </div>

            <div style={{ paddingLeft: 16, borderLeft: "3px solid #22c55e" }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, marginBottom: 6 }}>
                Advanced Analytics
              </h3>
              <p style={{ margin: 0, fontSize: 14, color: "#9ca3af", lineHeight: 1.6 }}>
                Compare cities, track condition, compliance, ownership, utilities, and infrastructure health
              </p>
            </div>

            <div style={{ paddingLeft: 16, borderLeft: "3px solid #a78bfa" }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, marginBottom: 6 }}>
                Data Visualization
              </h3>
              <p style={{ margin: 0, fontSize: 14, color: "#9ca3af", lineHeight: 1.6 }}>
                Interactive charts for classification, condition, ownership, compliance, and utilities
              </p>
            </div>

            <div style={{ paddingLeft: 16, borderLeft: "3px solid #f97316" }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, marginBottom: 6 }}>
                Bulk Data Export
              </h3>
              <p style={{ margin: 0, fontSize: 14, color: "#9ca3af", lineHeight: 1.6 }}>
                Export comprehensive building data across all cities to CSV for external analysis
              </p>
            </div>

            <div style={{ paddingLeft: 16, borderLeft: "3px solid #06b6d4" }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, marginBottom: 6 }}>
                Unified Map View
              </h3>
              <p style={{ margin: 0, fontSize: 14, color: "#9ca3af", lineHeight: 1.6 }}>
                View all building locations across all cities on a single interactive map
              </p>
            </div>

            <div style={{ paddingLeft: 16, borderLeft: "3px solid #eab308" }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, marginBottom: 6 }}>
                Comprehensive Building Data
              </h3>
              <p style={{ margin: 0, fontSize: 14, color: "#9ca3af", lineHeight: 1.6 }}>
                Track 18+ building attributes including condition, age, utilities, compliance, and more
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}