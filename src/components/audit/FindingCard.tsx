"use client";

import {
  AlertTriangle,
  AlertCircle,
  Info,
  ShieldAlert,
  ExternalLink,
  ChevronDown,
  MessageCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useTriggerChat } from "@/components/chat/ChatContext";
import type { AuditFinding } from "@/lib/types/audit";

const severityConfig: Record<
  string,
  {
    icon: typeof AlertTriangle;
    color: string;
    badgeClass: string;
  }
> = {
  critical: {
    icon: ShieldAlert,
    color: "text-red-400",
    badgeClass: "bg-red-500/15 text-red-400 border-red-500/30",
  },
  high: {
    icon: AlertTriangle,
    color: "text-orange-400",
    badgeClass: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  },
  medium: {
    icon: AlertCircle,
    color: "text-yellow-400",
    badgeClass: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  },
  low: {
    icon: Info,
    color: "text-blue-400",
    badgeClass: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  },
  info: {
    icon: Info,
    color: "text-muted-foreground",
    badgeClass: "bg-muted text-muted-foreground border-border",
  },
};

interface FindingCardProps {
  finding: AuditFinding;
  isExpanded: boolean;
  onToggle: () => void;
}

export function FindingCard({
  finding,
  isExpanded,
  onToggle,
}: FindingCardProps) {
  const config = severityConfig[finding.severity] || severityConfig.info;
  const Icon = config.icon;
  const triggerChat = useTriggerChat();

  return (
    <Card
      className="cursor-pointer transition-colors hover:border-border/80"
      onClick={onToggle}
    >
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start gap-3">
          <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${config.color}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge variant="outline" className={`text-[10px] ${config.badgeClass}`}>
                {finding.severity.toUpperCase()}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {finding.jurisdiction}
              </Badge>
            </div>
            <p className="text-sm font-medium leading-snug">{finding.title}</p>

            {isExpanded && (
              <div className="mt-3 space-y-3 text-xs">
                <div>
                  <p className="font-semibold text-muted-foreground mb-1">
                    Description
                  </p>
                  <p className="text-foreground leading-relaxed">
                    {finding.description}
                  </p>
                </div>

                <div>
                  <p className="font-semibold text-muted-foreground mb-1">
                    Regulation
                  </p>
                  <p className="text-foreground">{finding.regulation_title}</p>
                </div>

                <div>
                  <p className="font-semibold text-muted-foreground mb-1">
                    Requirement Violated
                  </p>
                  <p className="text-foreground italic">
                    &quot;{finding.requirement}&quot;
                  </p>
                </div>

                <div>
                  <p className="font-semibold text-muted-foreground mb-1">
                    Config Reference
                  </p>
                  <code className="text-primary bg-muted px-1.5 py-0.5 rounded text-[11px]">
                    {finding.config_reference}
                  </code>
                </div>

                <div>
                  <p className="font-semibold text-muted-foreground mb-1">
                    Remediation
                  </p>
                  <p className="text-foreground leading-relaxed">
                    {finding.remediation}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {finding.source_url && (
                    <a
                      href={finding.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-3 w-3" />
                      View Source
                    </a>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerChat(
                        `Explain this audit finding and how to fix it: "${finding.title}" — ${finding.description} (Regulation: ${finding.regulation_title})`
                      );
                    }}
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <MessageCircle className="h-3 w-3" />
                    Explain this
                  </button>
                </div>
              </div>
            )}
          </div>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </CardContent>
    </Card>
  );
}
