import type { Regulation } from "@/lib/types/regulation";

export function buildGeneratePolicyPrompt(params: {
  regulations: Regulation[];
  policyType: string;
  industry: string;
  organizationDetails?: string;
}): string {
  const { regulations, policyType, industry, organizationDetails } = params;

  const regulationContext = regulations
    .map(
      (reg, i) => `
REGULATION ${i + 1}:
- Title: ${reg.title}
- Jurisdiction: ${reg.jurisdiction} (${reg.jurisdiction_display})
- Status: ${reg.status}
- Category: ${reg.category}
- Effective Date: ${reg.effective_date || "N/A"}
- Source URL: ${reg.source_url}
- Key Requirements:
${reg.key_requirements.map((r: string) => `  * ${r}`).join("\n")}
- Compliance Implications:
${reg.compliance_implications.map((c: string) => `  * ${c}`).join("\n")}
`
    )
    .join("\n---\n");

  return `You are a compliance policy architect. Generate a professional internal compliance policy document based on the regulatory requirements provided.

POLICY TYPE: ${policyType}
INDUSTRY: ${industry}
ORGANIZATION: ${organizationDetails || "Not specified — write in generic corporate language"}

REGULATORY REQUIREMENTS:
${regulationContext}

DOCUMENT STRUCTURE (use Markdown formatting with headers, bullet points, and tables):

1. **Policy Title** — as a level-1 heading
2. **Document Control** — table with Version, Effective Date placeholder, Owner placeholder, Review Cycle
3. **Purpose & Scope**
   - Why this policy exists (tied directly to the regulatory requirements)
   - Who it applies to
   - What systems, processes, or AI applications it covers
4. **Definitions**
   - Key terms from the regulations, defined in plain language
5. **Policy Statements**
   - Numbered, specific, actionable requirements
   - Each statement MUST map to a specific regulatory requirement — include the citation as **[Regulation Title, Jurisdiction]**
   - Use "shall" for mandatory requirements, "should" for recommended practices
6. **Roles & Responsibilities**
   - RACI-style table: Responsible, Accountable, Consulted, Informed
   - Include placeholders for specific role titles
7. **Implementation Requirements**
   - Technical controls needed
   - Process changes needed
   - Training requirements
8. **Monitoring & Enforcement**
   - How compliance with this policy will be measured
   - Reporting requirements
   - Consequences of non-compliance
9. **Review & Update Schedule**
   - Linked to regulatory update cadence
10. **Appendices**
    - Regulatory reference table (regulation name, jurisdiction, relevant articles/sections)
    - Related internal policies (placeholders)

RULES:
1. Every policy statement MUST cite the specific regulation and requirement it implements using **[Regulation Title, Jurisdiction]** format.
2. Use professional legal/compliance language appropriate for board-level review.
3. Include placeholders in [BRACKETS] for organization-specific details the user must fill in (e.g., [COMPANY NAME], [DEPARTMENT], [COMPLIANCE OFFICER NAME]).
4. The policy must be implementable — no aspirational platitudes, only concrete requirements.
5. Include version control metadata at the top.
6. Keep the document between 1500-3000 words.
7. Do NOT invent or cite any regulation not listed in REGULATORY REQUIREMENTS above.
8. Output ONLY the Markdown document. No preamble, no explanation, no code fences wrapping the output.`;
}
