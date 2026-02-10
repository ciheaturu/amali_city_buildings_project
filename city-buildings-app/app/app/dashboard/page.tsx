"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import dynamic from "next/dynamic";

const BuildingMap = dynamic(() => import("./BuildingMap"), { ssr: false });

type BuildingRow = {
  id: string;
  building_name: string;
  street_address: string;
  city_id: string;
  classification: string;
  occupants: number | null;
  latitude?: number | null;
  longitude?: number | null;
  condition?: string | null;
  year_built?: number | null;
  floors?: number | null;
  ownership_type?: string | null;
  compliance_status?: string | null;
  has_electricity?: boolean;
  has_water?: boolean;
  has_sewerage?: boolean;
  floor_area_sqm?: number | null;
};

type Filters = {
  classification: string;
  condition: string;
  ownership: string;
  compliance: string;
  yearFrom: string;
  yearTo: string;
  hasElectricity: boolean | null;
  hasWater: boolean | null;
  hasSewerage: boolean | null;
  searchTerm: string;
};

const PIE_COLORS = ["#38bdf8", "#22c55e", "#f97316", "#e11d48", "#a78bfa", "#facc15"];

const btnDark = {
  padding: "10px 12px",
  borderRadius: 10,
  background: "#111827",
  color: "white",
  border: "1px solid #1f2937",
  fontWeight: 800,
  cursor: "pointer",
};

const btnPrimary = {
  padding: "10px 12px",
  borderRadius: 10,
  background: "#38bdf8",
  border: "none",
  color: "#0b1220",
  fontWeight: 900,
  cursor: "pointer",
};

const btnRed = {
  padding: "8px 12px",
  borderRadius: 8,
  background: "#dc2626",
  border: "none",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 12,
};

function toCsv(rows: any[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => `"${(v ?? "").toString().replace(/"/g, '""')}"`;
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

function Card(props: { title: string; value: string; subtitle?: string; accent?: string }) {
  return (
    <div
      style={{
        borderRadius: 14,
        padding: 16,
        background: "#111827",
        border: "1px solid #1f2937",
        boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
      }}
    >
      <div style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase" }}>
        {props.title}
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, marginTop: 8, color: props.accent ?? "#38bdf8" }}>
        {props.value}
      </div>
      {props.subtitle && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>{props.subtitle}</div>}
    </div>
  );
}

