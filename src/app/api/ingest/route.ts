import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callGeminiWithRetry } from "@/lib/ai/client";
import { buildClassifyRegulationPrompt } from "@/lib/ai/prompts/classify-regulation";
import { buildExtractUpdatePrompt } from "@/lib/ai/prompts/extract-update";
import { fetchAllRSSFeeds } from "@/lib/utils/rss";
import { validateCronSecret } from "@/lib/auth/cron";
import { isLikelyRelevant } from "@/lib/utils/relevance-filter";
import { computeContentHash } from "@/lib/utils/content-hash";
import { buildClassifyItemPrompt } from "@/lib/ai/prompts/classify-item";
import { buildVerifyRegulationPrompt } from "@/lib/ai/prompts/verify-regulation";
import type { ClassifiedRegulation, ExtractedUpdate, Pass1Result, Pass2Result } from "@/lib/ai/types";

const MAX_API_CALLS = 40;

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
    const feedResult = await fetchAllRSSFeeds(supabase);
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

    // ==================================================================
    // DISCOVERY PIPELINE — detect new regulations via two-pass Gemini
    // ==================================================================
    let discoveryProcessed = 0;
    let discoveryPending = 0;
    let discoveryNoise = 0;

    for (const item of feedItems) {
      if (apiCallCount >= MAX_API_CALLS) break;

      // Pre-filter: skip items that don't mention AI + regulation keywords
      if (!isLikelyRelevant(item)) {
        discoveryNoise++;
        continue;
      }

      // Dedup: check if we already have this item pending
      const hash = await computeContentHash(item.title, item.link);
      const { count: existingCount } = await supabase
        .from("pending_regulations")
        .select("*", { count: "exact", head: true })
        .eq("content_hash", hash)
        .eq("review_status", "pending");

      if (existingCount && existingCount > 0) continue;

      try {
        // Pass 1: Classification
        const pass1Prompt = buildClassifyItemPrompt(
          { title: String(item.title), source: String(item.source), link: String(item.link), contentSnippet: String(item.contentSnippet) },
          existingTitles
        );
        apiCallCount++;
        const pass1Raw = await callGeminiWithRetry(pass1Prompt);
        const pass1 = parseJsonResponse(pass1Raw) as Pass1Result | null;

        if (!pass1 || pass1.confidence <= 0.4) {
          discoveryNoise++;
          continue;
        }

        if (pass1.classification === "noise") {
          discoveryNoise++;
          continue;
        }

        // For updates/enforcement/guidance — handled by existing pipeline above, skip here
        if (pass1.classification !== "new_regulation") {
          continue;
        }

        // Pass 2: Verification (only for new_regulation)
        const pass2Prompt = buildVerifyRegulationPrompt(
          { title: String(item.title), source: String(item.source), link: String(item.link), contentSnippet: String(item.contentSnippet) },
          { classification: pass1.classification, confidence: pass1.confidence, reasoning: pass1.reasoning }
        );
        apiCallCount++;
        const pass2Raw = await callGeminiWithRetry(pass2Prompt);
        const pass2 = parseJsonResponse(pass2Raw) as Pass2Result | null;

        if (!pass2 || pass2.verification === "disagree") {
          discoveryNoise++;
          continue;
        }

        // Insert pending regulation
        const draft = pass2.draft;
        await supabase.from("pending_regulations").insert({
          title: String(draft.title || item.title),
          jurisdiction: draft.jurisdiction,
          jurisdiction_display: draft.jurisdiction_display,
          status: draft.status,
          category: draft.category,
          summary: draft.summary,
          key_requirements: draft.key_requirements || [],
          compliance_implications: draft.compliance_implications || [],
          effective_date: draft.effective_date,
          source_url: String(draft.source_url || item.link),
          source_name: draft.source_name,
          pass1_classification: pass1.classification,
          pass1_confidence: pass1.confidence,
          pass2_classification: pass2.verification,
          pass2_confidence: pass2.confidence,
          review_status: pass2.verification === "uncertain" ? "uncertain" : "pending",
          feed_source: item.source,
          raw_title: String(item.title),
          raw_snippet: String(item.contentSnippet).slice(0, 2000),
          raw_link: String(item.link),
          content_hash: hash,
        });

        discoveryPending++;
        discoveryProcessed++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Discovery] Failed for "${String(item.title)}": ${msg}`);
        discoveryProcessed++;
      }
    }

    await logEntry("discovery_pipeline", "success", {
      items_processed: discoveryProcessed + discoveryNoise,
      items_created: discoveryPending,
      items_skipped: discoveryNoise,
    });

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
      discovery: {
        processed: discoveryProcessed,
        pending_created: discoveryPending,
        noise_filtered: discoveryNoise,
      },
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
