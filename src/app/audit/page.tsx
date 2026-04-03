"use client";

import { useState, useEffect, useRef } from "react";
import yaml from "js-yaml";
import { ConfigInput } from "@/components/audit/ConfigInput";
import { AuditReportDisplay } from "@/components/audit/AuditReport";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import type { AuditReport } from "@/lib/types/audit";
import { exampleConfigs } from "@/lib/utils/example-config";
import { useSetChatContext } from "@/components/chat/ChatContext";

function parseConfig(input: string): string {
  try {
    JSON.parse(input);
    return input;
  } catch {
    // Not JSON — try YAML
  }
  try {
    const parsed = yaml.load(input);
    if (typeof parsed === "object" && parsed !== null) {
      return JSON.stringify(parsed, null, 2);
    }
  } catch {
    // Not YAML either
  }
  throw new Error("Invalid configuration. Please paste valid JSON or YAML.");
}

/* ------------------------------------------------------------------ */
/* Progress bar component                                              */
/* ------------------------------------------------------------------ */

const STATUS_MESSAGES = [
  "Parsing agent configuration...",
  "Identifying applicable jurisdictions...",
  "Checking against 42+ regulations...",
  "Analyzing compliance gaps...",
  "Generating findings and recommendations...",
  "Calculating cost exposure...",
];

function AuditProgress({ done }: { done: boolean }) {
  const [progress, setProgress] = useState(0);
  const [msgIndex, setMsgIndex] = useState(0);
  const startTime = useRef(Date.now());

  // Progress bar: fill to 95% over 15s, then hold
  useEffect(() => {
    if (done) {
      setProgress(100);
      return;
    }

    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime.current) / 1000;
      // Ease-out curve: fast start, slows toward 95%
      const target = Math.min(95, 95 * (1 - Math.exp(-elapsed / 5)));
      setProgress(target);
    }, 100);

    return () => clearInterval(interval);
  }, [done]);

  // Rotate status messages every 3s
  useEffect(() => {
    if (done) return;
    const interval = setInterval(() => {
      setMsgIndex((i) => (i + 1) % STATUS_MESSAGES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [done]);

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 w-full">
      {/* Progress bar */}
      <div className="w-full max-w-sm mb-6">
        <div className="h-1.5 w-full rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300 ease-out"
            style={{
              width: `${progress}%`,
              background: "linear-gradient(90deg, #3b82f6, #1d4ed8)",
              boxShadow: "0 0 12px rgba(59, 130, 246, 0.4)",
            }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px] font-mono text-[var(--text-tertiary)] tabular-nums">
            {Math.round(progress)}%
          </span>
          <span className="text-[10px] font-mono text-[var(--text-tertiary)]">
            ~15s
          </span>
        </div>
      </div>

      {/* Rotating status message */}
      <p
        key={msgIndex}
        className="text-sm font-mono text-[var(--text-primary)] animate-in fade-in duration-300"
      >
        {done ? "Complete." : STATUS_MESSAGES[msgIndex]}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const MAX_SIZE_BYTES = 50 * 1024;

export default function AuditPage() {
  // Pre-load Customer Support Agent example config
  const [config, setConfig] = useState(() => {
    const customerSupport = exampleConfigs.find((c) => c.id === "customer-support");
    return customerSupport ? JSON.stringify(customerSupport.config, null, 2) : "";
  });
  const [report, setReport] = useState<AuditReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auditDone, setAuditDone] = useState(false);
  useSetChatContext({ page: report ? "audit-results" : "audit" });
  const [cooldown, setCooldown] = useState(false);

  const runAudit = async () => {
    setError(null);
    setReport(null);
    setAuditDone(false);

    // Client-side size check
    if (new TextEncoder().encode(config).length > MAX_SIZE_BYTES) {
      setError("Config exceeds 50 KB limit.");
      return;
    }

    let parsedConfig: string;
    try {
      parsedConfig = parseConfig(config);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid configuration.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: parsedConfig }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Audit failed. Please try again.");
        return;
      }

      // Signal progress bar to jump to 100%
      setAuditDone(true);
      // Brief pause so user sees 100% before results render
      await new Promise((r) => setTimeout(r, 400));
      setReport(data as AuditReport);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
      // 5-second cooldown after submission
      setCooldown(true);
      setTimeout(() => setCooldown(false), 5000);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-sm sm:text-base font-mono font-bold uppercase tracking-[0.1em] text-[var(--text-bright)]">
          AI Agent Configuration Auditor
        </h1>
        <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
          Paste an AI agent configuration (JSON or YAML) to audit it against
          live regulatory data. Every finding is grounded in real regulations
          — zero hallucinated citations.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Left: Config Input */}
        <div>
          <ConfigInput
            value={config}
            onChange={setConfig}
            onSubmit={runAudit}
            isLoading={isLoading}
            cooldown={cooldown}
          />
        </div>

        {/* Right: Results */}
        <div>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isLoading && <AuditProgress done={auditDone} />}

          {!isLoading && !report && !error && (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <p className="text-sm">
                Paste a config and click &quot;Run Compliance Audit&quot; to see
                results.
              </p>
              <p className="text-xs mt-1">
                Or click &quot;Load Example Config&quot; to try a sample.
              </p>
            </div>
          )}

          {report && <AuditReportDisplay report={report} />}
        </div>
      </div>
    </div>
  );
}
