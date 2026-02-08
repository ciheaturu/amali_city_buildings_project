"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const btnDark: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  background: "#111827",
  color: "white",
  border: "1px solid #1f2937",
  fontWeight: 800,
  cursor: "pointer",
};

export default function AdminHomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function guard() {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (profile?.role !== "admin") {
        router.push("/app");
        return;
      }

      setLoading(false);
    }

    guard();
  }, [router]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
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
      <div style={{ maxWidth: 980, margin: "0 auto", padding: 24 }}>
        <div
          style={{
            borderRadius: 16,
            padding: 20,
            background: "linear-gradient(135deg,#1d4ed8,#0ea5e9)",
            marginBottom: 18,
          }}
        >
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>Admin</h1>
          <p style={{ opacity: 0.85, marginTop: 6 }}>
            Manage and analyse buildings across all cities
          </p>

          <div
            style={{
              marginTop: 12,
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
            }}
          >
            <button onClick={signOut} style={btnDark}>
              Sign out
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <button
            onClick={() => router.push("/admin/buildings")}
            style={{
              borderRadius: 14,
              padding: 18,
              background: "#111827",
              border: "1px solid #1f2937",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 900, color: "#22c55e" }}>
              Buildings
            </div>
            <div style={{ marginTop: 6, color: "#9ca3af", fontSize: 12 }}>
              Add, edit, and export buildings across cities
            </div>
          </button>

          <button
            onClick={() => router.push("/admin/dashboard")}
            style={{
              borderRadius: 14,
              padding: 18,
              background: "#111827",
              border: "1px solid #1f2937",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 900, color: "#38bdf8" }}>
              Dashboard
            </div>
            <div style={{ marginTop: 6, color: "#9ca3af", fontSize: 12 }}>
              Compare cities and view summary charts
            </div>
          </button>
        </div>
      </div>
    </main>
  );
}
