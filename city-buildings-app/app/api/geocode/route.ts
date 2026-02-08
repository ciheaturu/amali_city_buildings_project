import { NextResponse } from "next/server";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (!q) return jsonError("Missing q parameter.");

  const limit = Math.min(Number(searchParams.get("limit") ?? "6") || 6, 10);

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", q);
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url.toString(), {
    headers: {
      // IMPORTANT: Replace this with your real app name and a real contact email.
      // Nominatim usage policy expects an identifying User Agent.
      "User-Agent": "CityBuildingsApp/1.0 (contact@yourdomain.com)",
      "Accept-Language": "en",
    },
    // Keep things safe
    cache: "no-store",
  });

  if (!res.ok) {
    return jsonError(`Geocoder request failed (${res.status}).`, 502);
  }

  const data = (await res.json()) as any[];

  // Return only what the UI needs
  const places = (data ?? []).map((p) => ({
    place_id: String(p.place_id ?? ""),
    display_name: String(p.display_name ?? ""),
    lat: p.lat != null ? String(p.lat) : null,
    lon: p.lon != null ? String(p.lon) : null,
  }));

  return NextResponse.json({ places });
}
