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
  condition?: string | null;
  year_built?: number | null;
  ownership_type?: string | null;
  compliance_status?: string | null;
  has_electricity?: boolean;
  has_water?: boolean;
  has_sewerage?: boolean;
};

type Filters = {
  cityId: string;
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
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState<Filters>({
    cityId: "",
    classification: "",
    condition: "",
    ownership: "",
    compliance: "",
    searchTerm: "",
    hasElectricity: null,
    hasWater: null,
    hasSewerage: null,
  });

  const cityNameById = useMemo(() => {
    const m = new Map<string, string>();
    cities.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [cities]);

  const filteredRows = useMemo(() => {
    return rows.filter((b) => {
      if (filters.cityId && b.city_id !== filters.cityId) return false;
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
      cityId: "",
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
      .select("*")
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

    const enriched = filteredRows.map((r: any) => ({
      city: cityNameById.get(r.city_id) ?? "",
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

    const filename = `admin_buildings_${hasActiveFilters ? "filtered_" : ""}${new Date().toISOString().split("T")[0]}.csv`;
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