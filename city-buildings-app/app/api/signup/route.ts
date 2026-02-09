import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
      return NextResponse.json({ error: "Missing NEXT_PUBLIC_SUPABASE_URL" }, { status: 500 });
    }
    if (!serviceRoleKey) {
      return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { cityId, email, password } = await req.json();

    if (!cityId || !email || !password) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Verify city exists using UUID
    const { data: city, error: cityCheckErr } = await supabaseAdmin
      .from("cities")
      .select("uuid")
      .eq("uuid", cityId)
      .single();

    if (cityCheckErr || !city) {
      return NextResponse.json({ error: "Invalid city selected" }, { status: 400 });
    }

    // Create user
    const { data: createdUser, error: userErr } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (userErr || !createdUser.user) {
      return NextResponse.json(
        { error: userErr?.message ?? "Failed to create user" },
        { status: 400 }
      );
    }

    const userId = createdUser.user.id;

    // Create profile linked to selected city (UUID)
    const { error: profErr } = await supabaseAdmin.from("profiles").insert({
      user_id: userId,
      city_id: cityId, // UUID
      role: "city",
    });

    if (profErr) {
      return NextResponse.json({ error: profErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
