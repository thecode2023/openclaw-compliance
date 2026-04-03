import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@/lib/supabase/server";
import { callGeminiWithRetry } from "@/lib/ai/client";
import { buildCompanionPrompt, COMPANION_OPTIONS } from "@/lib/ai/prompts/companion";
import type { Regulation } from "@/lib/types/regulation";
import type { CompanionType } from "@/lib/ai/prompts/companion";

export async function POST(request: NextRequest) {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { policy_content, companion_type, regulation_ids } = body as {
      policy_content: string;
      companion_type: CompanionType;
      regulation_ids?: string[];
    };

    if (!policy_content || !companion_type) {
      return NextResponse.json(
        { error: "Policy content and companion type are required" },
        { status: 400 }
      );
    }

    if (!COMPANION_OPTIONS.some((o) => o.value === companion_type)) {
      return NextResponse.json(
        { error: "Invalid companion type" },
        { status: 400 }
      );
    }

    // Fetch regulations if IDs provided
    let regulations: Regulation[] = [];
    if (regulation_ids && regulation_ids.length > 0) {
      const { data } = await supabase
        .from("regulations")
        .select("*")
        .in("id", regulation_ids);
      regulations = (data || []) as Regulation[];
    }

    const prompt = buildCompanionPrompt(companion_type, policy_content, regulations);
    const content_markdown = await callGeminiWithRetry(prompt);

    const typeLabel = COMPANION_OPTIONS.find((o) => o.value === companion_type)?.label || companion_type;
    const title = `${typeLabel}`;

    return NextResponse.json({ content_markdown, title });
  } catch (error) {
    console.error("[policies/companion] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate companion document",
      },
      { status: 500 }
    );
  }
}
