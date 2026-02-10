"use client";

import { useEffect, useState } from "react";

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstall(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setShowInstall(false);
    }

    setDeferredPrompt(null);
  };

  if (!showInstall) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        left: 20,
        right: 20,
        maxWidth: 400,
        margin: "0 auto",
        padding: 16,
        background: "#111827",
        border: "1px solid #1f2937",
        borderRadius: 12,
        display: "flex",
        alignItems: "center",
        gap: 12,
        zIndex: 1000,
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Install App</div>
        <div style={{ fontSize: 13, color: "#9ca3af" }}>
          Add to home screen for quick access
        </div>
      </div>
      <button
        onClick={handleInstall}
        style={{
          padding: "8px 16px",
          background: "#0ea5e9",
          border: "none",
          borderRadius: 8,
          color: "white",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Install
      </button>
      <button
        onClick={() => setShowInstall(false)}
        style={{
          padding: "8px 12px",
          background: "transparent",
          border: "1px solid #374151",
          borderRadius: 8,
          color: "white",
          cursor: "pointer",
        }}
      >
        ✕
      </button>
    </div>
  );
}