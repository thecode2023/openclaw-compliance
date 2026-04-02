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
  Check,
  Sparkles,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  POLICY_TYPE_OPTIONS,
  STATUS_OPTIONS,
  type PolicyDocument,
  type PolicyStatus,
} from "@/lib/types/policy";
import { INDUSTRY_OPTIONS } from "@/lib/types/user";
import type { Regulation } from "@/lib/types/regulation";

interface PoliciesClientProps {
  regulations: Regulation[];
  policies: PolicyDocument[];
  userIndustry: string;
}

type View = "list" | "editor";

export function PoliciesClient({
  regulations,
  policies: initialPolicies,
  userIndustry,
}: PoliciesClientProps) {
  // State
  const [policies, setPolicies] = useState(initialPolicies);
  const [view, setView] = useState<View>("list");
  const [activeTab, setActiveTab] = useState("generate");

  // Generator state
  const [selectedRegIds, setSelectedRegIds] = useState<string[]>([]);
  const [policyType, setPolicyType] = useState("");
  const [industry, setIndustry] = useState(userIndustry);
  const [orgDetails, setOrgDetails] = useState("");
  const [generating, setGenerating] = useState(false);
  const [regSearch, setRegSearch] = useState("");

  // Editor state
  const [editingPolicy, setEditingPolicy] = useState<PolicyDocument | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [editorTitle, setEditorTitle] = useState("");
  const [editorStatus, setEditorStatus] = useState<PolicyStatus>("draft");
  const [saving, setSaving] = useState(false);
  const [editorTab, setEditorTab] = useState<"edit" | "preview">("edit");

  // Filter regulations by search
  const filteredRegulations = regulations.filter(
    (r) =>
      r.title.toLowerCase().includes(regSearch.toLowerCase()) ||
      r.jurisdiction_display?.toLowerCase().includes(regSearch.toLowerCase())
  );

  const toggleRegulation = (id: string) => {
    setSelectedRegIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
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
  }, [selectedRegIds, policyType, industry, orgDetails]);

  // Save policy
  const handleSave = useCallback(async () => {
    if (!editorTitle || !editorContent) return;
    setSaving(true);

    try {
      if (editingPolicy) {
        // Update existing
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
        setPolicies((prev) =>
          prev.map((p) => (p.id === updated.id ? updated : p))
        );
        setEditingPolicy(updated);
        toast.success("Policy updated");
      } else {
        // Create new
        const selectedRegs = regulations.filter((r) =>
          selectedRegIds.includes(r.id)
        );
        const res = await fetch("/api/policies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: editorTitle,
            content_markdown: editorContent,
            regulation_id: selectedRegIds[0] || null,
            industry,
            jurisdictions: [
              ...new Set(selectedRegs.map((r) => r.jurisdiction)),
            ],
            metadata: { policy_type: policyType },
          }),
        });

        if (!res.ok) throw new Error("Failed to save policy");
        const created = await res.json();
        setPolicies((prev) => [created, ...prev]);
        setEditingPolicy(created);
        toast.success("Policy saved");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save"
      );
    } finally {
      setSaving(false);
    }
  }, [
    editingPolicy,
    editorTitle,
    editorContent,
    editorStatus,
    selectedRegIds,
    regulations,
    industry,
    policyType,
  ]);

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

  // Copy markdown
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(editorContent);
    toast.success("Markdown copied to clipboard");
  }, [editorContent]);

  // Open existing policy in editor
  const openPolicy = (policy: PolicyDocument) => {
    setEditingPolicy(policy);
    setEditorContent(policy.content_markdown);
    setEditorTitle(policy.title);
    setEditorStatus(policy.status);
    setView("editor");
  };

  // Back to list
  const backToList = () => {
    setView("list");
    setEditingPolicy(null);
  };

  // Get status badge
  const getStatusBadge = (status: PolicyStatus) => {
    const opt = STATUS_OPTIONS.find((s) => s.value === status);
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${opt?.color || ""}`}
      >
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
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          <Button variant="outline" size="sm" onClick={handleCopy}>
            <Copy className="w-3.5 h-3.5 mr-1" />
            Copy
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
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              editorTab === "edit"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Edit
          </button>
          <button
            onClick={() => setEditorTab("preview")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              editorTab === "preview"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Preview
          </button>
        </div>

        {/* Split pane */}
        <div className="flex-1 overflow-hidden md:grid md:grid-cols-2 md:divide-x md:divide-border">
          {/* Editor pane */}
          <div
            className={`h-full overflow-hidden flex flex-col ${
              editorTab !== "edit" ? "hidden md:flex" : "flex"
            }`}
          >
            <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border shrink-0">
              Markdown
            </div>
            <textarea
              value={editorContent}
              onChange={(e) => setEditorContent(e.target.value)}
              className="flex-1 w-full resize-none bg-background p-4 text-sm font-mono leading-relaxed focus:outline-none"
              spellCheck={false}
            />
          </div>

          {/* Preview pane */}
          <div
            className={`h-full overflow-auto ${
              editorTab !== "preview" ? "hidden md:block" : "block"
            }`}
          >
            <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border sticky top-0 bg-card z-10">
              Preview
            </div>
            <div className="p-6 prose prose-sm prose-invert max-w-none [&>h1]:text-xl [&>h2]:text-lg [&>h3]:text-base [&_table]:text-xs [&_th]:px-3 [&_th]:py-1.5 [&_td]:px-3 [&_td]:py-1.5 [&_table]:border [&_th]:border [&_td]:border [&_th]:border-border [&_td]:border-border [&_th]:bg-muted/50">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{editorContent || "*No content yet*"}</ReactMarkdown>
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
          Generate compliance policies from regulatory requirements, tailored to
          your industry.
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
              <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded-full">
                {policies.length}
              </span>
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
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Regulations */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Source Regulations <span className="text-destructive">*</span>
              {selectedRegIds.length > 0 && (
                <span className="ml-2 text-xs text-muted-foreground font-normal">
                  {selectedRegIds.length} selected
                </span>
              )}
            </label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                value={regSearch}
                onChange={(e) => setRegSearch(e.target.value)}
                placeholder="Search regulations..."
                className="w-full h-9 pl-9 pr-3 rounded-md border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="border border-border rounded-md max-h-[240px] overflow-y-auto divide-y divide-border">
              {filteredRegulations.map((reg) => {
                const selected = selectedRegIds.includes(reg.id);
                return (
                  <button
                    key={reg.id}
                    onClick={() => toggleRegulation(reg.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50 ${
                      selected ? "bg-primary/5" : ""
                    }`}
                  >
                    <div
                      className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center transition-colors ${
                        selected
                          ? "bg-primary border-primary"
                          : "border-input"
                      }`}
                    >
                      {selected && (
                        <Check className="w-3 h-3 text-primary-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{reg.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {reg.jurisdiction_display} &middot; {reg.status}
                      </p>
                    </div>
                  </button>
                );
              })}
              {filteredRegulations.length === 0 && (
                <p className="px-3 py-4 text-sm text-muted-foreground text-center">
                  No regulations match your search
                </p>
              )}
            </div>
          </div>

          {/* Industry */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Industry <span className="text-destructive">*</span>
            </label>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Select industry...</option>
              {INDUSTRY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Organization Details */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Organization Details{" "}
              <span className="text-xs text-muted-foreground font-normal">
                (optional)
              </span>
            </label>
            <textarea
              value={orgDetails}
              onChange={(e) => setOrgDetails(e.target.value)}
              placeholder="Company name, department, additional context..."
              rows={3}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={
              generating ||
              selectedRegIds.length === 0 ||
              !policyType ||
              !industry
            }
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
              <p className="text-xs text-muted-foreground mb-4">
                Generate a policy and save it to see it here.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab("generate")}
              >
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
                    <p className="text-sm font-medium truncate">
                      {policy.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {getStatusBadge(policy.status)}
                      {policy.metadata?.policy_type ? (
                        <span className="text-xs text-muted-foreground">
                          {POLICY_TYPE_OPTIONS.find(
                            (o) =>
                              o.value ===
                              (policy.metadata as Record<string, string>)
                                .policy_type
                          )?.label ||
                            String(policy.metadata.policy_type)}
                        </span>
                      ) : null}
                      <span className="text-xs text-muted-foreground">
                        &middot;{" "}
                        {new Date(policy.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(policy.id);
                    }}
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
