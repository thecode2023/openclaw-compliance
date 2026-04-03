"use client";

import { useState, useCallback } from "react";
import {
  FileText,
  Plus,
  Copy,
  Save,
  ArrowLeft,
  Loader2,
  Search,
  Trash2,
  Sparkles,
  Download,
  X,
} from "lucide-react";
import { Markdown } from "@/components/Markdown";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  POLICY_TYPE_OPTIONS,
  STATUS_OPTIONS,
  type PolicyDocument,
  type PolicyStatus,
} from "@/lib/types/policy";
import { INDUSTRY_OPTIONS, AI_USE_CASE_OPTIONS } from "@/lib/types/user";
import { useSetChatContext } from "@/components/chat/ChatContext";
import type { Regulation } from "@/lib/types/regulation";

const COMPANY_SIZE_OPTIONS = [
  { value: "startup", label: "Startup (<50 employees)" },
  { value: "smb", label: "SMB (50–500 employees)" },
  { value: "enterprise", label: "Enterprise (500–5,000 employees)" },
  { value: "large_enterprise", label: "Large Enterprise (5,000+ employees)" },
];

interface PoliciesClientProps {
  regulations: Regulation[];
  policies: PolicyDocument[];
  userIndustry: string;
  userAiUseCases: string[];
  userJurisdictions: string[];
  userOrganization: string;
}

type View = "list" | "editor";

