export interface RelationshipSeed {
  source_title: string;
  target_title: string;
  relationship_type: "triggers" | "requires" | "conflicts_with" | "supplements" | "supersedes" | "references";
  description: string;
  strength: "strong" | "moderate" | "weak";
}

export const REGULATION_RELATIONSHIPS: RelationshipSeed[] = [
  // EU AI Act connections
  { source_title: "EU Artificial Intelligence Act (Regulation 2024/1689)", target_title: "EU General Data Protection Regulation (GDPR) — AI Provisions", relationship_type: "triggers", description: "AI systems processing personal data must comply with GDPR", strength: "strong" },
  { source_title: "EU Artificial Intelligence Act (Regulation 2024/1689)", target_title: "NIST AI Risk Management Framework (AI RMF 1.0)", relationship_type: "references", description: "International standards alignment for risk management", strength: "moderate" },
  { source_title: "EU Artificial Intelligence Act (Regulation 2024/1689)", target_title: "OECD Principles on Artificial Intelligence", relationship_type: "references", description: "Based on OECD principles for trustworthy AI", strength: "moderate" },
  { source_title: "EU General Data Protection Regulation (GDPR) — AI Provisions", target_title: "EU Artificial Intelligence Act (Regulation 2024/1689)", relationship_type: "supplements", description: "Automated decision-making rights under Article 22 supplement AI Act", strength: "strong" },
  { source_title: "EU Digital Operational Resilience Act (DORA)", target_title: "EU Artificial Intelligence Act (Regulation 2024/1689)", relationship_type: "supplements", description: "Financial services AI must meet DORA ICT resilience requirements", strength: "strong" },
  { source_title: "EU Product Liability Directive Revision (Directive 2024/2853) — AI Provisions", target_title: "EU Artificial Intelligence Act (Regulation 2024/1689)", relationship_type: "requires", description: "AI systems as products require CE marking and liability compliance", strength: "strong" },
  { source_title: "EU Markets in Crypto-Assets Regulation (MiCA)", target_title: "EU Digital Operational Resilience Act (DORA)", relationship_type: "supplements", description: "MiCA crypto assets require DORA operational resilience", strength: "moderate" },
  { source_title: "EU Cyber Resilience Act (Regulation 2024/2847) — AI-Connected Device Requirements", target_title: "EU Artificial Intelligence Act (Regulation 2024/1689)", relationship_type: "supplements", description: "AI-connected devices must meet CRA cybersecurity requirements", strength: "moderate" },
  { source_title: "EU Platform Workers Directive — Algorithmic Management", target_title: "EU Artificial Intelligence Act (Regulation 2024/1689)", relationship_type: "supplements", description: "Algorithmic management of workers intersects AI Act high-risk classification", strength: "moderate" },
  { source_title: "EU Medical Device Regulation (MDR 2017/745) — AI/ML Requirements", target_title: "EU Artificial Intelligence Act (Regulation 2024/1689)", relationship_type: "supplements", description: "AI/ML medical devices subject to both MDR and AI Act", strength: "strong" },

  // US framework connections
  { source_title: "California AI Transparency Act (SB 942) and AI Watermarking Requirements (AB 853)", target_title: "NIST AI Risk Management Framework (AI RMF 1.0)", relationship_type: "references", description: "References NIST AI RMF for transparency standards", strength: "moderate" },
  { source_title: "Colorado AI Act (SB 24-205)", target_title: "NIST AI Risk Management Framework (AI RMF 1.0)", relationship_type: "references", description: "Explicitly requires NIST AI RMF conformance", strength: "strong" },
  { source_title: "Texas Responsible AI Governance Act (TRAIGA, HB 149)", target_title: "Colorado AI Act (SB 24-205)", relationship_type: "conflicts_with", description: "Different compliance thresholds and approaches to high-risk AI", strength: "moderate" },
  { source_title: "NIST AI 600-1: Generative AI Profile", target_title: "NIST AI Risk Management Framework (AI RMF 1.0)", relationship_type: "supplements", description: "Extends AI RMF with GenAI-specific risk guidance", strength: "strong" },
  { source_title: "New York City Local Law 144 — Automated Employment Decision Tools (AEDT)", target_title: "Illinois AI Video Interview Act (AIVI) and Biometric Information Privacy Act (BIPA)", relationship_type: "references", description: "Both address AI in employment decisions", strength: "weak" },
  { source_title: "California Consumer Privacy Act / California Privacy Rights Act (CCPA/CPRA) — AI Provisions", target_title: "EU General Data Protection Regulation (GDPR) — AI Provisions", relationship_type: "references", description: "Modeled on GDPR automated decision-making rights", strength: "moderate" },
  { source_title: "FTC Enforcement Actions on AI — Section 5 Authority", target_title: "NIST AI Risk Management Framework (AI RMF 1.0)", relationship_type: "references", description: "FTC references NIST standards in enforcement guidance", strength: "weak" },
  { source_title: "Connecticut AI Act (SB 2, Public Act 24-148)", target_title: "Colorado AI Act (SB 24-205)", relationship_type: "references", description: "Similar high-risk AI requirements across states", strength: "moderate" },
  { source_title: "Utah Artificial Intelligence Policy Act (SB 149)", target_title: "FTC Enforcement Actions on AI — Section 5 Authority", relationship_type: "references", description: "State disclosure requirements complement federal enforcement", strength: "weak" },
  { source_title: "Maryland Facial Recognition in Hiring (HB 1202)", target_title: "New York City Local Law 144 — Automated Employment Decision Tools (AEDT)", relationship_type: "references", description: "Both regulate AI in employment hiring decisions", strength: "moderate" },
  { source_title: "OMB Memorandum M-24-10 — Advancing Governance, Innovation, and Risk Management for Agency Use of AI", target_title: "NIST AI Risk Management Framework (AI RMF 1.0)", relationship_type: "requires", description: "Federal agencies must follow NIST AI RMF", strength: "strong" },

  // Healthcare/Finance intersections
  { source_title: "HIPAA and AI — HHS Guidance on Use of AI with Protected Health Information", target_title: "FDA AI/ML-Based Software as Medical Device (SaMD) Framework", relationship_type: "triggers", description: "AI in healthcare intersects both HIPAA privacy and FDA device regulation", strength: "strong" },
  { source_title: "SEC Proposed Rules on AI in Investment Advisory and Broker-Dealer Activities", target_title: "EU Digital Operational Resilience Act (DORA)", relationship_type: "references", description: "Both address AI in financial services", strength: "weak" },
  { source_title: "HHS AI Strategy — Trustworthy AI in Health and Human Services", target_title: "HIPAA and AI — HHS Guidance on Use of AI with Protected Health Information", relationship_type: "supplements", description: "HHS AI strategy encompasses HIPAA AI guidance", strength: "moderate" },

  // Asia-Pacific connections
  { source_title: "Singapore Model AI Governance Framework for Generative AI and Agentic AI Systems", target_title: "OECD Principles on Artificial Intelligence", relationship_type: "references", description: "Aligned with OECD AI principles", strength: "moderate" },
  { source_title: "China Interim Measures for the Management of Generative AI Services", target_title: "China PBOC Guidelines on AI in Financial Services", relationship_type: "supplements", description: "GenAI measures build on existing AI regulations", strength: "moderate" },
  { source_title: "South Korea AI Basic Act (AI Industry Promotion and Trust Framework Act)", target_title: "EU Artificial Intelligence Act (Regulation 2024/1689)", relationship_type: "references", description: "Risk-based approach modeled on EU framework", strength: "moderate" },
  { source_title: "Japan AI Guidelines for Business (METI)", target_title: "OECD Principles on Artificial Intelligence", relationship_type: "references", description: "Based on OECD principles, voluntary approach", strength: "moderate" },
  { source_title: "Indonesia Personal Data Protection Law (UU PDP, Law No. 27 of 2022)", target_title: "EU General Data Protection Regulation (GDPR) — AI Provisions", relationship_type: "references", description: "Data transfer requirements modeled on GDPR adequacy", strength: "moderate" },
  { source_title: "India Digital Personal Data Protection Act (DPDPA, 2023)", target_title: "EU General Data Protection Regulation (GDPR) — AI Provisions", relationship_type: "references", description: "Data protection framework inspired by GDPR", strength: "moderate" },
  { source_title: "Thailand Personal Data Protection Act (PDPA, B.E. 2562)", target_title: "EU General Data Protection Regulation (GDPR) — AI Provisions", relationship_type: "references", description: "PDPA closely modeled on GDPR provisions", strength: "moderate" },
  { source_title: "Australia AI Ethics Framework and Proposed Mandatory Guardrails", target_title: "OECD Principles on Artificial Intelligence", relationship_type: "references", description: "Ethics framework aligned with OECD principles", strength: "moderate" },

  // Latin America
  { source_title: "Brazil AI Bill (PL 2338/2023)", target_title: "EU Artificial Intelligence Act (Regulation 2024/1689)", relationship_type: "references", description: "Risk-based classification modeled on EU approach", strength: "strong" },
  { source_title: "Brazil AI Bill (PL 2338/2023)", target_title: "OECD Principles on Artificial Intelligence", relationship_type: "references", description: "Incorporates OECD AI principles", strength: "moderate" },

  // Middle East & Africa
  { source_title: "UAE National AI Strategy 2031 and Data Protection Framework", target_title: "OECD Principles on Artificial Intelligence", relationship_type: "references", description: "Aligned with international AI governance standards", strength: "moderate" },
  { source_title: "South Africa Protection of Personal Information Act (POPIA) — AI Provisions", target_title: "EU General Data Protection Regulation (GDPR) — AI Provisions", relationship_type: "references", description: "POPIA automated decision provisions modeled on GDPR", strength: "moderate" },
  { source_title: "Nigeria Data Protection Act 2023 — AI Provisions", target_title: "EU General Data Protection Regulation (GDPR) — AI Provisions", relationship_type: "references", description: "AI provisions in data protection law inspired by GDPR", strength: "weak" },
  { source_title: "Saudi Arabia Personal Data Protection Law (PDPL)", target_title: "EU General Data Protection Regulation (GDPR) — AI Provisions", relationship_type: "references", description: "PDPL data protection modeled on GDPR", strength: "weak" },

  // Cross-regional
  { source_title: "OECD Principles on Artificial Intelligence", target_title: "NIST AI Risk Management Framework (AI RMF 1.0)", relationship_type: "references", description: "NIST AI RMF implements OECD principles in US context", strength: "moderate" },
  { source_title: "Canada Artificial Intelligence and Data Act (AIDA, Bill C-27)", target_title: "EU Artificial Intelligence Act (Regulation 2024/1689)", relationship_type: "references", description: "AIDA risk classification draws from EU AI Act categories", strength: "moderate" },
  { source_title: "UK Pro-Innovation AI Regulation — Sectoral Approach and Forthcoming AI Bill", target_title: "EU Artificial Intelligence Act (Regulation 2024/1689)", relationship_type: "references", description: "UK diverges from EU approach but references it as baseline", strength: "weak" },
  { source_title: "G7 Hiroshima AI Process International Code of Conduct", target_title: "OECD Principles on Artificial Intelligence", relationship_type: "references", description: "G7 code of conduct builds on OECD AI principles", strength: "strong" },
  { source_title: "UNESCO Recommendation on the Ethics of Artificial Intelligence", target_title: "OECD Principles on Artificial Intelligence", relationship_type: "supplements", description: "UNESCO recommendation extends OECD principles with human rights focus", strength: "moderate" },
  { source_title: "Council of Europe Framework Convention on AI, Human Rights, Democracy and Rule of Law", target_title: "EU Artificial Intelligence Act (Regulation 2024/1689)", relationship_type: "supplements", description: "Council of Europe treaty adds human rights layer to AI governance", strength: "moderate" },
  { source_title: "ISO/IEC 42001:2023 — AI Management System Standard", target_title: "NIST AI Risk Management Framework (AI RMF 1.0)", relationship_type: "references", description: "ISO AI management standard aligns with NIST framework", strength: "moderate" },
  { source_title: "ISO/IEC 23894:2023 — AI Risk Management", target_title: "ISO/IEC 42001:2023 — AI Management System Standard", relationship_type: "supplements", description: "Risk management standard supplements AI management system", strength: "strong" },
  { source_title: "WHO Guidance on Ethics and Governance of AI for Health", target_title: "OECD Principles on Artificial Intelligence", relationship_type: "references", description: "WHO AI health guidance built on OECD ethical principles", strength: "moderate" },
];