export default function CityDashboardPage() {
  const router = useRouter();

  const [buildings, setBuildings] = useState<BuildingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [cityName, setCityName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<Filters>({
    classification: "",
    condition: "",
    ownership: "",
    compliance: "",
    yearFrom: "",
    yearTo: "",
    hasElectricity: null,
    hasWater: null,
    hasSewerage: null,
    searchTerm: "",
  });

  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);

      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return router.replace("/login");

      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("role, city_id")
        .eq("user_id", user.id)
        .single();

      if (profErr || !profile) return router.replace("/login");
      if (profile.role !== "city") return router.replace("/admin/dashboard");

      if (profile.city_id) {
        const { data: city } = await supabase.from("cities").select("name").eq("id", profile.city_id).single();
        if (city) setCityName(city.name);

        const { data: buildingRows, error: bErr } = await supabase
          .from("buildings")
          .select("*")
          .eq("city_id", profile.city_id);

        if (bErr) return setError(bErr.message);
        setBuildings((buildingRows ?? []) as BuildingRow[]);
      }

      setLoading(false);
    }

    loadData();
  }, [router]);

  const filteredBuildings = useMemo(() => {
    return buildings.filter((b) => {
      if (filters.classification && b.classification !== filters.classification) return false;
      if (filters.condition && b.condition !== filters.condition) return false;
      if (filters.ownership && b.ownership_type !== filters.ownership) return false;
      if (filters.compliance && b.compliance_status !== filters.compliance) return false;
      
      if (filters.yearFrom) {
        const year = b.year_built;
        if (!year || year < Number(filters.yearFrom)) return false;
      }
      if (filters.yearTo) {
        const year = b.year_built;
        if (!year || year > Number(filters.yearTo)) return false;
      }

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
  }, [buildings, filters]);

  const insights = useMemo(() => {
    const currentYear = new Date().getFullYear();
    
    // Priority buildings (poor condition + high occupancy)
    const priorityBuildings = filteredBuildings
      .filter((b) => 
        (b.condition === "Poor" || b.condition === "Dilapidated") && 
        (b.occupants ?? 0) > 50
      )
      .sort((a, b) => (b.occupants ?? 0) - (a.occupants ?? 0))
      .slice(0, 5);

    // Infrastructure gaps
    const noElectricity = filteredBuildings.filter((b) => !b.has_electricity);
    const noWater = filteredBuildings.filter((b) => !b.has_water);
    const noSewerage = filteredBuildings.filter((b) => !b.has_sewerage);

    // Compliance issues
    const nonCompliant = filteredBuildings.filter((b) => b.compliance_status === "Non-compliant");

    // Aging infrastructure (>50 years old + poor/fair condition)
    const agingInfra = filteredBuildings.filter((b) => {
      if (!b.year_built) return false;
      const age = currentYear - b.year_built;
      return age > 50 && (b.condition === "Poor" || b.condition === "Fair");
    });

    // Buildings needing assessment
    const needsAssessment = filteredBuildings.filter(
      (b) => !b.condition || b.compliance_status === "Not Assessed"
    );

    return {
      priorityBuildings,
      noElectricity,
      noWater,
      noSewerage,
      nonCompliant,
      agingInfra,
      needsAssessment,
    };
  }, [filteredBuildings]);

  const summary = useMemo(() => {
    const total = filteredBuildings.length;
    const totalOccupants = filteredBuildings.reduce((s, b) => s + (b.occupants ?? 0), 0);
    const avgOccupants = total ? totalOccupants / total : 0;

    const currentYear = new Date().getFullYear();
    const withAge = filteredBuildings.filter((b) => b.year_built);
    const avgAge = withAge.length
      ? withAge.reduce((s, b) => s + (currentYear - (b.year_built ?? currentYear)), 0) / withAge.length
      : 0;

    const withElec = filteredBuildings.filter((b) => b.has_electricity).length;
    const withWater = filteredBuildings.filter((b) => b.has_water).length;
    const withSewer = filteredBuildings.filter((b) => b.has_sewerage).length;
    const infraScore = total ? ((withElec + withWater + withSewer) / (total * 3)) * 100 : 0;

    const byClass: Record<string, number> = {};
    filteredBuildings.forEach((b) => {
      byClass[b.classification] = (byClass[b.classification] ?? 0) + 1;
    });
    const classData = Object.entries(byClass).map(([name, value]) => ({ name, value }));

    const byCondition: Record<string, number> = {};
    filteredBuildings.forEach((b) => {
      if (b.condition) byCondition[b.condition] = (byCondition[b.condition] ?? 0) + 1;
    });
    const conditionData = Object.entries(byCondition).map(([name, value]) => ({ name, value }));

    const byCompliance: Record<string, number> = {};
    filteredBuildings.forEach((b) => {
      if (b.compliance_status) byCompliance[b.compliance_status] = (byCompliance[b.compliance_status] ?? 0) + 1;
    });
    const complianceData = Object.entries(byCompliance).map(([status, count]) => ({ status, count }));

    const points = filteredBuildings
      .filter((b) => b.latitude != null && b.longitude != null)
      .map((b) => ({ ...b, latitude: b.latitude as number, longitude: b.longitude as number }));

    let center: [number, number] = [-26.2041, 28.0473];
    if (points.length > 0) {
      const latAvg = points.reduce((s, p) => s + p.latitude, 0) / points.length;
      const lonAvg = points.reduce((s, p) => s + p.longitude, 0) / points.length;
      center = [latAvg, lonAvg];
    }

    return {
      total,
      totalOccupants,
      avgOccupants,
      avgAge,
      infraScore,
      classData,
      conditionData,
      complianceData,
      points,
      center,
    };
  }, [filteredBuildings]);

  function clearFilters() {
    setFilters({
      classification: "",
      condition: "",
      ownership: "",
      compliance: "",
      yearFrom: "",
      yearTo: "",
      hasElectricity: null,
      hasWater: null,
      hasSewerage: null,
      searchTerm: "",
    });
  }

  const hasActiveFilters = Object.values(filters).some((v) => v !== "" && v !== null);

  function exportFilteredData() {
    const data = filteredBuildings.map((b) => ({
      name: b.building_name,
      address: b.street_address,
      classification: b.classification,
      condition: b.condition ?? "",
      year_built: b.year_built ?? "",
      floors: b.floors ?? "",
      occupants: b.occupants ?? "",
      ownership: b.ownership_type ?? "",
      compliance: b.compliance_status ?? "",
      electricity: b.has_electricity ? "Yes" : "No",
      water: b.has_water ? "Yes" : "No",
      sewerage: b.has_sewerage ? "Yes" : "No",
      floor_area_sqm: b.floor_area_sqm ?? "",
    }));

    const filename = `${cityName.replace(/\s+/g, "_")}_filtered_buildings_${new Date().toISOString().split("T")[0]}.csv`;
    downloadCsv(filename, toCsv(data));
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
          <div style={{ fontSize: 18, fontWeight: 600, color: "#9ca3af" }}>Loading dashboard...</div>
        </div>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </main>
    );
  }

  return (
    <main style={{ background: "#020617", minHeight: "100vh", color: "white" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: 24 }}>
        {/* Header */}
        <div
          style={{
            borderRadius: 16,
            padding: 20,
            background: "linear-gradient(135deg,#1d4ed8,#0ea5e9)",
            marginBottom: 18,
          }}
        >
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>Analytics Dashboard - {cityName}</h1>
          <p style={{ opacity: 0.85, marginTop: 6 }}>Decision support and data insights</p>

          <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => router.push("/app")} style={btnDark}>Home</button>
              <button onClick={() => router.push("/app/buildings")} style={btnDark}> Buildings</button>
              <button onClick={() => setShowFilters(!showFilters)} style={{ ...btnDark, background: hasActiveFilters ? "#1e40af" : btnDark.background }}>
                Filters {hasActiveFilters && `(${Object.values(filters).filter(v => v !== "" && v !== null).length})`}
              </button>
              <button onClick={exportFilteredData} style={btnDark}>Export CSV</button>
            </div>
          </div>
        </div>

        {error && <p style={{ marginTop: 8, color: "#fca5a5", padding: 12, background: "#7f1d1d", borderRadius: 8 }}>{error}</p>}

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
              <div>
                <label style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600, display: "block", marginBottom: 6 }}>Search</label>
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

              <div>
                <label style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600, display: "block", marginBottom: 6 }}>Classification</label>
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

              <div>
                <label style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600, display: "block", marginBottom: 6 }}>Condition</label>
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

              <div>
                <label style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600, display: "block", marginBottom: 6 }}>Ownership</label>
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

              <div>
                <label style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600, display: "block", marginBottom: 6 }}>Compliance</label>
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

              <div>
                <label style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600, display: "block", marginBottom: 6 }}>Built From</label>
                <input
                  type="number"
                  value={filters.yearFrom}
                  onChange={(e) => setFilters({ ...filters, yearFrom: e.target.value })}
                  placeholder="1990"
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

              <div>
                <label style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600, display: "block", marginBottom: 6 }}>Built To</label>
                <input
                  type="number"
                  value={filters.yearTo}
                  onChange={(e) => setFilters({ ...filters, yearTo: e.target.value })}
                  placeholder="2020"
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

              <div>
                <label style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600, display: "block", marginBottom: 6 }}>Electricity</label>
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

              <div>
                <label style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600, display: "block", marginBottom: 6 }}>Water</label>
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

              <div>
                <label style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600, display: "block", marginBottom: 6 }}>Sewerage</label>
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
              Showing {filteredBuildings.length} of {buildings.length} buildings
            </div>
          </div>
        )}

        {/* Key Metrics */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 18 }}>
          <Card title="Buildings" value={`${summary.total}`} accent="#38bdf8" />
          <Card title="Total Occupants" value={`${summary.totalOccupants.toLocaleString()}`} accent="#22c55e" />
          <Card title="Avg Age" value={`${summary.avgAge.toFixed(0)} yrs`} accent="#f97316" />
          <Card
            title="Infrastructure Score"
            value={`${summary.infraScore.toFixed(0)}%`}
            accent={summary.infraScore > 70 ? "#22c55e" : summary.infraScore > 40 ? "#f97316" : "#e11d48"}
          />
        </div>

        {/* Decision Support Insights */}
        <div style={{ borderRadius: 14, background: "#111827", border: "1px solid #1f2937", padding: 18, marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Decision Support Insights</h2>

          <div style={{ display: "grid", gap: 12 }}>
            {insights.priorityBuildings.length > 0 && (
              <div style={{ padding: 14, background: "#7f1d1d", borderRadius: 10, border: "1px solid #991b1b" }}>
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8, color: "#fca5a5" }}>
                  Priority: {insights.priorityBuildings.length} High-Occupancy Buildings in Poor Condition
                </div>
                <div style={{ fontSize: 13, color: "#fecaca", marginBottom: 8 }}>
                  These buildings have poor/dilapidated condition and high occupancy (&gt;50 people). Immediate attention required.
                </div>
                <div style={{ fontSize: 12, color: "#fee2e2" }}>
                  {insights.priorityBuildings.slice(0, 3).map(b => `${b.building_name} (${b.occupants} occupants)`).join(" • ")}
                </div>
              </div>
            )}

            {insights.nonCompliant.length > 0 && (
              <div style={{ padding: 14, background: "#7c2d12", borderRadius: 10, border: "1px solid #9a3412" }}>
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8, color: "#fdba74" }}>
                  Compliance: {insights.nonCompliant.length} Non-Compliant Buildings
                </div>
                <div style={{ fontSize: 13, color: "#fed7aa" }}>
                  Review and address compliance issues to meet regulatory requirements.
                </div>
              </div>
            )}

            {(insights.noElectricity.length > 0 || insights.noWater.length > 0 || insights.noSewerage.length > 0) && (
              <div style={{ padding: 14, background: "#1e3a8a", borderRadius: 10, border: "1px solid #1e40af" }}>
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8, color: "#93c5fd" }}>
                  🔌 Infrastructure Gaps Identified
                </div>
                <div style={{ fontSize: 13, color: "#bfdbfe" }}>
                  {insights.noElectricity.length > 0 && `${insights.noElectricity.length} without electricity • `}
                  {insights.noWater.length > 0 && `${insights.noWater.length} without water • `}
                  {insights.noSewerage.length > 0 && `${insights.noSewerage.length} without sewerage`}
                </div>
              </div>
            )}

            {insights.agingInfra.length > 0 && (
              <div style={{ padding: 14, background: "#713f12", borderRadius: 10, border: "1px solid #92400e" }}>
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8, color: "#fcd34d" }}>
                  Aging Infrastructure: {insights.agingInfra.length} Buildings Over 50 Years Old
                </div>
                <div style={{ fontSize: 13, color: "#fde68a" }}>
                  Consider renovation or modernization programs for buildings built before 1975.
                </div>
              </div>
            )}

            {insights.needsAssessment.length > 0 && (
              <div style={{ padding: 14, background: "#374151", borderRadius: 10, border: "1px solid #4b5563" }}>
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8, color: "#d1d5db" }}>
                  Data Gaps: {insights.needsAssessment.length} Buildings Need Assessment
                </div>
                <div style={{ fontSize: 13, color: "#e5e7eb" }}>
                  Update missing condition or compliance data for better decision-making.
                </div>
              </div>
            )}

            {insights.priorityBuildings.length === 0 && insights.nonCompliant.length === 0 && insights.agingInfra.length === 0 && (
              <div style={{ padding: 14, background: "#14532d", borderRadius: 10, border: "1px solid #166534" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#86efac" }}>
                  No Critical Issues Detected
                </div>
                <div style={{ fontSize: 13, color: "#bbf7d0", marginTop: 6 }}>
                  Current filtered buildings are in good standing. Continue regular monitoring.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Charts */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <section style={{ borderRadius: 14, background: "#111827", border: "1px solid #1f2937", padding: 14 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Classification</h2>
            <div style={{ height: 280, marginTop: 10 }}>
              {summary.classData.length > 0 ? (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie dataKey="value" data={summary.classData} label stroke="#111827">
                      {summary.classData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#6b7280" }}>
                  No data
                </div>
              )}
            </div>
          </section>

          <section style={{ borderRadius: 14, background: "#111827", border: "1px solid #1f2937", padding: 14 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>🔧 Condition</h2>
            <div style={{ height: 280, marginTop: 10 }}>
              {summary.conditionData.length > 0 ? (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie dataKey="value" data={summary.conditionData} label stroke="#111827">
                      {summary.conditionData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#6b7280" }}>
                  No data
                </div>
              )}
            </div>
          </section>
        </div>

        <div style={{ borderRadius: 14, background: "#111827", border: "1px solid #1f2937", padding: 14, marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Compliance Status</h2>
          <div style={{ height: 280, marginTop: 10 }}>
            {summary.complianceData.length > 0 ? (
              <ResponsiveContainer>
                <BarChart data={summary.complianceData}>
                  <XAxis dataKey="status" tick={{ fill: "#e5e7eb", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#e5e7eb", fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }} />
                  <Legend />
                  <Bar dataKey="count" fill="#a78bfa" name="Buildings" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#6b7280" }}>
                No data
              </div>
            )}
          </div>
        </div>

        {/* Map */}
        <div style={{ marginTop: 14 }}>
          <section style={{ borderRadius: 14, background: "#111827", border: "1px solid #1f2937", overflow: "hidden" }}>
            <div style={{ padding: 12, borderBottom: "1px solid #1f2937" }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Building Locations</h2>
              <div style={{ marginTop: 6, color: "#9ca3af", fontSize: 12 }}>
                Showing {summary.points.length.toLocaleString()} of {summary.total} filtered buildings with GPS coordinates
              </div>
            </div>

            <div style={{ height: 420 }}>
              <BuildingMap
                points={summary.points}
                fallbackCenter={summary.center}
                fallbackZoom={12}
                cityNameById={new Map()}
              />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}