"use client";

import { cn } from "@/lib/utils";
import type { ConversationStep } from "@/lib/api";
import { Check } from "lucide-react";

export type RoleStepId =
  | "parsed"
  | "coaching"
  | "resume"
  | "applied"
  | "interview";

const STEPS: { id: RoleStepId; label: string }[] = [
  { id: "parsed", label: "Parsed" },
  { id: "coaching", label: "Coaching" },
  { id: "resume", label: "Resume" },
  { id: "applied", label: "Applied" },
  { id: "interview", label: "Interview" },
];

export function stepIndexForConversation(step: ConversationStep): number {
  switch (step) {
    case "jd_parsing":
    case "gap_detection":
      return 0;
    case "gap_conversation":
      return 1;
    case "resume_generation":
      return 2;
    case "done":
      return 2;
    case "interview_prep":
      return 4;
    default:
      return 0;
  }
}

export function RoleStepper({
  currentStep,
  className,
  compact,
}: {
  currentStep: ConversationStep;
  className?: string;
  compact?: boolean;
}) {
  const activeIndex = stepIndexForConversation(currentStep);

  if (compact) {
    const current = STEPS[activeIndex];
    return (
      <div className={cn("flex items-center justify-between gap-3", className)}>
        <span className="text-[11px] font-medium text-foreground truncate">
          {current.label}
          <span className="text-muted-foreground font-normal">
            {" "}
            · {activeIndex + 1}/{STEPS.length}
          </span>
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-colors",
                i <= activeIndex ? "bg-primary" : "bg-border"
              )}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-1 px-5 py-2 border-b border-border/40 bg-muted/20", className)}>
      {STEPS.map((step, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        return (
          <div key={step.id} className="flex items-center gap-1 flex-1 min-w-0">
            <div
              className={cn(
                "flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0 border",
                done && "bg-primary text-primary-foreground border-primary",
                active && !done && "bg-primary/15 text-primary border-primary/40",
                !done && !active && "bg-background text-muted-foreground border-border"
              )}
            >
              {done ? <Check className="w-3 h-3" /> : i + 1}
            </div>
            <span
              className={cn(
                "text-[11px] font-medium truncate hidden sm:inline",
                active ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {step.label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={cn("h-px flex-1 mx-1", done ? "bg-primary/40" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}
