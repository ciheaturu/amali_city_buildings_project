"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function redirectIfLoggedIn() {
      const { data } = await supabase.auth.getUser();
      if (data.user) router.push("/me");
    }
    redirectIfLoggedIn();
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push("/me");
  }

  return (
    <main style={{ background: "#020617", minHeight: "100vh", color: "white" }}>
      <div style={{ maxWidth: 520, margin: "0 auto", padding: 24 }}>
        <div
          style={{
            borderRadius: 16,
            padding: 20,
            background: "linear-gradient(135deg,#1d4ed8,#0ea5e9)",
            marginTop: 24,
          }}
        >
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>Log in</h1>
          <p style={{ opacity: 0.85, marginTop: 6 }}>
            Access your city account or admin dashboard
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          style={{
            marginTop: 16,
            borderRadius: 16,
            background: "#0b1220",
            border: "1px solid #1f2937",
            padding: 18,
            display: "grid",
            gap: 12,
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>
              Email
            </span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 10,
                border: "1px solid #1f2937",
                background: "#111827",
                color: "white",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>
              Password
            </span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 10,
                border: "1px solid #1f2937",
                background: "#111827",
                color: "white",
              }}
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              background: "#38bdf8",
              border: "none",
              fontWeight: 900,
              cursor: loading ? "not-allowed" : "pointer",
              marginTop: 6,
            }}
          >
            {loading ? "Signing in..." : "Log in"}
          </button>

          {error ? <p style={{ color: "#fca5a5", margin: 0 }}>{error}</p> : null}

          <p style={{ margin: 0, color: "#9ca3af", fontSize: 12 }}>
            New city{" "}
            <a href="/signup" style={{ color: "#38bdf8", fontWeight: 800 }}>
              Create an account
            </a>
          </p>
        </form>
      </div>
    </main>
  );
}
