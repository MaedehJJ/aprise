"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  TrendingUp,
  Briefcase,
  GraduationCap,
  RefreshCw,
  Rocket,
  MapPin,
  Sparkles,
  PartyPopper,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Direction = "forward" | "backward";

interface OnboardingState {
  goal: string;
  status: string;
  targetRole: string;
  targetIndustry: string;
}

const TOTAL_STEPS = 4;

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<Direction>("forward");
  const [animKey, setAnimKey] = useState(0);
  const [data, setData] = useState<OnboardingState>({
    goal: "",
    status: "",
    targetRole: "",
    targetIndustry: "",
  });

  const goNext = () => {
    setDirection("forward");
    setAnimKey((k) => k + 1);
    setStep((s) => s + 1);
  };

  const goBack = () => {
    setDirection("backward");
    setAnimKey((k) => k + 1);
    setStep((s) => s - 1);
  };

  const animClass =
    direction === "forward" ? "step-enter" : "step-enter-back";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-5 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center shadow-sm">
            <TrendingUp className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <span
            className="text-base font-semibold"
            style={{ fontFamily: "var(--font-instrument-serif)" }}
          >
            Aprise
          </span>
        </div>

        {step > 0 && step < TOTAL_STEPS && (
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5">
              {Array.from({ length: TOTAL_STEPS - 1 }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-500",
                    i < step - 1
                      ? "w-8 bg-primary"
                      : i === step - 1
                      ? "w-8 bg-primary"
                      : "w-5 bg-border"
                  )}
                />
              ))}
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              {step} / {TOTAL_STEPS - 1}
            </span>
          </div>
        )}

        <Link href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          Skip for now
        </Link>
      </header>

      {/* Step area */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div
          key={animKey}
          className={cn(
            "w-full max-w-lg",
            step < TOTAL_STEPS ? animClass : ""
          )}
        >
          {step === 0 && <WelcomeStep onNext={goNext} />}
          {step === 1 && (
            <GoalStep
              value={data.goal}
              onChange={(v) => setData((d) => ({ ...d, goal: v }))}
              onNext={goNext}
              onBack={goBack}
            />
          )}
          {step === 2 && (
            <StatusStep
              value={data.status}
              onChange={(v) => setData((d) => ({ ...d, status: v }))}
              onNext={goNext}
              onBack={goBack}
            />
          )}
          {step === 3 && (
            <TargetStep
              role={data.targetRole}
              industry={data.targetIndustry}
              onChangeRole={(v) =>
                setData((d) => ({ ...d, targetRole: v }))
              }
              onChangeIndustry={(v) =>
                setData((d) => ({ ...d, targetIndustry: v }))
              }
              onNext={goNext}
              onBack={goBack}
            />
          )}
          {step === 4 && <DoneStep data={data} />}
        </div>
      </div>
    </div>
  );
}

/* ── Step 0: Welcome ────────────────────────────────────────────── */
function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center text-center gap-8">
      <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center ring-1 ring-primary/15 shadow-sm">
        <Sparkles className="w-8 h-8 text-accent-foreground" />
      </div>

      <div className="space-y-3">
        <h1
          className="text-4xl leading-snug"
          style={{ fontFamily: "var(--font-instrument-serif)" }}
        >
          Welcome to Aprise.
        </h1>
        <p className="text-muted-foreground leading-relaxed max-w-sm mx-auto">
          Let&apos;s take two minutes to set things up. I&apos;ll ask a few
          questions so your AI coach can give you advice that actually fits
          where you are right now.
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={onNext}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground btn-primary-glow hover:bg-primary/90 transition-all duration-200"
        >
          Let&apos;s go
          <ArrowRight className="w-4 h-4" />
        </button>
        <p className="text-xs text-muted-foreground">3 quick questions · takes ~2 min</p>
      </div>
    </div>
  );
}

