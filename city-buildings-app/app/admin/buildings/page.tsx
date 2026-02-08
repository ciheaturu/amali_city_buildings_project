"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type City = { id: string; name: string };

type Building = {
  id: string;
  city_id: string;
  building_name: string;
  street_address: string;
  classification: string;
  occupants: number | null;
  latitude: number | null;
  longitude: number | null;
};

function toCsv(rows: any[]) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);

  const escape = (v: unknown) => {
    const s = (v ?? "").toString().replace(/"/g, '""');
    return `"${s}"`;
  };

  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ];

  return lines.join("\n");
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminBuildingsPage() {
  const router = useRouter();

  const [cities, setCities] = useState<City[]>([]);
  const [rows, setRows] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const cityNameById = useMemo(() => {
    const m = new Map<string, string>();
    cities.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [cities]);

  async function load() {
    setLoading(true);
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.replace("/login");
      return;
    }

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", userData.user.id)
      .single();

    if (pErr || profile?.role !== "admin") {
      router.replace("/app");
      return;
    }

    const { data: cityRows, error: cityErr } = await supabase
      .from("cities")
      .select("id, name")
      .order("name", { ascending: true });

    if (cityErr) {
      setLoading(false);
      setError(cityErr.message);
      return;
    }

    setCities((cityRows ?? []) as City[]);

    const { data, error } = await supabase
      .from("buildings")
      .select(
        "id, city_id, building_name, street_address, classification, occupants, latitude, longitude"
      )
      .order("created_at", { ascending: false });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setRows((data ?? []) as Building[]);
  }

  useEffect(() => {
    load();
  }, []);

  async function exportAll() {
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.replace("/login");
      return;
    }

    const { data, error } = await supabase
      .from("buildings")
      .select(
        "id, city_id, building_name, street_address, latitude, longitude, classification, occupants, photo_url, created_at, updated_at"
      );

    if (error) {
      setError(error.message);
      return;
    }

    const enriched = (data ?? []).map((r: any) => ({
      ...r,
      city_name: cityNameById.get(r.city_id) ?? "",
    }));

    downloadCsv("admin_buildings_all.csv", toCsv(enriched));
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  async function deleteBuilding(id: string, name: string) {
    setError(null);

    const ok = window.confirm(
      `Are you sure you want to delete "${name}"?\n\nThis action cannot be undone.`
    );
    if (!ok) return;

    setDeletingId(id);

    const { error } = await supabase.from("buildings").delete().eq("id", id);

    setDeletingId(null);

    if (error) {
      setError(error.message);
      return;
    }

    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  const btnDark = (disabled?: boolean): React.CSSProperties => ({
    padding: "10px 12px",
    borderRadius: 10,
    background: disabled ? "#334155" : "#111827",
    color: "white",
    border: "1px solid #1f2937",
    fontWeight: 800,
    cursor: disabled ? "not-allowed" : "pointer",
  });

  const btnGreen: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 10,
    background: "#22c55e",
    border: "none",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };

  const btnBlueSmall: React.CSSProperties = {
    padding: "8px 10px",
    borderRadius: 10,
    background: "#2563eb",
    border: "none",
    color: "white",
    fontWeight: 800,
    cursor: "pointer",
  };

  const btnRedSmall = (disabled?: boolean): React.CSSProperties => ({
    padding: "8px 10px",
    borderRadius: 10,
    background: disabled ? "#7f1d1d" : "#dc2626",
    border: "none",
    color: "white",
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
  });

  return (
    <main style={{ background: "#020617", minHeight: "100vh", color: "white" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: 24 }}>
        <div
          style={{
            borderRadius: 16,
            padding: 20,
            background: "linear-gradient(135deg,#1d4ed8,#0ea5e9)",
          }}
        >
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>All buildings</h1>
          <p style={{ opacity: 0.85, marginTop: 6 }}>
            Add, edit, and export buildings across all cities
          </p>

          <div
            style={{
              marginTop: 12,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => router.push("/admin")} style={btnDark()}>
                Home
              </button>

              <button onClick={() => router.push("/admin/dashboard")} style={btnDark()}>
                Dashboard
              </button>

              <button onClick={exportAll} disabled={rows.length === 0} style={btnDark(rows.length === 0)}>
                Export CSV
              </button>

              <button onClick={() => router.push("/admin/buildings/new")} style={btnGreen}>
                Add new building
              </button>
            </div>

            <button onClick={signOut} style={btnDark()}>
              Sign out
            </button>
          </div>
        </div>

        {loading ? <p style={{ marginTop: 16 }}>Loading...</p> : null}
        {error ? <p style={{ marginTop: 16, color: "#fca5a5" }}>{error}</p> : null}

        <div style={{ marginTop: 16, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #1f2937" }}>
                  City
                </th>
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #1f2937" }}>
                  Name
                </th>
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #1f2937" }}>
                  Address
                </th>
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #1f2937" }}>
                  Class
                </th>
                <th style={{ textAlign: "right", padding: 10, borderBottom: "1px solid #1f2937" }}>
                  Occupants
                </th>
                <th style={{ padding: 10, borderBottom: "1px solid #1f2937" }} />
              </tr>
            </thead>

            <tbody>
              {rows.map((b) => (
                <tr key={b.id}>
                  <td style={{ padding: 10, borderBottom: "1px solid #111827" }}>
                    {cityNameById.get(b.city_id) ?? b.city_id}
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid #111827" }}>{b.building_name}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #111827" }}>{b.street_address}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #111827" }}>{b.classification}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #111827", textAlign: "right" }}>
                    {b.occupants ?? ""}
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid #111827", textAlign: "right" }}>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                      <button
                        onClick={() => router.push(`/admin/buildings/${b.id}/edit`)}
                        style={btnBlueSmall}
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => deleteBuilding(b.id, b.building_name)}
                        disabled={deletingId === b.id}
                        style={btnRedSmall(deletingId === b.id)}
                      >
                        {deletingId === b.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 12 }}>
                    No buildings yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 14 }}>
          <button onClick={load} style={btnDark()}>
            Refresh
          </button>
        </div>
      </div>
    </main>
  );
}
