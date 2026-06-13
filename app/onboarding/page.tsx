"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  TrendingUp,
  Briefcase,
  MapPin,
  Sparkles,
  PartyPopper,
  Building2,
  GraduationCap,
  Rocket,
  Link2,
  FileText,
  Plus,
  X,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createProfile, ingestCv, getMyProfile, ApiError, type CompanySize } from "@/lib/api";

type Direction = "forward" | "backward";

interface OnboardingData {
  name: string;
  yearsExperience: string;
  targetRoles: string[];
  targetRoleDraft: string;
  market: string;
  companySize: CompanySize | null;
}

const TOTAL_STEPS = 4;

export default function OnboardingPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn, getToken } = useAuth();

  // If the user already has a profile, they've completed onboarding —
  // skip straight to the app instead of showing the flow again.
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/sign-in");
      return;
    }

    // TODO: remove before launch — skip redirect for testing
  }, [isLoaded, isSignedIn, getToken, router]);

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<Direction>("forward");
  const [animKey, setAnimKey] = useState(0);
  const [data, setData] = useState<OnboardingData>({
    name: "",
    yearsExperience: "",
    targetRoles: [],
    targetRoleDraft: "",
    market: "",
    companySize: null,
  });
  const [files, setFiles] = useState<PendingFile[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  const animClass = direction === "forward" ? "step-enter" : "step-enter-back";

  const handleFinish = async () => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      await createProfile(getToken, {
        name: data.name.trim(),
        target_roles: data.targetRoles,
        preferred_company_size: data.companySize,
        years_experience: data.yearsExperience ? Number(data.yearsExperience) : null,
      });

      // Ingest each uploaded document. Failures here shouldn't block the
      // user from entering the app — they can always re-upload from Files.
      await Promise.allSettled(
        files.map((pf) => ingestCv(getToken, pf.file))
      );

      goNext();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? typeof err.detail === "string"
            ? err.detail
            : "Something went wrong creating your profile."
          : "Something went wrong. Please check your connection and try again.";
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-5 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center shadow-sm">
            <TrendingUp className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <span className="text-base font-semibold">
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
                    i <= step - 1 ? "w-8 bg-primary" : "w-5 bg-border"
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
        <div key={animKey} className={cn("w-full max-w-lg", step < TOTAL_STEPS ? animClass : "")}>
          {step === 0 && <WelcomeStep onNext={goNext} />}
          {step === 1 && (
            <AboutStep
              name={data.name}
              yearsExperience={data.yearsExperience}
              onChangeName={(v) => setData((d) => ({ ...d, name: v }))}
              onChangeYears={(v) => setData((d) => ({ ...d, yearsExperience: v }))}
              onNext={goNext}
              onBack={goBack}
            />
          )}
          {step === 2 && (
            <TargetStep
              data={data}
              setData={setData}
              onNext={goNext}
              onBack={goBack}
            />
          )}
          {step === 3 && (
            <UploadStep
              files={files}
              setFiles={setFiles}
              onNext={handleFinish}
              onBack={goBack}
              submitting={submitting}
              submitError={submitError}
            />
          )}
          {step === 4 && <DoneStep data={data} router={router} />}
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
        <h1 className="text-4xl leading-snug">
          Welcome to Aprise.
        </h1>
        <p className="text-muted-foreground leading-relaxed max-w-sm mx-auto">
          Let&apos;s build your profile and your memory — the foundation your AI coach uses to
          give advice that actually fits where you are and where you want to go.
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
        <p className="text-xs text-muted-foreground">3 quick steps · takes ~3 min</p>
      </div>
    </div>
  );
}

/* ── Step 1: About you ──────────────────────────────────────────── */
function AboutStep({
  name,
  yearsExperience,
  onChangeName,
  onChangeYears,
  onNext,
  onBack,
}: {
  name: string;
  yearsExperience: string;
  onChangeName: (v: string) => void;
  onChangeYears: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const yearsOptions = [
    { value: "0", label: "0", description: "Just starting out", icon: GraduationCap },
    { value: "2", label: "1–3", description: "Early career", icon: Rocket },
    { value: "5", label: "4–7", description: "Mid-level", icon: Briefcase },
    { value: "10", label: "8+", description: "Senior / leadership", icon: TrendingUp },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Step 1 of 3</p>
        <h2 className="text-3xl leading-snug">
          Let&apos;s start with you.
        </h2>
        <p className="text-muted-foreground text-sm">
          Just the basics — your coach will use this to calibrate its tone and advice.
        </p>
      </div>

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Your name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => onChangeName(e.target.value)}
            placeholder="e.g. Maya Jordan"
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all duration-200"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Years of experience
          </label>
          <div className="grid grid-cols-2 gap-3">
            {yearsOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onChangeYears(opt.value)}
                className={cn(
                  "group flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all duration-200",
                  yearsExperience === opt.value
                    ? "border-primary/40 bg-accent ring-2 ring-primary/20 shadow-sm"
                    : "border-border bg-card hover:border-primary/20 hover:bg-accent/40 shadow-sm"
                )}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200",
                    yearsExperience === opt.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground group-hover:bg-accent group-hover:text-accent-foreground"
                  )}
                >
                  <opt.icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{opt.label} years</p>
                  <p className="text-xs text-muted-foreground">{opt.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <StepNav onBack={onBack} onNext={onNext} canProceed={name.trim().length > 0 && !!yearsExperience} />
    </div>
  );
}

