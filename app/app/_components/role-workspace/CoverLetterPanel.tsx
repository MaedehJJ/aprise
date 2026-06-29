"use client";

import { useState } from "react";
import {
  Check, ClipboardCopy, Download, FileText, Loader2, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CoverLetter } from "@/lib/api";

export function CoverLetterPanel({
  coverLetter,
  jdId,
  getToken,
  loading,
  generating,
  error,
  onGenerate,
  onDismissError,
}: {
  coverLetter: CoverLetter | null;
  jdId: string;
  getToken: () => Promise<string | null>;
  loading: boolean;
  generating: boolean;
  error: string | null;
  onGenerate: () => void;
  onDismissError: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const content = coverLetter?.content ?? null;

  const handleCopyText = () => {
    if (!content) return;
    const text = [
      content.opening_paragraph,
      ...content.body_paragraphs,
      content.closing_paragraph,
    ].join("\n\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownloadPdf = async () => {
    if (!coverLetter) return;
    setDownloading(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/cover-letters/${coverLetter.id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("PDF generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cover-letter-${coverLetter.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // fall through
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        {error && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-700">{error}</p>
            <button onClick={onDismissError} className="text-red-400 hover:text-red-600 text-xs shrink-0">✕</button>
          </div>
        )}

        {!content ? (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center ring-1 ring-primary/15">
              <FileText className="w-7 h-7 text-accent-foreground" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-semibold text-foreground">Generate a cover letter</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Tailored from your coaching session — company-specific, no generic openers.
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
                <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Generate cover letter</>
              )}
            </button>
          </div>
        ) : (
          <>
            <section className="flex flex-col gap-4">
              <p className="text-sm text-foreground leading-relaxed">{content.opening_paragraph}</p>
              {content.body_paragraphs.map((para, i) => (
                <p key={i} className="text-sm text-foreground leading-relaxed">{para}</p>
              ))}
              <p className="text-sm text-foreground leading-relaxed">{content.closing_paragraph}</p>
            </section>

            <div className="pt-3 border-t border-border/40 flex items-center gap-3 flex-wrap">
              <button
                onClick={handleCopyText}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <ClipboardCopy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy text"}
              </button>
              <span className="text-border">·</span>
              <button
                onClick={handleDownloadPdf}
                disabled={downloading}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                {downloading ? "Generating PDF…" : "Download PDF"}
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
          </>
        )}
      </div>
    </div>
  );
}
