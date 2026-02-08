"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const CLASS_OPTIONS = ["residential", "commercial", "public"] as const;

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

export default function NewBuildingPage() {
  const router = useRouter();

  const [cityName, setCityName] = useState<string>("");

  const [buildingName, setBuildingName] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [latitude, setLatitude] = useState<string>("");
  const [longitude, setLongitude] = useState<string>("");
  const [classification, setClassification] =
    useState<(typeof CLASS_OPTIONS)[number]>("residential");
  const [occupants, setOccupants] = useState<string>("");
  const [photoUrl, setPhotoUrl] = useState("");

  const [saving, setSaving] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Address suggestions state (same pattern as Admin add)
  const [addrQuery, setAddrQuery] = useState("");
  const [addrLoading, setAddrLoading] = useState(false);
  const [addrError, setAddrError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceSuggestion | null>(null);

  const addrAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    async function guardAndLoadCity() {
      setError(null);

      const { data } = await supabase.auth.getUser();
      const user = data.user;

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
        return;
      }

      if (profile?.role !== "city") {
        router.push("/admin");
        return;
      }

      if (profile?.city_id) {
        const { data: city, error: cityErr } = await supabase
          .from("cities")
          .select("name")
          .eq("id", profile.city_id)
          .single();

        if (!cityErr) setCityName(city?.name ?? "");
      }
    }

    guardAndLoadCity();
  }, [router]);

  // Debounced search for address suggestions using OpenStreetMap Nominatim
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
      setError("Occupants must be a non negative number.");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      setSaving(false);
      router.push("/login");
      return;
    }

    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("city_id, role")
      .eq("user_id", user.id)
      .single();

    if (profErr) {
      setSaving(false);
      setError(profErr.message);
      return;
    }

    if (profile?.role !== "city" || !profile.city_id) {
      setSaving(false);
      setError("Only city users can add buildings.");
      return;
    }

    const { error: insErr } = await supabase.from("buildings").insert({
      city_id: profile.city_id,
      building_name: buildingName,
      street_address: streetAddress,
      latitude: lat,
      longitude: lon,
      classification,
      occupants: occ,
      photo_url: photoUrl.trim() === "" ? null : photoUrl.trim(),
    });

    setSaving(false);

    if (insErr) {
      setError(insErr.message);
      return;
    }

    router.push("/app/buildings");
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
          <p style={{ opacity: 0.85, marginTop: 6 }}>Capture a new building record</p>
        </div>

        <form
          onSubmit={onSubmit}
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

          <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
            <button type="submit" disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.8 : 1 }}>
              {saving ? "Saving..." : "Save building"}
            </button>

            <button type="button" onClick={() => router.push("/app/buildings")} style={btnDark}>
              Cancel
            </button>
          </div>

          {error ? <p style={{ color: "#fca5a5", margin: 0 }}>{error}</p> : null}
        </form>
      </div>
    </main>
  );
}
