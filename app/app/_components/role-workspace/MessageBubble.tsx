"use client";

import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConversationMessage } from "@/lib/api";

export function MessageBubble({
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
