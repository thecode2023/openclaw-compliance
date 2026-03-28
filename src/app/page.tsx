import Link from "next/link";
import { Shield, ArrowRight, Globe, Activity, FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { createAdminClient } from "@/lib/supabase/admin";
import { UpdateTimeline } from "@/components/feed/UpdateTimeline";
import type { RegulatoryUpdate } from "@/lib/types/regulation";

export const dynamic = "force-dynamic";

async function getStats() {
  const supabase = createAdminClient();

  const [regulationsRes, jurisdictionsRes, latestVerifiedRes] =
    await Promise.all([
      supabase
        .from("regulations")
        .select("*", { count: "exact", head: true }),
      supabase.from("regulations").select("jurisdiction"),
      supabase
        .from("regulations")
        .select("last_verified_at")
        .order("last_verified_at", { ascending: false })
        .limit(1)
        .single(),
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
  };
}

async function getRecentUpdates() {
  const supabase = createAdminClient();

  // Only show verified/curated updates on the landing page — not raw ingestion artifacts
  const { data } = await supabase
    .from("regulatory_updates")
    .select("*")
    .eq("verified", true)
    .order("detected_at", { ascending: false })
    .limit(5);

  return (data || []) as RegulatoryUpdate[];
}

export default async function HomePage() {
  const [stats, recentUpdates] = await Promise.all([
    getStats(),
    getRecentUpdates(),
  ]);

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-8 w-8 text-primary" />
            <Badge variant="outline" className="text-xs">
              Open Source
            </Badge>
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            AI Regulatory Intelligence Platform
          </h1>
          <p className="mt-4 text-lg text-muted-foreground leading-relaxed max-w-2xl">
            Track global AI regulations in real time and audit your AI agent
            configurations against live regulatory data. No hallucinated
            advice — every finding is grounded in real, timestamped regulations.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/feed">
                Browse Regulatory Feed
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/audit">
                Audit Your Agent Config
                <FileSearch className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <Separator />

      {/* Stats + Recent Updates */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-10">
          {/* Stats */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-6">
              Live Coverage
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Activity className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-3xl font-bold">
                        {stats.regulationCount}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Regulations Tracked
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-3xl font-bold">
                        {stats.jurisdictionCount}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Jurisdictions
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-3xl font-bold">Free</p>
                      <p className="text-sm text-muted-foreground">
                        Open Source
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Recent Updates */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Recent Updates
              </h2>
              <Link
                href="/feed"
                className="text-xs text-primary hover:underline"
              >
                View all
              </Link>
            </div>
            {recentUpdates.length > 0 ? (
              <UpdateTimeline updates={recentUpdates} />
            ) : (
              <p className="text-sm text-muted-foreground">
                No regulatory updates yet. Seed the database to get started.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border mt-auto">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <p className="text-xs text-muted-foreground text-center">
            {stats.lastVerified
              ? `Regulatory data last verified: ${new Date(stats.lastVerified).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}. `
              : ""}
            Built with Claude Code · Powered by Gemini · Data stored in
            Supabase
          </p>
        </div>
      </footer>
    </div>
  );
}
