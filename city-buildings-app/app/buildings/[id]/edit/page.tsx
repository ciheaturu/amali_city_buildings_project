"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const CLASS_OPTIONS = ["residential", "commercial", "public", "industrial", "mixed-use"] as const;
const CONDITION_OPTIONS = ["Excellent", "Good", "Fair", "Poor", "Dilapidated", "Under Construction"] as const;
const OWNERSHIP_OPTIONS = ["Private", "Government", "Municipal", "Corporate"] as const;
const COMPLIANCE_OPTIONS = ["Compliant", "Non-compliant", "Under Review", "Not Assessed"] as const;

type PlaceSuggestion = {
  place_id: number | string;
  display_name: string;
  lat: string;
  lon: string;
};

const btnDark: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  background: "#111827",
  color: "white",
  border: "1px solid #1f2937",
  fontWeight: 800,
  cursor: "pointer",
};

const btnPrimary: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  background: "#38bdf8",
  border: "none",
  color: "#0b1220",
  fontWeight: 900,
  cursor: "pointer",
};

const btnRed: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  background: "#dc2626",
  border: "none",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

export default function EditBuildingPage() {
  const router = useRouter();
  const params = useParams();
  const buildingId = params?.id as string;

  const [cityName, setCityName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Basic fields
  const [buildingName, setBuildingName] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [latitude, setLatitude] = useState<string>("");
  const [longitude, setLongitude] = useState<string>("");
  const [classification, setClassification] = useState<(typeof CLASS_OPTIONS)[number]>("residential");
  const [occupants, setOccupants] = useState<string>("");
  const [photoUrl, setPhotoUrl] = useState("");

  // NEW FIELDS
  const [condition, setCondition] = useState<(typeof CONDITION_OPTIONS)[number] | "">("");
  const [yearBuilt, setYearBuilt] = useState<string>("");
  const [floors, setFloors] = useState<string>("");
  const [ownershipType, setOwnershipType] = useState<(typeof OWNERSHIP_OPTIONS)[number] | "">("");
  const [complianceStatus, setComplianceStatus] = useState<(typeof COMPLIANCE_OPTIONS)[number] | "">("");
  const [hasElectricity, setHasElectricity] = useState(false);
  const [hasWater, setHasWater] = useState(false);
  const [hasSewerage, setHasSewerage] = useState(false);
  const [floorAreaSqm, setFloorAreaSqm] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Address suggestions
  const [addrQuery, setAddrQuery] = useState("");
  const [addrLoading, setAddrLoading] = useState(false);
  const [addrError, setAddrError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceSuggestion | null>(null);

  const addrAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    async function loadBuilding() {
      setLoading(true);
      setError(null);

      if (!buildingId) {
        setError("No building ID provided");
        setLoading(false);
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("role, city_id")
        .eq("user_id", user.id)
        .single();

      if (profErr) {
        setError(profErr.message);
        setLoading(false);
        return;
      }

      if (profile?.role !== "city") {
        router.push("/admin");
        return;
      }

      if (profile?.city_id) {
        const { data: city } = await supabase
          .from("cities")
          .select("name")
          .eq("id", profile.city_id)
          .single();
        if (city) setCityName(city.name);
      }

      const { data: building, error: bErr } = await supabase
        .from("buildings")
        .select("*")
        .eq("id", buildingId)
        .single();

      if (bErr) {
        setError(bErr.message);
        setLoading(false);
        return;
      }

      if (!building) {
        setError("Building not found");
        setLoading(false);
        return;
      }

      // Populate form fields
      setBuildingName(building.building_name ?? "");
      setStreetAddress(building.street_address ?? "");
      setLatitude(building.latitude != null ? String(building.latitude) : "");
      setLongitude(building.longitude != null ? String(building.longitude) : "");
      setClassification(building.classification ?? "residential");
      setOccupants(building.occupants != null ? String(building.occupants) : "");
      setPhotoUrl(building.photo_url ?? "");

      // NEW FIELDS
      setCondition(building.condition ?? "");
      setYearBuilt(building.year_built != null ? String(building.year_built) : "");
      setFloors(building.floors != null ? String(building.floors) : "");
      setOwnershipType(building.ownership_type ?? "");
      setComplianceStatus(building.compliance_status ?? "");
      setHasElectricity(building.has_electricity ?? false);
      setHasWater(building.has_water ?? false);
      setHasSewerage(building.has_sewerage ?? false);
      setFloorAreaSqm(building.floor_area_sqm != null ? String(building.floor_area_sqm) : "");

      setLoading(false);
    }

    loadBuilding();
  }, [buildingId, router]);

  // Debounced address search
  useEffect(() => {
    const q = addrQuery.trim();
    setAddrError(null);

    if (q.length < 3) {
      setSuggestions([]);
      setAddrLoading(false);
      if (addrAbortRef.current) addrAbortRef.current.abort();
      return;
    }

    setAddrLoading(true);

    const t = window.setTimeout(async () => {
      try {
        if (addrAbortRef.current) addrAbortRef.current.abort();
        const controller = new AbortController();
        addrAbortRef.current = controller;

        const url =
          "https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&q=" +
          encodeURIComponent(q);

        const res = await fetch(url, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });

        if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);

        const data = (await res.json()) as any[];
        const parsed: PlaceSuggestion[] = (data ?? []).map((d) => ({
          place_id: d.place_id,
          display_name: d.display_name,
          lat: d.lat,
          lon: d.lon,
        }));

        setSuggestions(parsed);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setAddrError(e?.message ?? "Could not fetch address suggestions.");
        setSuggestions([]);
      } finally {
        setAddrLoading(false);
      }
    }, 600);

    return () => window.clearTimeout(t);
  }, [addrQuery]);

  function onPickSuggestion(p: PlaceSuggestion) {
    setSelectedPlace(p);
    setStreetAddress(p.display_name);
    setAddrQuery(p.display_name);
    setShowSuggestions(false);
  }

  function fillCoordsFromSelected() {
    if (!selectedPlace) return;
    setLatitude(selectedPlace.lat);
    setLongitude(selectedPlace.lon);
  }

  async function useMyLocation() {
    setError(null);

    if (!navigator.geolocation) {
      setError("Geolocation not supported by this browser.");
      return;
    }

    setGeoLoading(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(String(pos.coords.latitude));
        setLongitude(String(pos.coords.longitude));
        setGeoLoading(false);
      },
      () => {
        setError("Could not get your location. Check browser permissions.");
        setGeoLoading(false);
      }
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const lat = latitude.trim() === "" ? null : Number(latitude);
    const lon = longitude.trim() === "" ? null : Number(longitude);
    const occ = occupants.trim() === "" ? null : Number(occupants);

    if (lat !== null && Number.isNaN(lat)) {
      setSaving(false);
      setError("Latitude must be a number.");
      return;
    }
    if (lon !== null && Number.isNaN(lon)) {
      setSaving(false);
      setError("Longitude must be a number.");
      return;
    }
    if (occ !== null && (Number.isNaN(occ) || !Number.isFinite(occ) || occ < 0)) {
      setSaving(false);
      setError("Occupants must be a non-negative number.");
      return;
    }

    // Validate new fields
    const yearBuiltNum = yearBuilt.trim() === "" ? null : Number(yearBuilt);
    const floorsNum = floors.trim() === "" ? null : Number(floors);
    const floorAreaNum = floorAreaSqm.trim() === "" ? null : Number(floorAreaSqm);

    if (yearBuiltNum !== null && (Number.isNaN(yearBuiltNum) || yearBuiltNum < 1800 || yearBuiltNum > new Date().getFullYear() + 5)) {
      setSaving(false);
      setError("Year built must be between 1800 and current year + 5.");
      return;
    }
    if (floorsNum !== null && (Number.isNaN(floorsNum) || floorsNum < 1)) {
      setSaving(false);
      setError("Number of floors must be at least 1.");
      return;
    }
    if (floorAreaNum !== null && (Number.isNaN(floorAreaNum) || floorAreaNum <= 0)) {
      setSaving(false);
      setError("Floor area must be a positive number.");
      return;
    }

    const { error: updateErr } = await supabase
      .from("buildings")
      .update({
        building_name: buildingName,
        street_address: streetAddress,
        latitude: lat,
        longitude: lon,
        classification,
        occupants: occ,
        photo_url: photoUrl.trim() === "" ? null : photoUrl.trim(),
        // NEW FIELDS
        condition: condition === "" ? null : condition,
        year_built: yearBuiltNum,
        floors: floorsNum,
        ownership_type: ownershipType === "" ? null : ownershipType,
        compliance_status: complianceStatus === "" ? null : complianceStatus,
        has_electricity: hasElectricity,
        has_water: hasWater,
        has_sewerage: hasSewerage,
        floor_area_sqm: floorAreaNum,
        updated_at: new Date().toISOString(),
      })
      .eq("id", buildingId);

    setSaving(false);

    if (updateErr) {
      setError(updateErr.message);
      return;
    }

    router.push("/app/buildings");
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this building? This action cannot be undone.")) {
      return;
    }

    setDeleting(true);
    setError(null);

    const { error: delErr } = await supabase.from("buildings").delete().eq("id", buildingId);

    setDeleting(false);

    if (delErr) {
      setError(delErr.message);
      return;
    }

    router.push("/app/buildings");
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
      <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
        <div
          style={{
            borderRadius: 16,
            padding: 20,
            background: "linear-gradient(135deg,#1d4ed8,#0ea5e9)",
            marginBottom: 18,
          }}
        >
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>
            {cityName ? `Edit building - ${cityName}` : "Edit building"}
          </h1>
          <p style={{ opacity: 0.85, marginTop: 6 }}>Update building information</p>
        </div>

        <form
          onSubmit={onSubmit}
          style={{
            borderRadius: 16,
            background: "#0b1220",
            border: "1px solid #1f2937",
            padding: 18,
            display: "grid",
            gap: 16,
          }}
        >
          {/* Section: Basic Information */}
          <div style={{ borderBottom: "1px solid #1f2937", paddingBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#38bdf8" }}>
              Basic Information
            </h3>
          </div>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>
              Building name <span style={{ color: "#f87171" }}>*</span>
            </span>
            <input
              value={buildingName}
              onChange={(e) => setBuildingName(e.target.value)}
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

          <label style={{ display: "grid", gap: 6, position: "relative" }}>
            <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>
              Street address <span style={{ color: "#f87171" }}>*</span>
            </span>

            <input
              value={streetAddress}
              onChange={(e) => {
                const v = e.target.value;
                setStreetAddress(v);
                setAddrQuery(v);
                setSelectedPlace(null);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => {
                window.setTimeout(() => setShowSuggestions(false), 150);
              }}
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

            <div style={{ marginTop: 6, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={fillCoordsFromSelected}
                disabled={!selectedPlace}
                style={{
                  ...btnDark,
                  background: !selectedPlace ? "#334155" : btnDark.background,
                  cursor: !selectedPlace ? "not-allowed" : "pointer",
                }}
              >
                Fill coordinates from selected address
              </button>
            </div>

            {showSuggestions && (
              <div
                style={{
                  position: "absolute",
                  top: 74,
                  left: 0,
                  right: 0,
                  zIndex: 20,
                  borderRadius: 12,
                  background: "#0b1220",
                  border: "1px solid #1f2937",
                  overflow: "hidden",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.35)",
                }}
              >
                <div style={{ padding: 10, borderBottom: "1px solid #1f2937" }}>
                  <div style={{ fontSize: 12, color: "#9ca3af" }}>
                    {addrLoading ? "Searching..." : "Suggestions"}
                  </div>
                  {addrError && (
                    <div style={{ fontSize: 12, color: "#fca5a5", marginTop: 6 }}>{addrError}</div>
                  )}
                </div>

                {addrLoading ? null : suggestions.length === 0 ? (
                  <div style={{ padding: 10, color: "#9ca3af", fontSize: 12 }}>
                    Type at least 3 characters
                  </div>
                ) : (
                  <div>
                    {suggestions.map((s) => (
                      <button
                        key={String(s.place_id)}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => onPickSuggestion(s)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: 10,
                          border: "none",
                          background: selectedPlace?.place_id === s.place_id ? "#111827" : "#0b1220",
                          color: "white",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 800 }}>{s.display_name}</div>
                        <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
                          lat {s.lat}, lon {s.lon}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>Latitude</span>
              <input
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                inputMode="decimal"
                placeholder="-26.2041"
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
              <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>Longitude</span>
              <input
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                inputMode="decimal"
                placeholder="28.0473"
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
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={useMyLocation}
              disabled={geoLoading}
              style={{
                ...btnDark,
                cursor: geoLoading ? "not-allowed" : "pointer",
                opacity: geoLoading ? 0.75 : 1,
              }}
            >
              {geoLoading ? "Getting location..." : "Use my location"}
            </button>
          </div>

          {/* Building Details */}
          <div style={{ borderBottom: "1px solid #1f2937", paddingBottom: 12, marginTop: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#22c55e" }}>
              Building Details
            </h3>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>
                Classification <span style={{ color: "#f87171" }}>*</span>
              </span>
              <select
                value={classification}
                onChange={(e) => setClassification(e.target.value as any)}
                required
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid #1f2937",
                  background: "#111827",
                  color: "white",
                }}
              >
                {CLASS_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>Condition</span>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as any)}
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid #1f2937",
                  background: "#111827",
                  color: "white",
                }}
              >
                <option value="">Select condition...</option>
                {CONDITION_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>Year Built</span>
              <input
                value={yearBuilt}
                onChange={(e) => setYearBuilt(e.target.value)}
                inputMode="numeric"
                placeholder="2020"
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
              <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>Floors</span>
              <input
                value={floors}
                onChange={(e) => setFloors(e.target.value)}
                inputMode="numeric"
                placeholder="5"
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
              <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>Floor Area (m²)</span>
              <input
                value={floorAreaSqm}
                onChange={(e) => setFloorAreaSqm(e.target.value)}
                inputMode="decimal"
                placeholder="500.5"
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
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>Ownership</span>
              <select
                value={ownershipType}
                onChange={(e) => setOwnershipType(e.target.value as any)}
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid #1f2937",
                  background: "#111827",
                  color: "white",
                }}
              >
                <option value="">Select...</option>
                {OWNERSHIP_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>Compliance</span>
              <select
                value={complianceStatus}
                onChange={(e) => setComplianceStatus(e.target.value as any)}
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid #1f2937",
                  background: "#111827",
                  color: "white",
                }}
              >
                <option value="">Select...</option>
                {COMPLIANCE_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>Occupants</span>
            <input
              value={occupants}
              onChange={(e) => setOccupants(e.target.value)}
              inputMode="numeric"
              placeholder="120"
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

          {/* Utilities */}
          <div style={{ borderBottom: "1px solid #1f2937", paddingBottom: 12, marginTop: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#f97316" }}>
              Utilities
            </h3>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: 12,
                borderRadius: 10,
                border: "1px solid #1f2937",
                background: "#111827",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={hasElectricity}
                onChange={(e) => setHasElectricity(e.target.checked)}
                style={{ width: 18, height: 18, cursor: "pointer" }}
              />
              <span style={{ color: "white", fontSize: 14, fontWeight: 600 }}>Electricity</span>
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: 12,
                borderRadius: 10,
                border: "1px solid #1f2937",
                background: "#111827",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={hasWater}
                onChange={(e) => setHasWater(e.target.checked)}
                style={{ width: 18, height: 18, cursor: "pointer" }}
              />
              <span style={{ color: "white", fontSize: 14, fontWeight: 600 }}>Water</span>
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: 12,
                borderRadius: 10,
                border: "1px solid #1f2937",
                background: "#111827",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={hasSewerage}
                onChange={(e) => setHasSewerage(e.target.checked)}
                style={{ width: 18, height: 18, cursor: "pointer" }}
              />
              <span style={{ color: "white", fontSize: 14, fontWeight: 600 }}>Sewerage</span>
            </label>
          </div>

          {/* Photo */}
          <div style={{ borderBottom: "1px solid #1f2937", paddingBottom: 12, marginTop: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#a78bfa" }}>
              📸 Additional
            </h3>
          </div>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>Photo URL</span>
            <input
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://..."
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

          {/* Buttons */}
          <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 12 }}>
              <button type="submit" disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.8 : 1 }}>
                {saving ? "Saving..." : "Update"}
              </button>

              <button type="button" onClick={() => router.push("/app/buildings")} style={btnDark}>
                Cancel
              </button>
            </div>

            <button type="button" onClick={handleDelete} disabled={deleting} style={{ ...btnRed, opacity: deleting ? 0.8 : 1 }}>
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>

          {error && <p style={{ color: "#fca5a5", margin: 0 }}>{error}</p>}
        </form>
      </div>
    </main>
  );
}