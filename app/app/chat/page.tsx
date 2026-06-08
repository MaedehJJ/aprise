"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Briefcase,
  Building2,
  Plus,
  Search,
  Send,
  Sparkles,
  FileText,
  ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Types ────────────────────────────────────────────────────────── */
interface ChatMessage {
  role: "assistant" | "user";
  content: string;
}

interface Thread {
  id: string;
  company: string;
  role: string;
  logo: string;
  lastActive: string;
  step: string;
  messages: ChatMessage[];
}

/* ── Sample threads (frontend-only until chat endpoints exist) ──────── */
const sampleThreads: Thread[] = [
  {
    id: "t1",
    company: "Stripe",
    role: "Senior Frontend Engineer",
    logo: "S",
    lastActive: "2h ago",
    step: "Gap analysis",
    messages: [
      {
        role: "assistant",
        content:
          "I've read through the Stripe JD. Their focus on distributed systems and resilience patterns stands out — and it's a thinner area in your current resume.\n\nLet's close that gap together. Have you worked on anything involving retries, graceful degradation, or handling partial failures — even in a side project?",
      },
      {
        role: "user",
        content:
          "Yeah, at my last job I built a webhook delivery system that retried failed deliveries with exponential backoff and dead-letter queues.",
      },
      {
        role: "assistant",
        content:
          "That's exactly the kind of story Stripe wants to hear. Let's shape it into a resume bullet:\n\n\"Designed a webhook delivery pipeline with exponential backoff and dead-letter queues, reducing failed-delivery loss by [X]% — directly addressing reliability-at-scale concerns.\"\n\nDo you remember a rough number for that improvement? Even an estimate works — it makes the bullet land harder.",
      },
    ],
  },
  {
    id: "t2",
    company: "Linear",
    role: "Product Designer",
    logo: "L",
    lastActive: "Yesterday",
    step: "JD parsing",
    messages: [
      {
        role: "assistant",
        content:
          "Linear's JD leans heavily on craft and systems thinking rather than breadth. I've pulled out the core requirements — want to walk through which of your projects map best to their values before we touch the resume?",
      },
    ],
  },
  {
    id: "t3",
    company: "Notion",
    role: "Senior Software Engineer",
    logo: "N",
    lastActive: "3 days ago",
    step: "Resume ready",
    messages: [
      {
        role: "assistant",
        content:
          "Your tailored resume for Notion is ready to review. I leaned into your collaborative-tooling experience and reframed your platform work around their \"all-in-one\" philosophy. Want me to walk you through the changes?",
      },
    ],
  },
];

