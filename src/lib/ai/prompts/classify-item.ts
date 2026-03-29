/**
 * Pass 1 — Classification prompt.
 * Determines whether an RSS item represents a new regulation, an update to an existing one, or noise.
 */
export function buildClassifyItemPrompt(
  item: { title: string; source: string; link: string; contentSnippet: string },
  existingTitles: string[]
): string {
  const titleList = existingTitles.map((t) => `- ${t}`).join("\n");

  return `You are a regulatory intelligence analyst. Classify the following RSS item to determine if it represents a meaningful AI regulation development.

EXISTING REGULATIONS IN DATABASE (${existingTitles.length} titles — do NOT classify as new if already listed):
${titleList}

RSS ITEM:
Title: ${item.title}
Source: ${item.source}
Link: ${item.link}
Content: ${item.contentSnippet}

CLASSIFICATION RULES:
1. "new_regulation" — A NEW law, regulation, framework, standard, or executive order related to AI governance that is NOT in the existing database. Must be an actual regulatory instrument, not news about one.
2. "update_to_existing" — A change, amendment, enforcement action, or status update to a regulation already in the database. Match by title.
3. "enforcement_action" — A government or regulatory body taking enforcement action related to AI compliance.
4. "guidance_update" — New guidance, interpretation, or advisory from a regulatory body about existing AI rules.
5. "noise" — Not related to AI regulation, or is general news/opinion/commentary rather than a regulatory development.

CRITICAL: Be conservative. If uncertain, classify as "noise". Only classify as "new_regulation" if the item clearly describes an actual regulatory instrument (law, rule, framework, standard) — NOT a news article about regulation.

Respond with ONLY this JSON (no markdown, no explanation):
{
  "classification": "new_regulation|update_to_existing|enforcement_action|guidance_update|noise",
  "confidence": 0.0,
  "matched_existing_title": null,
  "reasoning": "one sentence"
}`;
}
