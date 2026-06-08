"use client";

import { useState, useEffect, useRef } from "react";
import {
  Brain,
  Building2,
  Clock,
  FileText,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Types ────────────────────────────────────────────────────────── */
type Stage = "Applied" | "Screening" | "Interview" | "Offer" | "Archived";

interface Application {
  id: string;
  company: string;
  role: string;
  date: string;
  stage: Stage;
  logo: string;
  location: string;
  coaching: CoachingMessage[];
}

interface CoachingMessage {
  role: "assistant" | "user";
  content: string;
}

/* ── Sample data ─────────────────────────────────────────────────── */
const sampleApps: Application[] = [
  {
    id: "1",
    company: "Stripe",
    role: "Senior Frontend Engineer",
    date: "Jun 3",
    stage: "Applied",
    logo: "S",
    location: "Remote",
    coaching: [
      {
        role: "assistant",
        content:
          "Your resume shows strong React and TypeScript work — exactly what Stripe looks for. One gap: their JD emphasizes distributed systems and resilience patterns.\n\nI'd recommend adding a bullet about any work you've done around retry logic, graceful degradation, or handling partial failures. Even a side project counts.\n\nWant me to help rewrite your top 3 experience bullets to better match Stripe's language?",
      },
    ],
  },
  {
    id: "2",
    company: "Linear",
    role: "Product Designer",
    date: "May 28",
    stage: "Applied",
    logo: "L",
    location: "San Francisco",
    coaching: [
      {
        role: "assistant",
        content:
          "Linear is notoriously selective about design craft. Their product has an almost obsessive attention to detail — micro-interactions, keyboard shortcuts, performance feel.\n\nFor your portfolio, lead with work that shows systems thinking, not just screens. Specific recommendations: show your design principles, and include at least one case study where you reduced cognitive load.\n\nShould I help you identify which of your current projects speaks most to Linear's values?",
      },
    ],
  },
  {
    id: "3",
    company: "Notion",
    role: "Senior Software Engineer",
    date: "May 20",
    stage: "Screening",
    logo: "N",
    location: "New York",
    coaching: [
      {
        role: "assistant",
        content:
          "You have a phone screen with Notion coming up. Based on their hiring patterns, expect a short intro call with a recruiter (30 min) focused on background and motivation.\n\nKey things to prepare:\n• A crisp \"why Notion\" — mention the editor, the all-in-one philosophy, and something specific about their API.\n• Your most recent impactful project, told as: situation → decision → result.\n• Salary expectations — know your range before they ask.\n\nWant me to run a mock phone screen with you?",
      },
    ],
  },
  {
    id: "4",
    company: "Figma",
    role: "Staff Engineer, Collaboration",
    date: "May 15",
    stage: "Interview",
    logo: "F",
    location: "Remote",
    coaching: [
      {
        role: "assistant",
        content:
          "You're in the loop at Figma — this is serious. The Staff Engineer loop typically includes:\n\n1. Coding round (LeetCode medium-hard, graph/tree)\n2. System design (likely: design a multiplayer editing system with OT/CRDTs)\n3. Cross-functional leadership (tell me about a time you drove a large technical decision)\n4. Hiring manager fit\n\nFor system design, expect something around real-time collaboration. Figma cares about: conflict resolution, local-first UX, and performance at scale. I can walk you through the canonical CRDT design — want to prep now?",
      },
    ],
  },
  {
    id: "5",
    company: "Vercel",
    role: "Staff Engineer, DX",
    date: "May 10",
    stage: "Offer",
    logo: "V",
    location: "Remote",
    coaching: [
      {
        role: "assistant",
        content:
          "🎉 Offer received! Before you decide, let's talk negotiation.\n\nBased on market data for Staff-level DX roles at late-stage startups:\n• Base: you likely have room for +8–12%\n• Equity: ask about refresh schedule and acceleration clauses\n• Sign-on: if there's a cliff, request a sign-on to bridge the gap\n\nVercel is growing fast — the equity could be meaningful. Don't leave it on the table.\n\nWant me to draft a negotiation email that's confident but not aggressive?",
      },
    ],
  },
  {
    id: "6",
    company: "Airbnb",
    role: "Frontend Engineer II",
    date: "Apr 30",
    stage: "Archived",
    logo: "A",
    location: "San Francisco",
    coaching: [
      {
        role: "assistant",
        content:
          "This one was archived after the final round. Airbnb's feedback indicated strong technical skills but the team wasn't fully aligned on scope match.\n\nKey takeaway: for next time, probe the leveling criteria earlier in the process — it saves everyone time. You can ask 'How would you define success in the first 6 months?' in the recruiter call to get a sense of expectations.\n\nThis doesn't reflect your skills — it reflects a fit mismatch. The Vercel offer is a great next step.",
      },
    ],
  },
];

const columns: Stage[] = ["Applied", "Screening", "Interview", "Offer", "Archived"];

const stageColors: Record<Stage, string> = {
  Applied: "bg-blue-100 text-blue-700 border-blue-200",
  Screening: "bg-amber-100 text-amber-700 border-amber-200",
  Interview: "bg-violet-100 text-violet-700 border-violet-200",
  Offer: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Archived: "bg-gray-100 text-gray-500 border-gray-200",
};

const stageDot: Record<Stage, string> = {
  Applied: "bg-blue-500",
  Screening: "bg-amber-500",
  Interview: "bg-violet-500",
  Offer: "bg-emerald-500",
  Archived: "bg-gray-400",
};

/* ── Main component ──────────────────────────────────────────────── */
export default function ApplicationsPage() {
  const [selectedApp, setSelectedApp] = useState<Application | null>(
    sampleApps[3]
  );

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Kanban board */}
      <div className="flex-1 overflow-auto p-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1
              className="text-xl font-semibold text-foreground leading-tight"
              style={{ fontFamily: "var(--font-instrument-serif)" }}
            >
              Pipeline
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {sampleApps.filter((a) => a.stage !== "Archived").length} active applications
            </p>
          </div>
          <button className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground btn-primary-glow hover:bg-primary/90 transition-all duration-200 shadow-sm">
            <Plus className="w-3.5 h-3.5" />
            Add application
          </button>
        </div>

        {/* Board */}
        <div className="flex gap-4 min-w-max pb-4">
          {columns.map((stage) => (
            <KanbanColumn
              key={stage}
              stage={stage}
              apps={sampleApps.filter((a) => a.stage === stage)}
              selectedId={selectedApp?.id}
              onSelect={setSelectedApp}
            />
          ))}
        </div>
      </div>

      {/* Coaching panel */}
      {selectedApp && (
        <CoachingPanel
          app={selectedApp}
          onClose={() => setSelectedApp(null)}
        />
      )}
    </div>
  );
}

