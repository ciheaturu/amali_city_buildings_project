"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function BuildingsPage() {
  const router = useRouter();
  const [buildings, setBuildings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBuildings() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("city_id")
        .eq("user_id", userData.user.id)
        .single();

      if (profile?.city_id) {
        const { data } = await supabase
          .from("buildings")
          .select("*")
          .eq("city_id", profile.city_id)
          .order("created_at", { ascending: false });

        setBuildings(data || []);
      }

      setLoading(false);
    }
    loadBuildings();
  }, [router]);

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
            padding: 24,
            background: "linear-gradient(135deg, #1d4ed8, #0ea5e9)",
            marginBottom: 24,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 900, margin: 0 }}>Buildings</h1>
            <p style={{ opacity: 0.9, margin: 0, marginTop: 4 }}>
              {buildings.length} building{buildings.length !== 1 ? "s" : ""} found
            </p>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={() => router.push("/app")}
              style={{
                padding: "10px 16px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.2)",
                border: "1px solid rgba(255,255,255,0.3)",
                color: "white",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              ← Back
            </button>
            <button
              onClick={() => router.push("/app/buildings/new")}
              style={{
                padding: "10px 16px",
                borderRadius: 10,
                background: "#38bdf8",
                border: "none",
                color: "#0b1220",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Add Building
            </button>
          </div>
        </div>

        {buildings.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: 60,
              borderRadius: 16,
              background: "#111827",
              border: "1px solid #1f2937",
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}></div>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>No buildings yet</h2>
            <p style={{ color: "#9ca3af", marginBottom: 24 }}>
              Start by adding your first building
            </p>
            <button
              onClick={() => router.push("/app/buildings/new")}
              style={{
                padding: "12px 24px",
                borderRadius: 10,
                background: "#38bdf8",
                border: "none",
                color: "#0b1220",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Add Your First Building
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {buildings.map((building) => (
              <div
                key={building.id}
                style={{
                  borderRadius: 12,
                  padding: 20,
                  background: "#111827",
                  border: "1px solid #1f2937",
                }}
              >
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, marginBottom: 8 }}>
                  {building.address || "No address"}
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, color: "#9ca3af", fontSize: 14 }}>
                  <div>{building.location_description || "No location"}</div>
                  <div>{building.occupants || 0} occupants</div>
                  {building.year_built && <div>Built {building.year_built}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}