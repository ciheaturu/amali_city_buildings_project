"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [cityName, setCityName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cityName, email, password }),
    });

    setLoading(false);

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(body.error ?? "Signup failed");
      return;
    }

    router.push("/login");
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
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>City sign up</h1>
          <p style={{ opacity: 0.85, marginTop: 6 }}>
            Create a city account to capture and manage buildings
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
              City name
            </span>
            <input
              value={cityName}
              onChange={(e) => setCityName(e.target.value)}
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
            {loading ? "Creating..." : "Create account"}
          </button>

          {error ? <p style={{ color: "#fca5a5", margin: 0 }}>{error}</p> : null}

          <p style={{ margin: 0, color: "#9ca3af", fontSize: 12 }}>
            Already have an account{" "}
            <a href="/login" style={{ color: "#38bdf8", fontWeight: 800 }}>
              Log in
            </a>
          </p>
        </form>
      </div>
    </main>
  );
}
