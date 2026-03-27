"use client";

import { useState } from "react";
import { ConfigInput } from "@/components/audit/ConfigInput";
import { AuditReportDisplay } from "@/components/audit/AuditReport";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import type { AuditReport } from "@/lib/types/audit";

export default function AuditPage() {
  const [config, setConfig] = useState("");
  const [report, setReport] = useState<AuditReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAudit = async () => {
    setError(null);
    setReport(null);

    // Validate JSON
    try {
      JSON.parse(config);
    } catch {
      setError("Invalid JSON. Please check your config and try again.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Audit failed. Please try again.");
        return;
      }

      setReport(data as AuditReport);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-lg sm:text-2xl font-bold tracking-tight">
          OpenClaw Configuration Auditor
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Paste an OpenClaw agent config to audit it against live regulatory
          data. Every finding is grounded in real regulations — zero
          hallucinated citations.
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

          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mb-4" />
              <p className="text-sm font-medium">
                Analyzing config against regulatory database...
              </p>
              <p className="text-xs mt-1">
                This typically takes 10-20 seconds.
              </p>
            </div>
          )}

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
