export type JurisdictionPriority = "active" | "monitoring" | "expansion";

export interface UserProfile {
  id: string;
  display_name: string | null;
  organization: string | null;
  industry: Industry | null;
  jurisdictions: string[];
  ai_use_cases: string[];
  notification_prefs: NotificationPrefs;
  jurisdiction_priorities: Record<string, JurisdictionPriority>;
  onboarded: boolean;
  created_at: string;
  updated_at: string;
}

export type Industry =
  | "financial_services"
  | "healthcare"
  | "technology"
  | "retail"
  | "manufacturing"
  | "government"
  | "education"
  | "legal"
  | "insurance"
  | "media"
  | "other";

export interface NotificationPrefs {
  email_alerts: boolean;
  dashboard_alerts: boolean;
}

export const INDUSTRY_OPTIONS: { value: Industry; label: string }[] = [
  { value: "financial_services", label: "Financial Services" },
  { value: "healthcare", label: "Healthcare" },
  { value: "technology", label: "Technology" },
  { value: "retail", label: "Retail & E-Commerce" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "government", label: "Government" },
  { value: "education", label: "Education" },
  { value: "legal", label: "Legal" },
  { value: "insurance", label: "Insurance" },
  { value: "media", label: "Media & Entertainment" },
  { value: "other", label: "Other" },
];

export interface JurisdictionOption {
  code: string;
  name: string;
  flag: string;
  region: "Europe" | "North America" | "Latin America" | "Asia-Pacific" | "International";
}

export const JURISDICTION_OPTIONS: JurisdictionOption[] = [
  // Europe
  { code: "EU", name: "European Union", flag: "🇪🇺", region: "Europe" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", region: "Europe" },

  // North America
  { code: "US", name: "United States (Federal)", flag: "🇺🇸", region: "North America" },
  { code: "US-TX", name: "Texas", flag: "🇺🇸", region: "North America" },
  { code: "US-CO", name: "Colorado", flag: "🇺🇸", region: "North America" },
  { code: "US-IL", name: "Illinois", flag: "🇺🇸", region: "North America" },
  { code: "US-CA", name: "California", flag: "🇺🇸", region: "North America" },
  { code: "CA", name: "Canada", flag: "🇨🇦", region: "North America" },

  // Latin America
  { code: "BR", name: "Brazil", flag: "🇧🇷", region: "Latin America" },

  // Asia-Pacific
  { code: "SG", name: "Singapore", flag: "🇸🇬", region: "Asia-Pacific" },
  { code: "ID", name: "Indonesia", flag: "🇮🇩", region: "Asia-Pacific" },

  // International
  { code: "INTL", name: "International (OECD)", flag: "🌐", region: "International" },
];

export interface AiUseCaseOption {
  value: string;
  label: string;
  description: string;
  icon: string;
}

export const AI_USE_CASE_OPTIONS: AiUseCaseOption[] = [
  {
    value: "chatbot",
    label: "Chatbot / Virtual Assistant",
    description: "Customer-facing conversational AI",
    icon: "💬",
  },
  {
    value: "content_generation",
    label: "Content Generation",
    description: "AI-generated text, images, or media",
    icon: "✍️",
  },
  {
    value: "automated_decisions",
    label: "Automated Decision-Making",
    description: "AI systems making consequential decisions",
    icon: "⚖️",
  },
  {
    value: "data_analysis",
    label: "Data Analysis / Processing",
    description: "AI-powered analytics and data processing",
    icon: "📊",
  },
  {
    value: "hiring_screening",
    label: "Hiring / HR Screening",
    description: "Resume screening, interview analysis",
    icon: "👥",
  },
  {
    value: "customer_profiling",
    label: "Customer Profiling",
    description: "Behavioral analysis and segmentation",
    icon: "🎯",
  },
  {
    value: "autonomous_agents",
    label: "Autonomous Agents",
    description: "Multi-step autonomous AI systems",
    icon: "🤖",
  },
];