/* ── Step 1: Goal ────────────────────────────────────────────────── */
const goalOptions = [
  {
    value: "first_job",
    label: "Land my first job",
    description: "Fresh graduate or career beginner",
    icon: GraduationCap,
  },
  {
    value: "career_change",
    label: "Switch careers",
    description: "Moving into a new field",
    icon: RefreshCw,
  },
  {
    value: "level_up",
    label: "Level up my role",
    description: "Getting promoted or senior",
    icon: TrendingUp,
  },
  {
    value: "new_opportunity",
    label: "Find a better fit",
    description: "Exploring new opportunities",
    icon: Rocket,
  },
];

function GoalStep({
  value,
  onChange,
  onNext,
  onBack,
}: {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Question 1 of 3
        </p>
        <h2
          className="text-3xl leading-snug"
          style={{ fontFamily: "var(--font-instrument-serif)" }}
        >
          What&apos;s your main job search goal?
        </h2>
        <p className="text-muted-foreground text-sm">
          This helps your AI coach understand where you&apos;re coming from.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {goalOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "group flex flex-col items-start gap-3 p-4 rounded-2xl border text-left transition-all duration-200",
              value === opt.value
                ? "border-primary/40 bg-accent ring-2 ring-primary/20 shadow-sm"
                : "border-border bg-card hover:border-primary/20 hover:bg-accent/40 shadow-sm"
            )}
          >
            <div
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200",
                value === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground group-hover:bg-accent group-hover:text-accent-foreground"
              )}
            >
              <opt.icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {opt.label}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {opt.description}
              </p>
            </div>
          </button>
        ))}
      </div>

      <StepNav onBack={onBack} onNext={onNext} canProceed={!!value} />
    </div>
  );
}

/* ── Step 2: Status ─────────────────────────────────────────────── */
const statusOptions = [
  {
    value: "employed",
    label: "Currently employed",
    description: "Exploring while working",
    emoji: "💼",
  },
  {
    value: "unemployed",
    label: "Actively searching",
    description: "Looking full-time",
    emoji: "🔍",
  },
  {
    value: "transitioning",
    label: "In transition",
    description: "Wrapping up previous role",
    emoji: "🔄",
  },
  {
    value: "student",
    label: "Still studying",
    description: "Preparing for graduation",
    emoji: "🎓",
  },
];

function StatusStep({
  value,
  onChange,
  onNext,
  onBack,
}: {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Question 2 of 3
        </p>
        <h2
          className="text-3xl leading-snug"
          style={{ fontFamily: "var(--font-instrument-serif)" }}
        >
          Where are you in your search right now?
        </h2>
        <p className="text-muted-foreground text-sm">
          No right answer here — just helps us set the right pace.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {statusOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "group flex items-center gap-4 px-4 py-3.5 rounded-xl border text-left transition-all duration-200",
              value === opt.value
                ? "border-primary/40 bg-accent ring-2 ring-primary/20 shadow-sm"
                : "border-border bg-card hover:border-primary/20 hover:bg-accent/40 shadow-sm"
            )}
          >
            <span className="text-2xl">{opt.emoji}</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">
                {opt.label}
              </p>
              <p className="text-xs text-muted-foreground">{opt.description}</p>
            </div>
            <div
              className={cn(
                "w-4 h-4 rounded-full border-2 transition-all duration-200",
                value === opt.value
                  ? "border-primary bg-primary"
                  : "border-border"
              )}
            />
          </button>
        ))}
      </div>

      <StepNav onBack={onBack} onNext={onNext} canProceed={!!value} />
    </div>
  );
}

