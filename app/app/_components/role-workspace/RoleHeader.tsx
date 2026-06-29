"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, ChevronDown, ListChecks, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScoreRing } from "@/app/app/_components/ScoreRing";
import type { ATSScore, ConversationDetail, FitScore } from "@/lib/api";
import { getFitScore, getJD } from "@/lib/api";
import { logoLetter, stepBadgeMeta } from "./chat-shared";

export function RoleHeader({
  detail,
  getToken,
  fitScore,
  fitScoreLoading,
  onRefreshFitScore,
  atsScore,
}: {
  detail: ConversationDetail;
  getToken: () => Promise<string | null>;
  fitScore: FitScore | null;
  fitScoreLoading: boolean;
  onRefreshFitScore: (refresh?: boolean) => void;
  atsScore?: ATSScore | null;
}) {
  const badge = stepBadgeMeta[detail.current_step];
  const [companyResearch, setCompanyResearch] = useState(detail.jd.company_research);
  const [researchPending, setResearchPending] = useState(false);
  const [researchOpen, setResearchOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    const loadJdMeta = async () => {
      try {
        const jd = await getJD(getToken, detail.jd.id);
        if (cancelled) return;
        if (jd.company_research) setCompanyResearch(jd.company_research);
        const pending = jd.company_research_status === "pending";
        setResearchPending(pending);
        if (pending && !timer) timer = setInterval(loadJdMeta, 3000);
        else if (!pending && timer) {
          clearInterval(timer);
          timer = undefined;
        }
      } catch {
        // non-fatal
      }
    };

    void loadJdMeta();
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [detail.jd.id, getToken]);

  return (
    <div className="shrink-0 border-b border-border/60 bg-background">
      <div className="flex items-center justify-between px-5 py-3 gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
            {logoLetter(detail.jd)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {detail.jd.company_name || "Unknown company"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {detail.jd.role_title || "Untitled role"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {fitScore ? (
            <button
              type="button"
              onClick={() => onRefreshFitScore(true)}
              disabled={fitScoreLoading}
              className="disabled:opacity-50"
              title="Refresh fit score"
            >
              <ScoreRing score={fitScore.score} fitLevel={fitScore.fit_level} />
            </button>
          ) : (
            <button
              onClick={() => onRefreshFitScore(false)}
              disabled={fitScoreLoading}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {fitScoreLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              Fit score
            </button>
          )}
          {atsScore && (
            <ScoreRing score={atsScore.score} label="ATS" size="sm" />
          )}
          <span
            className={cn(
              "text-[10px] font-semibold px-2.5 py-1 rounded-full border inline-flex items-center gap-1.5",
              badge.className
            )}
          >
            <ListChecks className="w-3 h-3" />
            {badge.label}
          </span>
        </div>
      </div>

      {researchPending && !companyResearch && (
        <div className="mx-5 mb-2 flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 border border-border/50">
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
          Researching company…
        </div>
      )}

      {companyResearch && (
        <div className="border-t border-border/40">
          <button
            type="button"
            onClick={() => setResearchOpen((o) => !o)}
            className="w-full flex items-center justify-between px-5 py-2.5 text-left hover:bg-muted/30 transition-colors"
          >
            <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Building2 className="w-3.5 h-3.5" />
              Company snapshot
            </span>
            <ChevronDown
              className={cn(
                "w-3.5 h-3.5 text-muted-foreground transition-transform",
                researchOpen && "rotate-180"
              )}
            />
          </button>
          {researchOpen && (
            <div className="px-5 pb-3">
              <p className="text-xs text-muted-foreground leading-relaxed">{companyResearch}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function RoleWorkspaceFooter() {
  return (
    <div className="shrink-0 border-t border-border/50 px-5 py-2 flex items-center gap-4 text-[11px] text-muted-foreground bg-muted/20">
      <Link href="/app/files" className="hover:text-foreground transition-colors">
        All memories → Files
      </Link>
      <span className="text-border">·</span>
      <Link href="/app/stars" className="hover:text-foreground transition-colors">
        All STAR stories → Library
      </Link>
    </div>
  );
}

/** Hook for fit score state used by RoleHeader */
export function useFitScore(jdId: string, getToken: () => Promise<string | null>) {
  const [fitScore, setFitScore] = useState<FitScore | null>(null);
  const [fitScoreLoading, setFitScoreLoading] = useState(false);

  const loadFitScore = async (refresh = false) => {
    if (!jdId) return;
    setFitScoreLoading(true);
    try {
      const jd = await getJD(getToken, jdId);
      if (jd.fit_score && !refresh) {
        setFitScore(jd.fit_score);
        return;
      }
      const score = await getFitScore(getToken, jdId, { refresh });
      setFitScore(score);
    } catch {
      // silent
    } finally {
      setFitScoreLoading(false);
    }
  };

  useEffect(() => {
    if (!jdId) return;
    void loadFitScore(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jdId, getToken]);

  return { fitScore, fitScoreLoading, loadFitScore };
}
