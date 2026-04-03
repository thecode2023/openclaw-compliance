export interface RelationshipSeed {
  source_title: string;
  target_title: string;
  relationship_type: "triggers" | "requires" | "conflicts_with" | "supplements" | "supersedes" | "references";
  description: string;
  strength: "strong" | "moderate" | "weak";
}

export const REGULATION_RELATIONSHIPS: RelationshipSeed[] = [
  // EU AI Act connections
  { source_title: "EU AI Act", target_title: "GDPR", relationship_type: "triggers", description: "AI systems processing personal data must comply with GDPR", strength: "strong" },
  { source_title: "EU AI Act", target_title: "NIST AI Risk Management Framework", relationship_type: "references", description: "International standards alignment for risk management", strength: "moderate" },
  { source_title: "EU AI Act", target_title: "OECD AI Principles", relationship_type: "references", description: "Based on OECD principles for trustworthy AI", strength: "moderate" },
  { source_title: "GDPR", target_title: "EU AI Act", relationship_type: "supplements", description: "Automated decision-making rights under Article 22 supplement AI Act", strength: "strong" },
  { source_title: "Digital Operational Resilience Act (DORA)", target_title: "EU AI Act", relationship_type: "supplements", description: "Financial services AI must meet DORA ICT resilience requirements", strength: "strong" },
  { source_title: "Digital Services Act (DSA)", target_title: "EU AI Act", relationship_type: "supplements", description: "Algorithmic transparency requirements for platforms", strength: "moderate" },
  { source_title: "Digital Markets Act (DMA)", target_title: "EU AI Act", relationship_type: "supplements", description: "AI in gatekeeper platform obligations", strength: "moderate" },
  { source_title: "EU AI Liability Directive", target_title: "EU AI Act", relationship_type: "supplements", description: "Establishes burden of proof for AI-caused harm", strength: "strong" },
  { source_title: "EU Product Liability Directive (Revised)", target_title: "EU AI Act", relationship_type: "requires", description: "AI systems as products require CE marking and liability compliance", strength: "strong" },

  // US framework connections
  { source_title: "California AI Transparency Act (SB 942)", target_title: "NIST AI Risk Management Framework", relationship_type: "references", description: "References NIST AI RMF for transparency standards", strength: "moderate" },
  { source_title: "Colorado AI Act (SB 205)", target_title: "NIST AI Risk Management Framework", relationship_type: "references", description: "Explicitly requires NIST AI RMF conformance", strength: "strong" },
  { source_title: "Texas Responsible AI Governance Act (TRAIGA)", target_title: "Colorado AI Act (SB 205)", relationship_type: "conflicts_with", description: "Different compliance thresholds and approaches", strength: "moderate" },
  { source_title: "NIST AI 600-1 (GenAI Profile)", target_title: "NIST AI Risk Management Framework", relationship_type: "supplements", description: "Extends AI RMF with GenAI-specific risk guidance", strength: "strong" },
  { source_title: "NYC Local Law 144", target_title: "Illinois AI Video Interview Act", relationship_type: "references", description: "Both address AI in employment decisions", strength: "weak" },
  { source_title: "CCPA/CPRA Automated Decision-Making", target_title: "GDPR", relationship_type: "references", description: "Modeled on GDPR automated decision-making rights", strength: "moderate" },
  { source_title: "FTC AI Enforcement Policy", target_title: "NIST AI Risk Management Framework", relationship_type: "references", description: "FTC references NIST standards in enforcement guidance", strength: "weak" },

  // Healthcare/Finance intersections
  { source_title: "HIPAA AI Guidance", target_title: "FDA AI/ML Software Framework", relationship_type: "triggers", description: "AI in healthcare intersects both HIPAA privacy and FDA device regulation", strength: "strong" },
  { source_title: "SEC AI Guidance (Reg S-P)", target_title: "Digital Operational Resilience Act (DORA)", relationship_type: "references", description: "Both address AI in financial services", strength: "weak" },

  // Asia-Pacific connections
  { source_title: "Singapore Model AI Governance Framework", target_title: "OECD AI Principles", relationship_type: "references", description: "Aligned with OECD AI principles", strength: "moderate" },
  { source_title: "Singapore Agentic AI Framework", target_title: "Singapore Model AI Governance Framework", relationship_type: "supplements", description: "Extends governance to agentic AI systems", strength: "strong" },
  { source_title: "China Interim Measures for GenAI", target_title: "China Algorithm Recommendation Regulations", relationship_type: "supplements", description: "GenAI measures build on existing algorithm regulations", strength: "strong" },
  { source_title: "South Korea AI Basic Act", target_title: "EU AI Act", relationship_type: "references", description: "Risk-based approach modeled on EU framework", strength: "moderate" },
  { source_title: "Japan AI Strategy and Guidelines", target_title: "OECD AI Principles", relationship_type: "references", description: "Based on OECD principles, voluntary approach", strength: "moderate" },
  { source_title: "Indonesia UU PDP", target_title: "GDPR", relationship_type: "references", description: "Data transfer requirements modeled on GDPR adequacy", strength: "moderate" },
  { source_title: "India Digital Personal Data Protection Act", target_title: "GDPR", relationship_type: "references", description: "Data protection framework inspired by GDPR", strength: "moderate" },
  { source_title: "Thailand PDPA", target_title: "GDPR", relationship_type: "references", description: "PDPA closely modeled on GDPR provisions", strength: "moderate" },

  // Latin America
  { source_title: "Brazil AI Bill (PL 2338)", target_title: "EU AI Act", relationship_type: "references", description: "Risk-based classification modeled on EU approach", strength: "strong" },
  { source_title: "Brazil AI Bill (PL 2338)", target_title: "OECD AI Principles", relationship_type: "references", description: "Incorporates OECD AI principles", strength: "moderate" },

  // Middle East & Africa
  { source_title: "UAE AI Governance Principles", target_title: "OECD AI Principles", relationship_type: "references", description: "Aligned with international AI governance standards", strength: "moderate" },
  { source_title: "Saudi Arabia NDMO AI Regulations", target_title: "NIST AI Risk Management Framework", relationship_type: "references", description: "References NIST framework for risk management", strength: "weak" },
  { source_title: "South Africa POPIA", target_title: "GDPR", relationship_type: "references", description: "POPIA automated decision provisions modeled on GDPR", strength: "moderate" },
  { source_title: "Nigeria Data Protection Act", target_title: "GDPR", relationship_type: "references", description: "AI provisions in data protection law inspired by GDPR", strength: "weak" },

  // Cross-regional
  { source_title: "OECD AI Principles", target_title: "NIST AI Risk Management Framework", relationship_type: "references", description: "NIST AI RMF implements OECD principles in US context", strength: "moderate" },
  { source_title: "EU AI Act", target_title: "Brazil AI Bill (PL 2338)", relationship_type: "references", description: "EU Act influenced Brazil's regulatory approach", strength: "moderate" },
  { source_title: "Canada AIDA", target_title: "EU AI Act", relationship_type: "references", description: "AIDA risk classification draws from EU AI Act categories", strength: "moderate" },
  { source_title: "UK AI Regulation Policy", target_title: "EU AI Act", relationship_type: "references", description: "UK diverges from EU approach but references it as baseline", strength: "weak" },

  // US state interconnections
  { source_title: "Connecticut AI Act (SB 2)", target_title: "Colorado AI Act (SB 205)", relationship_type: "references", description: "Similar high-risk AI requirements across states", strength: "moderate" },
  { source_title: "Utah AI Policy Act", target_title: "FTC AI Enforcement Policy", relationship_type: "references", description: "State disclosure requirements complement federal enforcement", strength: "weak" },
  { source_title: "Maryland AI in Hiring Act", target_title: "NYC Local Law 144", relationship_type: "references", description: "Both regulate AI in employment hiring decisions", strength: "moderate" },
];
