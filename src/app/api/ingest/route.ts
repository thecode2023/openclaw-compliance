import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callGeminiWithRetry } from "@/lib/ai/client";
import { buildClassifyRegulationPrompt } from "@/lib/ai/prompts/classify-regulation";
import { buildExtractUpdatePrompt } from "@/lib/ai/prompts/extract-update";
import { fetchAllRSSFeeds } from "@/lib/utils/rss";
import { validateCronSecret } from "@/lib/auth/cron";
import type { ClassifiedRegulation, ExtractedUpdate } from "@/lib/ai/types";

const MAX_API_CALLS = 20;

export async function POST(request: NextRequest) {
  const authError = validateCronSecret(request);
  if (authError) return authError;

  const supabase = createAdminClient();
  const runId = crypto.randomUUID();
  let apiCallCount = 0;

  const logEntry = async (
    sourceName: string,
    status: "success" | "failure" | "skipped",
    details: {
      items_processed?: number;
      items_created?: number;
      items_updated?: number;
      items_skipped?: number;
      error_message?: string;
    }
  ) => {
    await supabase.from("ingestion_logs").insert({
      run_id: runId,
      source_name: sourceName,
      status,
      ...details,
      completed_at: new Date().toISOString(),
    });
  };

  try {
    // Get existing regulation titles for dedup and update matching
    const { data: existingRegs } = await supabase
      .from("regulations")
      .select("id, title, jurisdiction, status");

    const existingTitles = (existingRegs || []).map((r) => r.title);
    const existingTitleSet = new Set(
      existingTitles.map((t) => t.toLowerCase())
    );

    // Fetch RSS feeds (individual feed failures are logged but don't block the pipeline)
    const feedResult = await fetchAllRSSFeeds();
    const feedItems = feedResult.items;

    // Log any feed errors
    for (const feedError of feedResult.errors) {
      await logEntry(feedError.source, "failure", {
        error_message: `RSS feed error: ${feedError.error}`,
      });
    }

    let totalCreated = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalAlerts = 0;

    // Helper: generate alerts for affected users when a regulation is created/updated
    async function generateAlerts(
      regulationId: string,
      jurisdiction: string,
      regulationStatus: string,
      updateType: string,
      title: string,
      summary: string
    ) {
      // Find users whose jurisdictions overlap with this regulation's jurisdiction
      const { data: affectedUsers } = await supabase
        .from("user_profiles")
        .select("id")
        .filter("jurisdictions", "cs", `{${jurisdiction}}`);

      if (!affectedUsers || affectedUsers.length === 0) return;

      // Determine severity based on regulation status and update type
      let severity: "critical" | "high" | "medium" | "low" = "medium";
      if (updateType === "enforcement_action") {
        severity = "critical";
      } else if (
        updateType === "new_regulation" &&
        (regulationStatus === "enacted" || regulationStatus === "in_effect")
      ) {
        severity = "high";
      } else if (updateType === "amendment" || updateType === "status_change") {
        severity = "high";
      } else if (updateType === "guidance_update") {
        severity = "low";
      }

      // Determine alert_type from update_type (must match DB constraint)
      const alertType =
        updateType === "new_regulation"
          ? "new_regulation"
          : updateType === "enforcement_action"
            ? "enforcement_action"
            : "regulation_changed";

      const alertRows = affectedUsers.map((u) => ({
        user_id: u.id,
        regulation_id: regulationId,
        alert_type: alertType,
        severity,
        title,
        summary,
        read: false,
        dismissed: false,
      }));

      const { error: alertError } = await supabase
        .from("compliance_alerts")
        .insert(alertRows);

      if (!alertError) {
        totalAlerts += alertRows.length;
      }
    }

    for (const item of feedItems) {
      if (apiCallCount >= MAX_API_CALLS) {
        await logEntry("rate_limit", "skipped", {
          items_skipped: feedItems.length - totalCreated - totalUpdated - totalSkipped,
          error_message: `Rate limit reached (${MAX_API_CALLS} API calls)`,
        });
        break;
      }

      try {
        // First, check if this might be an update to an existing regulation
        const itemTitle = String(item.title || "");
        const itemSnippet = String(item.contentSnippet || "");
        const itemLink = String(item.link || "");
        const itemSource = String(item.source || "");

        const updatePrompt = buildExtractUpdatePrompt(
          `${itemTitle}\n\n${itemSnippet}`,
          itemLink,
          existingTitles
        );

        apiCallCount++;
        const updateResponse = await callGeminiWithRetry(updatePrompt);
        const updateData = parseJsonResponse(updateResponse);

        if (updateData?.is_relevant && updateData.updates?.length > 0) {
          for (const update of updateData.updates as ExtractedUpdate[]) {
            // Safely coerce all fields to strings
            const uTitle = String(update.title || "");
            const uSummary = String(update.summary || "");
            const uSourceUrl = String(update.source_url || item.link);
            const uRegTitle = String(update.regulation_title || "");
            const uType = String(update.update_type || "guidance_update");

            // Find matching regulation
            const matchingReg = (existingRegs || []).find(
              (r) =>
                r.title.toLowerCase() === uRegTitle.toLowerCase()
            );

            if (matchingReg) {
              // Insert as regulatory update
              await supabase.from("regulatory_updates").insert({
                regulation_id: matchingReg.id,
                update_type: uType,
                title: uTitle,
                summary: uSummary,
                source_url: uSourceUrl,
                verified: false,
                raw_source_text: String(item.contentSnippet || ""),
                detected_at: new Date().toISOString(),
              });

              // Generate alerts for affected users
              await generateAlerts(
                matchingReg.id,
                matchingReg.jurisdiction,
                matchingReg.status,
                uType,
                uTitle,
                uSummary
              );

              totalUpdated++;
            } else if (update.update_type === "new_regulation") {
              // Classify as new regulation
              if (apiCallCount >= MAX_API_CALLS) break;

              const classifyPrompt = buildClassifyRegulationPrompt(
                `${itemTitle}\n\n${itemSnippet}`,
                itemLink,
                itemSource
              );

              apiCallCount++;
              const classifyResponse =
                await callGeminiWithRetry(classifyPrompt);
              const classified = parseJsonResponse(
                classifyResponse
              ) as ClassifiedRegulation | null;

              const cTitle = classified ? String(classified.title || "") : "";
              const cSummary = classified ? String(classified.summary || "") : "";

              if (
                classified &&
                classified.confidence > 0.3 &&
                cTitle &&
                !existingTitleSet.has(cTitle.toLowerCase())
              ) {
                const { data: newReg } = await supabase
                  .from("regulations")
                  .insert({
                    title: cTitle,
                    jurisdiction: String(classified.jurisdiction || ""),
                    jurisdiction_display: String(classified.jurisdiction_display || ""),
                    status: classified.status,
                    category: classified.category,
                    summary: cSummary,
                    key_requirements: Array.isArray(classified.key_requirements) ? classified.key_requirements.map(String) : [],
                    compliance_implications: Array.isArray(classified.compliance_implications) ? classified.compliance_implications.map(String) : [],
                    effective_date: classified.effective_date || null,
                    source_url: String(classified.source_url || item.link),
                    source_name: String(classified.source_name || item.source),
                    ai_classified: true,
                    ai_confidence: classified.confidence,
                    last_verified_at: new Date().toISOString(),
                  })
                  .select("id")
                  .single();

                if (newReg) {
                  await generateAlerts(
                    newReg.id,
                    String(classified.jurisdiction || ""),
                    String(classified.status || ""),
                    "new_regulation",
                    cTitle,
                    cSummary
                  );
                }

                existingTitleSet.add(cTitle.toLowerCase());
                totalCreated++;
              } else {
                totalSkipped++;
              }
            }
          }
        } else {
          totalSkipped++;
        }
      } catch (itemError) {
        const errorMsg =
          itemError instanceof Error ? itemError.message : String(itemError);
        await logEntry(String(item.source || "unknown"), "failure", {
          error_message: `Failed processing "${String(item.title || "unknown")}": ${errorMsg}`,
        });
        totalSkipped++;
      }
    }

    await logEntry("ingestion_run", "success", {
      items_processed: feedItems.length,
      items_created: totalCreated,
      items_updated: totalUpdated,
      items_skipped: totalSkipped,
    });

    return NextResponse.json({
      run_id: runId,
      status: "completed",
      feed_items_fetched: feedItems.length,
      feed_errors: feedResult.errors.length,
      api_calls_made: apiCallCount,
      regulations_created: totalCreated,
      updates_recorded: totalUpdated,
      items_skipped: totalSkipped,
      alerts_generated: totalAlerts,
    });
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : "Unknown error";

    await logEntry("ingestion_run", "failure", {
      error_message: errorMsg,
    });

    return NextResponse.json(
      {
        run_id: runId,
        status: "failed",
        error: "Ingestion pipeline failed. Check server logs.",
      },
      { status: 500 }
    );
  }
}

// Also support GET for Vercel Cron (Vercel Cron sends GET requests)
export async function GET(request: NextRequest) {
  return POST(request);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseJsonResponse(text: string): any {
  try {
    // Strip markdown code fences if present
    const cleaned = text
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}
