"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Check,
  X,
  ChevronDown,
  ExternalLink,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface PendingItem {
  id: string;
  title: string;
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
  pass1_classification: string;
  pass1_confidence: number;
  pass2_classification: string | null;
  pass2_confidence: number | null;
  review_status: string;
  feed_source: string | null;
  raw_title: string;
  raw_snippet: string | null;
  detected_at: string;
}

interface PendingReviewClientProps {
  items: PendingItem[];
}

export function PendingReviewClient({ items }: PendingReviewClientProps) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleAction(id: string, action: "approve" | "dismiss") {
    setLoadingId(id);
    try {
      await fetch("/api/pending", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          action,
          dismiss_reason: action === "dismiss" ? "Not relevant" : undefined,
        }),
      });
      router.refresh();
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8 space-y-4">
      <div>
        <h1 className="text-sm font-mono font-bold uppercase tracking-[0.1em] text-[var(--text-bright)]">
          Pending Regulations
        </h1>
        <p className="text-xs text-[var(--text-tertiary)] mt-1">
          {items.length} item{items.length !== 1 ? "s" : ""} detected by the discovery pipeline awaiting review
        </p>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Check className="h-10 w-10 text-emerald-500/30 mb-3" />
          <p className="text-sm text-[var(--text-secondary)]">No pending regulations to review</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">New items will appear here when the daily ingestion pipeline detects them.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const isExpanded = expandedId === item.id;
            const isLoading = loadingId === item.id;
            const isUncertain = item.review_status === "uncertain";

            return (
              <div
                key={item.id}
                className={cn(
                  "rounded-lg border border-[var(--border-subtle)] bg-card transition-all duration-200",
                  isUncertain && "border-l-2 border-l-amber-500"
                )}
              >
                {/* Header row */}
                <div
                  className="flex items-start gap-3 p-4 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-medium text-[var(--text-primary)]">{item.title}</span>
                      {isUncertain && (
                        <Badge variant="outline" className="text-amber-400 border-amber-500/30 bg-amber-500/10">
                          <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                          Uncertain
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-tertiary)]">
                      {item.jurisdiction_display && (
                        <Badge variant="outline" className="text-[10px]">{item.jurisdiction_display}</Badge>
                      )}
                      {item.status && (
                        <Badge variant="outline" className="text-[10px]">{item.status}</Badge>
                      )}
                      {item.category && (
                        <Badge variant="outline" className="text-[10px]">{item.category}</Badge>
                      )}
                      <span className="font-mono tabular-nums">
                        P1: {Math.round(item.pass1_confidence * 100)}%
                        {item.pass2_confidence != null && ` · P2: ${Math.round(item.pass2_confidence * 100)}%`}
                      </span>
                      <span>· {format(new Date(item.detected_at), "MMM d, yyyy")}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isLoading}
                      onClick={(e) => { e.stopPropagation(); handleAction(item.id, "approve"); }}
                      className="h-8 text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                    >
                      {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isLoading}
                      onClick={(e) => { e.stopPropagation(); handleAction(item.id, "dismiss"); }}
                      className="h-8 text-xs text-red-400 border-red-500/30 hover:bg-red-500/10"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Dismiss
                    </Button>
                    <ChevronDown className={cn("h-4 w-4 text-[var(--text-tertiary)] transition-transform", isExpanded && "rotate-180")} />
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-[var(--border-dim)] px-4 py-3 space-y-3 text-xs">
                    {item.summary && (
                      <div>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">Summary</span>
                        <p className="mt-1 text-[var(--text-secondary)] leading-relaxed">{item.summary}</p>
                      </div>
                    )}
                    {item.key_requirements && item.key_requirements.length > 0 && (
                      <div>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">Key Requirements</span>
                        <ul className="mt-1 space-y-0.5">
                          {item.key_requirements.map((r, i) => (
                            <li key={i} className="text-[var(--text-secondary)] flex gap-1.5">
                              <span className="text-primary shrink-0">•</span>{r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {item.raw_snippet && (
                      <div>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">Raw RSS Content</span>
                        <p className="mt-1 text-[var(--text-tertiary)] leading-relaxed italic">{item.raw_snippet.slice(0, 500)}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-3 pt-1">
                      <a
                        href={item.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Source
                      </a>
                      {item.feed_source && (
                        <span className="text-[var(--text-tertiary)]">via {item.feed_source}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
