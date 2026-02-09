"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function CityDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/login");
        return;
      }
      setLoading(false);
    }
    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <main style={{ background: "#020617", minHeight: "100vh", color: "white", padding: 24 }}>
        Loading...
      </main>
    );
  }

  return (
    <main style={{ background: "#020617", minHeight: "100vh", color: "white", padding: 24 }}>
      <h1 style={{ fontSize: 32, fontWeight: 900 }}>City Dashboard</h1>
      <p style={{ marginTop: 12, color: "#9ca3af" }}>
        Welcome to your city dashboard. Manage your buildings here.
      </p>
      
      <div style={{ marginTop: 24 }}>
        <a 
          href="/buildings" 
          style={{ 
            display: "inline-block",
            padding: "12px 24px", 
            background: "#38bdf8", 
            borderRadius: 10, 
            fontWeight: 900,
            textDecoration: "none",
            color: "#000"
          }}
        >
          View Buildings
        </a>
      </div>
    </main>
  );
}