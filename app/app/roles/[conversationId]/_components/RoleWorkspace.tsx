"use client";

import { useCallback, useRef, useState } from "react";
import { Loader2, PanelRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { RoleStepper } from "@/app/app/_components/RoleStepper";
import { RateLimitBanner } from "@/app/app/_components/RateLimitBanner";
import type { ATSScore } from "@/lib/api";
import { useRoleConversation } from "@/app/app/_components/role-workspace/useRoleConversation";
import { RoleHeader, RoleWorkspaceFooter, useFitScore } from "@/app/app/_components/role-workspace/RoleHeader";
import { SimilarRolesBanner } from "@/app/app/_components/role-workspace/SimilarRolesBanner";
import { ConversationPanel } from "@/app/app/_components/role-workspace/ConversationPanel";
import { RoleOutputsPanel } from "@/app/app/_components/role-workspace/RoleOutputsPanel";
import { RoleNotesPanel } from "@/app/app/_components/role-workspace/RoleNotesPanel";

export default function RoleWorkspace({
  conversationId,
  getToken,
  highlightInterview,
}: {
  conversationId: string;
  getToken: () => Promise<string | null>;
  highlightInterview?: boolean;
}) {
  const {
    detail,
    loading,
    error,
    composerValue,
    setComposerValue,
    sending,
    thinkingPhase,
    sendError,
    setSendError,
    systemUpdates,
    addSystemUpdate,
    dismissSystemUpdate,
    handleSend,
    setDetail,
    rateLimitSeconds,
    clearRateLimit,
  } = useRoleConversation(conversationId, getToken);

  const { fitScore, fitScoreLoading, loadFitScore } = useFitScore(
    detail?.jd.id ?? "",
    getToken
  );
  const [atsScore, setAtsScore] = useState<ATSScore | null>(null);
  const [mobileOutputsOpen, setMobileOutputsOpen] = useState(false);
  const [resumeTabFocusKey, setResumeTabFocusKey] = useState(0);
  const [outputsWidth, setOutputsWidth] = useState(420);
  const dragState = useRef<{ startX: number; startWidth: number } | null>(null);

  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragState.current = { startX: e.clientX, startWidth: outputsWidth };
    const onMove = (ev: MouseEvent) => {
      if (!dragState.current) return;
      const delta = dragState.current.startX - ev.clientX;
      setOutputsWidth(Math.max(280, Math.min(700, dragState.current.startWidth + delta)));
    };
    const onUp = () => {
      dragState.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [outputsWidth]);

  const handleOpenOutputs = () => {
    setResumeTabFocusKey((k) => k + 1);
    setMobileOutputsOpen(true);
  };

  if (loading && !detail) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-red-600">{error ?? "Role not found."}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <RoleHeader
        detail={detail}
        getToken={getToken}
        fitScore={fitScore}
        fitScoreLoading={fitScoreLoading}
        onRefreshFitScore={loadFitScore}
        atsScore={atsScore}
      />
      <SimilarRolesBanner jdId={detail.jd.id} getToken={getToken} />
      <RoleStepper currentStep={detail.current_step} className="hidden sm:flex" />
      <div className="sm:hidden px-4 py-1.5 border-b border-border/40 bg-muted/10">
        <RoleStepper currentStep={detail.current_step} compact />
      </div>

      {sendError?.includes("Rate limit") && (
        <RateLimitBanner retryAfterSeconds={rateLimitSeconds} onDismiss={clearRateLimit} />
      )}

      {highlightInterview && (
        <div className="shrink-0 mx-4 mt-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-800">
          Interview prep mode — answer questions in the chat below.
        </div>
      )}

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Chat column */}
        <div className="flex-1 min-w-0 flex flex-col border-r border-border/50">
          <ConversationPanel
            detail={detail}
            composerValue={composerValue}
            onComposerChange={setComposerValue}
            onSend={handleSend}
            sending={sending}
            rateLimited={rateLimitSeconds !== null}
            thinkingPhase={thinkingPhase}
            systemUpdates={systemUpdates}
            onDismissSystemUpdate={dismissSystemUpdate}
            sendError={sendError?.includes("Rate limit") ? null : sendError}
            onDismissSendError={() => setSendError(null)}
            onOpenOutputs={handleOpenOutputs}
          />
        </div>

        {/* Drag handle */}
        <div
          onMouseDown={handleDividerMouseDown}
          className="hidden lg:flex w-1.5 shrink-0 cursor-col-resize items-center justify-center hover:bg-primary/20 active:bg-primary/40 transition-colors group"
          title="Drag to resize"
        >
          <div className="w-0.5 h-8 rounded-full bg-border group-hover:bg-primary/40 transition-colors" />
        </div>

        {/* Outputs column — desktop */}
        <div
          className="hidden lg:flex shrink-0 flex-col min-h-0 bg-muted/5"
          style={{ width: outputsWidth }}
        >
          <RoleOutputsPanel
            detail={detail}
            getToken={getToken}
            onDetailUpdate={setDetail}
            onAddSystemUpdate={addSystemUpdate}
            onAtsScoreChange={(score) => setAtsScore(score ?? null)}
            autoOpenOnResumeReady
            resumeTabFocusKey={resumeTabFocusKey}
          />
        </div>
      </div>

      <RoleNotesPanel jdId={detail.jd.id} getToken={getToken} />
      <RoleWorkspaceFooter />

      {/* Mobile outputs sheet */}
      <div className="lg:hidden shrink-0 border-t border-border/50 p-2 bg-background">
        <button
          type="button"
          onClick={() => setMobileOutputsOpen(true)}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary/10 text-primary py-2.5 text-sm font-semibold"
        >
          <PanelRight className="w-4 h-4" />
          Resume & actions
        </button>
      </div>

      {mobileOutputsOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close panel"
            onClick={() => setMobileOutputsOpen(false)}
          />
          <div className="relative bg-background rounded-t-2xl border-t border-border shadow-xl max-h-[85vh] flex flex-col min-h-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
              <p className="text-sm font-semibold">Resume & actions</p>
              <button
                type="button"
                onClick={() => setMobileOutputsOpen(false)}
                className="text-xs font-medium text-muted-foreground"
              >
                Close
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <RoleOutputsPanel
                detail={detail}
                getToken={getToken}
                onDetailUpdate={setDetail}
                onAddSystemUpdate={addSystemUpdate}
                onAtsScoreChange={(score) => setAtsScore(score ?? null)}
                autoOpenOnResumeReady
                resumeTabFocusKey={resumeTabFocusKey}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
