import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET: List pending regulations for authenticated user
export async function GET() {
  const supabase = await createServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("pending_regulations")
    .select("*")
    .in("review_status", ["pending", "uncertain"])
    .order("detected_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch pending items" }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

// PATCH: Approve or dismiss a pending regulation
export async function PATCH(request: NextRequest) {
  const supabase = await createServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, action, dismiss_reason, edits } = body;

  if (!id || !action) {
    return NextResponse.json({ error: "Missing id or action" }, { status: 400 });
  }

  // Fetch the pending item
  const { data: pending, error: fetchError } = await supabase
    .from("pending_regulations")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !pending) {
    return NextResponse.json({ error: "Pending regulation not found" }, { status: 404 });
  }

  const admin = createAdminClient();

  if (action === "approve") {
    // Apply edits if provided
    const final = edits ? { ...pending, ...edits } : pending;

    // Insert into regulations table
    const { error: insertError } = await admin.from("regulations").insert({
      title: final.title,
      jurisdiction: final.jurisdiction ?? "INTL",
      jurisdiction_display: final.jurisdiction_display ?? "Unknown",
      status: final.status ?? "proposed",
      category: final.category ?? "legislation",
      summary: final.summary ?? "",
      key_requirements: final.key_requirements ?? [],
      compliance_implications: final.compliance_implications ?? [],
      effective_date: final.effective_date,
      source_url: final.source_url,
      source_name: final.source_name ?? "Discovered via ingestion",
      ai_classified: true,
      ai_confidence: final.pass1_confidence,
      last_verified_at: new Date().toISOString(),
    });

    if (insertError) {
      return NextResponse.json({ error: "Failed to create regulation" }, { status: 500 });
    }

    // Update pending status
    await admin.from("pending_regulations").update({
      review_status: "approved",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    }).eq("id", id);

    return NextResponse.json({ status: "approved" });
  }

  if (action === "dismiss") {
    await admin.from("pending_regulations").update({
      review_status: "dismissed",
      dismiss_reason: dismiss_reason ?? "Not relevant",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    }).eq("id", id);

    return NextResponse.json({ status: "dismissed" });
  }

  return NextResponse.json({ error: "Invalid action. Use 'approve' or 'dismiss'." }, { status: 400 });
}
