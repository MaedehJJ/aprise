"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Check, ChevronDown, ChevronUp, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ConversationStep,
  getMyProfile,
  listApplications,
  listConversations,
  listMemories,
  updateProfilePreferences,
} from "@/lib/api";

const COACHING_DONE_STEPS: ConversationStep[] = [
  "resume_generation",
  "interview_prep",
  "done",
];

type ChecklistStep = {
  id: string;
  label: string;
  href?: string;
  done: boolean;
};

export function FirstRunChecklist() {
  const { getToken } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [steps, setSteps] = useState<ChecklistStep[]>([]);

  const load = useCallback(async () => {
    try {
      const profile = await getMyProfile(getToken);
      if (profile?.preferences?.checklist_dismissed === true) {
        setDismissed(true);
        return;
      }

      const [memories, conversations, applications] = await Promise.all([
        listMemories(getToken, { limit: 1 }),
        listConversations(getToken, { limit: 50 }),
        listApplications(getToken),
      ]);

      const cvUploaded = memories.length > 0;
      const firstJd = conversations.length > 0;
      const coachingComplete = conversations.some((c) =>
        COACHING_DONE_STEPS.includes(c.current_step)
      );
      const firstApplication = applications.length > 0;

      setSteps([
        {
          id: "cv",
          label: "Upload your CV to Memory Bank",
          href: "/app/files",
          done: cvUploaded,
        },
        {
          id: "jd",
          label: "Paste your first job description",
          href: "/app/chat?new=1",
          done: firstJd,
        },
        {
          id: "coach",
          label: "Complete coaching for a role",
          done: coachingComplete,
        },
        {
          id: "apply",
          label: "Mark your first application",
          href: "/app/applications",
          done: firstApplication,
        },
      ]);
    } catch {
      setSteps([]);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const allDone = useMemo(
    () => steps.length > 0 && steps.every((s) => s.done),
    [steps]
  );

  useEffect(() => {
    if (allDone && !dismissed) {
      void updateProfilePreferences(getToken, { checklist_dismissed: true }).then(() =>
        setDismissed(true)
      );
    }
  }, [allDone, dismissed, getToken]);

  const handleDismiss = async () => {
    setDismissed(true);
    try {
      await updateProfilePreferences(getToken, { checklist_dismissed: true });
    } catch {
      // non-fatal
    }
  };

  if (loading || dismissed || steps.length === 0 || allDone) return null;

  const doneCount = steps.filter((s) => s.done).length;

  return (
    <div className="mx-4 mb-3 shrink-0 rounded-xl border border-primary/20 bg-primary/5 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-primary/10">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
          <p className="text-xs font-semibold text-foreground truncate">
            Getting started ({doneCount}/{steps.length})
          </p>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60"
            aria-label={collapsed ? "Expand checklist" : "Collapse checklist"}
          >
            {collapsed ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => void handleDismiss()}
            className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60"
            aria-label="Dismiss checklist"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {!collapsed && (
        <ul className="px-3 py-2 space-y-1.5">
          {steps.map((step) => (
            <li key={step.id} className="flex items-start gap-2">
              <span
                className={cn(
                  "mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0",
                  step.done
                    ? "bg-primary border-primary text-primary-foreground"
                    : "border-border bg-background"
                )}
              >
                {step.done && <Check className="w-2.5 h-2.5" />}
              </span>
              {step.href && !step.done ? (
                <Link
                  href={step.href}
                  className="text-xs text-foreground hover:text-primary hover:underline leading-snug"
                >
                  {step.label}
                </Link>
              ) : (
                <span
                  className={cn(
                    "text-xs leading-snug",
                    step.done ? "text-muted-foreground line-through" : "text-foreground"
                  )}
                >
                  {step.label}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
