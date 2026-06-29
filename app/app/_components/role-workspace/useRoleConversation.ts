"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  ConversationDetail,
  ConversationMessage,
  ConversationStep,
  getConversation,
  streamMessage,
} from "@/lib/api";
import { trackFunnelEvent } from "@/lib/analytics";
import {
  memoryUpdatesToSystemUpdates,
  type SystemUpdate,
} from "./chat-shared";

export function useRoleConversation(
  conversationId: string,
  getToken: () => Promise<string | null>
) {
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composerValue, setComposerValue] = useState("");
  const [sending, setSending] = useState(false);
  const [thinkingPhase, setThinkingPhase] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [rateLimitSeconds, setRateLimitSeconds] = useState<number | null>(null);

  // Auto-clear rate limit when the window expires.
  useEffect(() => {
    if (!rateLimitSeconds) return;
    const timer = setTimeout(() => {
      setRateLimitSeconds(null);
      setSendError(null);
    }, rateLimitSeconds * 1000);
    return () => clearTimeout(timer);
  }, [rateLimitSeconds]);
  const [systemUpdates, setSystemUpdates] = useState<SystemUpdate[]>([]);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getConversation(getToken, conversationId);
      setDetail(data);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? String(err.detail ?? err.message)
          : "Could not load this role."
      );
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [conversationId, getToken]);

  useEffect(() => {
    void loadDetail();
    setSystemUpdates([]);
  }, [loadDetail]);

  const handleSend = async () => {
    if (!composerValue.trim() || !detail || sending) return;
    const content = composerValue.trim();
    setComposerValue("");

    const optimisticUser: ConversationMessage = {
      id: `opt-${Date.now()}`,
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };
    const streamingMsg: ConversationMessage = {
      id: "streaming",
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
    };

    setDetail((prev) =>
      prev ? { ...prev, messages: [...prev.messages, optimisticUser, streamingMsg] } : prev
    );
    setSending(true);
    setSendError(null);

    let finalContent = "";

    try {
      for await (const event of streamMessage(getToken, detail.id, content)) {
        if (event.type === "thinking") {
          setThinkingPhase(event.phase);
        } else if (event.type === "token") {
          setThinkingPhase("");
          finalContent += event.content;
          const snapshot = finalContent;
          setDetail((prev) => {
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
          setDetail((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              current_step: newStep,
              messages: prev.messages.map((m) =>
                m.id === "streaming" ? realMsg : m
              ),
            };
          });

          const updates: SystemUpdate[] = [];
          if (event.memory_updates?.length) {
            updates.push(...memoryUpdatesToSystemUpdates(event.memory_updates));
          }
          if (newStep === "resume_generation") {
            trackFunnelEvent("coaching_complete", { conversation_id: detail.id });
            updates.push({
              id: `resume-ready-${Date.now()}`,
              kind: "resume_ready",
              title: "Gap analysis complete — resume ready to generate",
              body: "Open Resume & actions to generate your tailored resume and track this application.",
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
      setDetail((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: prev.messages.filter(
            (m) => m.id !== "streaming" && m.id !== optimisticUser.id
          ),
        };
      });
      if (err instanceof ApiError && err.status === 429) {
        setRateLimitSeconds(err.retryAfterSeconds ?? null);
        setSendError("Rate limit reached. Please wait before sending another message.");
      } else {
        setRateLimitSeconds(null);
        const msg =
          err instanceof ApiError
            ? String(err.detail ?? err.message)
            : "Failed to send message. Please try again.";
        setSendError(msg);
      }
    } finally {
      setSending(false);
      setThinkingPhase("");
    }
  };

  return {
    detail,
    loading,
    error,
    reload: loadDetail,
    composerValue,
    setComposerValue,
    sending,
    thinkingPhase,
    sendError,
    setSendError,
    systemUpdates,
    addSystemUpdate: (u: SystemUpdate) => setSystemUpdates((prev) => [...prev, u]),
    dismissSystemUpdate: (id: string) =>
      setSystemUpdates((prev) => prev.filter((u) => u.id !== id)),
    handleSend,
    setDetail,
    rateLimitSeconds,
    clearRateLimit: () => { setRateLimitSeconds(null); setSendError(null); },
  };
}
