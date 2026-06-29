"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import { startInterviewPrep } from "@/lib/api";
import { trackFunnelEvent } from "@/lib/analytics";
import RoleWorkspace from "./RoleWorkspace";

export default function RoleWorkspaceClient({
  conversationId,
}: {
  conversationId: string;
}) {
  const { getToken } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const interviewBootstrapped = useRef(false);
  const interviewMode = searchParams.get("mode") === "interview";
  const starId = searchParams.get("starId");

  useEffect(() => {
    if (!interviewMode || interviewBootstrapped.current) return;
    interviewBootstrapped.current = true;
    void startInterviewPrep(getToken, conversationId)
      .then(() => trackFunnelEvent("interview_prep_started", { conversation_id: conversationId }))
      .catch(() => {
        // workspace still loads; user can start manually
      })
      .finally(() => {
        router.replace(`/app/roles/${conversationId}`);
      });
  }, [interviewMode, conversationId, getToken, router]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50 shrink-0 bg-background/80">
        <Link
          href="/app/chat"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All roles
        </Link>
        {interviewMode && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200">
            Interview prep
          </span>
        )}
        {starId && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
            Practicing a STAR story
          </span>
        )}
      </div>
      <div className="flex-1 min-h-0">
        <RoleWorkspace
          conversationId={conversationId}
          getToken={getToken}
          highlightInterview={interviewMode}
        />
      </div>
    </div>
  );
}