/* ── Step 3: Target ─────────────────────────────────────────────── */
function TargetStep({
  role,
  industry,
  onChangeRole,
  onChangeIndustry,
  onNext,
  onBack,
}: {
  role: string;
  industry: string;
  onChangeRole: (v: string) => void;
  onChangeIndustry: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const suggestions = [
    "Software Engineer",
    "Product Manager",
    "UX Designer",
    "Data Scientist",
    "Marketing Manager",
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Question 3 of 3
        </p>
        <h2
          className="text-3xl leading-snug"
          style={{ fontFamily: "var(--font-instrument-serif)" }}
        >
          What kind of role are you going after?
        </h2>
        <p className="text-muted-foreground text-sm">
          Be as specific as you like — your coach will use this.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Briefcase className="w-3 h-3" /> Target role
          </label>
          <input
            type="text"
            value={role}
            onChange={(e) => onChangeRole(e.target.value)}
            placeholder="e.g. Senior Product Designer"
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all duration-200"
          />
          <div className="flex flex-wrap gap-2 mt-1">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => onChangeRole(s)}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-full border transition-all duration-150",
                  role === s
                    ? "border-primary/40 bg-accent text-accent-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/20 hover:text-foreground"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <MapPin className="w-3 h-3" /> Target industry{" "}
            <span className="normal-case text-muted-foreground/60">(optional)</span>
          </label>
          <input
            type="text"
            value={industry}
            onChange={(e) => onChangeIndustry(e.target.value)}
            placeholder="e.g. Fintech, Healthcare, SaaS"
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all duration-200"
          />
        </div>
      </div>

      <StepNav
        onBack={onBack}
        onNext={onNext}
        canProceed={role.trim().length > 0}
        nextLabel="Set up my dashboard"
      />
    </div>
  );
}

/* ── Step 4: Done ────────────────────────────────────────────────── */
function DoneStep({ data }: { data: OnboardingState }) {
  return (
    <div className="flex flex-col items-center text-center gap-8 animate-scale-in">
      <div className="relative">
        <div className="w-20 h-20 rounded-2xl bg-accent flex items-center justify-center ring-1 ring-primary/15 shadow-md">
          <PartyPopper className="w-10 h-10 text-accent-foreground" />
        </div>
        <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-sm">
          <CheckCircle2 className="w-3.5 h-3.5 text-primary-foreground" />
        </div>
      </div>

      <div className="space-y-3">
        <h2
          className="text-4xl leading-snug"
          style={{ fontFamily: "var(--font-instrument-serif)" }}
        >
          You&apos;re all set.
        </h2>
        <p className="text-muted-foreground leading-relaxed max-w-sm mx-auto">
          Your dashboard is ready. Your AI coach already knows you&apos;re
          targeting{" "}
          <span className="font-medium text-foreground">
            {data.targetRole || "your dream role"}
          </span>{" "}
          — let&apos;s get your first application in.
        </p>
      </div>

      {/* Summary pills */}
      <div className="flex flex-wrap justify-center gap-2">
        {[
          goalOptions.find((g) => g.value === data.goal)?.label,
          statusOptions.find((s) => s.value === data.status)?.label,
          data.targetRole || null,
          data.targetIndustry || null,
        ]
          .filter(Boolean)
          .map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-accent text-accent-foreground border border-primary/15"
            >
              <CheckCircle2 className="w-3 h-3 text-primary/60" />
              {item}
            </span>
          ))}
      </div>

      <Link href="/dashboard">
        <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground btn-primary-glow hover:bg-primary/90 transition-all duration-200">
          Open my dashboard
          <ArrowRight className="w-4 h-4" />
        </button>
      </Link>
    </div>
  );
}

/* ── Navigation buttons ─────────────────────────────────────────── */
function StepNav({
  onBack,
  onNext,
  canProceed,
  nextLabel = "Continue",
}: {
  onBack: () => void;
  onNext: () => void;
  canProceed: boolean;
  nextLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between pt-2">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-200"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>
      <button
        onClick={onNext}
        disabled={!canProceed}
        className={cn(
          "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200",
          canProceed
            ? "bg-primary text-primary-foreground btn-primary-glow hover:bg-primary/90"
            : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
        )}
      >
        {nextLabel}
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

