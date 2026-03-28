"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Globe,
  Cpu,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  INDUSTRY_OPTIONS,
  JURISDICTION_OPTIONS,
  AI_USE_CASE_OPTIONS,
  type Industry,
} from "@/lib/types/user";

const STEPS = [
  { label: "Profile", icon: User },
  { label: "Jurisdictions", icon: Globe },
  { label: "AI Use Cases", icon: Cpu },
  { label: "Review", icon: CheckCircle },
];

const REGIONS = ["Europe", "North America", "Latin America", "Asia-Pacific", "Middle East & Africa", "International"] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [displayName, setDisplayName] = useState("");
  const [organization, setOrganization] = useState("");
  const [industry, setIndustry] = useState<Industry | "">("");
  const [selectedJurisdictions, setSelectedJurisdictions] = useState<string[]>([]);
  const [selectedUseCases, setSelectedUseCases] = useState<string[]>([]);

  // Animation direction
  const [direction, setDirection] = useState<"forward" | "back">("forward");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/signin");
    }
  }, [authLoading, user, router]);

  function goNext() {
    setDirection("forward");
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setDirection("back");
    setStep((s) => Math.max(s - 1, 0));
  }

  function toggleJurisdiction(code: string) {
    setSelectedJurisdictions((prev) =>
      prev.includes(code) ? prev.filter((j) => j !== code) : [...prev, code]
    );
  }

  function selectAllInRegion(region: string) {
    const regionCodes = JURISDICTION_OPTIONS.filter((j) => j.region === region).map((j) => j.code);
    setSelectedJurisdictions((prev) => {
      const withoutRegion = prev.filter((c) => !regionCodes.includes(c));
      return [...withoutRegion, ...regionCodes];
    });
  }

  function clearRegion(region: string) {
    const regionCodes = JURISDICTION_OPTIONS.filter((j) => j.region === region).map((j) => j.code);
    setSelectedJurisdictions((prev) => prev.filter((c) => !regionCodes.includes(c)));
  }

  function toggleUseCase(value: string) {
    setSelectedUseCases((prev) =>
      prev.includes(value) ? prev.filter((u) => u !== value) : [...prev, value]
    );
  }

  async function handleSubmit() {
    if (!user) return;
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { error: insertError } = await supabase.from("user_profiles").upsert({
      id: user.id,
      display_name: displayName || null,
      organization: organization || null,
      industry: industry || null,
      jurisdictions: selectedJurisdictions,
      ai_use_cases: selectedUseCases,
      onboarded: true,
      updated_at: new Date().toISOString(),
    });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  const canAdvance = () => {
    if (step === 0) return !!displayName && !!industry;
    if (step === 1) return selectedJurisdictions.length > 0;
    if (step === 2) return selectedUseCases.length > 0;
    return true;
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Progress indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="flex flex-1 items-center">
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300",
                      i < step
                        ? "border-primary bg-primary text-primary-foreground"
                        : i === step
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-muted bg-muted/50 text-muted-foreground"
                    )}
                  >
                    {i < step ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium transition-colors",
                      i <= step ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={cn(
                      "mx-2 h-0.5 flex-1 rounded transition-colors duration-300",
                      i < step ? "bg-primary" : "bg-muted"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step content with animation */}
      <div
        key={step}
        className={cn(
          "animate-in fade-in duration-300",
          direction === "forward" ? "slide-in-from-right-4" : "slide-in-from-left-4"
        )}
      >
        {step === 0 && (
          <StepProfile
            displayName={displayName}
            setDisplayName={setDisplayName}
            organization={organization}
            setOrganization={setOrganization}
            industry={industry}
            setIndustry={setIndustry}
          />
        )}
        {step === 1 && (
          <StepJurisdictions
            selected={selectedJurisdictions}
            onToggle={toggleJurisdiction}
            onSelectAll={selectAllInRegion}
            onClear={clearRegion}
          />
        )}
        {step === 2 && (
          <StepUseCases selected={selectedUseCases} onToggle={toggleUseCase} />
        )}
        {step === 3 && (
          <StepReview
            displayName={displayName}
            organization={organization}
            industry={industry}
            jurisdictions={selectedJurisdictions}
            useCases={selectedUseCases}
          />
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="mt-8 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={goBack}
          disabled={step === 0}
          className={cn(step === 0 && "invisible")}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back
        </Button>

        {step < STEPS.length - 1 ? (
          <Button onClick={goNext} disabled={!canAdvance()}>
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Create My Dashboard
          </Button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 1: Profile                                                     */
/* ------------------------------------------------------------------ */
function StepProfile({
  displayName,
  setDisplayName,
  organization,
  setOrganization,
  industry,
  setIndustry,
}: {
  displayName: string;
  setDisplayName: (v: string) => void;
  organization: string;
  setOrganization: (v: string) => void;
  industry: Industry | "";
  setIndustry: (v: Industry | "") => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Tell us about yourself</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This helps us personalize your compliance dashboard.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="displayName" className="text-sm font-medium">
            Display Name <span className="text-destructive">*</span>
          </label>
          <Input
            id="displayName"
            placeholder="Jane Smith"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="organization" className="text-sm font-medium">
            Organization <span className="text-muted-foreground text-xs">(optional)</span>
          </label>
          <Input
            id="organization"
            placeholder="Acme Corp"
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="industry" className="text-sm font-medium">
            Industry <span className="text-destructive">*</span>
          </label>
          <select
            id="industry"
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
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 2: Jurisdictions                                               */
/* ------------------------------------------------------------------ */
function StepJurisdictions({
  selected,
  onToggle,
  onSelectAll,
  onClear,
}: {
  selected: string[];
  onToggle: (code: string) => void;
  onSelectAll: (region: string) => void;
  onClear: (region: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Which jurisdictions matter to you?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Select the regulatory jurisdictions your AI systems operate in.
          We&apos;ll track regulations and generate alerts for these.
        </p>
      </div>

      {REGIONS.map((region) => {
        const jurisdictions = JURISDICTION_OPTIONS.filter((j) => j.region === region);
        const allSelected = jurisdictions.every((j) => selected.includes(j.code));

        return (
          <div key={region} className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">{region}</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => onSelectAll(region)}
                  className="text-xs text-primary hover:underline"
                >
                  Select All
                </button>
                {allSelected && (
                  <button
                    onClick={() => onClear(region)}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {jurisdictions.map((j) => {
                const isSelected = selected.includes(j.code);
                return (
                  <button
                    key={j.code}
                    onClick={() => onToggle(j.code)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-all",
                      isSelected
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border hover:border-primary/50 hover:bg-accent/50 text-muted-foreground"
                    )}
                  >
                    <span className="text-lg">{j.flag}</span>
                    <span className="font-medium truncate">{j.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <p className="text-xs text-muted-foreground">
        {selected.length} jurisdiction{selected.length !== 1 ? "s" : ""} selected
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 3: AI Use Cases                                                */
/* ------------------------------------------------------------------ */
function StepUseCases({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">How are you using AI?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Select the AI capabilities your organization deploys. This helps us
          prioritize the most relevant regulations and findings.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {AI_USE_CASE_OPTIONS.map((uc) => {
          const isSelected = selected.includes(uc.value);
          return (
            <button
              key={uc.value}
              onClick={() => onToggle(uc.value)}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-4 text-left transition-all",
                isSelected
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50 hover:bg-accent/50"
              )}
            >
              <span className="text-2xl mt-0.5">{uc.icon}</span>
              <div>
                <div className={cn("text-sm font-medium", isSelected ? "text-foreground" : "text-muted-foreground")}>
                  {uc.label}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {uc.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        {selected.length} use case{selected.length !== 1 ? "s" : ""} selected
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 4: Review                                                      */
/* ------------------------------------------------------------------ */
function StepReview({
  displayName,
  organization,
  industry,
  jurisdictions,
  useCases,
}: {
  displayName: string;
  organization: string;
  industry: Industry | "";
  jurisdictions: string[];
  useCases: string[];
}) {
  const industryLabel = INDUSTRY_OPTIONS.find((o) => o.value === industry)?.label ?? "—";
  const jurisdictionLabels = jurisdictions.map((code) => {
    const j = JURISDICTION_OPTIONS.find((o) => o.code === code);
    return j ? `${j.flag} ${j.name}` : code;
  });
  const useCaseLabels = useCases.map((val) => {
    const uc = AI_USE_CASE_OPTIONS.find((o) => o.value === val);
    return uc ? `${uc.icon} ${uc.label}` : val;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Review your profile</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Confirm everything looks right. You can always change these later from
          your dashboard.
        </p>
      </div>

      <div className="space-y-4">
        <ReviewSection title="Profile">
          <ReviewItem label="Name" value={displayName} />
          {organization && <ReviewItem label="Organization" value={organization} />}
          <ReviewItem label="Industry" value={industryLabel} />
        </ReviewSection>

        <ReviewSection title="Jurisdictions">
          <div className="flex flex-wrap gap-2">
            {jurisdictionLabels.map((label) => (
              <span
                key={label}
                className="inline-flex items-center rounded-md bg-accent px-2.5 py-1 text-xs font-medium"
              >
                {label}
              </span>
            ))}
          </div>
        </ReviewSection>

        <ReviewSection title="AI Use Cases">
          <div className="flex flex-wrap gap-2">
            {useCaseLabels.map((label) => (
              <span
                key={label}
                className="inline-flex items-center rounded-md bg-accent px-2.5 py-1 text-xs font-medium"
              >
                {label}
              </span>
            ))}
          </div>
        </ReviewSection>
      </div>
    </div>
  );
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