export function PoliciesClient({
  regulations,
  policies: initialPolicies,
  userIndustry,
  userAiUseCases,
  userJurisdictions,
  userOrganization,
}: PoliciesClientProps) {
  const [policies, setPolicies] = useState(initialPolicies);
  const [view, setView] = useState<View>("list");
  useSetChatContext({ page: view === "editor" ? "policy-editor" : "policies" });
  const [activeTab, setActiveTab] = useState("generate");

  // Generator state
  const [selectedRegIds, setSelectedRegIds] = useState<string[]>([]);
  const [policyType, setPolicyType] = useState("");
  const [industry, setIndustry] = useState(userIndustry);
  const [orgDetails, setOrgDetails] = useState("");
  const [generating, setGenerating] = useState(false);
  const [regSearch, setRegSearch] = useState("");
  const [regRegion, setRegRegion] = useState("all");
  const [regCategory, setRegCategory] = useState("all");

  // Company context state
  const [companyName, setCompanyName] = useState(userOrganization);
  const [companySize, setCompanySize] = useState("");
  const [aiUseCases, setAiUseCases] = useState<string[]>(userAiUseCases);
  const [geoOperations, setGeoOperations] = useState<string[]>(userJurisdictions);
  const [stakeholders, setStakeholders] = useState("");

  // Editor state
  const [editingPolicy, setEditingPolicy] = useState<PolicyDocument | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [editorTitle, setEditorTitle] = useState("");
  const [editorStatus, setEditorStatus] = useState<PolicyStatus>("draft");
  const [saving, setSaving] = useState(false);
  const [editorTab, setEditorTab] = useState<"edit" | "preview">("edit");
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const getRegion = (jurisdiction: string): string => {
    if (["EU", "GB"].some((c) => jurisdiction.startsWith(c))) return "Europe";
    if (["US", "CA"].some((c) => jurisdiction.startsWith(c))) return "North America";
    if (["CN", "JP", "KR", "SG", "AU", "IN", "ID", "TH", "VN", "PH", "HK", "TW"].some((c) => jurisdiction.startsWith(c))) return "Asia-Pacific";
    if (["BR", "MX"].some((c) => jurisdiction.startsWith(c))) return "Latin America";
    if (["SA", "AE", "IL", "NG", "KE", "ZA"].some((c) => jurisdiction.startsWith(c))) return "Middle East & Africa";
    if (["INTL", "OECD", "G7", "ISO", "IEEE", "WHO"].some((c) => jurisdiction.startsWith(c))) return "International";
    return "Other";
  };

  const REGION_TABS = ["All", "Europe", "North America", "Asia-Pacific", "Latin America", "Middle East & Africa", "International"];
  const CATEGORY_OPTIONS = ["All", "legislation", "framework", "guidance", "standard", "executive_order"];

  const filteredRegulations = regulations.filter((r) => {
    const matchesSearch =
      !regSearch ||
      r.title.toLowerCase().includes(regSearch.toLowerCase()) ||
      r.jurisdiction_display?.toLowerCase().includes(regSearch.toLowerCase());
    const matchesRegion = regRegion === "all" || getRegion(r.jurisdiction) === regRegion;
    const matchesCategory = regCategory === "all" || r.category === regCategory;
    return matchesSearch && matchesRegion && matchesCategory;
  });

  const toggleRegulation = (id: string) => {
    setSelectedRegIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAiUseCase = (value: string) => {
    setAiUseCases((prev) =>
      prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]
    );
  };

  const toggleGeo = (value: string) => {
    setGeoOperations((prev) =>
      prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]
    );
  };

  // Generate policy
  const handleGenerate = useCallback(async () => {
    if (selectedRegIds.length === 0 || !policyType || !industry) return;
    setGenerating(true);

    try {
      const res = await fetch("/api/policies/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          regulation_ids: selectedRegIds,
          policy_type: policyType,
          industry,
          organization_details: orgDetails || undefined,
          company_name: companyName || undefined,
          company_size: companySize || undefined,
          ai_use_cases: aiUseCases.length > 0 ? aiUseCases : undefined,
          geographic_operations: geoOperations.length > 0 ? geoOperations : undefined,
          stakeholders: stakeholders || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || `Generation failed (${res.status})`);
      }

      const { content_markdown, title } = await res.json();
      setEditorContent(content_markdown);
      setEditorTitle(title);
      setEditorStatus("draft");
      setEditingPolicy(null);
      setView("editor");
      toast.success("Policy generated successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to generate policy"
      );
    } finally {
      setGenerating(false);
    }
  }, [selectedRegIds, policyType, industry, orgDetails, companyName, companySize, aiUseCases, geoOperations, stakeholders]);

  // Save policy
  const handleSave = useCallback(async () => {
    if (!editorTitle || !editorContent) return;
    setSaving(true);

    try {
      if (editingPolicy) {
        const res = await fetch("/api/policies", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingPolicy.id,
            title: editorTitle,
            content_markdown: editorContent,
            status: editorStatus,
          }),
        });
        if (!res.ok) throw new Error("Failed to update policy");
        const updated = await res.json();
        setPolicies((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        setEditingPolicy(updated);
        toast.success("Policy updated");
      } else {
        const selectedRegs = regulations.filter((r) => selectedRegIds.includes(r.id));
        const res = await fetch("/api/policies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: editorTitle,
            content_markdown: editorContent,
            regulation_id: selectedRegIds[0] || null,
            industry,
            jurisdictions: [...new Set(selectedRegs.map((r) => r.jurisdiction))],
            metadata: { policy_type: policyType, company_name: companyName },
          }),
        });
        if (!res.ok) throw new Error("Failed to save policy");
        const created = await res.json();
        setPolicies((prev) => [created, ...prev]);
        setEditingPolicy(created);
        toast.success("Policy saved");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [editingPolicy, editorTitle, editorContent, editorStatus, selectedRegIds, regulations, industry, policyType, companyName]);

  // Download PDF
  const handleDownloadPDF = useCallback(async () => {
    setGeneratingPdf(true);
    try {
      const { generatePolicyPDF } = await import("@/lib/utils/policy-pdf");
      const doc = generatePolicyPDF(editorContent, editorTitle, companyName || undefined);
      doc.save(`${editorTitle.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 60)}.pdf`);
      toast.success("PDF downloaded");
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error("Failed to generate PDF");
    } finally {
      setGeneratingPdf(false);
    }
  }, [editorContent, editorTitle, companyName]);

  // Delete policy
  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("Delete this policy? This cannot be undone.")) return;
      try {
        const res = await fetch(`/api/policies?id=${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete");
        setPolicies((prev) => prev.filter((p) => p.id !== id));
        if (editingPolicy?.id === id) {
          setView("list");
          setEditingPolicy(null);
        }
        toast.success("Policy deleted");
      } catch {
        toast.error("Failed to delete policy");
      }
    },
    [editingPolicy]
  );

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(editorContent);
    toast.success("Markdown copied to clipboard");
  }, [editorContent]);

  const openPolicy = (policy: PolicyDocument) => {
    setEditingPolicy(policy);
    setEditorContent(policy.content_markdown);
    setEditorTitle(policy.title);
    setEditorStatus(policy.status);
    // Restore company name from metadata if available
    const meta = policy.metadata as Record<string, string> | null;
    if (meta?.company_name) setCompanyName(meta.company_name);
    setView("editor");
  };

  const backToList = () => {
    setView("list");
    setEditingPolicy(null);
  };

  const getStatusBadge = (status: PolicyStatus) => {
    const opt = STATUS_OPTIONS.find((s) => s.value === status);
    return (
      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${opt?.color || ""}`}>
        {opt?.label || status}
      </span>
    );
  };

  // ── EDITOR VIEW ──
  if (view === "editor") {
    return (
      <div className="flex flex-col h-[calc(100vh-3.5rem)]">
        {/* Toolbar */}
        <div className="border-b border-border px-4 py-3 flex flex-wrap items-center gap-3 shrink-0 bg-card">
          <Button variant="ghost" size="sm" onClick={backToList}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>

          <input
            type="text"
            value={editorTitle}
            onChange={(e) => setEditorTitle(e.target.value)}
            className="flex-1 min-w-[200px] bg-transparent text-sm font-medium border-b border-transparent hover:border-border focus:border-primary focus:outline-none px-1 py-0.5 transition-colors"
            placeholder="Policy title..."
          />

          <select
            value={editorStatus}
            onChange={(e) => setEditorStatus(e.target.value as PolicyStatus)}
            className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          <Button variant="outline" size="sm" onClick={handleCopy}>
            <Copy className="w-3.5 h-3.5 mr-1" />
            Copy
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPDF}
            disabled={generatingPdf || !editorContent}
          >
            {generatingPdf ? (
              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5 mr-1" />
            )}
            PDF
          </Button>

          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5 mr-1" />
            )}
            {editingPolicy ? "Update" : "Save"}
          </Button>
        </div>

        {/* Mobile edit/preview toggle */}
        <div className="md:hidden border-b border-border px-4 py-2 flex gap-2 shrink-0">
          <button
            onClick={() => setEditorTab("edit")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${editorTab === "edit" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Edit
          </button>
          <button
            onClick={() => setEditorTab("preview")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${editorTab === "preview" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Preview
          </button>
        </div>

        {/* Split pane */}
        <div className="flex-1 overflow-hidden md:grid md:grid-cols-2 md:divide-x md:divide-border">
          <div className={`h-full overflow-hidden flex flex-col ${editorTab !== "edit" ? "hidden md:flex" : "flex"}`}>
            <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border shrink-0">Markdown</div>
            <textarea
              value={editorContent}
              onChange={(e) => setEditorContent(e.target.value)}
              className="flex-1 w-full resize-none bg-background p-4 text-sm font-mono leading-relaxed focus:outline-none"
              spellCheck={false}
            />
          </div>
          <div className={`h-full overflow-auto ${editorTab !== "preview" ? "hidden md:block" : "block"}`}>
            <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border sticky top-0 bg-card z-10">Preview</div>
            <div className="p-6 prose prose-sm prose-invert max-w-none [&>h1]:text-xl [&>h2]:text-lg [&>h3]:text-base [&_table]:text-xs [&_th]:px-3 [&_th]:py-1.5 [&_td]:px-3 [&_td]:py-1.5 [&_table]:border [&_th]:border [&_td]:border [&_th]:border-border [&_td]:border-border [&_th]:bg-muted/50">
              <Markdown>{editorContent || "*No content yet*"}</Markdown>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ──
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Policy Generator</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Generate compliance policies from regulatory requirements, tailored to your company.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="generate">
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            Generate
          </TabsTrigger>
          <TabsTrigger value="my-policies">
            <FileText className="w-3.5 h-3.5 mr-1.5" />
            My Policies
            {policies.length > 0 && (
              <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded-full">{policies.length}</span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── GENERATE TAB ── */}
        <TabsContent value="generate" className="mt-6 space-y-6">
          {/* Policy Type */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Policy Type <span className="text-destructive">*</span>
            </label>
            <select
              value={policyType}
              onChange={(e) => setPolicyType(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Select policy type...</option>
              {POLICY_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Regulations Picker */}
          <div>
            <label className="text-sm font-medium mb-3 block">
              Source Regulations <span className="text-destructive">*</span>
            </label>

            {/* Selected chips */}
            {selectedRegIds.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Selected ({selectedRegIds.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedRegIds.map((id) => {
                    const reg = regulations.find((r) => r.id === id);
                    if (!reg) return null;
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 text-xs rounded-full bg-primary/15 text-primary border border-primary/30"
                      >
                        {reg.title.length > 40 ? reg.title.slice(0, 40) + "..." : reg.title}
                        <button
                          onClick={() => toggleRegulation(id)}
                          className="p-0.5 rounded-full hover:bg-primary/20 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Region tabs */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {REGION_TABS.map((region) => (
                <button
                  key={region}
                  onClick={() => setRegRegion(region === "All" ? "all" : region)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                    (region === "All" ? "all" : region) === regRegion
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                  }`}
                >
                  {region}
                </button>
              ))}
            </div>

            {/* Search + Category filter row */}
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={regSearch}
                  onChange={(e) => setRegSearch(e.target.value)}
                  placeholder="Search regulations..."
                  className="w-full h-9 pl-9 pr-3 rounded-md border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <select
                value={regCategory}
                onChange={(e) => setRegCategory(e.target.value)}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-xs shrink-0"
              >
                {CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat} value={cat === "All" ? "all" : cat}>
                    {cat === "All" ? "All Categories" : cat.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>

            {/* Regulation card grid */}
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="max-h-[420px] overflow-y-auto p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredRegulations.map((reg) => {
                  const selected = selectedRegIds.includes(reg.id);
                  const statusColors: Record<string, string> = {
                    enacted: "bg-green-500/15 text-green-400",
                    in_effect: "bg-green-500/15 text-green-400",
                    proposed: "bg-amber-500/15 text-amber-400",
                    under_review: "bg-blue-500/15 text-blue-400",
                    repealed: "bg-gray-500/15 text-gray-400",
                  };
                  const catColors: Record<string, string> = {
                    legislation: "bg-indigo-500/15 text-indigo-400",
                    executive_order: "bg-purple-500/15 text-purple-400",
                    framework: "bg-cyan-500/15 text-cyan-400",
                    guidance: "bg-teal-500/15 text-teal-400",
                    standard: "bg-orange-500/15 text-orange-400",
                  };
                  return (
                    <button
                      key={reg.id}
                      onClick={() => toggleRegulation(reg.id)}
                      className={`text-left p-3 rounded-lg border-2 transition-all hover:bg-muted/30 ${
                        selected
                          ? "border-primary bg-primary/5 shadow-sm shadow-primary/10"
                          : "border-transparent bg-card hover:border-border"
                      }`}
                    >
                      <p className="text-sm font-medium leading-snug line-clamp-2 mb-2">
                        {reg.title}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="inline-block px-2 py-0.5 text-[10px] font-medium rounded-full bg-muted text-muted-foreground">
                          {reg.jurisdiction_display}
                        </span>
                        <span className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded-full ${statusColors[reg.status] || "bg-muted text-muted-foreground"}`}>
                          {reg.status.replace("_", " ")}
                        </span>
                        <span className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded-full ${catColors[reg.category] || "bg-muted text-muted-foreground"}`}>
                          {reg.category.replace("_", " ")}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {filteredRegulations.length === 0 && (
                <p className="px-3 py-8 text-sm text-muted-foreground text-center">
                  No regulations match your filters
                </p>
              )}
              <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground bg-card/50">
                {filteredRegulations.length} regulation{filteredRegulations.length !== 1 ? "s" : ""} shown
              </div>
            </div>
          </div>

          {/* ── COMPANY CONTEXT SECTION ── */}
          <div className="border border-border rounded-lg p-5 space-y-5">
            <h3 className="text-sm font-semibold text-foreground">Company Context</h3>

            {/* Company Name */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Company Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Acme Corp"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground mt-1">Replaces [COMPANY NAME] placeholders in the generated policy.</p>
            </div>

            {/* Industry (already exists) */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Industry <span className="text-destructive">*</span>
              </label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Select industry...</option>
                {INDUSTRY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Company Size */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Company Size</label>
              <select
                value={companySize}
                onChange={(e) => setCompanySize(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Select size...</option>
                {COMPANY_SIZE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">Scales governance complexity to match your organization.</p>
            </div>

            {/* AI Use Cases */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                AI Use Cases
                {aiUseCases.length > 0 && (
                  <span className="ml-2 text-xs text-muted-foreground font-normal">{aiUseCases.length} selected</span>
                )}
              </label>
              <div className="flex flex-wrap gap-2">
                {AI_USE_CASE_OPTIONS.map((opt) => {
                  const active = aiUseCases.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      onClick={() => toggleAiUseCase(opt.value)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border transition-colors ${
                        active
                          ? "bg-primary/10 border-primary/40 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                      }`}
                    >
                      <span>{opt.icon}</span>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Geographic Operations */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Geographic Operations
                {geoOperations.length > 0 && (
                  <span className="ml-2 text-xs text-muted-foreground font-normal">{geoOperations.length} selected</span>
                )}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {userJurisdictions.map((j) => {
                  const active = geoOperations.includes(j);
                  return (
                    <button
                      key={j}
                      onClick={() => toggleGeo(j)}
                      className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                        active
                          ? "bg-primary/10 border-primary/40 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/30"
                      }`}
                    >
                      {j}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Key Stakeholders */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Key Stakeholders{" "}
                <span className="text-xs text-muted-foreground font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={stakeholders}
                onChange={(e) => setStakeholders(e.target.value)}
                placeholder="CTO, VP of Compliance, DPO, Head of AI"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground mt-1">Used in the RACI table instead of generic role placeholders.</p>
            </div>

            {/* Organization Details */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Additional Context{" "}
                <span className="text-xs text-muted-foreground font-normal">(optional)</span>
              </label>
              <textarea
                value={orgDetails}
                onChange={(e) => setOrgDetails(e.target.value)}
                placeholder="Department focus, specific AI systems in scope, compliance history..."
                rows={2}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </div>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={generating || selectedRegIds.length === 0 || !policyType || !industry}
            className="w-full sm:w-auto"
            size="lg"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating policy...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Policy
              </>
            )}
          </Button>
        </TabsContent>

        {/* ── MY POLICIES TAB ── */}
        <TabsContent value="my-policies" className="mt-6">
          {policies.length === 0 ? (
            <div className="text-center py-16">
              <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium mb-1">No saved policies</p>
              <p className="text-xs text-muted-foreground mb-4">Generate a policy and save it to see it here.</p>
              <Button variant="outline" size="sm" onClick={() => setActiveTab("generate")}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                Generate your first policy
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {policies.map((policy) => (
                <div
                  key={policy.id}
                  className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors group cursor-pointer"
                  onClick={() => openPolicy(policy)}
                >
                  <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{policy.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {getStatusBadge(policy.status)}
                      {policy.metadata?.policy_type ? (
                        <span className="text-xs text-muted-foreground">
                          {POLICY_TYPE_OPTIONS.find((o) => o.value === (policy.metadata as Record<string, string>).policy_type)?.label || String(policy.metadata.policy_type)}
                        </span>
                      ) : null}
                      <span className="text-xs text-muted-foreground">
                        &middot; {new Date(policy.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(policy.id); }}
                    className="p-1.5 rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                    title="Delete policy"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
