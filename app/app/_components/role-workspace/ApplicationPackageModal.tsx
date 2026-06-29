"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Check,
  ClipboardCopy,
  Download,
  ExternalLink,
  Loader2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GetToken } from "@/lib/api";
import type { Resume } from "@/lib/api";
import type { CoverLetter } from "@/lib/api";

export function ApplicationPackageModal({
  resume,
  coverLetter,
  coverLetterError,
  getToken,
  onClose,
}: {
  resume: Resume;
  coverLetter: CoverLetter | null;
  coverLetterError: string | null;
  getToken: GetToken;
  onClose: () => void;
}) {
  const [resumeDownloaded, setResumeDownloaded] = useState(false);
  const [clDownloaded, setClDownloaded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleDownloadResume = async () => {
    const token = await getToken();
    const res = await fetch(`/api/resumes/${resume.id}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resume-${resume.id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    setResumeDownloaded(true);
  };

  const handleDownloadCL = async () => {
    if (!coverLetter) return;
    const token = await getToken();
    const res = await fetch(`/api/cover-letters/${coverLetter.id}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cover-letter-${coverLetter.id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    setClDownloaded(true);
  };

  const handleCopyLinkedIn = () => {
    const summary = resume.content?.summary ?? "";
    if (!summary) return;
    navigator.clipboard.writeText(summary).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const steps = [
    {
      label: "Download resume PDF",
      done: resumeDownloaded,
      action: handleDownloadResume,
      icon: <Download className="w-3.5 h-3.5" />,
      actionLabel: "Download",
    },
    {
      label: "Download cover letter PDF",
      done: clDownloaded,
      disabled: !coverLetter,
      error: coverLetterError,
      action: handleDownloadCL,
      icon: <Download className="w-3.5 h-3.5" />,
      actionLabel: "Download",
    },
    {
      label: "Copy LinkedIn summary",
      done: copied,
      action: handleCopyLinkedIn,
      icon: <ClipboardCopy className="w-3.5 h-3.5" />,
      actionLabel: copied ? "Copied!" : "Copy",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="relative bg-background rounded-2xl border border-border shadow-xl w-full max-w-md flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
          <p className="text-sm font-semibold text-foreground">Application package ready</p>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-3">
          {steps.map((step, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center justify-between gap-3 p-3 rounded-xl border",
                step.done
                  ? "border-emerald-200 bg-emerald-50/50"
                  : step.error
                  ? "border-red-200 bg-red-50/50"
                  : "border-border/60 bg-muted/10"
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                {step.done ? (
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground">{step.label}</p>
                  {step.error && (
                    <p className="text-[11px] text-red-600 mt-0.5">{step.error}</p>
                  )}
                </div>
              </div>
              {!step.done && !step.error && (
                <button
                  onClick={step.action}
                  disabled={step.disabled}
                  className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {step.icon}
                  {step.actionLabel}
                </button>
              )}
            </div>
          ))}

          <Link
            href="/app/applications"
            className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border/60 bg-muted/10 hover:bg-muted/20 transition-colors"
          >
            <p className="text-xs font-medium text-foreground">Open Applications board</p>
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
          </Link>
        </div>

        <div className="px-5 pb-4 pt-1">
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-semibold hover:bg-primary/90 transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
