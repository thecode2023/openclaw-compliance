"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  INDUSTRY_OPTIONS,
  JURISDICTION_OPTIONS,
  AI_USE_CASE_OPTIONS,
  type Industry,
  type UserProfile,
} from "@/lib/types/user";

const REGIONS = ["Europe", "North America", "Latin America", "Asia-Pacific", "Middle East & Africa", "International"] as const;

interface ProfileEditorProps {
  profile: UserProfile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileEditor({ profile, open, onOpenChange }: ProfileEditorProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state - initialized from profile
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [organization, setOrganization] = useState(profile.organization ?? "");
  const [industry, setIndustry] = useState<Industry | "">(profile.industry ?? "");
  const [jurisdictions, setJurisdictions] = useState<string[]>(profile.jurisdictions);
  const [useCases, setUseCases] = useState<string[]>(profile.ai_use_cases);

  // Reset form when profile changes or sheet opens
  useEffect(() => {
    if (open) {
      setDisplayName(profile.display_name ?? "");
      setOrganization(profile.organization ?? "");
      setIndustry(profile.industry ?? "");
      setJurisdictions([...profile.jurisdictions]);
      setUseCases([...profile.ai_use_cases]);
      setError(null);
    }
  }, [open, profile]);

  function toggleJurisdiction(code: string) {
    setJurisdictions((prev) =>
      prev.includes(code) ? prev.filter((j) => j !== code) : [...prev, code]
    );
  }

  function toggleUseCase(value: string) {
    setUseCases((prev) =>
      prev.includes(value) ? prev.filter((u) => u !== value) : [...prev, value]
    );
  }

  async function handleSave() {
    if (!displayName.trim()) {
      setError("Display name is required.");
      return;
    }
    if (!industry) {
      setError("Industry is required.");
      return;
    }
    if (jurisdictions.length === 0) {
      setError("Select at least one jurisdiction.");
      return;
    }
    if (useCases.length === 0) {
      setError("Select at least one AI use case.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName.trim(),
          organization: organization.trim() || null,
          industry,
          jurisdictions,
          ai_use_cases: useCases,
          // Clean up priorities: remove old jurisdictions, default new ones to "active"
          jurisdiction_priorities: Object.fromEntries(
            jurisdictions.map((j) => [
              j,
              profile.jurisdiction_priorities?.[j] ?? "active",
            ])
          ),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save changes.");
        return;
      }

      onOpenChange(false);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit Profile</SheetTitle>
          <SheetDescription>
            Update your compliance profile. Changes to jurisdictions will immediately update your dashboard.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-4 py-2">
          {/* Profile fields */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Profile</h3>
            <div className="space-y-2">
              <label htmlFor="edit-name" className="text-sm font-medium">
                Display Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="edit-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Jane Smith"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="edit-org" className="text-sm font-medium">
                Organization
              </label>
              <Input
                id="edit-org"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="Acme Corp"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="edit-industry" className="text-sm font-medium">
                Industry <span className="text-destructive">*</span>
              </label>
              <select
                id="edit-industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value as Industry | "")}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Select your industry...</option>
                {INDUSTRY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {/* Jurisdictions */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">
              Jurisdictions <span className="text-destructive">*</span>
            </h3>
            {REGIONS.map((region) => {
              const regionJurisdictions = JURISDICTION_OPTIONS.filter((j) => j.region === region);
              return (
                <div key={region} className="space-y-2">
                  <span className="text-xs text-muted-foreground font-medium">{region}</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {regionJurisdictions.map((j) => {
                      const selected = jurisdictions.includes(j.code);
                      return (
                        <button
                          key={j.code}
                          type="button"
                          onClick={() => toggleJurisdiction(j.code)}
                          className={cn(
                            "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-all text-left",
                            selected
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border hover:border-primary/50 text-muted-foreground"
                          )}
                        >
                          <span>{j.flag}</span>
                          <span className="truncate">{j.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <p className="text-xs text-muted-foreground">
              {jurisdictions.length} selected
            </p>
          </section>

          {/* AI Use Cases */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">
              AI Use Cases <span className="text-destructive">*</span>
            </h3>
            <div className="grid grid-cols-1 gap-1.5">
              {AI_USE_CASE_OPTIONS.map((uc) => {
                const selected = useCases.includes(uc.value);
                return (
                  <button
                    key={uc.value}
                    type="button"
                    onClick={() => toggleUseCase(uc.value)}
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-3 py-2 text-left transition-all",
                      selected
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border hover:border-primary/50 text-muted-foreground"
                    )}
                  >
                    <span className="text-base">{uc.icon}</span>
                    <div>
                      <div className="text-xs font-medium">{uc.label}</div>
                      <div className="text-[10px] text-muted-foreground">{uc.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {useCases.length} selected
            </p>
          </section>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <SheetFooter>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Changes
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
