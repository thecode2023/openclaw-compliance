import { NextRequest, NextResponse } from "next/server";
import { validateCronSecret } from "@/lib/auth/cron";
import { createAdminClient } from "@/lib/supabase/admin";
import { scrapeUrl } from "@/lib/firecrawl/client";
import { computeContentHash, computeDiff } from "@/lib/firecrawl/diff";
import { callGeminiWithRetry } from "@/lib/ai/client";

const MAX_SOURCES_PER_RUN = 30;
const MAX_CONSECUTIVE_FAILURES = 5;

export async function POST(request: NextRequest) {
  const authError = validateCronSecret(request);
  if (authError) return authError;

  const supabase = createAdminClient();
  const startTime = Date.now();

  let sourcesChecked = 0;
  let changesDetected = 0;
  let errors = 0;
  let creditsUsed = 0;

  try {
    // Fetch enabled sources
    const { data: sources, error: fetchError } = await supabase
      .from("scrape_sources")
      .select("*, regulations!inner(title, jurisdiction)")
      .eq("enabled", true)
      .order("last_scraped_at", { ascending: true, nullsFirst: true })
      .limit(MAX_SOURCES_PER_RUN);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!sources || sources.length === 0) {
      return NextResponse.json({
        status: "completed",
        message: "No enabled scrape sources found",
      });
    }

    for (const source of sources) {
      sourcesChecked++;
      creditsUsed++;

      const regTitle = source.regulations?.title || "Unknown";
      const regJurisdiction = source.regulations?.jurisdiction || "";

      console.log(`[scrape] Scraping: ${regTitle} — ${source.url}`);

      // Scrape the URL
      const result = await scrapeUrl({
        url: source.url,
        formats: ["markdown"],
        onlyMainContent: true,
        cssSelector: source.css_selector || undefined,
      });

      if (!result.success || !result.data?.markdown) {
        errors++;
        const newErrorCount = (source.error_count || 0) + 1;
        await supabase
          .from("scrape_sources")
          .update({
            error_count: newErrorCount,
            last_error: result.error || "No content returned",
            enabled: newErrorCount < MAX_CONSECUTIVE_FAILURES,
            updated_at: new Date().toISOString(),
          })
          .eq("id", source.id);

        console.error(`[scrape] Failed: ${regTitle} — ${result.error}`);
        continue;
      }

      const newContent = result.data.markdown;
      const newHash = computeContentHash(newContent);

      // Reset error count on successful scrape
      const updates: Record<string, unknown> = {
        last_scraped_at: new Date().toISOString(),
        error_count: 0,
        last_error: null,
        updated_at: new Date().toISOString(),
      };

      // Compare hashes
      if (source.last_content_hash && newHash === source.last_content_hash) {
        // No change
        updates.change_detected = false;
        await supabase.from("scrape_sources").update(updates).eq("id", source.id);
        continue;
      }

      // Content changed — compute diff
      const diff = source.last_content_text
        ? computeDiff(source.last_content_text, newContent)
        : { has_changes: true, summary: "Initial scrape", added_text: newContent.slice(0, 2000), removed_text: "", changed_sections: [], added_word_count: 0, removed_word_count: 0 };

      // Store new content
      updates.last_content_hash = newHash;
      updates.last_content_text = newContent.slice(0, 50000); // Cap storage
      updates.change_detected = diff.has_changes;

      await supabase.from("scrape_sources").update(updates).eq("id", source.id);

      if (!diff.has_changes) {
        continue;
      }

      // Substantive change detected — classify with Gemini
      changesDetected++;
      console.log(`[scrape] Change detected: ${regTitle} — ${diff.summary}`);

      try {
        const classificationPrompt = `A regulatory source page has been updated. Classify this change.

REGULATION: ${regTitle}
SOURCE URL: ${source.url}
CHANGE SUMMARY: ${diff.summary}

ADDED CONTENT (first 2000 chars):
${diff.added_text.slice(0, 2000)}

${diff.removed_text ? `REMOVED CONTENT (first 500 chars):\n${diff.removed_text.slice(0, 500)}` : ""}

${diff.changed_sections.length > 0 ? `AFFECTED SECTIONS: ${diff.changed_sections.join(", ")}` : ""}

Respond with ONLY valid JSON (no markdown, no code fences):
{
  "update_type": "amendment" | "status_change" | "enforcement_action" | "guidance_update",
  "title": "Brief title of the change (max 100 chars)",
  "summary": "2-3 sentence summary of what changed and its compliance implications",
  "significance": "high" | "medium" | "low"
}`;

        const classificationResult = await callGeminiWithRetry(classificationPrompt);

        let parsed;
        try {
          const cleaned = classificationResult.replace(/```json\n?|\n?```/g, "").trim();
          parsed = JSON.parse(cleaned);
        } catch {
          console.error(`[scrape] Failed to parse classification for ${regTitle}`);
          continue;
        }

        // Insert regulatory update (unverified — requires human review)
        await supabase.from("regulatory_updates").insert({
          regulation_id: source.regulation_id,
          update_type: parsed.update_type || "guidance_update",
          title: parsed.title || `Source page updated: ${regTitle}`,
          summary: parsed.summary || diff.summary,
          source_url: source.url,
          verified: false,
          raw_source_text: diff.added_text.slice(0, 5000),
        });

        // Generate compliance alerts for affected users
        if (parsed.significance !== "low") {
          const { data: affectedUsers } = await supabase
            .from("user_profiles")
            .select("id, jurisdictions");

          if (affectedUsers) {
            const alertInserts = affectedUsers
              .filter(
                (u: { jurisdictions: string[] }) =>
                  u.jurisdictions?.includes(regJurisdiction)
              )
              .map((u: { id: string }) => ({
                user_id: u.id,
                regulation_id: source.regulation_id,
                alert_type: "source_change",
                title: parsed.title || `Update: ${regTitle}`,
                summary: parsed.summary || diff.summary,
                severity: parsed.significance === "high" ? "high" : "medium",
                read: false,
                dismissed: false,
              }));

            if (alertInserts.length > 0) {
              await supabase.from("compliance_alerts").insert(alertInserts);
            }
          }
        }
      } catch (classifyError) {
        console.error(`[scrape] Classification failed for ${regTitle}:`, classifyError);
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    return NextResponse.json({
      status: "completed",
      sources_checked: sourcesChecked,
      changes_detected: changesDetected,
      errors,
      credits_used: creditsUsed,
      elapsed_seconds: elapsed,
    });
  } catch (error) {
    console.error("[scrape] Pipeline error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Monitor pipeline failed" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
