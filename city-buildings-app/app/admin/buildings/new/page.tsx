"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type City = { id: string; name: string };

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

export default function AdminNewBuildingPage() {
  const router = useRouter();

  const [cities, setCities] = useState<City[]>([]);
  const [cityId, setCityId] = useState("");
  const [cityName, setCityName] = useState<string>("");

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
  const [geoLoading, setGeoLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Address suggestions state
  const [addrQuery, setAddrQuery] = useState("");
  const [addrLoading, setAddrLoading] = useState(false);
  const [addrError, setAddrError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceSuggestion | null>(null);

  const addrAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    async function init() {
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

      const list = (cityRows ?? []) as City[];
      setCities(list);

      const firstId = list[0]?.id ?? "";
      setCityId((prev) => prev || firstId);

      const selected = list.find((c) => c.id === (cityId || firstId));
      setCityName(selected?.name ?? "");

      setLoading(false);
    }

    init();
  }, [router]);

  useEffect(() => {
    const selected = cities.find((c) => c.id === cityId);
    setCityName(selected?.name ?? "");
  }, [cities, cityId]);

  // Debounced search for address suggestions
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

    if (!cityId) {
      setSaving(false);
      setError("Select a city.");
      return;
    }

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

    const { error: insErr } = await supabase.from("buildings").insert({
      city_id: cityId,
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
    });

    setSaving(false);

    if (insErr) {
      setError(insErr.message);
      return;
    }

    router.push("/admin/buildings");
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
            {cityName ? `Add building for ${cityName}` : "Add building"}
          </h1>
          <p style={{ opacity: 0.85, marginTop: 6 }}>Admin: Capture a new building record with detailed information</p>
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
          {/* City Selection */}
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>
              City <span style={{ color: "#f87171" }}>*</span>
            </span>
            <select
              value={cityId}
              onChange={(e) => setCityId(e.target.value)}
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
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

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

              <div style={{ color: "#9ca3af", fontSize: 12, alignSelf: "center" }}>
                Pick a suggested address then click the button
              </div>
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
                    Type at least 3 characters to see matches
                  </div>
                ) : (
                  <div>
                    {suggestions.map((s) => {
                      const active = selectedPlace?.place_id === s.place_id;
                      return (
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
                            background: active ? "#111827" : "#0b1220",
                            color: "white",
                            cursor: "pointer",
                          }}
                        >
                          <div style={{ fontSize: 13, fontWeight: 800 }}>{s.display_name}</div>
                          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
                            lat {s.lat}, lon {s.lon}
                          </div>
                        </button>
                      );
                    })}
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

            <div style={{ color: "#9ca3af", fontSize: 12, alignSelf: "center" }}>
              Fills latitude and longitude from your device location
            </div>
          </div>

          {/* Section: Building Details */}
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
              <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>Number of Floors</span>
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
              <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>Ownership Type</span>
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
                <option value="">Select ownership...</option>
                {OWNERSHIP_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>Compliance Status</span>
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
                <option value="">Select compliance...</option>
                {COMPLIANCE_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>Approximate occupants</span>
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

          {/* Section: Utilities & Infrastructure */}
          <div style={{ borderBottom: "1px solid #1f2937", paddingBottom: 12, marginTop: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#f97316" }}>
              Utilities & Infrastructure
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

          {/* Section: Additional Information */}
          <div style={{ borderBottom: "1px solid #1f2937", paddingBottom: 12, marginTop: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#a78bfa" }}>
              Additional Information
            </h3>
          </div>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>Photo or image URL</span>
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

          {/* Submit Buttons */}
          <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
            <button type="submit" disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.8 : 1 }}>
              {saving ? "Saving..." : "Save building"}
            </button>

            <button type="button" onClick={() => router.push("/admin/buildings")} style={btnDark}>
              Cancel
            </button>
          </div>

          {error && <p style={{ color: "#fca5a5", margin: 0 }}>{error}</p>}
        </form>
      </div>
    </main>
  );
}