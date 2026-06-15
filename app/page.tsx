import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  ChevronRight,
  FileText,
  MessageSquare,
  Sparkles,
  TrendingUp,
  Tag,
  BookOpen,
  Star,
  Layers,
  Target,
  RotateCcw,
  User,
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
              <Brain className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Aprise</span>
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
            Your career assistant — built on your story
          </div>

          {/* Headline */}
          <h1
            className="animate-fade-up text-5xl sm:text-6xl lg:text-7xl leading-[1.08] tracking-tight"
            style={{ animationDelay: "80ms" }}
          >
            You apply.{" "}
            <span className="italic text-primary">You rise.</span>
            <br />
            <span className="text-foreground/90">You aprise.</span>
          </h1>

          {/* Subheadline */}
          <p
            className="animate-fade-up text-lg sm:text-xl text-muted-foreground max-w-2xl leading-relaxed"
            style={{ animationDelay: "160ms" }}
          >
            Aprise builds a living memory of your professional story — your experience,
            strengths, and goals — then uses it to craft personalized resumes, cover letters,
            and interview prep for every role you pursue.
          </p>

          {/* CTAs */}
          <div
            className="animate-fade-up flex flex-col sm:flex-row gap-3 mt-2"
            style={{ animationDelay: "240ms" }}
          >
            <Link href={userId ? "/app" : "/sign-up"}>
              <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground btn-primary-glow hover:bg-primary/90 transition-all duration-200">
                Meet your career assistant
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

          {/* Assistant mockup */}
          <div
            className="animate-scale-in mt-8 w-full max-w-4xl"
            style={{ animationDelay: "480ms" }}
          >
            <AssistantMockup />
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
            <h2 className="text-3xl sm:text-4xl leading-snug">
              From your story to their offer —<br />
              <span className="italic text-muted-foreground font-normal">
                every application, truly personalized.
              </span>
            </h2>
          </div>

          <div className="relative grid sm:grid-cols-3 gap-6">
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
            <h2 className="text-3xl sm:text-4xl leading-snug">
              A career assistant that actually knows you
            </h2>
            <p className="mt-4 text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">
              Not another template generator. Aprise remembers your professional story
              and uses it — intelligently — across every step of your job search.
            </p>
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
                  <h3 className="font-semibold text-foreground mb-1.5">{f.title}</h3>
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
            <h2 className="text-3xl sm:text-4xl">
              Real stories. Real results.
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
                    <Star key={j} className="w-3.5 h-3.5 fill-primary/80 text-primary/80" />
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
                    <p className="text-xs font-semibold text-foreground">{t.name}</p>
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
              {["Google", "Meta", "Apple", "Stripe", "Airbnb", "Linear"].map((co) => (
                <span
                  key={co}
                  className="text-sm font-semibold text-foreground tracking-tight"
                >
                  {co}
                </span>
              ))}
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
            <h2 className="text-3xl sm:text-4xl leading-snug">
              Simple, honest pricing
            </h2>
            <p className="mt-4 text-muted-foreground text-sm max-w-sm mx-auto">
              Start building your career memory for free. Unlock the full assistant when you're ready.
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
                  <span className="text-4xl font-bold">$0</span>
                  <span className="text-sm text-muted-foreground mb-1">/ month</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Build your foundation.
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
                  <span className="text-4xl font-bold">$12</span>
                  <span className="text-sm text-muted-foreground mb-1">/ month</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  The full career assistant.
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
            <Brain className="w-6 h-6" />
          </div>
          <h2 className="text-3xl sm:text-4xl">
            Your story deserves better than a template.
          </h2>
          <p className="text-muted-foreground text-sm max-w-md leading-relaxed">
            Stop writing generic resumes. Start applying with a career assistant
            that remembers who you are, understands what each role needs,
            and helps you show up as your best self — every time.
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
              <Brain className="w-3 h-3 text-primary" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Aprise</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Aprise · Your career, truly understood.
          </p>
          <div className="flex items-center gap-5 text-xs text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
            <a href="#" className="hover:text-foreground transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </main>
  );
}

