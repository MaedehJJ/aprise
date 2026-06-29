"use client";

import { useRef, useEffect } from "react";
import type { ConversationDetail, ConversationStep } from "@/lib/api";
import type { SystemUpdate } from "./chat-shared";
import { MessageBubble } from "./MessageBubble";
import { ChatComposer } from "./ChatComposer";
import { SystemUpdateCard } from "./SystemUpdateCard";

export function ConversationPanel({
  detail,
  composerValue,
  onComposerChange,
  onSend,
  sending,
  rateLimited,
  thinkingPhase,
  systemUpdates,
  onDismissSystemUpdate,
  sendError,
  onDismissSendError,
  onOpenOutputs,
}: {
  detail: ConversationDetail;
  composerValue: string;
  onComposerChange: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  rateLimited?: boolean;
  thinkingPhase: string;
  systemUpdates: SystemUpdate[];
  onDismissSystemUpdate: (id: string) => void;
  sendError: string | null;
  onDismissSendError: () => void;
  onOpenOutputs?: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [detail.messages.length, systemUpdates.length]);

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
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
            onOpenResumeTab={update.kind === "resume_ready" ? onOpenOutputs : undefined}
            openResumeLabel="Open Resume & actions"
          />
        ))}
      </div>

      {sendError && (
        <div className="px-4 pb-1 shrink-0">
          <div className="flex items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
            <p className="text-xs text-red-700">{sendError}</p>
            <button
              onClick={onDismissSendError}
              className="text-red-400 hover:text-red-600 text-xs shrink-0"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <ChatComposer
        value={composerValue}
        onChange={onComposerChange}
        onSend={onSend}
        sending={sending}
        rateLimited={rateLimited}
        placeholder={
          detail.current_step === "interview_prep"
            ? "Answer the interview question…"
            : "Reply to your coach…"
        }
      />
    </div>
  );
}

export function showOutputsStep(step: ConversationStep) {
  return (
    step === "resume_generation" ||
    step === "interview_prep" ||
    step === "done"
  );
}
