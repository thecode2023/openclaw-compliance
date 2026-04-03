import Link from "next/link";
import {
  Shield,
  ArrowRight,
  FileSearch,
  ChevronDown,
  MessageCircle,
  FileText,
  Network,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";
import { UpdateTimeline } from "@/components/feed/UpdateTimeline";
import type { RegulatoryUpdate } from "@/lib/types/regulation";

export const dynamic = "force-dynamic";

async function getStats() {
  const supabase = createAdminClient();

  const [regulationsRes, jurisdictionsRes, latestVerifiedRes, auditCountRes] =
    await Promise.all([
      supabase.from("regulations").select("*", { count: "exact", head: true }),
      supabase.from("regulations").select("jurisdiction"),
      supabase
        .from("regulations")
        .select("last_verified_at")
        .order("last_verified_at", { ascending: false })
        .limit(1)
        .single(),
      supabase.from("audit_reports").select("*", { count: "exact", head: true }),
    ]);

  const uniqueJurisdictions = new Set(
    (jurisdictionsRes.data || []).map(
      (r: { jurisdiction: string }) => r.jurisdiction
    )
  );

  return {
    regulationCount: regulationsRes.count || 0,
    jurisdictionCount: uniqueJurisdictions.size,
    lastVerified: latestVerifiedRes.data?.last_verified_at || null,
    auditCount: auditCountRes.count || 0,
  };
}

async function getRecentUpdates() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("regulatory_updates")
    .select("*")
    .eq("verified", true)
    .in("update_type", ["status_change", "amendment", "enforcement_action"])
    .order("detected_at", { ascending: false })
    .limit(5);
  return (data || []) as RegulatoryUpdate[];
}

const FEATURES = [
  {
    icon: MessageCircle,
    title: "AI Compliance Assistant",
    description:
      "Ask questions about any AI regulation. Get instant, cited answers grounded in live regulatory data — zero hallucinations.",
    href: "/feed",
    color: "text-indigo-400",
  },
  {
    icon: FileSearch,
    title: "Configuration Auditor",
    description:
      "Paste your AI agent config and get a grounded compliance audit across all applicable jurisdictions with remediation guidance.",
    href: "/audit",
    color: "text-emerald-400",
  },
  {
    icon: FileText,
    title: "Policy Generator",
    description:
      "Generate tailored compliance policies from regulatory requirements. Split-pane editor with live preview and PDF export.",
    href: "/policies",
    color: "text-amber-400",
  },
  {
    icon: Network,
    title: "Dependency Graph",
    description:
      "Visualize how AI regulations trigger, require, or conflict with each other across jurisdictions. Interactive D3 force graph.",
    href: "/graph",
    color: "text-cyan-400",
  },
];

export default async function HomePage() {
  const [stats, recentUpdates] = await Promise.all([
    getStats(),
    getRecentUpdates(),
  ]);

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative min-h-[85vh] flex items-center overflow-hidden">
        <div className="animated-gradient absolute inset-0" />
        <div className="grid-bg absolute inset-0" />
        <div className="noise-overlay absolute inset-0" />

        <div className="relative z-10 mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 w-full">
          <div className="max-w-3xl stagger-in">
            <div className="flex items-center gap-3 mb-6">
              <Shield className="h-8 w-8 text-primary" />
              <span className="font-mono text-xs uppercase tracking-[0.15em] text-[var(--text-tertiary)] border border-[var(--border-subtle)] rounded px-2 py-0.5">
                Open Source
              </span>
            </div>

            <h1 className="font-mono text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-[var(--text-bright)] glow-text leading-[1.1]">
              Complyze
            </h1>
            <p className="mt-3 text-xl sm:text-2xl font-sans font-normal text-[var(--text-secondary)] leading-relaxed max-w-2xl">
              AI Regulatory Intelligence Platform
            </p>
            <p className="mt-4 text-base font-sans text-[var(--text-tertiary)] leading-relaxed max-w-xl">
              Track global AI regulations, audit agent configurations, generate
              compliance policies, and visualize regulatory dependencies — all
              grounded in real, timestamped data.
            </p>

            {/* Stats */}
            <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-sm text-[var(--text-tertiary)]">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 pulse-live" />
                <span className="text-[var(--text-primary)] font-semibold tabular-nums">
                  {stats.regulationCount}
                </span>{" "}
                Regulations
              </span>
              <span className="text-[var(--border-subtle)]">&middot;</span>
              <span>
                <span className="text-[var(--text-primary)] font-semibold tabular-nums">
                  {stats.jurisdictionCount}
                </span>{" "}
                Jurisdictions
              </span>
              <span className="text-[var(--border-subtle)]">&middot;</span>
              <span>
                <span className="text-[var(--text-primary)] font-semibold tabular-nums">
                  {stats.auditCount}
                </span>{" "}
                Audits Run
              </span>
            </div>

            <div className="mt-10 flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="font-mono text-xs uppercase tracking-wider"
              >
                <Link href="/feed">
                  Browse Regulatory Feed
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="font-mono text-xs uppercase tracking-wider"
              >
                <Link href="/audit">
                  Audit Agent Config
                  <FileSearch className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
          <ChevronDown className="h-5 w-5 text-[var(--text-tertiary)] bounce-down" />
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 w-full">
        <div className="text-center mb-12 stagger-in stagger-delay-1">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-primary" />
            <span className="font-mono text-xs uppercase tracking-[0.15em] text-[var(--text-tertiary)]">
              Platform Capabilities
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[var(--text-bright)]">
            Everything you need for AI compliance
          </h2>
          <p className="mt-2 text-sm text-[var(--text-tertiary)] max-w-lg mx-auto">
            From regulatory tracking to policy generation — a complete
            intelligence suite for compliance professionals.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((feature, i) => (
            <Link
              key={feature.title}
              href={feature.href}
              className={`group relative p-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] hover:border-primary/40 hover:bg-[var(--bg-tertiary)] transition-all duration-200 stagger-in stagger-delay-${i + 1}`}
            >
              <feature.icon
                className={`h-6 w-6 ${feature.color} mb-3 group-hover:scale-110 transition-transform`}
              />
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1.5">
                {feature.title}
              </h3>
              <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
                {feature.description}
              </p>
              <ArrowRight className="absolute top-5 right-5 h-3.5 w-3.5 text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          ))}
        </div>
      </section>

      {/* Recent Updates */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 w-full border-t border-[var(--border-dim)]">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 pulse-live" />
            <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.15em] text-[var(--text-tertiary)]">
              Live Regulatory Feed
            </h2>
          </div>
          <Link
            href="/feed"
            className="font-mono text-xs text-primary hover:underline underline-offset-4"
          >
            View All &rarr;
          </Link>
        </div>

        {recentUpdates.length > 0 ? (
          <div className="max-w-2xl">
            <UpdateTimeline updates={recentUpdates} />
          </div>
        ) : (
          <p className="text-sm text-[var(--text-tertiary)] font-sans">
            No regulatory updates yet. Check back after the next ingestion run.
          </p>
        )}
      </section>

      {/* Footer stats */}
      <footer className="border-t border-[var(--border-dim)] mt-auto">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <p className="font-mono text-[10px] text-[var(--text-tertiary)] text-center tracking-wider uppercase">
            {stats.lastVerified
              ? `Data verified: ${new Date(stats.lastVerified).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} · `
              : ""}
            Built with Claude Code &middot; Powered by Gemini &middot; Data stored in
            Supabase
          </p>
        </div>
      </footer>
    </div>
  );
}
