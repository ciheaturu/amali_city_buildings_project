"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type City = { id: string; name: string };

const CLASS_OPTIONS = ["residential", "commercial", "public"] as const;

type PlaceSuggestion = {
  place_id: number | string;
  display_name: string;
  lat: string;
  lon: string;
};

type BuildingRow = {
  id: string;
  city_id: string;
  building_name: string;
  street_address: string;
  latitude: number | null;
  longitude: number | null;
  classification: string;
  occupants: number | null;
  photo_url: string | null;
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

const btnGreen: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  background: "#22c55e",
  border: "none",
  color: "#052e16",
  fontWeight: 900,
  cursor: "pointer",
};

export default function AdminEditBuildingPage() {
  const router = useRouter();
  const params = useParams();
  const buildingId = typeof params?.id === "string" ? params.id : "";

  const [cities, setCities] = useState<City[]>([]);
  const [cityId, setCityId] = useState("");
  const [cityName, setCityName] = useState<string>("");

  const [buildingName, setBuildingName] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [latitude, setLatitude] = useState<string>("");
  const [longitude, setLongitude] = useState<string>("");
  const [classification, setClassification] =
    useState<(typeof CLASS_OPTIONS)[number]>("residential");
  const [occupants, setOccupants] = useState<string>("");
  const [photoUrl, setPhotoUrl] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Address suggestions state (same as Admin add)
  const [addrQuery, setAddrQuery] = useState("");
  const [addrLoading, setAddrLoading] = useState(false);
  const [addrError, setAddrError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceSuggestion | null>(null);

  const addrAbortRef = useRef<AbortController | null>(null);

  const headerTitle = useMemo(() => {
    if (cityName) return `Edit building for ${cityName}`;
    return "Edit building";
  }, [cityName]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      if (!buildingId) {
        setLoading(false);
        setError("Missing building id.");
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
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

      const cityList = (cityRows ?? []) as City[];
      setCities(cityList);

      const { data: b, error: bErr } = await supabase
        .from("buildings")
        .select(
          "id, city_id, building_name, street_address, latitude, longitude, classification, occupants, photo_url"
        )
        .eq("id", buildingId)
        .single();

      if (bErr) {
        setLoading(false);
        setError(bErr.message);
        return;
      }

      const row = b as BuildingRow;

      setCityId(row.city_id ?? "");
      setBuildingName(row.building_name ?? "");
      setStreetAddress(row.street_address ?? "");
      setAddrQuery(row.street_address ?? "");
      setSelectedPlace(null);

      setLatitude(row.latitude === null ? "" : String(row.latitude));
      setLongitude(row.longitude === null ? "" : String(row.longitude));

      const c = (row.classification ?? "residential") as any;
      setClassification(CLASS_OPTIONS.includes(c) ? c : "residential");

      setOccupants(row.occupants === null ? "" : String(row.occupants));
      setPhotoUrl(row.photo_url ?? "");

      const selected = cityList.find((x) => x.id === row.city_id);
      setCityName(selected?.name ?? "");

      setLoading(false);
    }

    load();
  }, [buildingId, router]);

  useEffect(() => {
    const selected = cities.find((c) => c.id === cityId);
    setCityName(selected?.name ?? "");
  }, [cities, cityId]);

  // Debounced search for address suggestions using OpenStreetMap Nominatim (same as Admin add)
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

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    if (!buildingId) {
      setSaving(false);
      setError("Missing building id.");
      return;
    }

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
      setError("Occupants must be a non negative number.");
      return;
    }

    const { error: updErr } = await supabase
      .from("buildings")
      .update({
        city_id: cityId,
        building_name: buildingName,
        street_address: streetAddress,
        latitude: lat,
        longitude: lon,
        classification,
        occupants: occ,
        photo_url: photoUrl.trim() === "" ? null : photoUrl.trim(),
      })
      .eq("id", buildingId);

    setSaving(false);

    if (updErr) {
      setError(updErr.message);
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
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>{headerTitle}</h1>
          <p style={{ opacity: 0.85, marginTop: 6 }}>Update the building details</p>
        </div>

        <form
          onSubmit={onSave}
          style={{
            borderRadius: 16,
            background: "#0b1220",
            border: "1px solid #1f2937",
            padding: 18,
            display: "grid",
            gap: 12,
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>City</span>
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

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>Building name</span>
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
            <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>Street address</span>

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

            {showSuggestions ? (
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
                  {addrError ? (
                    <div style={{ fontSize: 12, color: "#fca5a5", marginTop: 6 }}>{addrError}</div>
                  ) : null}
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
            ) : null}
          </label>

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

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>Classification</span>
            <select
              value={classification}
              onChange={(e) => setClassification(e.target.value as any)}
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
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>
              Approximate occupants
            </span>
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

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>
              Photo or image URL
            </span>
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

          {error ? <p style={{ color: "#fca5a5", margin: 0 }}>{error}</p> : null}

          <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                ...btnPrimary,
                opacity: saving ? 0.8 : 1,
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Saving..." : "Save changes"}
            </button>

            <button type="button" onClick={() => router.push("/admin/buildings")} style={btnDark}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
