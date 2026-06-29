"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ApiError,
  ConversationDetail,
  CoverLetter,
  Resume,
  generateCoverLetter,
  generateResume,
  getConversation,
  listCoverLetters,
  listResumes,
  startInterviewPrep,
} from "@/lib/api";
import type { SystemUpdate } from "./chat-shared";
import { trackFunnelEvent } from "@/lib/analytics";
import { invalidateTagsCache } from "@/app/app/browse/_components/BrowseClient";
import { ResumePanel } from "./ResumePanel";
import { CoverLetterPanel } from "./CoverLetterPanel";
import { StarStoriesPanel } from "./StarStoriesPanel";
import { showOutputsStep } from "./ConversationPanel";
import { ResumeCompare } from "@/app/app/roles/[conversationId]/_components/ResumeCompare";

type OutputTab = "resume" | "cover-letter" | "star";

export function RoleOutputsPanel({
  detail,
  getToken,
  onDetailUpdate,
  onAddSystemUpdate,
  onAtsScoreChange,
  autoOpenOnResumeReady,
  resumeTabFocusKey,
}: {
  detail: ConversationDetail;
  getToken: () => Promise<string | null>;
  onDetailUpdate?: (d: ConversationDetail) => void;
  onAddSystemUpdate: (u: SystemUpdate) => void;
  onAtsScoreChange?: (score: Resume["ats_score"]) => void;
  autoOpenOnResumeReady?: boolean;
  resumeTabFocusKey?: number;
}) {
  const outputsAvailable = showOutputsStep(detail.current_step);
  const [activeTab, setActiveTab] = useState<OutputTab>("resume");
  const prevStepRef = useRef(detail.current_step);

  const [resume, setResume] = useState<Resume | null>(null);
  const [allResumes, setAllResumes] = useState<Resume[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const [coverLetter, setCoverLetter] = useState<CoverLetter | null>(null);
  const [coverLetterLoading, setCoverLetterLoading] = useState(false);
  const [coverLetterError, setCoverLetterError] = useState<string | null>(null);
  const [generatingCL, setGeneratingCL] = useState(false);

  const [startingInterviewPrep, setStartingInterviewPrep] = useState(false);

  useEffect(() => {
    if (
      autoOpenOnResumeReady &&
      prevStepRef.current !== "resume_generation" &&
      detail.current_step === "resume_generation"
    ) {
      setActiveTab("resume");
    }
    prevStepRef.current = detail.current_step;
  }, [detail.current_step, autoOpenOnResumeReady]);

  useEffect(() => {
    if (resumeTabFocusKey) setActiveTab("resume");
  }, [resumeTabFocusKey]);

  useEffect(() => {
    if (!outputsAvailable) return;
    setResumeLoading(true);
    setResumeError(null);
    listResumes(getToken, detail.jd.id)
      .then((list) => {
        setAllResumes(list);
        const r = list[0] ?? null;
        setResume(r);
        if (r?.ats_score) onAtsScoreChange?.(r.ats_score);
      })
      .catch(() => setResumeError("Could not load resume."))
      .finally(() => setResumeLoading(false));
  }, [detail.jd.id, outputsAvailable, getToken, onAtsScoreChange]);

  useEffect(() => {
    if (activeTab !== "cover-letter" || !outputsAvailable) return;
    if (coverLetter !== null) return;
    setCoverLetterLoading(true);
    setCoverLetterError(null);
    listCoverLetters(getToken, detail.jd.id)
      .then((list) => setCoverLetter(list[0] ?? null))
      .catch(() => setCoverLetterError("Could not load cover letter."))
      .finally(() => setCoverLetterLoading(false));
  }, [activeTab, detail.jd.id, outputsAvailable, getToken, coverLetter]);

  const handleGenerate = async () => {
    setGenerating(true);
    setResumeError(null);
    try {
      const r = await generateResume(getToken, detail.jd.id);
      trackFunnelEvent("resume_generated", { jd_id: String(detail.jd.id), resume_id: String(r.id) });
      invalidateTagsCache();
      setResume(r);
      setAllResumes((prev) => [r, ...prev.filter((x) => x.id !== r.id)]);
      if (r.ats_score) onAtsScoreChange?.(r.ats_score);
      if (r.stars_extracted && r.stars_extracted > 0) {
        onAddSystemUpdate({
          id: `star-${Date.now()}`,
          kind: "star",
          title: `${r.stars_extracted} STAR ${r.stars_extracted === 1 ? "story" : "stories"} added`,
          body: "Stories from coaching were saved for interview prep.",
          href: "/app/stars",
          hrefLabel: "View STAR Library",
        });
        setActiveTab("star");
      }
    } catch (err) {
      setResumeError(
        err instanceof ApiError
          ? String(err.detail ?? err.message)
          : "Resume generation failed."
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateCoverLetter = async () => {
    setGeneratingCL(true);
    setCoverLetterError(null);
    try {
      setCoverLetter(await generateCoverLetter(getToken, detail.jd.id));
    } catch (err) {
      setCoverLetterError(
        err instanceof ApiError
          ? String(err.detail ?? err.message)
          : "Cover letter generation failed."
      );
    } finally {
      setGeneratingCL(false);
    }
  };

  const handleStartInterviewPrep = async () => {
    setStartingInterviewPrep(true);
    try {
      await startInterviewPrep(getToken, detail.id);
      onDetailUpdate?.(await getConversation(getToken, detail.id));
    } finally {
      setStartingInterviewPrep(false);
    }
  };

  if (!outputsAvailable) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center gap-2">
        <FileText className="w-8 h-8 text-muted-foreground/40" />
        <p className="text-sm font-medium text-foreground">Outputs unlock after coaching</p>
        <p className="text-xs text-muted-foreground max-w-[220px]">
          Complete gap-filling in the chat panel to generate your resume and cover letter.
        </p>
      </div>
    );
  }

  if (compareOpen && allResumes.length > 1) {
    return (
      <ResumeCompare resumes={allResumes} onClose={() => setCompareOpen(false)} />
    );
  }

  return (
    <div className="flex flex-col min-h-0 h-full">
      {allResumes.length > 1 && (
        <div className="shrink-0 px-3 py-2 border-b border-border/40 bg-muted/10">
          <button
            type="button"
            onClick={() => setCompareOpen(true)}
            className="text-xs font-medium text-primary hover:underline"
          >
            Compare versions ({allResumes.length})
          </button>
        </div>
      )}
      <div className="shrink-0 flex border-b border-border/50 bg-muted/20 p-1 gap-0.5">
        {(
          [
            { id: "resume" as const, label: "Resume", icon: FileText },
            { id: "cover-letter" as const, label: "Cover", icon: FileText },
            { id: "star" as const, label: "STAR", icon: BookOpen },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-all",
              activeTab === id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
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
          <StarStoriesPanel jdId={detail.jd.id} getToken={getToken} />
        )}
      </div>
    </div>
  );
}
