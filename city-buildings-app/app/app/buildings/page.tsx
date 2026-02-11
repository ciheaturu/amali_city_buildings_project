"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Building = {
  id: string;
  building_name: string;
  street_address: string;
  classification: string;
  occupants: number | null;
  latitude: number | null;
  longitude: number | null;
  condition?: string | null;
  year_built?: number | null;
  ownership_type?: string | null;
  compliance_status?: string | null;
  has_electricity?: boolean;
  has_water?: boolean;
  has_sewerage?: boolean;
};

type Filters = {
  classification: string;
  condition: string;
  ownership: string;
  compliance: string;
  searchTerm: string;
  hasElectricity: boolean | null;
  hasWater: boolean | null;
  hasSewerage: boolean | null;
};

function toCsv(rows: any[]) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);

  const escape = (v: unknown) => {
    const s = (v ?? "").toString().replace(/"/g, '""');
    return `"${s}"`;
  };

  const lines = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))];
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

export default function BuildingsPage() {
  const router = useRouter();

  const [rows, setRows] = useState<Building[]>([]);
  const [cityName, setCityName] = useState<string>("");
  const [cityId, setCityId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState<Filters>({
    classification: "",
    condition: "",
    ownership: "",
    compliance: "",
    searchTerm: "",
    hasElectricity: null,
    hasWater: null,
    hasSewerage: null,
  });

  const filteredRows = useMemo(() => {
    return rows.filter((b) => {
      if (filters.classification && b.classification !== filters.classification) return false;
      if (filters.condition && b.condition !== filters.condition) return false;
      if (filters.ownership && b.ownership_type !== filters.ownership) return false;
      if (filters.compliance && b.compliance_status !== filters.compliance) return false;

      if (filters.hasElectricity !== null && b.has_electricity !== filters.hasElectricity) return false;
      if (filters.hasWater !== null && b.has_water !== filters.hasWater) return false;
      if (filters.hasSewerage !== null && b.has_sewerage !== filters.hasSewerage) return false;

      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        const nameMatch = b.building_name?.toLowerCase().includes(term);
        const addressMatch = b.street_address?.toLowerCase().includes(term);
        if (!nameMatch && !addressMatch) return false;
      }

      return true;
    });
  }, [rows, filters]);

  const hasActiveFilters = Object.values(filters).some((v) => v !== "" && v !== null);

  function clearFilters() {
    setFilters({
      classification: "",
      condition: "",
      ownership: "",
      compliance: "",
      searchTerm: "",
      hasElectricity: null,
      hasWater: null,
      hasSewerage: null,
    });
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
    color: "#052e16",
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

  const btnRed: React.CSSProperties = {
    padding: "8px 12px",
    borderRadius: 8,
    background: "#dc2626",
    border: "none",
    color: "white",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 12,
  };

  async function load() {
    setLoading(true);
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.replace("/login");
      return;
    }

    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("role, city_id")
      .eq("user_id", userData.user.id)
      .single();

    if (profErr) {
      setLoading(false);
      setError(profErr.message);
      return;
    }

    if (profile?.role === "admin") {
      router.replace("/admin/buildings");
      return;
    }

    if (profile?.role !== "city") {
      router.replace("/login");
      return;
    }

    if (!profile.city_id) {
      setCityName("");
      setCityId("");
      setRows([]);
      setLoading(false);
      return;
    }

    setCityId(profile.city_id);

    const { data: city, error: cityErr } = await supabase
      .from("cities")
      .select("name")
      .eq("id", profile.city_id)
      .single();

    if (!cityErr) setCityName(city?.name ?? "");
    else setCityName("");

    // Fetch all building fields for filtering
    const { data, error } = await supabase
      .from("buildings")
      .select("*")
      .eq("city_id", profile.city_id)
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

  async function exportFiltered() {
    setError(null);

    if (!cityId) {
      setError("Missing city id.");
      return;
    }

    const enriched = filteredRows.map((r: any) => ({
      building_name: r.building_name,
      street_address: r.street_address,
      classification: r.classification,
      condition: r.condition ?? "",
      year_built: r.year_built ?? "",
      occupants: r.occupants ?? "",
      ownership: r.ownership_type ?? "",
      compliance: r.compliance_status ?? "",
      electricity: r.has_electricity ? "Yes" : "No",
      water: r.has_water ? "Yes" : "No",
      sewerage: r.has_sewerage ? "Yes" : "No",
      latitude: r.latitude ?? "",
      longitude: r.longitude ?? "",
    }));

    const filename = cityName
      ? `${cityName.toLowerCase().replace(/\s+/g, "_")}_buildings${hasActiveFilters ? "_filtered" : ""}.csv`
      : "city_buildings.csv";

    downloadCsv(filename, toCsv(enriched));
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

    const { error } = await supabase.from("buildings").delete().eq("id", id).eq("city_id", cityId);

    setDeletingId(null);

    if (error) {
      setError(error.message);
      return;
    }

    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <main style={{ background: "#020617", minHeight: "100vh", color: "white" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: 24 }}>
        <div
          style={{
            borderRadius: 16,
            padding: 20,
            background: "linear-gradient(135deg,#1d4ed8,#0ea5e9)",
            marginBottom: 18,
          }}
        >
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>
            {cityName ? `${cityName} Buildings` : "City Buildings"}
          </h1>
          <p style={{ opacity: 0.85, marginTop: 6 }}>
            Manage your city's buildings ({filteredRows.length.toLocaleString()} {hasActiveFilters ? `of ${rows.length.toLocaleString()}` : ""})
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
              <button onClick={() => router.push("/app")} style={btnDark()}>
                Home
              </button>

              <button onClick={() => router.push("/app/dashboard")} style={btnDark()}>
                Dashboard
              </button>

              <button 
                onClick={() => setShowFilters(!showFilters)} 
                style={{ ...btnDark(), background: hasActiveFilters ? "#1e40af" : "#111827" }}
              >
                Filters {hasActiveFilters && `(${Object.values(filters).filter(v => v !== "" && v !== null).length})`}
              </button>

              <button onClick={exportFiltered} disabled={filteredRows.length === 0} style={btnDark(filteredRows.length === 0)}>
                Export CSV
              </button>

              <button onClick={() => router.push("/app/buildings/new")} style={btnGreen}>
                Add Building
              </button>
            </div>

            <button onClick={signOut} style={btnDark()}>
              Sign out
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div style={{ borderRadius: 14, background: "#111827", border: "1px solid #1f2937", padding: 18, marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Filter Buildings</h2>
              {hasActiveFilters && (
                <button onClick={clearFilters} style={btnRed}>Clear All Filters</button>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              {/* Search */}
              <div>
                <label style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600, display: "block", marginBottom: 6 }}>
                  Search
                </label>
                <input
                  value={filters.searchTerm}
                  onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                  placeholder="Name or address..."
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid #1f2937",
                    background: "#0b1220",
                    color: "white",
                    fontSize: 14,
                  }}
                />
              </div>

              {/* Classification */}
              <div>
                <label style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600, display: "block", marginBottom: 6 }}>
                  Classification
                </label>
                <select
                  value={filters.classification}
                  onChange={(e) => setFilters({ ...filters, classification: e.target.value })}
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid #1f2937",
                    background: "#0b1220",
                    color: "white",
                    fontSize: 14,
                  }}
                >
                  <option value="">All</option>
                  <option value="residential">Residential</option>
                  <option value="commercial">Commercial</option>
                  <option value="public">Public</option>
                  <option value="industrial">Industrial</option>
                  <option value="mixed-use">Mixed-use</option>
                </select>
              </div>

              {/* Condition */}
              <div>
                <label style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600, display: "block", marginBottom: 6 }}>
                  Condition
                </label>
                <select
                  value={filters.condition}
                  onChange={(e) => setFilters({ ...filters, condition: e.target.value })}
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid #1f2937",
                    background: "#0b1220",
                    color: "white",
                    fontSize: 14,
                  }}
                >
                  <option value="">All</option>
                  <option value="Excellent">Excellent</option>
                  <option value="Good">Good</option>
                  <option value="Fair">Fair</option>
                  <option value="Poor">Poor</option>
                  <option value="Dilapidated">Dilapidated</option>
                  <option value="Under Construction">Under Construction</option>
                </select>
              </div>

              {/* Ownership */}
              <div>
                <label style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600, display: "block", marginBottom: 6 }}>
                  Ownership
                </label>
                <select
                  value={filters.ownership}
                  onChange={(e) => setFilters({ ...filters, ownership: e.target.value })}
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid #1f2937",
                    background: "#0b1220",
                    color: "white",
                    fontSize: 14,
                  }}
                >
                  <option value="">All</option>
                  <option value="Private">Private</option>
                  <option value="Government">Government</option>
                  <option value="Municipal">Municipal</option>
                  <option value="Corporate">Corporate</option>
                </select>
              </div>

              {/* Compliance */}
              <div>
                <label style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600, display: "block", marginBottom: 6 }}>
                  Compliance
                </label>
                <select
                  value={filters.compliance}
                  onChange={(e) => setFilters({ ...filters, compliance: e.target.value })}
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid #1f2937",
                    background: "#0b1220",
                    color: "white",
                    fontSize: 14,
                  }}
                >
                  <option value="">All</option>
                  <option value="Compliant">Compliant</option>
                  <option value="Non-compliant">Non-compliant</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Not Assessed">Not Assessed</option>
                </select>
              </div>

              {/* Electricity */}
              <div>
                <label style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600, display: "block", marginBottom: 6 }}>
                  Electricity
                </label>
                <select
                  value={filters.hasElectricity === null ? "" : String(filters.hasElectricity)}
                  onChange={(e) => setFilters({ ...filters, hasElectricity: e.target.value === "" ? null : e.target.value === "true" })}
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid #1f2937",
                    background: "#0b1220",
                    color: "white",
                    fontSize: 14,
                  }}
                >
                  <option value="">All</option>
                  <option value="true">Has Electricity</option>
                  <option value="false">No Electricity</option>
                </select>
              </div>

              {/* Water */}
              <div>
                <label style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600, display: "block", marginBottom: 6 }}>
                  Water
                </label>
                <select
                  value={filters.hasWater === null ? "" : String(filters.hasWater)}
                  onChange={(e) => setFilters({ ...filters, hasWater: e.target.value === "" ? null : e.target.value === "true" })}
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid #1f2937",
                    background: "#0b1220",
                    color: "white",
                    fontSize: 14,
                  }}
                >
                  <option value="">All</option>
                  <option value="true">Has Water</option>
                  <option value="false">No Water</option>
                </select>
              </div>

              {/* Sewerage */}
              <div>
                <label style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600, display: "block", marginBottom: 6 }}>
                  Sewerage
                </label>
                <select
                  value={filters.hasSewerage === null ? "" : String(filters.hasSewerage)}
                  onChange={(e) => setFilters({ ...filters, hasSewerage: e.target.value === "" ? null : e.target.value === "true" })}
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid #1f2937",
                    background: "#0b1220",
                    color: "white",
                    fontSize: 14,
                  }}
                >
                  <option value="">All</option>
                  <option value="true">Has Sewerage</option>
                  <option value="false">No Sewerage</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: 12, fontSize: 13, color: "#9ca3af" }}>
              Showing {filteredRows.length.toLocaleString()} of {rows.length.toLocaleString()} buildings
            </div>
          </div>
        )}

        {loading ? <p style={{ marginTop: 16 }}>Loading...</p> : null}
        {error ? <p style={{ marginTop: 16, color: "#fca5a5", padding: 12, background: "#7f1d1d", borderRadius: 8 }}>{error}</p> : null}

        <div style={{ marginTop: 16, overflowX: "auto", background: "#111827", borderRadius: 12, border: "1px solid #1f2937" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#0b1220" }}>
                <th style={{ textAlign: "left", padding: 12, borderBottom: "2px solid #1f2937", fontWeight: 800 }}>
                  Building Name
                </th>
                <th style={{ textAlign: "left", padding: 12, borderBottom: "2px solid #1f2937", fontWeight: 800 }}>
                  Address
                </th>
                <th style={{ textAlign: "left", padding: 12, borderBottom: "2px solid #1f2937", fontWeight: 800 }}>
                  Classification
                </th>
                <th style={{ textAlign: "right", padding: 12, borderBottom: "2px solid #1f2937", fontWeight: 800 }}>
                  Occupants
                </th>
                <th style={{ padding: 12, borderBottom: "2px solid #1f2937", textAlign: "right", fontWeight: 800 }}>
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.map((b) => (
                <tr key={b.id}>
                  <td style={{ padding: 12, borderBottom: "1px solid #1f2937", fontWeight: 600 }}>
                    {b.building_name}
                  </td>
                  <td style={{ padding: 12, borderBottom: "1px solid #1f2937", color: "#9ca3af", fontSize: 14 }}>
                    {b.street_address}
                  </td>
                  <td style={{ padding: 12, borderBottom: "1px solid #1f2937" }}>
                    <span style={{
                      padding: "4px 8px",
                      borderRadius: 6,
                      background: "#065f46",
                      fontSize: 12,
                      fontWeight: 600,
                      textTransform: "capitalize"
                    }}>
                      {b.classification}
                    </span>
                  </td>
                  <td style={{ padding: 12, borderBottom: "1px solid #1f2937", textAlign: "right", fontWeight: 600 }}>
                    {b.occupants?.toLocaleString() ?? "-"}
                  </td>
                  <td style={{ padding: 12, borderBottom: "1px solid #1f2937", textAlign: "right" }}>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                      <button
                        onClick={() => router.push(`/app/buildings/${b.id}/edit`)}
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

              {!loading && filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 24, textAlign: "center", color: "#9ca3af" }}>
                    {hasActiveFilters ? (
                      <>
                        No buildings match your filters. <button onClick={clearFilters} style={{ ...btnRed, marginLeft: 8 }}>Clear Filters</button>
                      </>
                    ) : (
                      "No buildings yet."
                    )}
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