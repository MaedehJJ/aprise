"use client";

import { useEffect, useState } from "react";
import {
  Check, ClipboardCopy, Download, FileText, Loader2, Package, Sparkles, Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ApiError, ATSScore, ConversationStep, createApplication, generateCoverLetter,
  getATSScore, listApplications, listCoverLetters,
} from "@/lib/api";
import type { CoverLetter, Resume } from "@/lib/api";
import { ApplicationPackageModal } from "./ApplicationPackageModal";
import { trackFunnelEvent } from "@/lib/analytics";

export function ResumePanel({
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
  const [atsScore, setAtsScore] = useState<ATSScore | null>(resume?.ats_score ?? null);
  const [atsLoading, setAtsLoading] = useState(false);

  useEffect(() => {
    if (resume?.ats_score) {
      setAtsScore(resume.ats_score);
    }
  }, [resume?.id, resume?.ats_score]);

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
  const [preparingPackage, setPreparingPackage] = useState(false);
  const [packageModal, setPackageModal] = useState<{
    coverLetter: CoverLetter | null;
    coverLetterError: string | null;
  } | null>(null);

  const handlePrepareApplication = async () => {
    if (!resume) return;
    setPreparingPackage(true);
    let coverLetter: CoverLetter | null = null;
    let coverLetterError: string | null = null;

    try {
      // 1. ensure cover letter exists
      const cls = await listCoverLetters(getToken, jdId);
      if (cls.length > 0) {
        coverLetter = cls[0];
      } else {
        try {
          coverLetter = await generateCoverLetter(getToken, jdId);
        } catch (err) {
          coverLetterError =
            err instanceof ApiError ? String(err.detail ?? err.message) : "Cover letter generation failed.";
        }
      }
      // 2. ensure application row exists
      try {
        const apps = await listApplications(getToken);
        const existing = apps.find((a) => a.jd_id === jdId);
        if (!existing) {
          await createApplication(getToken, { jd_id: jdId, resume_id: resume.id });
          trackFunnelEvent("application_created", { jd_id: String(jdId) });
          onApplicationTracked?.();
        }
      } catch (err) {
        // 409 = already exists — treat as success
        if (!(err instanceof ApiError && err.status === 409)) {
          // non-fatal — package modal still opens
        }
      }
    } finally {
      setPreparingPackage(false);
      setPackageModal({ coverLetter, coverLetterError });
    }
  };

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
    <>
    {packageModal && resume && (
      <ApplicationPackageModal
        resume={resume}
        coverLetter={packageModal.coverLetter}
        coverLetterError={packageModal.coverLetterError}
        getToken={getToken}
        onClose={() => setPackageModal(null)}
      />
    )}
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

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handlePrepareApplication}
                  disabled={preparingPackage}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                    !preparingPackage
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
                  )}
                >
                  {preparingPackage ? <Loader2 className="w-3 h-3 animate-spin" /> : <Package className="w-3 h-3" />}
                  {preparingPackage ? "Preparing…" : "Prepare application"}
                </button>
                {applied ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                    <Check className="w-3.5 h-3.5" />
                    Marked as applied
                  </span>
                ) : (
                  <button
                    onClick={handleMarkApplied}
                    disabled={applying}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    {applying ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                    {applying ? "Saving…" : "Mark as applied"}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
    </>
  );
}
