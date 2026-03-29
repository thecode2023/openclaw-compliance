/**
 * Pass 2 — Verification + Draft Extraction prompt.
 * Verifies Pass 1 classification and extracts structured regulation data if confirmed.
 */
export function buildVerifyRegulationPrompt(
  item: { title: string; source: string; link: string; contentSnippet: string },
  pass1Result: { classification: string; confidence: number; reasoning: string }
): string {
  return `You are a senior regulatory analyst performing quality assurance. A junior analyst classified the following RSS item as a potential NEW AI regulation. Your job is to verify this classification and, if correct, extract structured regulation data.

CLASSIFICATION FROM PASS 1:
- Classification: ${pass1Result.classification}
- Confidence: ${pass1Result.confidence}
- Reasoning: ${pass1Result.reasoning}

RSS ITEM:
Title: ${item.title}
Source: ${item.source}
Link: ${item.link}
Content: ${item.contentSnippet}

VERIFICATION RULES:
1. Does this item describe an actual NEW regulatory instrument (law, rule, framework, standard, executive order)?
2. Is it genuinely about AI, autonomous systems, data protection with AI provisions, or algorithmic governance?
3. Is there enough information to create a meaningful database entry?

If verified as a real new regulation, extract the structured data. If NOT a real new regulation (e.g., it is just news coverage, an opinion piece, or a duplicate), mark as disagree.

CRITICAL: Only extract information explicitly stated in the content. Do NOT invent requirements, penalties, or dates. If a field cannot be determined from the content, use null.

Respond with ONLY this JSON (no markdown, no explanation):
{
  "verification": "agree|disagree|uncertain",
  "confidence": 0.0,
  "reasoning": "one sentence",
  "draft": {
    "title": "Official name of the regulation or null",
    "jurisdiction": "ISO-style code (US, EU, GB, US-CA, KR, etc.) or null",
    "jurisdiction_display": "Human-readable name or null",
    "status": "enacted|proposed|in_effect|under_review|null",
    "category": "legislation|executive_order|framework|guidance|standard|null",
    "summary": "2-3 sentence summary or null",
    "key_requirements": [],
    "compliance_implications": [],
    "effective_date": "YYYY-MM-DD or null",
    "source_url": "${item.link}",
    "source_name": "Name of the publishing body or null"
  }
}`;
}
