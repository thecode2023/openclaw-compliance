export type PolicyStatus = "draft" | "review" | "approved" | "archived";

export interface PolicyDocument {
  id: string;
  user_id: string;
  title: string;
  regulation_id: string | null;
  industry: string | null;
  jurisdictions: string[];
  content_markdown: string;
  version: number;
  status: PolicyStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface GeneratePolicyRequest {
  regulation_ids: string[];
  policy_type: string;
  industry: string;
  organization_details?: string;
}

export const POLICY_TYPE_OPTIONS = [
  { value: "acceptable_use", label: "Acceptable Use Policy" },
  { value: "data_governance", label: "Data Governance Policy" },
  { value: "ai_risk_management", label: "AI Risk Management Policy" },
  { value: "human_oversight", label: "Human Oversight Policy" },
  { value: "transparency_disclosure", label: "Transparency & Disclosure Policy" },
  { value: "incident_response", label: "Incident Response Policy" },
  { value: "vendor_third_party", label: "Vendor/Third-Party AI Policy" },
  { value: "model_governance", label: "Model Governance Policy" },
] as const;

export const STATUS_OPTIONS: { value: PolicyStatus; label: string; color: string }[] = [
  { value: "draft", label: "Draft", color: "bg-muted text-muted-foreground" },
  { value: "review", label: "In Review", color: "bg-amber-500/15 text-amber-400" },
  { value: "approved", label: "Approved", color: "bg-green-500/15 text-green-400" },
  { value: "archived", label: "Archived", color: "bg-gray-500/15 text-gray-400" },
];
