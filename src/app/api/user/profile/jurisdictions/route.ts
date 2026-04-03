import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest) {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { jurisdiction, action } = (await request.json()) as {
      jurisdiction: string;
      action: "add" | "remove";
    };

    if (!jurisdiction || !["add", "remove"].includes(action)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Fetch current jurisdictions
    const { data: profile, error: fetchError } = await supabase
      .from("user_profiles")
      .select("jurisdictions")
      .eq("id", user.id)
      .single();

    if (fetchError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const current = (profile.jurisdictions as string[]) || [];
    let updated: string[];

    if (action === "add") {
      updated = [...new Set([...current, jurisdiction])];
    } else {
      updated = current.filter((j) => j !== jurisdiction);
    }

    const { error: updateError } = await supabase
      .from("user_profiles")
      .update({
        jurisdictions: updated,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ jurisdictions: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update" },
      { status: 500 }
    );
  }
}
