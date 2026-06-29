"use client";

import { useMemo, useState } from "react";
import DiffMatchPatch from "diff-match-patch";
import { ArrowLeft, GitCompare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Resume, ResumeContent } from "@/lib/api";

function resumeToText(content: ResumeContent | null): string {
  if (!content) return "";
  const lines: string[] = [content.summary, ""];
  for (const exp of content.experience) {
    lines.push(`${exp.role} · ${exp.company} (${exp.dates})`);
    for (const b of exp.bullets) lines.push(`• ${b}`);
    lines.push("");
  }
  if (content.skills.length) {
    lines.push(`Skills: ${content.skills.join(", ")}`);
  }
  return lines.join("\n").trim();
}

function DiffText({ oldText, newText }: { oldText: string; newText: string }) {
  const parts = useMemo(() => {
    const dmp = new DiffMatchPatch();
    const diffs = dmp.diff_main(oldText, newText);
    dmp.diff_cleanupSemantic(diffs);
    return diffs;
  }, [oldText, newText]);

  return (
    <pre className="text-xs leading-relaxed whitespace-pre-wrap font-sans">
      {parts.map(([op, text], i) => (
        <span
          key={i}
          className={cn(
            op === 1 && "bg-emerald-100 text-emerald-900",
            op === -1 && "bg-red-100 text-red-900 line-through decoration-red-400/60",
            op === 0 && "text-foreground"
          )}
        >
          {text}
        </span>
      ))}
    </pre>
  );
}

function formatResumeDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ResumeCompare({
  resumes,
  onClose,
}: {
  resumes: Resume[];
  onClose: () => void;
}) {
  const sorted = useMemo(
    () => [...resumes].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [resumes]
  );
  const [leftId, setLeftId] = useState(sorted[1]?.id ?? sorted[0]?.id ?? "");
  const [rightId, setRightId] = useState(sorted[0]?.id ?? "");

  const left = sorted.find((r) => r.id === leftId) ?? sorted[0];
  const right = sorted.find((r) => r.id === rightId) ?? sorted[0];

  const leftText = resumeToText(left?.content ?? null);
  const rightText = resumeToText(right?.content ?? null);

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold">Compare versions</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>
      </div>

      <div className="shrink-0 grid grid-cols-2 gap-2 px-4 py-3 border-b border-border/40 bg-muted/10">
        <label className="space-y-1">
          <span className="text-[10px] font-semibold uppercase text-muted-foreground">
            Older
          </span>
          <select
            value={leftId}
            onChange={(e) => setLeftId(e.target.value)}
            className="w-full text-xs rounded-lg border border-border bg-background px-2 py-1.5"
          >
            {sorted.map((r) => (
              <option key={r.id} value={r.id}>
                {formatResumeDate(r.created_at)}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-semibold uppercase text-muted-foreground">
            Newer
          </span>
          <select
            value={rightId}
            onChange={(e) => setRightId(e.target.value)}
            className="w-full text-xs rounded-lg border border-border bg-background px-2 py-1.5"
          >
            {sorted.map((r) => (
              <option key={r.id} value={r.id}>
                {formatResumeDate(r.created_at)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-0 overflow-hidden">
        <div className="overflow-y-auto p-4 border-b lg:border-b-0 lg:border-r border-border/40">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-2">
            Removed / unchanged
          </p>
          <DiffText oldText={leftText} newText={rightText} />
        </div>
        <div className="overflow-y-auto p-4">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-2">
            Side-by-side (newer highlighted)
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Older</p>
              <pre className="text-xs whitespace-pre-wrap font-sans text-muted-foreground">
                {leftText || "—"}
              </pre>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Newer</p>
              <pre className="text-xs whitespace-pre-wrap font-sans text-foreground">
                {rightText || "—"}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
