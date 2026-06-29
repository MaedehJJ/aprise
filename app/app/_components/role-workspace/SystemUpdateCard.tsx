"use client";

import Link from "next/link";
import { BookOpen, Brain, Briefcase, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SystemUpdate } from "./chat-shared";

export function SystemUpdateCard({
  update,
  onDismiss,
  onOpenResumeTab,
  openResumeLabel = "Open Resume tab",
}: {
  update: SystemUpdate;
  onDismiss: () => void;
  onOpenResumeTab?: () => void;
  openResumeLabel?: string;
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
                {openResumeLabel}
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
