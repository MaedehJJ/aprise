"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  Briefcase,
  Building2,
  FileText,
  ListChecks,
  Loader2,
  Plus,
  Search,
  Send,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ApiError,
  ConversationDetail,
  ConversationListItem,
  ConversationMessage,
  ConversationStep,
  createConversation,
  createJD,
  getConversation,
  listConversations,
  sendMessage,
} from "@/lib/api";

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
    label: "Gap analysis",
    className: "bg-amber-100 text-amber-700 border-amber-200",
  },
  resume_generation: {
    label: "Resume ready",
    className: "bg-emerald-100 text-emerald-700 border-emerald-200",
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
export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getToken } = useAuth();

  const [threads, setThreads] = useState<ConversationListItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeDetail, setActiveDetail] = useState<ConversationDetail | null>(null);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [threadsError, setThreadsError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [composerValue, setComposerValue] = useState("");
  const [sending, setSending] = useState(false);
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
  const didInit = useRef(false);

  // Initial load: run once after mount (guard ensures stability even if refs change).
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    loadThreads().then((data) => {
      if (startFresh) {
        setShowNewChat(true);
        router.replace("/app/chat");
      } else if (data.length > 0) {
        setActiveId(data[0].id);
      }
    });
  }, [loadThreads, router, startFresh]);

  // Load detail whenever active thread changes
  useEffect(() => {
    if (activeId) {
      loadDetail(activeId);
      setShowNewChat(false);
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
    const thinkingMsg: ConversationMessage = {
      id: "thinking",
      role: "assistant",
      content: "…",
      created_at: new Date().toISOString(),
    };

    setActiveDetail((prev) =>
      prev
        ? { ...prev, messages: [...prev.messages, optimisticUser, thinkingMsg] }
        : prev
    );
    setSending(true);
    setSendError(null);

    try {
      const assistantMsg = await sendMessage(getToken, activeDetail.id, content);
      setActiveDetail((prev) => {
        if (!prev) return prev;
        const withoutThinking = prev.messages.filter((m) => m.id !== "thinking");
        return { ...prev, messages: [...withoutThinking, assistantMsg] };
      });
      // Refresh the thread list so last_message updates
      setThreads((prev) =>
        prev.map((t) =>
          t.id === activeDetail.id
            ? { ...t, last_message: assistantMsg.content }
            : t
        )
      );
    } catch (err) {
      // Roll back optimistic messages
      setActiveDetail((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: prev.messages.filter(
            (m) => m.id !== "thinking" && m.id !== optimisticUser.id
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
            composerValue={composerValue}
            onComposerChange={setComposerValue}
            onSend={handleSend}
            sending={sending}
            sendError={sendError}
            onDismissSendError={() => setSendError(null)}
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
  composerValue,
  onComposerChange,
  onSend,
  sending,
  sendError,
  onDismissSendError,
}: {
  detail: ConversationDetail;
  composerValue: string;
  onComposerChange: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  sendError: string | null;
  onDismissSendError: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const badge = stepBadgeMeta[detail.current_step];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [detail.messages.length]);

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

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4"
      >
        {detail.messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>

      {/* Send error */}
      {sendError && (
        <div className="px-5 pb-0 pt-2 shrink-0">
          <div className="flex items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
            <p className="text-xs text-red-700">{sendError}</p>
            <button onClick={onDismissSendError} className="text-red-400 hover:text-red-600 transition-colors shrink-0">
              <span className="text-xs">✕</span>
            </button>
          </div>
        </div>
      )}

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
            disabled={sending}
            className="flex-1 text-sm text-foreground placeholder:text-muted-foreground/50 bg-transparent focus:outline-none resize-none max-h-32 py-1 disabled:opacity-50"
          />
          <button
            onClick={onSend}
            disabled={!composerValue.trim() || sending}
            className={cn(
              "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all duration-150",
              composerValue.trim() && !sending
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
        <p className="text-[10px] text-muted-foreground/50 text-center mt-2">
          Coaching responses are tailored using your memory and this job&apos;s requirements
        </p>
      </div>
    </div>
  );
}

/* ── Message bubble ───────────────────────────────────────────────── */
function MessageBubble({ message }: { message: ConversationMessage }) {
  const isAssistant = message.role === "assistant";
  const isThinking = message.id === "thinking";

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
        {isThinking ? (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Thinking…
          </span>
        ) : (
          <span className="whitespace-pre-line">{message.content}</span>
        )}
      </div>
    </div>
  );
}
