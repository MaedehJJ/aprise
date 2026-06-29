"use client";

import { useRouter } from "next/navigation";
import { Loader2, Plus, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConversationListItem } from "@/lib/api";
import { logoLetter, stepBadgeMeta } from "@/app/app/_components/role-workspace/chat-shared";

export function RoleList({
  threads,
  loading,
  error,
  searchQuery,
  onSearchChange,
  onRetry,
  onNewRole,
}: {
  threads: ConversationListItem[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onRetry: () => void;
  onNewRole: () => void;
}) {
  const router = useRouter();

  return (
    <div className="w-[280px] shrink-0 border-r border-border/60 flex flex-col overflow-hidden h-full">
      <div className="p-3 border-b border-border/50 flex flex-col gap-2.5">
        <button
          onClick={onNewRole}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground btn-primary-glow hover:bg-primary/90 transition-all duration-200 w-full"
        >
          <Plus className="w-3.5 h-3.5" />
          New role
        </button>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search roles…"
            className="w-full rounded-lg border border-border/60 bg-muted/30 pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/25"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
          </div>
        ) : error ? (
          <div className="mx-2 mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 flex flex-col gap-1.5">
            <p className="text-[11px] text-red-700">{error}</p>
            <button
              onClick={onRetry}
              className="text-[11px] font-medium text-red-700 underline text-left"
            >
              Retry
            </button>
          </div>
        ) : threads.length === 0 ? (
          searchQuery ? (
            <p className="text-xs text-muted-foreground text-center py-8 px-3">
              No matches found.
            </p>
          ) : (
            <div className="px-2 py-4 flex flex-col items-center text-center gap-3">
              <Sparkles className="w-8 h-8 text-muted-foreground opacity-60" />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground">No roles yet</p>
                <p className="text-[11px] text-muted-foreground px-2">
                  Paste a job description to start coaching.
                </p>
              </div>
              <button
                type="button"
                onClick={onNewRole}
                className="text-xs font-medium text-primary hover:underline"
              >
                New role
              </button>
            </div>
          )
        ) : (
          threads.map((thread) => {
            const badge = stepBadgeMeta[thread.current_step];
            return (
              <button
                key={thread.id}
                type="button"
                onClick={() => router.push(`/app/roles/${thread.id}`)}
                className={cn(
                  "group flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all duration-200 w-full",
                  "border-transparent hover:border-border/60 hover:bg-muted/40"
                )}
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {logoLetter(thread.jd)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground truncate">
                    {thread.jd.company_name || "Unknown company"}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {thread.jd.role_title || "Untitled role"}
                  </p>
                  <span
                    className={cn(
                      "inline-block mt-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border",
                      badge.className
                    )}
                  >
                    {badge.label}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