/* ── Career assistant mockup ────────────────────────────────────── */
function AssistantMockup() {
  return (
    <div className="relative mx-auto w-full max-w-3xl rounded-2xl border border-border/60 bg-card shadow-2xl shadow-primary/8 overflow-hidden ring-1 ring-foreground/5">
      {/* Window chrome */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 bg-muted/30">
        <div className="w-3 h-3 rounded-full bg-red-400/70" />
        <div className="w-3 h-3 rounded-full bg-amber-400/70" />
        <div className="w-3 h-3 rounded-full bg-green-400/70" />
        <div className="flex-1 mx-3 rounded-md bg-background/80 border border-border/50 px-3 py-1 text-xs text-muted-foreground text-center">
          aprise.app
        </div>
      </div>

      {/* App shell */}
      <div className="flex h-[360px] overflow-hidden">
        {/* Sidebar */}
        <div className="w-[160px] shrink-0 border-r border-border/60 bg-sidebar p-3 flex flex-col gap-1">
          <div className="flex items-center gap-2 px-2 py-1.5 mb-2">
            <div className="w-5 h-5 rounded bg-primary/15 flex items-center justify-center">
              <Brain className="w-3 h-3 text-primary" />
            </div>
            <span className="text-xs font-semibold text-foreground">Aprise</span>
          </div>
          {[
            { label: "Assistant", active: true },
            { label: "My Memory", active: false },
            { label: "Applications", active: false },
            { label: "Interview Prep", active: false },
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

          {/* JD tags in sidebar */}
          <div className="mt-auto pt-3 border-t border-border/60">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-2 mb-1.5">
              Recent roles
            </p>
            {[
              { label: "AI · Product", color: "bg-violet-100 text-violet-700" },
              { label: "AI · Infra", color: "bg-blue-100 text-blue-700" },
            ].map((tag) => (
              <div
                key={tag.label}
                className={`mx-1 mb-1 px-2 py-0.5 rounded-full text-[8px] font-semibold ${tag.color}`}
              >
                {tag.label}
              </div>
            ))}
          </div>
        </div>

        {/* Main area — chat + memory panel */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60 bg-background/50">
            <div className="flex items-center gap-2">
              <div className="text-xs font-semibold text-foreground">
                AI Engineer @ Cohere
              </div>
              <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">
                AI · Product
              </span>
            </div>
            <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-[9px] font-bold text-accent-foreground">
              MJ
            </div>
          </div>

          {/* Chat messages */}
          <div className="flex-1 overflow-hidden flex flex-col gap-2.5 p-3">
            {/* Memory context pill */}
            <div className="flex items-center gap-1.5 self-start">
              <div className="flex items-center gap-1 rounded-full bg-primary/8 border border-primary/15 px-2.5 py-1 text-[9px] font-medium text-primary/80">
                <BookOpen className="w-2.5 h-2.5" />
                Using 4 memory cards · 2 similar past roles
              </div>
            </div>

            {/* Assistant message */}
            <div className="flex gap-2 items-start">
              <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                <Brain className="w-3 h-3 text-primary" />
              </div>
              <div className="bg-muted/60 rounded-xl rounded-tl-sm px-3 py-2 text-[10px] text-foreground leading-relaxed max-w-[80%]">
                I&apos;ve reviewed the Cohere JD. This role is product-focused AI engineering — similar to your work at{" "}
                <span className="font-semibold text-primary">Layer</span>, where you shipped the AI-driven document
                summarizer. Here&apos;s a tailored bullet for your resume:
              </div>
            </div>

            {/* Tailored resume bullet */}
            <div className="ml-7 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-[10px] text-foreground leading-relaxed">
              <span className="text-[8px] font-semibold uppercase tracking-wider text-primary/60 block mb-1">
                Suggested resume bullet
              </span>
              Led end-to-end development of an AI document intelligence feature, reducing analyst review time by 40%
              through custom LLM pipelines and a user-facing React interface — shipped to 200+ enterprise customers.
            </div>

            {/* User message */}
            <div className="flex gap-2 items-start flex-row-reverse">
              <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center shrink-0 mt-0.5 text-[8px] font-bold">
                MJ
              </div>
              <div className="bg-primary/10 rounded-xl rounded-tr-sm px-3 py-2 text-[10px] text-foreground max-w-[80%]">
                Can you also draft my cover letter for this one?
              </div>
            </div>
          </div>

          {/* Input bar */}
          <div className="border-t border-border/60 px-3 py-2 bg-background/50">
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 border border-border/60 px-3 py-1.5">
              <span className="text-[10px] text-muted-foreground flex-1">Ask anything about this role…</span>
              <div className="w-4 h-4 rounded bg-primary/15 flex items-center justify-center">
                <ArrowRight className="w-2.5 h-2.5 text-primary" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Data ────────────────────────────────────────────────────────── */
const howItWorks = [
  {
    icon: BookOpen,
    title: "Build your professional memory",
    description:
      "Tell Aprise your story — past roles, projects, strengths, and goals. It builds a living memory that grows with every conversation and application.",
  },
  {
    icon: FileText,
    title: "Paste a JD, get a personalized application",
    description:
      "Drop in any job description. Aprise reads the role deeply, tags it intelligently, and drafts a tailored resume and cover letter drawn from your real story — not a template.",
  },
  {
    icon: Target,
    title: "Track, prep, and get smarter over time",
    description:
      "Manage your applications, prep for every interview stage, and let Aprise learn what kinds of roles fit you best — so each new application gets even sharper.",
  },
];

const features = [
  {
    icon: Brain,
    title: "Living professional memory",
    description:
      "Aprise remembers your experience, achievements, and goals across every session. No re-explaining yourself. Your story compounds over time.",
  },
  {
    icon: FileText,
    title: "Personalized resumes & cover letters",
    description:
      "Every document is crafted from your actual experience, matched to the specific language and priorities of the job description — not filled from a blank template.",
  },
  {
    icon: Tag,
    title: "Smart JD tagging & retrieval",
    description:
      "Aprise categorizes each role intelligently — product, infra, agentic, research, and more. When a similar JD comes up, it surfaces relevant past applications and what worked.",
  },
  {
    icon: MessageSquare,
    title: "Interview prep that knows your story",
    description:
      "Practice screening, technical, and behavioral interviews with an AI that draws on your actual experience to coach you through the specific questions you're likely to face.",
  },
  {
    icon: Layers,
    title: "Application tracking with context",
    description:
      "Track every role with full context — the JD, your tailored resume, notes, timeline, and interview stages — all linked together so nothing gets lost.",
  },
  {
    icon: RotateCcw,
    title: "Learns what works for you",
    description:
      "Over time, Aprise identifies patterns: which role types suit you, which applications advance, and how to position your experience more effectively in future applications.",
  },
];

const testimonials = [
  {
    quote:
      "I used to spend hours rewriting my resume for each role. Aprise does it in minutes — and the result actually sounds like me, not a generic bullet list.",
    name: "Priya S.",
    role: "Product Manager",
    initials: "PS",
  },
  {
    quote:
      "The memory feature is what sets it apart. It remembered my side project from three months earlier and used it perfectly in a resume bullet I hadn't even thought of.",
    name: "Marcus T.",
    role: "Software Engineer",
    initials: "MT",
  },
  {
    quote:
      "The interview prep was shockingly specific. It already knew what I'd built and coached me on exactly how to talk about it for the role I was targeting.",
    name: "Leila R.",
    role: "ML Engineer",
    initials: "LR",
  },
];

const freeTier = [
  "Professional memory (up to 20 entries)",
  "Tailored resume & cover letter for 3 roles",
  "Basic JD tagging and analysis",
  "Application tracking (up to 10 roles)",
];

const proTier = [
  "Unlimited professional memory",
  "Unlimited personalized resumes & cover letters",
  "Smart JD tagging, categorization & retrieval",
  "Full interview prep — screening, technical, behavioral",
  "Application timeline with full context",
  "Pattern insights across your job search",
  "Priority support",
];
