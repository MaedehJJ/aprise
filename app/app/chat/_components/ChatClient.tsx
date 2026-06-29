"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  BookOpen,
  Brain,
  Briefcase,
  Building2,
  Check,
  ChevronDown,
  ClipboardCopy,
  Download,
  FileText,
  ListChecks,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  Plus,
  Search,
  Send,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ApiError,
  ATSScore,
  ChunkType,
  CoverLetter,
  ConversationDetail,
  ConversationListItem,
  ConversationMessage,
  ConversationStep,
  FitScore,
  MemoryUpdate,
  Resume,
  createApplication,
  createConversation,
  createJD,
  generateCoverLetter,
  generateResume,
  getATSScore,
  getConversation,
  getFitScore,
  listConversations,
  listCoverLetters,
  listResumes,
  startInterviewPrep,
  streamMessage,
} from "@/lib/api";

/* ── System update cards (memory, STAR, resume ready) ─────────────── */
type SystemUpdate = {
  id: string;
  kind: "memory" | "star" | "resume_ready" | "application";
  title: string;
  body?: string;
  href?: string;
  hrefLabel?: string;
};

function chunkTypeLabel(chunkType: ChunkType): string {
  const labels: Record<ChunkType, string> = {
    EXPERIENCE: "Experience",
    EDUCATION: "Education",
    SKILLS_SUMMARY: "Skills",
    PROJECTS: "Project",
    LANGUAGES: "Language",
    OTHER: "Memory",
    WAR_STORY: "War story",
    PREFERENCE: "Preference",
  };
  return labels[chunkType] ?? "Memory";
}

function memoryUpdatesToSystemUpdates(updates: MemoryUpdate[]): SystemUpdate[] {
  return updates.map((update, i) => ({
    id: `mem-${Date.now()}-${i}`,
    kind: "memory" as const,
    title: `${chunkTypeLabel(update.chunk_type)} saved to Memory Bank`,
    body: update.content,
    href: "/app/files",
    hrefLabel: "View in Files",
  }));
}

/* Web Speech API (Chrome / Safari) — not in all TS lib configs */
type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { resultIndex: number; results: SpeechRecognitionResultList }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type BrowserSpeechRecognitionCtor = new () => BrowserSpeechRecognition;

