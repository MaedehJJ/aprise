"use client";

import { useState } from "react";
import { Briefcase, Building2, FileText, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ApiError, ConversationDetail, createConversation, createJD,
} from "@/lib/api";
import { trackFunnelEvent } from "@/lib/analytics";

export function JdInputForm({
  getToken,
  onCancel,
  onCreated,
}: {
  getToken: () => Promise<string | null>;
  onCancel: () => void;
  onCreated: (conv: ConversationDetail) => void;
}) {
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "parsing" | "coaching" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleStart = async () => {
    if (!text.trim() || status !== "idle") return;
    setErrorMsg("");

    try {
      setStatus("parsing");
      const jd = await createJD(getToken, text.trim());
      trackFunnelEvent("jd_created", { jd_id: String(jd.id) });

      setStatus("coaching");
      const conv = await createConversation(getToken, jd.id);
      onCreated(conv);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? String(err.detail ?? err.message)
          : "Something went wrong. Please try again.";
      setErrorMsg(msg);
      setStatus("error");
    }
  };

  const isLoading = status === "parsing" || status === "coaching";

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-xl mx-auto flex flex-col gap-6">
        <div className="space-y-1.5">
          <h2 className="text-2xl">Start a new conversation</h2>
          <p className="text-sm text-muted-foreground">
            Paste the job description you&apos;re targeting — your coach will parse it, compare it
            against your memory, and guide you toward a tailored resume.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Building2 className="w-3 h-3" /> Company
            </label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. Stripe"
              disabled={isLoading}
              className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all duration-200 disabled:opacity-50"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Briefcase className="w-3 h-3" /> Role title
            </label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Senior Frontend Engineer"
              disabled={isLoading}
              className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all duration-200 disabled:opacity-50"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <FileText className="w-3 h-3" /> Job description
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the full job description here…"
            rows={10}
            disabled={isLoading}
            className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all duration-200 resize-none disabled:opacity-50"
          />
        </div>

        {errorMsg && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
            {errorMsg}
          </p>
        )}

        {isLoading && (
          <div className="flex items-center gap-2.5 text-sm text-muted-foreground bg-muted/40 rounded-xl px-4 py-3">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            {status === "parsing"
              ? "Parsing the job description…"
              : "Running gap analysis against your memory…"}
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleStart}
            disabled={!text.trim() || isLoading}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200",
              text.trim() && !isLoading
                ? "bg-primary text-primary-foreground btn-primary-glow hover:bg-primary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
            )}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Start coaching
          </button>
        </div>
      </div>
    </div>
  );
}