const stepBadgeStyles: Record<string, string> = {
  "JD parsing": "bg-blue-100 text-blue-700 border-blue-200",
  "Gap analysis": "bg-amber-100 text-amber-700 border-amber-200",
  "Resume ready": "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const welcomeThread: Thread = {
  id: "welcome",
  company: "Your first move",
  role: "Paste a job description to get started",
  logo: "✦",
  lastActive: "Just now",
  step: "JD parsing",
  messages: [
    {
      role: "assistant",
      content:
        "Welcome to Aprise! I've gone through what you shared during onboarding, and your memory is building up nicely.\n\nWhenever you're ready, paste a job description below and I'll break it down — what they're really asking for, where your experience already lines up, and where we should focus to close the gaps. Let's get your first tailored resume going.",
    },
  ],
};

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const startFresh = searchParams.get("new") === "1";

  const [threads, setThreads] = useState<Thread[]>(() =>
    startFresh ? [welcomeThread, ...sampleThreads] : sampleThreads
  );
  const [activeId, setActiveId] = useState<string | null>(() =>
    startFresh ? "welcome" : sampleThreads[0]?.id ?? null
  );
  const [composerValue, setComposerValue] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeId) ?? null,
    [threads, activeId]
  );

  // Coming from onboarding: drop the `?new=1` marker once we've consumed it,
  // so refreshing the page doesn't re-trigger the welcome-thread setup.
  useEffect(() => {
    if (startFresh) router.replace("/app/chat");
  }, [startFresh, router]);

  const handleSend = () => {
    if (!composerValue.trim() || !activeThread) return;

    const userMessage: ChatMessage = { role: "user", content: composerValue.trim() };
    setThreads((prev) =>
      prev.map((t) =>
        t.id === activeThread.id ? { ...t, messages: [...t.messages, userMessage] } : t
      )
    );
    setComposerValue("");
  };

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Thread list */}
      <div className="w-[280px] shrink-0 border-r border-border/60 flex flex-col overflow-hidden">
        <div className="p-3 border-b border-border/50 flex flex-col gap-2.5">
          <button
            onClick={() => setShowNewChat(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground btn-primary-glow hover:bg-primary/90 transition-all duration-200 w-full"
          >
            <Plus className="w-3.5 h-3.5" />
            New conversation
          </button>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
            <input
              type="text"
              placeholder="Search conversations…"
              className="w-full rounded-lg border border-border/60 bg-muted/30 pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/30 transition-all duration-200"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
          {threads.map((thread) => (
            <button
              key={thread.id}
              onClick={() => {
                setActiveId(thread.id);
                setShowNewChat(false);
              }}
              className={cn(
                "group flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all duration-200 w-full",
                activeId === thread.id && !showNewChat
                  ? "border-primary/40 bg-accent/60 ring-2 ring-primary/15 shadow-sm"
                  : "border-transparent hover:border-border/60 hover:bg-muted/40"
              )}
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                {thread.logo}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-foreground truncate">{thread.company}</p>
                  <span className="text-[9px] text-muted-foreground shrink-0">{thread.lastActive}</span>
                </div>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">{thread.role}</p>
                <span
                  className={cn(
                    "inline-block mt-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border",
                    stepBadgeStyles[thread.step] ?? "bg-muted text-muted-foreground border-border"
                  )}
                >
                  {thread.step}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Active conversation / new-chat composer */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {showNewChat ? (
          <NewConversationPanel
            onCancel={() => setShowNewChat(false)}
            onCreate={(jd) => {
              const id = `t${Date.now()}`;
              const thread: Thread = {
                id,
                company: jd.company || "New conversation",
                role: jd.role || "Pasted job description",
                logo: (jd.company || "?").slice(0, 1).toUpperCase(),
                lastActive: "Just now",
                step: "JD parsing",
                messages: [
                  {
                    role: "assistant",
                    content:
                      "Got it — I'm reading through this job description now. Give me a moment to pull out the core requirements, then I'll show you where your experience already lines up and where we should focus.",
                  },
                ],
              };
              setThreads((prev) => [thread, ...prev]);
              setActiveId(id);
              setShowNewChat(false);
            }}
          />
        ) : activeThread ? (
          <ConversationView
            thread={activeThread}
            composerValue={composerValue}
            onComposerChange={setComposerValue}
            onSend={handleSend}
          />
        ) : (
          <EmptyState onNewChat={() => setShowNewChat(true)} />
        )}
      </div>
    </div>
  );
}

/* ── Empty state ─────────────────────────────────────────────────── */
function EmptyState({ onNewChat }: { onNewChat: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
      <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center ring-1 ring-primary/15 shadow-sm">
        <Sparkles className="w-7 h-7 text-accent-foreground" />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold text-foreground">Pick a conversation, or start a new one</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Each conversation is anchored to a job description — your coach uses it to tailor advice,
          spot gaps, and help you build a resume that fits.
        </p>
      </div>
      <button
        onClick={onNewChat}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground btn-primary-glow hover:bg-primary/90 transition-all duration-200"
      >
        <Plus className="w-4 h-4" />
        New conversation
      </button>
    </div>
  );
}

/* ── New conversation (paste JD) panel ───────────────────────────── */
function NewConversationPanel({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (jd: { company: string; role: string; text: string }) => void;
}) {
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [text, setText] = useState("");

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-xl mx-auto flex flex-col gap-6">
        <div className="space-y-1.5">
          <h2
            className="text-2xl"
            style={{ fontFamily: "var(--font-instrument-serif)" }}
          >
            Start a new conversation
          </h2>
          <p className="text-sm text-muted-foreground">
            Paste the job description you&apos;re targeting — your coach will parse it, compare it
            against your memory, and guide you toward a tailored resume.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Building2 className="w-3 h-3" /> Company
            </label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. Stripe"
              className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all duration-200"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Briefcase className="w-3 h-3" /> Role title
            </label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Senior Frontend Engineer"
              className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all duration-200"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <FileText className="w-3 h-3" /> Job description
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the full job description here…"
            rows={10}
            className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all duration-200 resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2.5">
          <button
            onClick={onCancel}
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-200"
          >
            Cancel
          </button>
          <button
            onClick={() => onCreate({ company, role, text })}
            disabled={!text.trim()}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200",
              text.trim()
                ? "bg-primary text-primary-foreground btn-primary-glow hover:bg-primary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
            )}
          >
            <Sparkles className="w-4 h-4" />
            Start coaching
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Active conversation view ────────────────────────────────────── */
function ConversationView({
  thread,
  composerValue,
  onComposerChange,
  onSend,
}: {
  thread: Thread;
  composerValue: string;
  onComposerChange: (v: string) => void;
  onSend: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [thread.messages.length, thread.id]);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Thread header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/60 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
            {thread.logo}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{thread.company}</p>
            <p className="text-xs text-muted-foreground">{thread.role}</p>
          </div>
        </div>
        <span
          className={cn(
            "text-[10px] font-semibold px-2.5 py-1 rounded-full border inline-flex items-center gap-1.5",
            stepBadgeStyles[thread.step] ?? "bg-muted text-muted-foreground border-border"
          )}
        >
          <ListChecks className="w-3 h-3" />
          {thread.step}
        </span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">
        {thread.messages.map((message, i) => (
          <MessageBubble key={i} message={message} />
        ))}
      </div>

      {/* Composer */}
      <div className="p-4 border-t border-border/60 shrink-0">
        <div className="max-w-3xl mx-auto flex items-end gap-2 rounded-2xl border border-border/60 bg-card px-3 py-2.5 focus-within:ring-2 focus-within:ring-primary/25 focus-within:border-primary/30 transition-all duration-200">
          <textarea
            value={composerValue}
            onChange={(e) => onComposerChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder="Reply to your coach…"
            rows={1}
            className="flex-1 text-sm text-foreground placeholder:text-muted-foreground/50 bg-transparent focus:outline-none resize-none max-h-32 py-1"
          />
          <button
            onClick={onSend}
            disabled={!composerValue.trim()}
            className={cn(
              "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all duration-150",
              composerValue.trim()
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground/50 text-center mt-2">
          Coaching responses are tailored using your memory and this job&apos;s requirements
        </p>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isAssistant = message.role === "assistant";

  return (
    <div className={cn("flex items-start gap-2.5 max-w-3xl", !isAssistant && "self-end flex-row-reverse")}>
      {isAssistant ? (
        <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center ring-1 ring-primary/15 shrink-0 mt-0.5">
          <Sparkles className="w-3.5 h-3.5 text-accent-foreground" />
        </div>
      ) : (
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0 mt-0.5">
          You
        </div>
      )}
      <div
        className={cn(
          "px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-line shadow-sm border",
          isAssistant
            ? "bg-card border-border/60 text-foreground rounded-tl-md"
            : "bg-primary text-primary-foreground border-primary/20 rounded-tr-md"
        )}
      >
        {message.content}
      </div>
    </div>
  );
}
