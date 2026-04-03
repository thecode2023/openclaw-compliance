"use client";

import { useState } from "react";
import { FileJson, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AuditReport } from "@/lib/types/audit";

interface ExportButtonsProps {
  report: AuditReport;
  costEstimate?: {
    total_penalty_exposure: number;
    total_remediation_cost: number;
    has_criminal_risk: boolean;
    breakdown: {
      jurisdiction: string;
      jurisdiction_display: string;
      max_penalty: number;
      remediation_cost: number;
      finding_count: number;
      has_criminal: boolean;
      enforcement_body: string;
      fine_basis: string;
    }[];
  };
}

export function ExportButtons({ report, costEstimate }: ExportButtonsProps) {
  const [exporting, setExporting] = useState(false);

  function exportJSON() {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `complyze-audit-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportPDF() {
    setExporting(true);
    try {
      const { generateAuditPDF } = await import("@/lib/utils/audit-pdf");
      const doc = generateAuditPDF(report, costEstimate);
      doc.save(`complyze-audit-${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={exportJSON} className="text-xs font-mono">
        <FileJson className="h-3.5 w-3.5 mr-1.5" />
        JSON
      </Button>
      <Button variant="outline" size="sm" onClick={exportPDF} disabled={exporting} className="text-xs font-mono">
        {exporting ? (
          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
        ) : (
          <FileText className="h-3.5 w-3.5 mr-1.5" />
        )}
        PDF Report
      </Button>
    </div>
  );
}
