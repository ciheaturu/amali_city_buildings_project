"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type QuickStats = {
  totalBuildings: number;
  totalOccupants: number;
  avgAge: number;
  infrastructureScore: number;
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

export default function CityHomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [cityName, setCityName] = useState("");
  const [userName, setUserName] = useState("");
  const [stats, setStats] = useState<QuickStats>({
    totalBuildings: 0,
    totalOccupants: 0,
    avgAge: 0,
    infrastructureScore: 0,
  });

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);

      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!user) {
        router.push("/login");
        return;
      }

      setUserName(user.email?.split("@")[0] || "User");

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, city_id")
        .eq("user_id", user.id)
        .single();

      if (profile?.role === "admin") {
        router.push("/admin");
        return;
      }

      if (profile?.city_id) {
        const { data: city } = await supabase
          .from("cities")
          .select("name")
          .eq("id", profile.city_id)
          .single();

        if (city) setCityName(city.name);

        // Load quick stats
        const { data: buildings } = await supabase
          .from("buildings")
          .select("occupants, year_built, has_electricity, has_water, has_sewerage")
          .eq("city_id", profile.city_id);

        if (buildings) {
          const totalBuildings = buildings.length;
          const totalOccupants = buildings.reduce((sum, b) => sum + (b.occupants || 0), 0);

          // Calculate average age
          const currentYear = new Date().getFullYear();
          const buildingsWithAge = buildings.filter((b) => b.year_built);
          const avgAge = buildingsWithAge.length
            ? buildingsWithAge.reduce((sum, b) => sum + (currentYear - (b.year_built || currentYear)), 0) /
              buildingsWithAge.length
            : 0;

          // Calculate infrastructure score
          const withElectricity = buildings.filter((b) => b.has_electricity).length;
          const withWater = buildings.filter((b) => b.has_water).length;
          const withSewerage = buildings.filter((b) => b.has_sewerage).length;
          const infrastructureScore = totalBuildings
            ? ((withElectricity + withWater + withSewerage) / (totalBuildings * 3)) * 100
            : 0;

          setStats({
            totalBuildings,
            totalOccupants,
            avgAge: Math.round(avgAge),
            infrastructureScore: Math.round(infrastructureScore),
          });
        }
      }

      setLoading(false);
    }

    loadDashboard();
  }, [router]);

  async function handleSignOut() {
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
          <div style={{ fontSize: 18, fontWeight: 600, color: "#9ca3af" }}>Loading...</div>
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
              Welcome back, {userName}!
            </h1>
            <p style={{ opacity: 0.9, margin: 0, fontSize: 16 }}>
              {cityName ? `Managing ${cityName}` : "City Building Management"}
            </p>
          </div>

          <button
            onClick={handleSignOut}
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
            title="Total Buildings"
            value={stats.totalBuildings.toString()}
            color="#38bdf8"
          />
          <StatCard
            title="Total Occupants"
            value={stats.totalOccupants.toLocaleString()}
            color="#22c55e"
          />
          <StatCard
            title="Average Building Age"
            value={`${stats.avgAge} yrs`}
            color="#f97316"
          />
          <StatCard
            title="Infrastructure Score"
            value={`${stats.infrastructureScore}%`}
            color={stats.infrastructureScore > 70 ? "#22c55e" : stats.infrastructureScore > 40 ? "#f97316" : "#e11d48"}
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
              onClick={() => router.push("/app/buildings/new")}
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
                Capture a new building record
              </div>
            </div>

            <div
              onClick={() => router.push("/app/buildings")}
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
              <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 6 }}>View All Buildings</div>
              <div style={{ fontSize: 13, opacity: 0.7 }}>
                Browse and manage records
              </div>
            </div>

            <div
              onClick={() => router.push("/app/dashboard")}
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
                View charts and insights
              </div>
            </div>
          </div>
        </div>

        {/* Platform Features */}
        <div
          style={{
            borderRadius: 16,
            background: "#111827",
            border: "1px solid #1f2937",
            padding: 24,
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, marginBottom: 20 }}>
            Platform Features
          </h2>

          <div style={{ display: "grid", gap: 20 }}>
            <div style={{ paddingLeft: 16, borderLeft: "3px solid #38bdf8" }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, marginBottom: 6 }}>
                Interactive Mapping
              </h3>
              <p style={{ margin: 0, fontSize: 14, color: "#9ca3af", lineHeight: 1.6 }}>
                Visualize all your buildings on an interactive map with geolocation support
              </p>
            </div>

            <div style={{ paddingLeft: 16, borderLeft: "3px solid #22c55e" }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, marginBottom: 6 }}>
                Advanced Analytics
              </h3>
              <p style={{ margin: 0, fontSize: 14, color: "#9ca3af", lineHeight: 1.6 }}>
                Track condition, compliance, utilities, and infrastructure health metrics
              </p>
            </div>

            <div style={{ paddingLeft: 16, borderLeft: "3px solid #a78bfa" }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, marginBottom: 6 }}>
                Data Export
              </h3>
              <p style={{ margin: 0, fontSize: 14, color: "#9ca3af", lineHeight: 1.6 }}>
                Export your building data to CSV for external analysis and reporting
              </p>
            </div>

            <div style={{ paddingLeft: 16, borderLeft: "3px solid #f97316" }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, marginBottom: 6 }}>
                Comprehensive Data
              </h3>
              <p style={{ margin: 0, fontSize: 14, color: "#9ca3af", lineHeight: 1.6 }}>
                Track building condition, age, utilities, compliance, ownership, and more
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}