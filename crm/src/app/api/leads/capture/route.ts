import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Public endpoint for a future sales page lead-capture form.
 * Not authenticated — creates a contact with stage=lead, source=organic.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, email, phone } = (body ?? {}) as {
    name?: unknown;
    email?: unknown;
    phone?: unknown;
  };

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "`name` is required" }, { status: 400 });
  }

  if (!process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Server is not configured to accept leads yet" },
      { status: 500 }
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("contacts")
    .insert({
      name: name.trim().slice(0, 200),
      email: typeof email === "string" && email.trim() ? email.trim().slice(0, 200) : null,
      phone: typeof phone === "string" && phone.trim() ? phone.trim().slice(0, 50) : null,
      stage: "lead",
      source: "organic",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: "Could not create contact" }, { status: 500 });
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
