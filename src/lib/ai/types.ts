export interface ClassifiedRegulation {
  title: string;
  jurisdiction: string;
  jurisdiction_display: string;
  status: "enacted" | "proposed" | "in_effect" | "under_review" | "repealed";
  category:
    | "legislation"
    | "executive_order"
    | "framework"
    | "guidance"
    | "standard";
  summary: string;
  key_requirements: string[];
  compliance_implications: string[];
  effective_date: string | null;
  source_url: string;
  source_name: string;
  confidence: number;
  needs_human_review: boolean;
  supporting_evidence: string;
}

// Discovery pipeline types
export interface Pass1Result {
  classification: "new_regulation" | "update_to_existing" | "enforcement_action" | "guidance_update" | "noise";
  confidence: number;
  matched_existing_title: string | null;
  reasoning: string;
}

export interface Pass2Result {
  verification: "agree" | "disagree" | "uncertain";
  confidence: number;
  reasoning: string;
  draft: {
    title: string | null;
    jurisdiction: string | null;
    jurisdiction_display: string | null;
    status: string | null;
    category: string | null;
    summary: string | null;
    key_requirements: string[];
    compliance_implications: string[];
    effective_date: string | null;
    source_url: string;
    source_name: string | null;
  };
}

export interface ExtractedUpdate {
  regulation_title: string;
  update_type:
    | "new_regulation"
    | "amendment"
    | "status_change"
    | "enforcement_action"
    | "guidance_update";
  title: string;
  summary: string;
  source_url: string;
  confidence: number;
  needs_human_review: boolean;
}