/* ── Kanban column ───────────────────────────────────────────────── */
function KanbanColumn({
  stage,
  apps,
  selectedId,
  onSelect,
}: {
  stage: Stage;
  apps: Application[];
  selectedId?: string;
  onSelect: (app: Application) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5 w-[220px]">
      <div className="flex items-center gap-2 mb-1">
        <span className={cn("w-2 h-2 rounded-full", stageDot[stage])} />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {stage}
        </span>
        <span className="ml-auto text-[10px] font-semibold bg-muted/80 text-muted-foreground rounded-full px-1.5 py-0.5">
          {apps.length}
        </span>
      </div>

      {/* Drop zone (visual) */}
      <div className="flex flex-col gap-2.5 min-h-[120px]">
        {apps.map((app) => (
          <AppCard
            key={app.id}
            app={app}
            selected={app.id === selectedId}
            onSelect={onSelect}
          />
        ))}

        {apps.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 p-6 text-center gap-1.5">
            <span className="text-[10px] text-muted-foreground/60 font-medium">
              No applications
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Application card ────────────────────────────────────────────── */
function AppCard({
  app,
  selected,
  onSelect,
}: {
  app: Application;
  selected: boolean;
  onSelect: (app: Application) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(app)}
      onKeyDown={(e) => e.key === "Enter" && onSelect(app)}
      className={cn(
        "group relative flex flex-col gap-3 p-3.5 rounded-xl border text-left transition-all duration-200 w-full cursor-pointer",
        selected
          ? "border-primary/40 bg-accent/60 ring-2 ring-primary/20 shadow-sm"
          : "border-border/60 bg-card hover:border-primary/25 hover:shadow-md hover:bg-card"
      )}
    >
      {/* Company + menu */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
            {app.logo}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">
              {app.company}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">
              {app.location}
            </p>
          </div>
        </div>
        <button
          onClick={(e) => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-150"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Role */}
      <p className="text-[11px] font-medium text-foreground leading-snug">
        {app.role}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "text-[9px] font-semibold px-2 py-0.5 rounded-full border",
            stageColors[app.stage]
          )}
        >
          {app.stage}
        </span>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="w-3 h-3" />
          {app.date}
        </div>
      </div>

      {/* Coach button */}
      <div
        className={cn(
          "flex items-center gap-1 pt-2 border-t transition-all duration-150",
          selected ? "border-primary/20" : "border-border/50"
        )}
      >
        <Sparkles
          className={cn(
            "w-3 h-3",
            selected ? "text-primary" : "text-muted-foreground/60"
          )}
        />
        <span
          className={cn(
            "text-[10px] font-medium",
            selected ? "text-primary" : "text-muted-foreground/60 group-hover:text-muted-foreground"
          )}
        >
          {selected ? "Coach active" : "View coaching"}
        </span>
      </div>
    </div>
  );
}

/* ── AI Coaching panel ───────────────────────────────────────────── */
function CoachingPanel({
  app,
  onClose,
}: {
  app: Application;
  onClose: () => void;
}) {
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [doneTyping, setDoneTyping] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fullText = app.coaching[0]?.content ?? "";

  useEffect(() => {
    // Reset the typing animation whenever the selected app changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDisplayedText("");
    setDoneTyping(false);
    setIsTyping(false);

    const delay = setTimeout(() => {
      setIsTyping(true);
      let i = 0;

      const tick = () => {
        i++;
        setDisplayedText(fullText.slice(0, i));
        if (i < fullText.length) {
          const charDelay = fullText[i - 1] === "\n" ? 60 : 12;
          timerRef.current = setTimeout(tick, charDelay);
        } else {
          setIsTyping(false);
          setDoneTyping(true);
        }
      };

      timerRef.current = setTimeout(tick, 0);
    }, 600);

    return () => {
      clearTimeout(delay);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [app.id, fullText]);

  return (
    <aside className="w-[320px] shrink-0 border-l border-border/60 bg-sidebar flex flex-col overflow-hidden animate-slide-in-right">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center ring-1 ring-primary/15">
            <Brain className="w-4 h-4 text-accent-foreground" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">AI Coach</p>
            <p className="text-[10px] text-muted-foreground">
              {app.company} · {app.stage}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-150"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* App summary */}
      <div className="mx-3 mt-3 p-3 rounded-xl border border-border/60 bg-card/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
            {app.logo}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">{app.company}</p>
            <p className="text-xs text-muted-foreground truncate">{app.role}</p>
          </div>
          <span
            className={cn(
              "shrink-0 text-[9px] font-semibold px-2 py-0.5 rounded-full border",
              stageColors[app.stage]
            )}
          >
            {app.stage}
          </span>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {/* Typing indicator or message */}
        <div className="flex items-start gap-2">
          <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center ring-1 ring-primary/15 shrink-0 mt-0.5">
            <Sparkles className="w-3 h-3 text-accent-foreground" />
          </div>
          <div className="flex-1">
            {!isTyping && displayedText === "" ? (
              /* Initial typing indicator */
              <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card border border-border/60 shadow-sm">
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-muted-foreground/60" />
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-muted-foreground/60" />
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-muted-foreground/60" />
              </div>
            ) : (
              <div className="px-3 py-2.5 rounded-xl bg-card border border-border/60 shadow-sm">
                <p className="text-xs text-foreground leading-relaxed whitespace-pre-line">
                  {displayedText}
                  {isTyping && (
                    <span className="inline-block w-0.5 h-3 bg-primary ml-0.5 animate-pulse" />
                  )}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Post-message actions */}
        {doneTyping && (
          <div className="flex flex-wrap gap-2 pl-8 animate-fade-in">
            {stageActions[app.stage]?.map((action) => (
              <button
                key={action}
                className="text-[10px] font-medium px-2.5 py-1.5 rounded-lg border border-primary/20 bg-accent/60 text-accent-foreground hover:bg-accent hover:border-primary/30 transition-all duration-150"
              >
                {action}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="p-3 border-t border-border/60">
        <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 focus-within:ring-2 focus-within:ring-primary/25 focus-within:border-primary/30 transition-all duration-200">
          <input
            type="text"
            placeholder="Ask your coach…"
            className="flex-1 text-xs text-foreground placeholder:text-muted-foreground/50 bg-transparent focus:outline-none"
          />
          <button className="w-6 h-6 rounded-lg bg-primary flex items-center justify-center shrink-0 hover:bg-primary/90 transition-all duration-150">
            <ArrowUpIcon className="w-3 h-3 text-primary-foreground" />
          </button>
        </div>
        <p className="text-[9px] text-muted-foreground/50 text-center mt-2">
          AI coaching based on your stage and role
        </p>
      </div>

      {/* Quick actions */}
      <div className="px-3 pb-3 grid grid-cols-3 gap-2">
        {[
          { icon: FileText, label: "Tailor CV" },
          { icon: MessageSquare, label: "Mock interview" },
          { icon: Building2, label: "Research co." },
        ].map((action) => (
          <button
            key={action.label}
            className="group flex flex-col items-center gap-1.5 p-2.5 rounded-xl border border-border/50 bg-card/60 hover:bg-card hover:border-primary/20 hover:shadow-sm transition-all duration-200"
          >
            <action.icon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors duration-200" />
            <span className="text-[9px] font-medium text-muted-foreground group-hover:text-foreground transition-colors duration-200 text-center leading-tight">
              {action.label}
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}

/* ── Inline icon ─────────────────────────────────────────────────── */
function ArrowUpIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

/* ── Stage-specific quick actions ───────────────────────────────── */
const stageActions: Partial<Record<Stage, string[]>> = {
  Applied: ["Tailor resume", "Write cover letter", "Research company"],
  Screening: ["Prep phone screen", "Salary research", "Mock intro call"],
  Interview: ["System design prep", "Behavioral questions", "Company deep dive"],
  Offer: ["Negotiate offer", "Draft email", "Compare offers"],
  Archived: ["Extract learnings", "Similar companies"],
};