function getSpeechRecognitionCtor(): BrowserSpeechRecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as Window & {
    SpeechRecognition?: BrowserSpeechRecognitionCtor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/* ── Step badge metadata ──────────────────────────────────────────── */
const stepBadgeMeta: Record<ConversationStep, { label: string; className: string }> = {
  jd_parsing: {
    label: "Parsing JD",
    className: "bg-blue-100 text-blue-700 border-blue-200",
  },
  gap_detection: {
    label: "Detecting gaps",
    className: "bg-blue-100 text-blue-700 border-blue-200",
  },
  gap_conversation: {
    label: "Coaching",
    className: "bg-amber-100 text-amber-700 border-amber-200",
  },
  resume_generation: {
    label: "Resume ready",
    className: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  interview_prep: {
    label: "Interview prep",
    className: "bg-violet-100 text-violet-700 border-violet-200",
  },
  done: {
    label: "Done",
    className: "bg-muted text-muted-foreground border-border",
  },
};

function logoLetter(item: Pick<ConversationListItem["jd"], "company_name">) {
  return (item.company_name || "?").slice(0, 1).toUpperCase();
}

/* ── Page ─────────────────────────────────────────────────────────── */
export default function ChatClient({
  initialThreads,
}: {
  initialThreads?: ConversationListItem[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getToken } = useAuth();

  const [threads, setThreads] = useState<ConversationListItem[]>(initialThreads ?? []);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeDetail, setActiveDetail] = useState<ConversationDetail | null>(null);
  const [loadingThreads, setLoadingThreads] = useState(initialThreads === undefined);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [threadsError, setThreadsError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [composerValue, setComposerValue] = useState("");
  const [sending, setSending] = useState(false);
  const [thinkingPhase, setThinkingPhase] = useState<string>("");
  const [systemUpdates, setSystemUpdates] = useState<SystemUpdate[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const loadThreads = useCallback(async () => {
    setLoadingThreads(true);
    setThreadsError(null);
    try {
      const data = await listConversations(getToken);
      setThreads(data);
      return data;
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? String(err.detail ?? err.message)
          : "Could not load conversations. Check your connection.";
      setThreadsError(msg);
      return [];
    } finally {
      setLoadingThreads(false);
    }
  }, [getToken]);

  const loadDetail = useCallback(
    async (id: string) => {
      setLoadingDetail(true);
      setDetailError(null);
      try {
        const data = await getConversation(getToken, id);
        setActiveDetail(data);
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? String(err.detail ?? err.message)
            : "Could not load this conversation.";
        setDetailError(msg);
        setActiveDetail(null);
      } finally {
        setLoadingDetail(false);
      }
    },
    [getToken]
  );

  // Read once at render time — a separate useEffect will fire if search params change.
  const startFresh = searchParams.get("new") === "1";
  const jdParam = searchParams.get("jd");
  const didInit = useRef(false);

  const applyInitialSelection = useCallback(
    (items: ConversationListItem[]) => {
      if (startFresh) {
        setShowNewChat(true);
        router.replace("/app/chat");
      } else if (jdParam) {
        const match = items.find((t) => t.jd.id === jdParam);
        if (match) {
          setActiveId(match.id);
        } else if (items.length > 0) {
          setActiveId(items[0].id);
        }
        router.replace("/app/chat");
      } else if (items.length > 0) {
        setActiveId(items[0].id);
      }
    },
    [startFresh, jdParam, router]
  );

  useEffect(() => {
    if (didInit.current) return;
    if (initialThreads !== undefined) {
      didInit.current = true;
      applyInitialSelection(initialThreads);
      return;
    }
    loadThreads().then((items) => {
      if (didInit.current) return;
      didInit.current = true;
      applyInitialSelection(items);
    });
  }, [initialThreads, loadThreads, applyInitialSelection]);

  // Load detail whenever active thread changes
  useEffect(() => {
    if (activeId) {
      loadDetail(activeId);
      setShowNewChat(false);
      setSystemUpdates([]);
    } else {
      setActiveDetail(null);
    }
  }, [activeId, loadDetail]);

  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) return threads;
    const q = searchQuery.toLowerCase();
    return threads.filter(
      (t) =>
        t.jd.company_name?.toLowerCase().includes(q) ||
        t.jd.role_title?.toLowerCase().includes(q)
    );
  }, [threads, searchQuery]);

  const handleSend = async () => {
    if (!composerValue.trim() || !activeDetail || sending) return;
    const content = composerValue.trim();
    setComposerValue("");

    const optimisticUser: ConversationMessage = {
      id: `opt-${Date.now()}`,
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };
    // Streaming placeholder — id "streaming" is recognised by MessageBubble
    const streamingMsg: ConversationMessage = {
      id: "streaming",
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
    };

    setActiveDetail((prev) =>
      prev
        ? { ...prev, messages: [...prev.messages, optimisticUser, streamingMsg] }
        : prev
    );
    setSending(true);
    setSendError(null);

    let finalContent = "";

    try {
      for await (const event of streamMessage(getToken, activeDetail.id, content)) {
        if (event.type === "thinking") {
          setThinkingPhase(event.phase);
        } else if (event.type === "token") {
          // Clear thinking phase as soon as content starts flowing
          setThinkingPhase("");
          finalContent += event.content;
          const snapshot = finalContent;
          setActiveDetail((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              messages: prev.messages.map((m) =>
                m.id === "streaming" ? { ...m, content: snapshot } : m
              ),
            };
          });
        } else if (event.type === "done") {
          setThinkingPhase("");
          const newStep = event.current_step as ConversationStep;
          const realMsg: ConversationMessage = {
            id: event.message_id,
            role: "assistant",
            content: event.content,
            created_at: new Date().toISOString(),
          };
          setActiveDetail((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              current_step: newStep,
              messages: prev.messages.map((m) =>
                m.id === "streaming" ? realMsg : m
              ),
            };
          });
          setThreads((prev) =>
            prev.map((t) =>
              t.id === activeDetail.id
                ? { ...t, last_message: event.content, current_step: newStep }
                : t
            )
          );

          const updates: SystemUpdate[] = [];
          if (event.memory_updates?.length) {
            updates.push(...memoryUpdatesToSystemUpdates(event.memory_updates));
          }
          if (newStep === "resume_generation") {
            updates.push({
              id: `resume-ready-${Date.now()}`,
              kind: "resume_ready",
              title: "Gap analysis complete — resume ready to generate",
              body: "Switch to the Resume tab to generate your tailored resume, download DOCX/PDF, and track this application.",
            });
          }
          if (updates.length) {
            setSystemUpdates((prev) => [...prev, ...updates]);
          }
        } else if (event.type === "error") {
          throw new Error(event.detail);
        }
      }
    } catch (err) {
      // Roll back optimistic messages
      setActiveDetail((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: prev.messages.filter(
            (m) => m.id !== "streaming" && m.id !== optimisticUser.id
          ),
        };
      });
      const msg =
        err instanceof ApiError
          ? String(err.detail ?? err.message)
          : "Failed to send message. Please try again.";
      setSendError(msg);
    } finally {
      setSending(false);
      setThinkingPhase("");
    }
  };

  const handleConversationCreated = async (conv: ConversationDetail) => {
    setActiveDetail(conv);
    setActiveId(conv.id);
    setShowNewChat(false);
    // Prepend to thread list
    const listItem: ConversationListItem = {
      id: conv.id,
      jd: conv.jd,
      current_step: conv.current_step,
      last_message: conv.messages[conv.messages.length - 1]?.content ?? null,
      updated_at: conv.updated_at,
    };
    setThreads((prev) => [listItem, ...prev]);
  };

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Thread list */}
      <div className="w-[280px] shrink-0 border-r border-border/60 flex flex-col overflow-hidden">
        <div className="p-3 border-b border-border/50 flex flex-col gap-2.5">
          <button
            onClick={() => {
              setShowNewChat(true);
              setActiveId(null);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground btn-primary-glow hover:bg-primary/90 transition-all duration-200 w-full"
          >
            <Plus className="w-3.5 h-3.5" />
            New conversation
          </button>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations…"
              className="w-full rounded-lg border border-border/60 bg-muted/30 pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/30 transition-all duration-200"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
          {loadingThreads ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
            </div>
          ) : threadsError ? (
            <div className="mx-2 mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 flex flex-col gap-1.5">
              <p className="text-[11px] text-red-700">{threadsError}</p>
              <button
                onClick={() => loadThreads()}
                className="text-[11px] font-medium text-red-700 underline text-left"
              >
                Retry
              </button>
            </div>
          ) : filteredThreads.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8 px-3">
              {searchQuery ? "No matches found." : "No conversations yet."}
            </p>
          ) : (
            filteredThreads.map((thread) => {
              const badge = stepBadgeMeta[thread.current_step];
              return (
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
                    {logoLetter(thread.jd)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {thread.jd.company_name || "Unknown company"}
                      </p>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {thread.jd.role_title || "Untitled role"}
                    </p>
                    <span
                      className={cn(
                        "inline-block mt-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border",
                        badge.className
                      )}
                    >
                      {badge.label}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {showNewChat ? (
          <NewConversationPanel
            getToken={getToken}
            onCancel={() => setShowNewChat(false)}
            onCreated={handleConversationCreated}
          />
        ) : loadingDetail ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
          </div>
        ) : detailError ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6">
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 max-w-sm text-center">
              {detailError}
            </p>
            <button
              onClick={() => activeId && loadDetail(activeId)}
              className="text-xs font-medium text-primary underline"
            >
              Try again
            </button>
          </div>
        ) : activeDetail ? (
          <ConversationView
            detail={activeDetail}
            getToken={getToken}
            composerValue={composerValue}
            onComposerChange={setComposerValue}
            onSend={handleSend}
            sending={sending}
            thinkingPhase={thinkingPhase}
            systemUpdates={systemUpdates}
            onAddSystemUpdate={(update) =>
              setSystemUpdates((prev) => [...prev, update])
            }
            onDismissSystemUpdate={(id) =>
              setSystemUpdates((prev) => prev.filter((u) => u.id !== id))
            }
            sendError={sendError}
            onDismissSendError={() => setSendError(null)}
            onDetailUpdate={(updated) => {
              setActiveDetail(updated);
              setThreads((prev) =>
                prev.map((t) =>
                  t.id === updated.id ? { ...t, current_step: updated.current_step } : t
                )
              );
            }}
          />
        ) : (
          <EmptyState onNewChat={() => setShowNewChat(true)} />
        )}
      </div>
    </div>
  );
}

/* ── Empty state ──────────────────────────────────────────────────── */
function EmptyState({ onNewChat }: { onNewChat: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
      <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center ring-1 ring-primary/15 shadow-sm">
        <Sparkles className="w-7 h-7 text-accent-foreground" />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold text-foreground">
          Pick a conversation, or start a new one
        </h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Each conversation is anchored to a job description — your coach uses it to tailor
          advice, spot gaps, and help you build a resume that fits.
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

/* ── New conversation panel ───────────────────────────────────────── */
function NewConversationPanel({
  getToken,
  onCancel,
  onCreated,
}: {
  getToken: () => Promise<string | null>;
  onCancel: () => void;
  onCreated: (conv: ConversationDetail) => void;
}) {
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "parsing" | "coaching" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleStart = async () => {
    if (!text.trim() || status !== "idle") return;
    setErrorMsg("");

    try {
      setStatus("parsing");
      const jd = await createJD(getToken, text.trim());

      setStatus("coaching");
      const conv = await createConversation(getToken, jd.id);
      onCreated(conv);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? String(err.detail ?? err.message)
          : "Something went wrong. Please try again.";
      setErrorMsg(msg);
      setStatus("error");
    }
  };

  const isLoading = status === "parsing" || status === "coaching";

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-xl mx-auto flex flex-col gap-6">
        <div className="space-y-1.5">
          <h2 className="text-2xl">Start a new conversation</h2>
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
              disabled={isLoading}
              className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all duration-200 disabled:opacity-50"
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
              disabled={isLoading}
              className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all duration-200 disabled:opacity-50"
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
            disabled={isLoading}
            className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all duration-200 resize-none disabled:opacity-50"
          />
        </div>

        {errorMsg && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
            {errorMsg}
          </p>
        )}

        {isLoading && (
          <div className="flex items-center gap-2.5 text-sm text-muted-foreground bg-muted/40 rounded-xl px-4 py-3">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            {status === "parsing"
              ? "Parsing the job description…"
              : "Running gap analysis against your memory…"}
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleStart}
            disabled={!text.trim() || isLoading}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200",
              text.trim() && !isLoading
                ? "bg-primary text-primary-foreground btn-primary-glow hover:bg-primary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
            )}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Start coaching
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Conversation view ────────────────────────────────────────────── */
function ConversationView({
  detail,
  getToken,
  composerValue,
  onComposerChange,
  onSend,
  sending,
  thinkingPhase,
  systemUpdates,
  onAddSystemUpdate,
  onDismissSystemUpdate,
  sendError,
  onDismissSendError,
  onDetailUpdate,
}: {
  detail: ConversationDetail;
  getToken: () => Promise<string | null>;
  composerValue: string;
  onComposerChange: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  thinkingPhase: string;
  systemUpdates: SystemUpdate[];
  onAddSystemUpdate: (update: SystemUpdate) => void;
  onDismissSystemUpdate: (id: string) => void;
  sendError: string | null;
  onDismissSendError: () => void;
  onDetailUpdate?: (updated: ConversationDetail) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const badge = stepBadgeMeta[detail.current_step];
  const [researchOpen, setResearchOpen] = useState(false);
  const prevStepRef = useRef(detail.current_step);

  const showResumeTab =
    detail.current_step === "resume_generation" ||
    detail.current_step === "interview_prep" ||
    detail.current_step === "done";
  const [activeTab, setActiveTab] = useState<"chat" | "resume" | "cover-letter">("chat");
  const [resume, setResume] = useState<Resume | null>(null);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [coverLetter, setCoverLetter] = useState<CoverLetter | null>(null);
  const [coverLetterLoading, setCoverLetterLoading] = useState(false);
  const [coverLetterError, setCoverLetterError] = useState<string | null>(null);
  const [generatingCL, setGeneratingCL] = useState(false);
  const [fitScore, setFitScore] = useState<FitScore | null>(null);
  const [fitScoreLoading, setFitScoreLoading] = useState(false);
  const [startingInterviewPrep, setStartingInterviewPrep] = useState(false);

  // Auto-open Resume tab when coaching completes
  useEffect(() => {
    if (
      prevStepRef.current !== "resume_generation" &&
      detail.current_step === "resume_generation"
    ) {
      setActiveTab("resume");
    }
    prevStepRef.current = detail.current_step;
  }, [detail.current_step]);

  // Load the latest existing resume when the tab becomes visible.
  useEffect(() => {
    if (!showResumeTab) return;
    setResumeLoading(true);
    setResumeError(null);
    listResumes(getToken, detail.jd.id)
      .then((list) => setResume(list[0] ?? null))
      .catch(() => setResumeError("Could not load resume."))
      .finally(() => setResumeLoading(false));
  }, [detail.jd.id, showResumeTab, getToken]);

  // Load existing cover letters when that tab is opened.
  useEffect(() => {
    if (activeTab !== "cover-letter" || !showResumeTab) return;
    if (coverLetter !== null) return; // already loaded
    setCoverLetterLoading(true);
    setCoverLetterError(null);
    listCoverLetters(getToken, detail.jd.id)
      .then((list) => setCoverLetter(list[0] ?? null))
      .catch(() => setCoverLetterError("Could not load cover letter."))
      .finally(() => setCoverLetterLoading(false));
  }, [activeTab, detail.jd.id, showResumeTab, getToken, coverLetter]);

  const handleGenerate = async () => {
    setGenerating(true);
    setResumeError(null);
    try {
      const r = await generateResume(getToken, detail.jd.id);
      setResume(r);
      if (r.stars_extracted && r.stars_extracted > 0) {
        onAddSystemUpdate({
          id: `star-${Date.now()}`,
          kind: "star",
          title: `${r.stars_extracted} STAR ${r.stars_extracted === 1 ? "story" : "stories"} added to your library`,
          body: "Stories from your coaching session were extracted for interview prep.",
          href: "/app/stars",
          hrefLabel: "View STAR Library",
        });
        setActiveTab("chat");
      }
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? String(err.detail ?? err.message)
          : "Resume generation failed. Please try again.";
      setResumeError(msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateCoverLetter = async () => {
    setGeneratingCL(true);
    setCoverLetterError(null);
    try {
      const cl = await generateCoverLetter(getToken, detail.jd.id);
      setCoverLetter(cl);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? String(err.detail ?? err.message)
          : "Cover letter generation failed. Please try again.";
      setCoverLetterError(msg);
    } finally {
      setGeneratingCL(false);
    }
  };

  const handleGetFitScore = async () => {
    setFitScoreLoading(true);
    try {
      const score = await getFitScore(getToken, detail.jd.id);
      setFitScore(score);
    } catch {
      // silently fail — user can retry
    } finally {
      setFitScoreLoading(false);
    }
  };

  const handleStartInterviewPrep = async () => {
    setStartingInterviewPrep(true);
    try {
      await startInterviewPrep(getToken, detail.id);
      const updated = await getConversation(getToken, detail.id);
      onDetailUpdate?.(updated);
      setActiveTab("chat");
    } catch {
      // silently fail
    } finally {
      setStartingInterviewPrep(false);
    }
  };

  useEffect(() => {
    if (activeTab === "chat") {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [detail.messages.length, activeTab, systemUpdates.length]);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/60 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
            {logoLetter(detail.jd)}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {detail.jd.company_name || "Unknown company"}
            </p>
            <p className="text-xs text-muted-foreground">
              {detail.jd.role_title || "Untitled role"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Fit score button */}
          {showResumeTab && (
            <div className="relative">
              {fitScore ? (
                <div className={cn(
                  "flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border",
                  fitScore.fit_level === "strong"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : fitScore.fit_level === "moderate"
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-red-50 text-red-700 border-red-200"
                )}>
                  <Sparkles className="w-3 h-3" />
                  Fit {fitScore.score}%
                </div>
              ) : (
                <button
                  onClick={handleGetFitScore}
                  disabled={fitScoreLoading}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  title="Get your fit score for this role"
                >
                  {fitScoreLoading
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Sparkles className="w-3.5 h-3.5" />
                  }
                  Fit score
                </button>
              )}
            </div>
          )}
          {showResumeTab && (
            <div className="flex items-center gap-0.5 rounded-lg border border-border/60 bg-muted/30 p-0.5">
              <button
                onClick={() => setActiveTab("chat")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                  activeTab === "chat"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <MessageSquare className="w-3 h-3" />
                Chat
              </button>
              <button
                onClick={() => setActiveTab("resume")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                  activeTab === "resume"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <FileText className="w-3 h-3" />
                Resume
              </button>
              <button
                onClick={() => setActiveTab("cover-letter")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                  activeTab === "cover-letter"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <FileText className="w-3 h-3" />
                Cover Letter
              </button>
            </div>
          )}
          <span
            className={cn(
              "text-[10px] font-semibold px-2.5 py-1 rounded-full border inline-flex items-center gap-1.5",
              badge.className
            )}
          >
            <ListChecks className="w-3 h-3" />
            {badge.label}
          </span>
        </div>
      </div>

      {/* Company research banner — shown when Tavily data is available */}
      {detail.jd.company_research && (
        <div className="border-b border-border/60 shrink-0">
          <button
            onClick={() => setResearchOpen((o) => !o)}
            className="w-full flex items-center justify-between px-5 py-2 text-left hover:bg-muted/30 transition-colors"
          >
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Building2 className="w-3.5 h-3.5" />
              Company snapshot
            </span>
            <ChevronDown
              className={cn(
                "w-3.5 h-3.5 text-muted-foreground transition-transform",
                researchOpen && "rotate-180"
              )}
            />
          </button>
          {researchOpen && (
            <div className="px-5 pb-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {detail.jd.company_research}
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === "resume" ? (
        <ResumePanel
          resume={resume}
          jdId={detail.jd.id}
          conversationId={detail.id}
          getToken={getToken}
          loading={resumeLoading}
          generating={generating}
          error={resumeError}
          onGenerate={handleGenerate}
          onDismissError={() => setResumeError(null)}
          onStartInterviewPrep={handleStartInterviewPrep}
          startingInterviewPrep={startingInterviewPrep}
          currentStep={detail.current_step}
          onApplicationTracked={() =>
            onAddSystemUpdate({
              id: `app-${Date.now()}`,
              kind: "application",
              title: "Application tracked",
              body: `${detail.jd.company_name || "This role"} was added to your pipeline.`,
              href: "/app/applications",
              hrefLabel: "View Applications",
            })
          }
        />
      ) : activeTab === "cover-letter" ? (
        <CoverLetterPanel
          coverLetter={coverLetter}
          jdId={detail.jd.id}
          getToken={getToken}
          loading={coverLetterLoading}
          generating={generatingCL}
          error={coverLetterError}
          onGenerate={handleGenerateCoverLetter}
          onDismissError={() => setCoverLetterError(null)}
        />
      ) : (
        <>
          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4"
          >
            {detail.messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                thinkingPhase={message.id === "streaming" ? thinkingPhase : undefined}
              />
            ))}
            {systemUpdates.map((update) => (
              <SystemUpdateCard
                key={update.id}
                update={update}
                onDismiss={() => onDismissSystemUpdate(update.id)}
                onOpenResumeTab={
                  update.kind === "resume_ready" ? () => setActiveTab("resume") : undefined
                }
              />
            ))}
          </div>

          {/* Send error */}
          {sendError && (
            <div className="px-5 pb-0 pt-2 shrink-0">
              <div className="flex items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
                <p className="text-xs text-red-700">{sendError}</p>
                <button
                  onClick={onDismissSendError}
                  className="text-red-400 hover:text-red-600 transition-colors shrink-0"
                >
                  <span className="text-xs">✕</span>
                </button>
              </div>
            </div>
          )}

          <ChatComposer
            value={composerValue}
            onChange={onComposerChange}
            onSend={onSend}
            sending={sending}
            placeholder={
              detail.current_step === "interview_prep"
                ? "Answer the interview question…"
                : "Reply to your coach…"
            }
          />
        </>
      )}
    </div>
  );
}

/* ── Resume panel ─────────────────────────────────────────────────── */
function ResumePanel({
  resume,
  jdId,
  conversationId,
  getToken,
  loading,
  generating,
  error,
  onGenerate,
  onDismissError,
  onStartInterviewPrep,
  startingInterviewPrep,
  currentStep,
  onApplicationTracked,
}: {
  resume: Resume | null;
  jdId: string;
  conversationId: string;
  getToken: () => Promise<string | null>;
  loading: boolean;
  generating: boolean;
  error: string | null;
  onGenerate: () => void;
  onDismissError: () => void;
  onStartInterviewPrep: () => void;
  startingInterviewPrep: boolean;
  currentStep: ConversationStep;
  onApplicationTracked?: () => void;
}) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const content = resume?.content ?? null;
  const tags: string[] = resume?.labels?.tags ?? [];
  const [copied, setCopied] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [atsScore, setAtsScore] = useState<ATSScore | null>(null);
  const [atsLoading, setAtsLoading] = useState(false);

  const handleGetAtsScore = async () => {
    if (!resume) return;
    setAtsLoading(true);
    try {
      const score = await getATSScore(getToken, resume.id);
      setAtsScore(score);
    } catch {
      // silently fail
    } finally {
      setAtsLoading(false);
    }
  };

  const handleCopyMarkdown = () => {
    if (!content) return;
    const lines: string[] = [];
    if (tags.length) lines.push(`**Tags:** ${tags.join(", ")}\n`);
    lines.push(`## Summary\n\n${content.summary}\n`);
    if (content.experience.length) {
      lines.push("## Experience\n");
      for (const e of content.experience) {
        lines.push(`### ${e.role} · ${e.company}  \n*${e.dates}*\n`);
        for (const b of e.bullets) lines.push(`- ${b}`);
        lines.push("");
      }
    }
    if (content.skills.length) {
      lines.push(`## Skills\n\n${content.skills.join(", ")}\n`);
    }
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const [downloading, setDownloading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handleDownloadDocx = async () => {
    if (!resume) return;
    setDownloading(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/resumes/${resume.id}/docx`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("DOCX generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `resume-${resume.id}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // fall through — user can still use Copy Markdown
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!resume) return;
    setDownloadingPdf(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/resumes/${resume.id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("PDF generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `resume-${resume.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // fall through
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleMarkApplied = async () => {
    if (!resume) return;
    setApplying(true);
    setApplyError(null);
    try {
      await createApplication(getToken, { jd_id: jdId, resume_id: resume.id });
      setApplied(true);
      onApplicationTracked?.();
    } catch (err) {
      setApplyError(
        err instanceof ApiError ? String(err.detail ?? err.message) : "Failed to create application."
      );
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        {/* Error */}
        {error && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-700">{error}</p>
            <button onClick={onDismissError} className="text-red-400 hover:text-red-600 text-xs shrink-0">
              ✕
            </button>
          </div>
        )}

        {!content ? (
          /* ── No resume yet ── */
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center ring-1 ring-primary/15">
              <FileText className="w-7 h-7 text-accent-foreground" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-semibold text-foreground">Ready to generate</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Your coach has gathered enough context. Generate a tailored resume, download DOCX or PDF,
                then use &ldquo;Mark as applied&rdquo; to add this role to your Applications board.
              </p>
            </div>
            <button
              onClick={onGenerate}
              disabled={generating}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all",
                !generating
                  ? "bg-primary text-primary-foreground btn-primary-glow hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
              )}
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating resume…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate tailored resume
                </>
              )}
            </button>
          </div>
        ) : (
          /* ── Resume document ── */
          <>
            {/* Tags */}
            {tags.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-full bg-primary/8 text-primary text-[11px] font-medium border border-primary/15"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Summary */}
            <section className="flex flex-col gap-1.5">
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Summary
              </h3>
              <p className="text-sm text-foreground leading-relaxed">{content.summary}</p>
            </section>

            {/* Experience */}
            {content.experience.length > 0 && (
              <section className="flex flex-col gap-4">
                <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Experience
                </h3>
                {content.experience.map((entry, i) => (
                  <div key={i} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <div>
                        <span className="text-sm font-semibold text-foreground">{entry.role}</span>
                        <span className="text-sm text-muted-foreground"> · {entry.company}</span>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{entry.dates}</span>
                    </div>
                    <ul className="flex flex-col gap-1">
                      {entry.bullets.map((bullet, j) => (
                        <li key={j} className="flex items-start gap-2 text-sm text-foreground">
                          <span className="mt-2 w-1 h-1 rounded-full bg-primary/50 shrink-0" />
                          <span className="leading-relaxed">{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            )}

            {/* Skills */}
            {content.skills.length > 0 && (
              <section className="flex flex-col gap-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Skills
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {content.skills.map((skill) => (
                    <span
                      key={skill}
                      className="px-2.5 py-1 rounded-lg bg-muted/60 border border-border/60 text-xs text-foreground"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* ATS score section */}
            {!atsScore ? (
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={handleGetAtsScore}
                  disabled={atsLoading}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border/60 rounded-lg px-3 py-1.5 transition-all hover:bg-muted/40 disabled:opacity-50"
                >
                  {atsLoading
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Sparkles className="w-3 h-3" />
                  }
                  {atsLoading ? "Scoring…" : "Check ATS score"}
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">ATS Score</span>
                  <span className={cn(
                    "text-lg font-bold",
                    atsScore.score >= 75 ? "text-emerald-600" : atsScore.score >= 50 ? "text-amber-600" : "text-red-600"
                  )}>{atsScore.score}/100</span>
                </div>
                {atsScore.missing_keywords.length > 0 && (
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground mb-1">Missing keywords</p>
                    <div className="flex flex-wrap gap-1">
                      {atsScore.missing_keywords.map((kw) => (
                        <span key={kw} className="px-2 py-0.5 rounded bg-red-50 border border-red-200 text-[11px] text-red-700">{kw}</span>
                      ))}
                    </div>
                  </div>
                )}
                {atsScore.quick_fixes.length > 0 && (
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground mb-1">Quick fixes</p>
                    <ul className="flex flex-col gap-1">
                      {atsScore.quick_fixes.map((fix, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-foreground">
                          <span className="mt-1 w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                          {fix}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Interview prep CTA */}
            {currentStep !== "interview_prep" && (
              <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Ready to prep for the interview?</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Switch to interview prep mode for tailored behavioral coaching.</p>
                </div>
                <button
                  onClick={onStartInterviewPrep}
                  disabled={startingInterviewPrep}
                  className="inline-flex items-center gap-1.5 shrink-0 rounded-lg px-3 py-2 text-xs font-semibold bg-violet-600 text-white hover:bg-violet-700 transition-all disabled:opacity-60"
                >
                  {startingInterviewPrep ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  {startingInterviewPrep ? "Starting…" : "Start interview prep"}
                </button>
              </div>
            )}

            {/* Actions row */}
            <div className="pt-3 border-t border-border/40 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyMarkdown}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <ClipboardCopy className="w-3.5 h-3.5" />}
                  {copied ? "Copied!" : "Copy markdown"}
                </button>
                <span className="text-border">·</span>
                <button
                  onClick={handleDownloadDocx}
                  disabled={downloading}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  {downloading
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Download className="w-3.5 h-3.5" />}
                  {downloading ? "Generating…" : "Download DOCX"}
                </button>
                <span className="text-border">·</span>
                <button
                  onClick={handleDownloadPdf}
                  disabled={downloadingPdf}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  {downloadingPdf
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Download className="w-3.5 h-3.5" />}
                  {downloadingPdf ? "Generating…" : "Download PDF"}
                </button>
                <span className="text-border">·</span>
                <button
                  onClick={onGenerate}
                  disabled={generating}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {generating ? "Regenerating…" : "Regenerate"}
                </button>
              </div>

              {applyError && (
                <p className="text-xs text-red-600 w-full">{applyError}</p>
              )}

              {applied ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                  <Check className="w-3.5 h-3.5" />
                  Marked as applied
                </span>
              ) : (
                <button
                  onClick={handleMarkApplied}
                  disabled={applying}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                    !applying
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
                  )}
                >
                  {applying ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  {applying ? "Saving…" : "Mark as applied"}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Cover letter panel ───────────────────────────────────────────── */
function CoverLetterPanel({
  coverLetter,
  jdId,
  getToken,
  loading,
  generating,
  error,
  onGenerate,
  onDismissError,
}: {
  coverLetter: CoverLetter | null;
  jdId: string;
  getToken: () => Promise<string | null>;
  loading: boolean;
  generating: boolean;
  error: string | null;
  onGenerate: () => void;
  onDismissError: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const content = coverLetter?.content ?? null;

  const handleCopyText = () => {
    if (!content) return;
    const text = [
      content.opening_paragraph,
      ...content.body_paragraphs,
      content.closing_paragraph,
    ].join("\n\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownloadPdf = async () => {
    if (!coverLetter) return;
    setDownloading(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/cover-letters/${coverLetter.id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("PDF generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cover-letter-${coverLetter.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // fall through
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        {error && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-700">{error}</p>
            <button onClick={onDismissError} className="text-red-400 hover:text-red-600 text-xs shrink-0">✕</button>
          </div>
        )}

        {!content ? (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center ring-1 ring-primary/15">
              <FileText className="w-7 h-7 text-accent-foreground" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-semibold text-foreground">Generate a cover letter</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Tailored from your coaching session — company-specific, no generic openers.
              </p>
            </div>
            <button
              onClick={onGenerate}
              disabled={generating}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all",
                !generating
                  ? "bg-primary text-primary-foreground btn-primary-glow hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
              )}
            >
              {generating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Generate cover letter</>
              )}
            </button>
          </div>
        ) : (
          <>
            <section className="flex flex-col gap-4">
              <p className="text-sm text-foreground leading-relaxed">{content.opening_paragraph}</p>
              {content.body_paragraphs.map((para, i) => (
                <p key={i} className="text-sm text-foreground leading-relaxed">{para}</p>
              ))}
              <p className="text-sm text-foreground leading-relaxed">{content.closing_paragraph}</p>
            </section>

            <div className="pt-3 border-t border-border/40 flex items-center gap-3 flex-wrap">
              <button
                onClick={handleCopyText}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <ClipboardCopy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy text"}
              </button>
              <span className="text-border">·</span>
              <button
                onClick={handleDownloadPdf}
                disabled={downloading}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                {downloading ? "Generating PDF…" : "Download PDF"}
              </button>
              <span className="text-border">·</span>
              <button
                onClick={onGenerate}
                disabled={generating}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {generating ? "Regenerating…" : "Regenerate"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── System update card ───────────────────────────────────────────── */
function SystemUpdateCard({
  update,
  onDismiss,
  onOpenResumeTab,
}: {
  update: SystemUpdate;
  onDismiss: () => void;
  onOpenResumeTab?: () => void;
}) {
  const icon =
    update.kind === "memory" ? (
      <Brain className="w-3.5 h-3.5 text-emerald-600" />
    ) : update.kind === "star" ? (
      <BookOpen className="w-3.5 h-3.5 text-violet-600" />
    ) : update.kind === "application" ? (
      <Briefcase className="w-3.5 h-3.5 text-blue-600" />
    ) : (
      <FileText className="w-3.5 h-3.5 text-primary" />
    );

  const borderClass =
    update.kind === "memory"
      ? "border-emerald-200/80 bg-emerald-50/50"
      : update.kind === "star"
      ? "border-violet-200/80 bg-violet-50/50"
      : update.kind === "application"
      ? "border-blue-200/80 bg-blue-50/50"
      : "border-primary/20 bg-primary/5";

  return (
    <div className={cn("mx-auto max-w-3xl w-full rounded-xl border px-4 py-3", borderClass)}>
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 shrink-0">{icon}</div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-semibold text-foreground">{update.title}</p>
          {update.body && (
            <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">
              {update.body}
            </p>
          )}
          <div className="flex items-center gap-3 pt-0.5">
            {onOpenResumeTab && (
              <button
                onClick={onOpenResumeTab}
                className="text-[11px] font-medium text-primary hover:underline"
              >
                Open Resume tab
              </button>
            )}
            {update.href && update.hrefLabel && (
              <Link
                href={update.href}
                className="text-[11px] font-medium text-primary hover:underline"
              >
                {update.hrefLabel}
              </Link>
            )}
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-muted/60 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ── Chat composer (auto-resize + voice) ─────────────────────────── */
function ChatComposer({
  value,
  onChange,
  onSend,
  sending,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  placeholder: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  useEffect(() => {
    setVoiceSupported(Boolean(getSpeechRecognitionCtor()));
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 72), 160)}px`;
  }, [value]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const toggleVoice = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      if (transcript.trim()) {
        onChange(value ? `${value.trimEnd()} ${transcript.trim()}` : transcript.trim());
      }
    };

    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  return (
    <div className="p-4 border-t border-border/60 shrink-0">
      <div className="max-w-3xl mx-auto rounded-2xl border border-border/40 bg-muted/25 backdrop-blur-sm px-4 py-3 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/25 transition-all duration-200">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder={placeholder}
            rows={3}
            disabled={sending}
            className="flex-1 min-h-[72px] max-h-40 text-sm text-foreground placeholder:text-muted-foreground/50 bg-transparent focus:outline-none resize-none py-1 disabled:opacity-50 leading-relaxed"
          />
          <div className="flex flex-col gap-1.5 shrink-0 pb-0.5">
            {voiceSupported && (
              <button
                type="button"
                onClick={toggleVoice}
                disabled={sending}
                title={listening ? "Stop listening" : "Voice input"}
                className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-150",
                  listening
                    ? "bg-red-100 text-red-600 ring-2 ring-red-200 animate-pulse"
                    : "bg-muted/80 text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {listening ? (
                  <MicOff className="w-3.5 h-3.5" />
                ) : (
                  <Mic className="w-3.5 h-3.5" />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={onSend}
              disabled={!value.trim() || sending}
              className={cn(
                "w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-150",
                value.trim() && !sending
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              {sending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground/50 text-center mt-2">
        {voiceSupported
          ? "Shift+Enter for a new line · Mic for voice input"
          : "Shift+Enter for a new line"}
      </p>
    </div>
  );
}

/* ── Message bubble ───────────────────────────────────────────────── */
function MessageBubble({
  message,
  thinkingPhase,
}: {
  message: ConversationMessage;
  thinkingPhase?: string;
}) {
  const isAssistant = message.role === "assistant";
  const isStreaming = message.id === "streaming";

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 max-w-3xl",
        !isAssistant && "self-end flex-row-reverse"
      )}
    >
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
          "px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm border",
          isAssistant
            ? "bg-card border-border/60 text-foreground rounded-tl-md"
            : "bg-primary text-primary-foreground border-primary/20 rounded-tr-md"
        )}
      >
        {isStreaming && !message.content ? (
          <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <Loader2 className="w-3 h-3 animate-spin shrink-0" />
            <span className="animate-pulse">{thinkingPhase || "Thinking…"}</span>
          </span>
        ) : (
          <span className="whitespace-pre-line">
            {message.content}
            {isStreaming && (
              <span className="inline-block w-0.5 h-3.5 bg-current ml-0.5 align-middle animate-pulse" />
            )}
          </span>
        )}
      </div>
    </div>
  );
}
