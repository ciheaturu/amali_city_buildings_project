"use client";

import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  return (
    <main
      style={{
        background: "linear-gradient(135deg, #020617, #0c4a6e)",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        padding: 24,
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 600 }}>
        {/* Logo/Title */}
        <div
          style={{
            fontSize: 56,
            fontWeight: 900,
            background: "linear-gradient(135deg, #38bdf8, #22c55e)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            marginBottom: 20,
          }}
        >
          City Buildings
        </div>

        {/* Subtitle */}
        <p
          style={{
            fontSize: 20,
            color: "#cbd5e1",
            marginBottom: 40,
            lineHeight: 1.6,
          }}
        >
          Manage and visualize city infrastructure with powerful analytics and mapping tools
        </p>

        {/* Buttons */}
        <div
          style={{
            display: "flex",
            gap: 16,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => router.push("/login")}
            style={{
              padding: "14px 32px",
              background: "#38bdf8",
              border: "none",
              borderRadius: 12,
              color: "white",
              fontWeight: 800,
              fontSize: 16,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#0ea5e9";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#38bdf8";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            Login
          </button>

          <button
            onClick={() => router.push("/signup")}
            style={{
              padding: "14px 32px",
              background: "#22c55e",
              border: "none",
              borderRadius: 12,
              color: "#052e16",
              fontWeight: 800,
              fontSize: 16,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#16a34a";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#22c55e";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            Sign Up
          </button>
        </div>

        {/* Features */}
        <div
          style={{
            marginTop: 60,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 20,
            textAlign: "center",
          }}
        >
          <div>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🏢</div>
            <div style={{ fontSize: 14, color: "#94a3b8", fontWeight: 600 }}>
              Building Management
            </div>
          </div>
          <div>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
            <div style={{ fontSize: 14, color: "#94a3b8", fontWeight: 600 }}>
              Analytics Dashboard
            </div>
          </div>
          <div>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🗺️</div>
            <div style={{ fontSize: 14, color: "#94a3b8", fontWeight: 600 }}>
              Interactive Maps
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}