/* ── Step 2: What you're targeting ──────────────────────────────── */
const companySizeOptions: { value: CompanySize; label: string; description: string }[] = [
  { value: "startup", label: "Startup", description: "< 50 people, fast & scrappy" },
  { value: "scaleup", label: "Scale-up", description: "Growing fast, more structure" },
  { value: "enterprise", label: "Enterprise", description: "Large, established orgs" },
];

const roleSuggestions = ["Software Engineer", "Product Manager", "UX Designer", "Data Scientist", "Marketing Manager"];

function TargetStep({
  data,
  setData,
  onNext,
  onBack,
}: {
  data: OnboardingData;
  setData: React.Dispatch<React.SetStateAction<OnboardingData>>;
  onNext: () => void;
  onBack: () => void;
}) {
  const addRole = (role: string) => {
    const trimmed = role.trim();
    if (!trimmed || data.targetRoles.includes(trimmed)) return;
    setData((d) => ({ ...d, targetRoles: [...d.targetRoles, trimmed], targetRoleDraft: "" }));
  };

  const removeRole = (role: string) => {
    setData((d) => ({ ...d, targetRoles: d.targetRoles.filter((r) => r !== role) }));
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Step 2 of 3</p>
        <h2 className="text-3xl leading-snug">
          What are you aiming for?
        </h2>
        <p className="text-muted-foreground text-sm">
          This shapes how your coach reads job descriptions and frames your story.
        </p>
      </div>

      <div className="flex flex-col gap-5">
        {/* Target roles */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Briefcase className="w-3 h-3" /> Target role(s)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={data.targetRoleDraft}
              onChange={(e) => setData((d) => ({ ...d, targetRoleDraft: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addRole(data.targetRoleDraft);
                }
              }}
              placeholder="e.g. Senior Product Designer"
              className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all duration-200"
            />
            <button
              onClick={() => addRole(data.targetRoleDraft)}
              disabled={!data.targetRoleDraft.trim()}
              className={cn(
                "inline-flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-200",
                data.targetRoleDraft.trim()
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {data.targetRoles.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1">
              {data.targetRoles.map((role) => (
                <span
                  key={role}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-accent text-accent-foreground border border-primary/15"
                >
                  {role}
                  <button onClick={() => removeRole(role)} className="hover:text-foreground transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2 mt-1">
            {roleSuggestions
              .filter((s) => !data.targetRoles.includes(s))
              .map((s) => (
                <button
                  key={s}
                  onClick={() => addRole(s)}
                  className="text-xs px-2.5 py-1 rounded-full border border-border bg-card text-muted-foreground hover:border-primary/20 hover:text-foreground transition-all duration-150"
                >
                  + {s}
                </button>
              ))}
          </div>
        </div>

        {/* Market */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <MapPin className="w-3 h-3" /> Market{" "}
            <span className="normal-case text-muted-foreground/60">(industry, region, or both)</span>
          </label>
          <input
            type="text"
            value={data.market}
            onChange={(e) => setData((d) => ({ ...d, market: e.target.value }))}
            placeholder="e.g. Fintech in Western Europe, or Healthcare SaaS in the US"
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all duration-200"
          />
        </div>

        {/* Company size */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Building2 className="w-3 h-3" /> Preferred company size{" "}
            <span className="normal-case text-muted-foreground/60">(optional)</span>
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            {companySizeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() =>
                  setData((d) => ({
                    ...d,
                    companySize: d.companySize === opt.value ? null : opt.value,
                  }))
                }
                className={cn(
                  "flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all duration-200",
                  data.companySize === opt.value
                    ? "border-primary/40 bg-accent ring-2 ring-primary/20 shadow-sm"
                    : "border-border bg-card hover:border-primary/20 hover:bg-accent/40 shadow-sm"
                )}
              >
                <p className="text-xs font-semibold text-foreground">{opt.label}</p>
                <p className="text-[10px] text-muted-foreground leading-snug">{opt.description}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      <StepNav onBack={onBack} onNext={onNext} canProceed={data.targetRoles.length > 0} />
    </div>
  );
}

/* ── Step 3: Upload documents ───────────────────────────────────── */
interface PendingFile {
  id: string;
  file: File;
  kind: "resume" | "linkedin";
}

function UploadStep({
  files,
  setFiles,
  onNext,
  onBack,
  submitting,
  submitError,
}: {
  files: PendingFile[];
  setFiles: React.Dispatch<React.SetStateAction<PendingFile[]>>;
  onNext: () => void;
  onBack: () => void;
  submitting: boolean;
  submitError: string | null;
}) {
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const linkedinInputRef = useRef<HTMLInputElement>(null);

  const addFiles = (fileList: FileList | null, kind: "resume" | "linkedin") => {
    if (!fileList) return;
    const additions = Array.from(fileList).map((file) => ({
      id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      kind,
    }));
    setFiles((prev) => [...prev, ...additions]);
  };

  const removeFile = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id));

  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Step 3 of 3</p>
        <h2 className="text-3xl leading-snug">
          Bring your experience with you.
        </h2>
        <p className="text-muted-foreground text-sm">
          Upload past resumes and your LinkedIn profile export (as a PDF) — we&apos;ll read them
          and start building your memory right away. You can always add more later.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <UploadTile
          icon={FileText}
          title="Resume"
          description="One or more versions of your resume — PDF only"
          onClick={() => resumeInputRef.current?.click()}
        />
        <input
          ref={resumeInputRef}
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files, "resume");
            e.target.value = "";
          }}
        />

        <UploadTile
          icon={Link2}
          title="LinkedIn export"
          description='From LinkedIn: More → "Save to PDF" on your profile page'
          onClick={() => linkedinInputRef.current?.click()}
        />
        <input
          ref={linkedinInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files, "linkedin");
            e.target.value = "";
          }}
        />
      </div>

      {files.length > 0 && (
        <div className="flex flex-col gap-2">
          {files.map((pf) => (
            <div
              key={pf.id}
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3.5 py-2.5"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                {pf.kind === "linkedin" ? (
                  <Link2 className="w-4 h-4 text-primary" />
                ) : (
                  <FileText className="w-4 h-4 text-primary" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground truncate">{pf.file.name}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{pf.kind}</p>
              </div>
              <button
                onClick={() => removeFile(pf.id)}
                className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-150 shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {submitError && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">{submitError}</p>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onBack}
          disabled={submitting}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-200 disabled:opacity-50"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <button
          onClick={onNext}
          disabled={submitting}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200",
            "bg-primary text-primary-foreground btn-primary-glow hover:bg-primary/90 disabled:opacity-70"
          )}
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Setting things up…
            </>
          ) : (
            <>
              Finish setup
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground text-center -mt-4">
        No documents yet? That&apos;s okay — you can skip this and upload later from your Files tab.
      </p>
    </div>
  );
}

function UploadTile({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: typeof FileText;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-4 p-4 rounded-2xl border border-dashed border-border/70 bg-muted/20 hover:bg-muted/30 hover:border-primary/30 transition-all duration-200 text-left w-full"
    >
      <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center ring-1 ring-primary/15 shrink-0">
        <Icon className="w-5 h-5 text-accent-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Plus className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors duration-200 shrink-0" />
    </button>
  );
}

/* ── Step 4: Done ────────────────────────────────────────────────── */
function DoneStep({
  data,
  router,
}: {
  data: OnboardingData;
  router: ReturnType<typeof useRouter>;
}) {
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
        <h2 className="text-4xl leading-snug">
          You&apos;re all set, {data.name.split(" ")[0] || "there"}.
        </h2>
        <p className="text-muted-foreground leading-relaxed max-w-sm mx-auto">
          Your profile is saved and we&apos;re building your memory in the background. Your AI coach
          already knows you&apos;re targeting{" "}
          <span className="font-medium text-foreground">{data.targetRoles[0] || "your next role"}</span>{" "}
          — let&apos;s start your first conversation.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {[...data.targetRoles, data.market || null, companySizeOptions.find((c) => c.value === data.companySize)?.label || null]
          .filter(Boolean)
          .map((item) => (
            <span
              key={item as string}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-accent text-accent-foreground border border-primary/15"
            >
              <CheckCircle2 className="w-3 h-3 text-primary/60" />
              {item}
            </span>
          ))}
      </div>

      <button
        onClick={() => router.push("/app/chat?new=1")}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground btn-primary-glow hover:bg-primary/90 transition-all duration-200"
      >
        Start my first conversation
        <ArrowRight className="w-4 h-4" />
      </button>
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
