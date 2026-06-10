import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import {
  ArrowRight,
  Brain,
  Calendar,
  CheckCircle2,
  ChevronRight,
  FileText,
  MessageSquare,
  Sparkles,
  Bell,
  TrendingUp,
  Zap,
  Star,
  BarChart3,
} from "lucide-react";

export default async function LandingPage() {
  const { userId } = await auth();

  return (
    <main className="min-h-screen flex flex-col overflow-hidden bg-background">
      {/* ── Navbar ──────────────────────────────────────────────── */}
      <header className="glass-nav sticky top-0 z-50 px-6 py-4">
        <nav className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shadow-sm">
              <TrendingUp className="w-4 h-4 text-primary-foreground" />
            </div>
            <span
              className="text-lg font-semibold tracking-tight"
            >
              Aprise
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#how-it-works" className="hover:text-foreground transition-colors">
              How it works
            </a>
            <a href="#features" className="hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#pricing" className="hover:text-foreground transition-colors">
              Pricing
            </a>
          </div>

          <div className="flex items-center gap-3">
            {userId ? (
              <Link href="/app">
                <button className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground btn-primary-glow hover:bg-primary/90 transition-all duration-200">
                  Dashboard
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </Link>
            ) : (
              <>
                <Link href="/sign-in">
                  <button className="hidden sm:inline-flex rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-200">
                    Sign in
                  </button>
                </Link>
                <Link href="/sign-up">
                  <button className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground btn-primary-glow hover:bg-primary/90 transition-all duration-200">
                    Get started
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center text-center px-6 pt-24 pb-16 min-h-[92vh] justify-center">
        <div className="absolute inset-0 grid-bg" />
        <div className="absolute inset-0 grid-fade" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-background to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />

        <div className="relative z-10 flex flex-col items-center gap-6 max-w-4xl">
          {/* Eyebrow badge */}
          <div
            className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-primary/20 bg-accent/60 px-4 py-1.5 text-xs font-medium text-accent-foreground tracking-wide shadow-sm"
            style={{ animationDelay: "0ms" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-pulse" />
            AI-powered job application tracker
          </div>

          {/* Headline */}
          <h1
            className="animate-fade-up text-5xl sm:text-6xl lg:text-7xl leading-[1.08] tracking-tight"
            style={{
              animationDelay: "80ms",
            }}
          >
            You apply.{" "}
            <span className="italic text-primary">You rise.</span>
            <br />
            <span className="text-foreground/90">You aprise.</span>
          </h1>

          {/* Subheadline */}
          <p
            className="animate-fade-up text-lg sm:text-xl text-muted-foreground max-w-xl leading-relaxed"
            style={{ animationDelay: "160ms" }}
          >
            Track every application, get AI coaching tailored to each stage,
            and walk into interviews prepared.
          </p>

          {/* CTAs */}
          <div
            className="animate-fade-up flex flex-col sm:flex-row gap-3 mt-2"
            style={{ animationDelay: "240ms" }}
          >
            <Link href={userId ? "/app" : "/sign-up"}>
              <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground btn-primary-glow hover:bg-primary/90 transition-all duration-200">
                Start tracking for free
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <a href="#how-it-works">
              <button className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/80 px-6 py-3 text-sm font-medium text-foreground hover:bg-muted/60 hover:border-primary/30 transition-all duration-200 shadow-sm">
                See how it works
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            </a>
          </div>

          <p
            className="animate-fade-up text-xs text-muted-foreground"
            style={{ animationDelay: "320ms" }}
          >
            Free to start · No credit card required
          </p>

          {/* Dashboard mockup */}
          <div
            className="animate-scale-in mt-8 w-full max-w-4xl"
            style={{ animationDelay: "480ms" }}
          >
            <DashboardMockup />
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────── */}
      <section id="how-it-works" className="px-6 py-24 bg-background">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-3">
              How it works
            </p>
            <h2
              className="text-3xl sm:text-4xl leading-snug"
            >
              From first application to offer letter —<br />
              <span className="italic text-muted-foreground font-normal">
                every step, guided.
              </span>
            </h2>
          </div>

          <div className="relative grid sm:grid-cols-3 gap-6">
            {/* Connector line (desktop) */}
            <div className="hidden sm:block absolute top-12 left-[calc(16.66%+1rem)] right-[calc(16.66%+1rem)] h-px bg-gradient-to-r from-transparent via-border to-transparent" />

            {howItWorks.map((step, i) => (
              <div
                key={i}
                className="relative flex flex-col gap-4 p-6 rounded-2xl border border-border bg-card shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-300 group"
              >
                <div className="w-11 h-11 rounded-xl bg-accent flex items-center justify-center text-accent-foreground ring-1 ring-primary/10 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                  <step.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-primary/70 mb-1 tracking-wide uppercase">
                    Step {i + 1}
                  </p>
                  <h3 className="font-semibold text-foreground mb-2 text-base">
                    {step.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────── */}
      <section
        id="features"
        className="px-6 py-24"
        style={{
          background:
            "linear-gradient(180deg, var(--background) 0%, oklch(0.968 0.028 282) 100%)",
        }}
      >
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-3">
              Features
            </p>
            <h2
              className="text-3xl sm:text-4xl leading-snug"
            >
              Everything you need to land the job
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            {features.map((f, i) => (
              <div
                key={i}
                className="group flex gap-5 p-6 rounded-2xl border border-border bg-card/80 hover:bg-card hover:shadow-md hover:border-primary/20 transition-all duration-300"
              >
                <div className="shrink-0 w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-accent-foreground ring-1 ring-primary/10 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                  <f.icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1.5">
                    {f.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {f.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Social proof ────────────────────────────────────────── */}
      <section className="px-6 py-24 bg-background">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-3">
              What people say
            </p>
            <h2
              className="text-3xl sm:text-4xl"
            >
              Trusted by job seekers everywhere
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-5">
            {testimonials.map((t, i) => (
              <div
                key={i}
                className="flex flex-col gap-4 p-6 rounded-2xl border border-border bg-card shadow-sm"
              >
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, j) => (
                    <Star
                      key={j}
                      className="w-3.5 h-3.5 fill-primary/80 text-primary/80"
                    />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed italic">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="flex items-center gap-3 mt-auto pt-2 border-t border-border/60">
                  <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-accent-foreground text-xs font-semibold">
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      {t.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Logo bar */}
          <div className="mt-16 flex flex-col items-center gap-6">
            <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
              Job seekers from
            </p>
            <div className="flex flex-wrap items-center justify-center gap-8 opacity-40">
              {["Google", "Meta", "Apple", "Stripe", "Airbnb", "Linear"].map(
                (co) => (
                  <span
                    key={co}
                    className="text-sm font-semibold text-foreground tracking-tight"
                  >
                    {co}
                  </span>
                )
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────── */}
      <section
        id="pricing"
        className="px-6 py-24"
        style={{
          background:
            "linear-gradient(180deg, var(--background) 0%, oklch(0.968 0.028 282) 100%)",
        }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-3">
              Pricing
            </p>
            <h2
              className="text-3xl sm:text-4xl leading-snug"
            >
              Simple, honest pricing
            </h2>
            <p className="mt-4 text-muted-foreground text-sm max-w-sm mx-auto">
              Start for free. Upgrade when you need the full power of AI coaching.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5 max-w-2xl mx-auto">
            {/* Free */}
            <div className="flex flex-col gap-6 p-7 rounded-2xl border border-border bg-card shadow-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                  Free
                </p>
                <div className="flex items-end gap-1">
                  <span
                    className="text-4xl font-bold"
                  >
                    $0
                  </span>
                  <span className="text-sm text-muted-foreground mb-1">
                    / month
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Everything to get started.
                </p>
              </div>
              <ul className="flex flex-col gap-3 text-sm text-muted-foreground">
                {freeTier.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-primary/60 shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-auto">
                <Link href="/sign-up">
                  <button className="w-full rounded-xl border border-border bg-muted/40 py-2.5 text-sm font-medium text-foreground hover:bg-muted/70 transition-all duration-200">
                    Get started free
                  </button>
                </Link>
              </div>
            </div>

            {/* Pro */}
            <div className="relative flex flex-col gap-6 p-7 rounded-2xl border border-primary/30 bg-card shadow-lg ring-1 ring-primary/10">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-sm">
                  <Sparkles className="w-3 h-3" />
                  Most popular
                </span>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-1">
                  Pro
                </p>
                <div className="flex items-end gap-1">
                  <span
                    className="text-4xl font-bold"
                  >
                    $12
                  </span>
                  <span className="text-sm text-muted-foreground mb-1">
                    / month
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  For serious job seekers.
                </p>
              </div>
              <ul className="flex flex-col gap-3 text-sm text-muted-foreground">
                {proTier.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-auto">
                <Link href="/sign-up">
                  <button className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground btn-primary-glow hover:bg-primary/90 transition-all duration-200">
                    Start with Pro
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA banner ──────────────────────────────────────────── */}
      <section className="px-6 py-24 bg-background">
        <div className="max-w-2xl mx-auto text-center flex flex-col items-center gap-6">
          <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center text-accent-foreground ring-1 ring-primary/15">
            <TrendingUp className="w-6 h-6" />
          </div>
          <h2
            className="text-3xl sm:text-4xl"
          >
            Ready to rise?
          </h2>
          <p className="text-muted-foreground text-sm max-w-sm leading-relaxed">
            Join thousands of job seekers who use Aprise to track, prepare,
            and land their next role.
          </p>
          <Link href={userId ? "/app" : "/sign-up"}>
            <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground btn-primary-glow hover:bg-primary/90 transition-all duration-200">
              Start for free
              <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="border-t border-border/60 px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-3 h-3 text-primary" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">
              Aprise
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Aprise · Built to help you rise.
          </p>
          <div className="flex items-center gap-5 text-xs text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">
              Privacy
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              Terms
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}

/* ── Dashboard preview mockup ───────────────────────────────────── */
function DashboardMockup() {
  return (
    <div className="relative mx-auto w-full max-w-3xl rounded-2xl border border-border/60 bg-card shadow-2xl shadow-primary/8 overflow-hidden ring-1 ring-foreground/5">
      {/* Window chrome */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 bg-muted/30">
        <div className="w-3 h-3 rounded-full bg-red-400/70" />
        <div className="w-3 h-3 rounded-full bg-amber-400/70" />
        <div className="w-3 h-3 rounded-full bg-green-400/70" />
        <div className="flex-1 mx-3 rounded-md bg-background/80 border border-border/50 px-3 py-1 text-xs text-muted-foreground text-center">
          aprise.app/dashboard
        </div>
      </div>

      {/* App shell */}
      <div className="flex h-[340px] overflow-hidden">
        {/* Sidebar */}
        <div className="w-[160px] shrink-0 border-r border-border/60 bg-sidebar p-3 flex flex-col gap-1">
          <div className="flex items-center gap-2 px-2 py-1.5 mb-2">
            <div className="w-5 h-5 rounded bg-primary/15 flex items-center justify-center">
              <TrendingUp className="w-3 h-3 text-primary" />
            </div>
            <span className="text-xs font-semibold text-foreground">
              Aprise
            </span>
          </div>
          {[
            { label: "Pipeline", active: true },
            { label: "Applications", active: false },
            { label: "AI Coach", active: false },
            { label: "Calendar", active: false },
          ].map((item) => (
            <div
              key={item.label}
              className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                item.active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </div>
          ))}
        </div>

        {/* Main area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60 bg-background/50">
            <div className="text-xs font-semibold text-foreground">
              Pipeline
            </div>
            <div className="flex items-center gap-2">
              <div className="h-5 w-32 rounded-md bg-muted/70 border border-border/50 px-2 flex items-center">
                <span className="text-[10px] text-muted-foreground">Search…</span>
              </div>
              <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-[9px] font-bold text-accent-foreground">
                MJ
              </div>
            </div>
          </div>

          {/* Kanban preview */}
          <div className="flex gap-3 p-3 overflow-x-auto flex-1">
            {mockColumns.map((col) => (
              <div key={col.title} className="flex flex-col gap-2 min-w-[130px]">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {col.title}
                  </span>
                  <span className="text-[9px] font-medium text-muted-foreground bg-muted/80 rounded-full px-1.5 py-0.5">
                    {col.cards.length}
                  </span>
                </div>
                {col.cards.map((card, ci) => (
                  <div
                    key={ci}
                    className={`p-2.5 rounded-xl border bg-card shadow-sm text-left ${
                      ci === 0 && col.title === "Interview"
                        ? "border-primary/30 ring-1 ring-primary/10"
                        : "border-border/60"
                    }`}
                  >
                    <p className="text-[10px] font-semibold text-foreground mb-0.5 truncate">
                      {card.company}
                    </p>
                    <p className="text-[9px] text-muted-foreground truncate mb-1.5">
                      {card.role}
                    </p>
                    <span
                      className={`inline-block text-[8px] font-semibold px-1.5 py-0.5 rounded-full ${card.statusClass}`}
                    >
                      {card.status}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Data ────────────────────────────────────────────────────────── */
const howItWorks = [
  {
    icon: FileText,
    title: "Add your applications",
    description:
      "Paste a job URL or manually add any role. Aprise organizes everything into a clean visual pipeline.",
  },
  {
    icon: Brain,
    title: "Get stage-aware coaching",
    description:
      "Your AI coach adapts as you move through stages — from tailoring your resume to rehearsing interview answers.",
  },
  {
    icon: TrendingUp,
    title: "Land the offer",
    description:
      "Track progress, stay on top of follow-ups, and walk into every step prepared and confident.",
  },
];

const features = [
  {
    icon: BarChart3,
    title: "Stage-aware AI coaching",
    description:
      "Get contextual advice that changes as your application progresses. Applied? Tailor your cover letter. Interview? Prep with custom questions.",
  },
  {
    icon: Calendar,
    title: "Application timeline",
    description:
      "A clear visual history of every touchpoint — applications sent, responses received, interviews scheduled.",
  },
  {
    icon: Bell,
    title: "Smart reminders",
    description:
      "Never miss a follow-up. Aprise nudges you at the right moments so opportunities don't go cold.",
  },
  {
    icon: MessageSquare,
    title: "Interview prep",
    description:
      "Generate company-specific questions, practice with the AI, and build your talking points before the call.",
  },
  {
    icon: Zap,
    title: "Instant JD analysis",
    description:
      "Paste any job description and Aprise extracts the key requirements, skills, and culture signals instantly.",
  },
  {
    icon: FileText,
    title: "Resume tailoring",
    description:
      "Rewrite your bullets to match each role's language — without starting from scratch every time.",
  },
];

const testimonials = [
  {
    quote:
      "I tracked 40 applications and finally understood which companies I was getting stuck at. Got my offer in 8 weeks.",
    name: "Priya S.",
    role: "Product Manager",
    initials: "PS",
  },
  {
    quote:
      "The AI coaching before my Google loop was exactly what I needed. It asked tougher questions than the actual interviewers.",
    name: "Marcus T.",
    role: "Software Engineer",
    initials: "MT",
  },
  {
    quote:
      "Having everything in one place — the JD, my notes, the timeline — made me feel so much more in control.",
    name: "Leila R.",
    role: "UX Designer",
    initials: "LR",
  },
];

const freeTier = [
  "Up to 10 active applications",
  "Basic kanban pipeline",
  "Application notes & timeline",
  "Email reminders",
];

const proTier = [
  "Unlimited applications",
  "Full AI coaching at every stage",
  "Interview prep & mock questions",
  "Resume & cover letter tailoring",
  "JD analysis & skill mapping",
  "Priority support",
];

const mockColumns = [
  {
    title: "Applied",
    cards: [
      { company: "Stripe", role: "Frontend Eng.", status: "Applied", statusClass: "bg-blue-100 text-blue-700" },
      { company: "Figma", role: "UX Engineer", status: "Applied", statusClass: "bg-blue-100 text-blue-700" },
    ],
  },
  {
    title: "Screening",
    cards: [
      { company: "Linear", role: "Product Design", status: "Phone screen", statusClass: "bg-amber-100 text-amber-700" },
    ],
  },
  {
    title: "Interview",
    cards: [
      { company: "Notion", role: "Sr. Engineer", status: "Loop ×4", statusClass: "bg-violet-100 text-violet-700" },
    ],
  },
  {
    title: "Offer",
    cards: [
      { company: "Vercel", role: "Staff Eng.", status: "Offer 🎉", statusClass: "bg-green-100 text-green-700" },
    ],
  },
];
