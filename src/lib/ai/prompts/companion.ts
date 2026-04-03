import type { Regulation } from "@/lib/types/regulation";

export type CompanionType = "checklist" | "briefing" | "training";

export const COMPANION_OPTIONS = [
  { value: "checklist" as CompanionType, label: "Implementation Checklist", icon: "CheckSquare" },
  { value: "briefing" as CompanionType, label: "Executive Briefing", icon: "FileText" },
  { value: "training" as CompanionType, label: "Training Outline", icon: "GraduationCap" },
];

export function buildCompanionPrompt(
  type: CompanionType,
  policyContent: string,
  regulations: Regulation[]
): string {
  const regContext = regulations
    .map(
      (r) =>
        `- ${r.title} (${r.jurisdiction_display}, ${r.status}): ${r.key_requirements.slice(0, 3).join("; ")}`
    )
    .join("\n");

  const policyExcerpt = policyContent.slice(0, 4000);

  switch (type) {
    case "checklist":
      return `You are a compliance implementation specialist. Generate a detailed implementation checklist based on the policy document and regulatory requirements below.

POLICY DOCUMENT (excerpt):
${policyExcerpt}

REGULATORY CONTEXT:
${regContext}

Generate a Markdown implementation checklist with these requirements:
1. Use checkbox format: \`- [ ] Task description\`
2. Group tasks by implementation phase: Preparation, Technical Controls, Process Changes, Training, Monitoring
3. Each task includes: description, responsible role in parentheses, estimated effort (hours/days), regulatory reference
4. Include dependencies between tasks where relevant
5. Add a "Quick Wins" section at the top for tasks completable in <1 day
6. Target length: 500-1000 words
7. Do NOT use markdown bold (**) inside checklist items — use plain text
8. Output ONLY the Markdown. No preamble or explanation.`;

    case "briefing":
      return `You are a compliance communications specialist writing for C-suite executives. Generate a one-page executive briefing based on the policy document below.

POLICY DOCUMENT (excerpt):
${policyExcerpt}

REGULATORY CONTEXT:
${regContext}

Generate a Markdown executive briefing with these requirements:
1. Title: "Executive Briefing: [Policy Topic]"
2. Structure:
   - **Why This Matters** (2-3 sentences on regulatory drivers and business risk)
   - **What This Policy Requires** (3-5 bullet points, plain language)
   - **Key Deadlines** (upcoming dates from regulatory context)
   - **Penalty Exposure** (financial risk summary)
   - **Resource Implications** (what the organization needs to invest)
   - **Recommended Board Action** (1-2 specific decisions needed)
3. Write for a non-technical executive. No jargon, no acronyms without explanation.
4. Target length: 300-500 words
5. Do NOT use markdown bold (**) inside table cells
6. Output ONLY the Markdown. No preamble or explanation.`;

    case "training":
      return `You are a compliance training designer. Generate a structured training session outline based on the policy document and regulatory requirements below.

POLICY DOCUMENT (excerpt):
${policyExcerpt}

REGULATORY CONTEXT:
${regContext}

Generate a Markdown training outline with these requirements:
1. Title: "Training Session: [Policy Topic]"
2. Structure:
   - **Session Overview** (duration, target audience, prerequisites)
   - **Learning Objectives** (3-5 measurable outcomes using Bloom's taxonomy verbs)
   - **Module 1: Regulatory Context** (why this matters, which laws apply)
   - **Module 2: Policy Requirements** (what employees must do, with examples)
   - **Module 3: Practical Scenarios** (3-4 realistic workplace scenarios with correct/incorrect responses)
   - **Module 4: Tools & Resources** (systems, contacts, escalation paths)
   - **Assessment Questions** (5 multiple-choice questions with answer key)
   - **Additional Resources** (links, references, further reading)
3. Include facilitator notes in [brackets]
4. Target length: 800-1500 words
5. Output ONLY the Markdown. No preamble or explanation.`;
  }
}
