"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { ConversationListItem } from "@/lib/api";
import { useAppData } from "@/app/app/_components/AppDataProvider";
import { JdInputForm } from "@/app/app/_components/role-workspace/JdInputForm";
import { RoleList } from "./RoleList";
import { HubEmptyState } from "./HubEmptyState";

export default function ChatClient({
  initialThreads,
}: {
  initialThreads?: ConversationListItem[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getToken } = useAuth();
  const { threads, loadingThreads, refreshConversations, prependThread, seedThreads } = useAppData();

  const [showNewChat, setShowNewChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const didInit = useRef(false);

  const jdParam = searchParams.get("jd");
  const startFresh = searchParams.get("new") === "1";

  useEffect(() => {
    const legacy = searchParams.get("conversation");
    if (legacy) router.replace(`/app/roles/${legacy}`);
  }, [searchParams, router]);

  // Seed context with SSR data so RoleList renders immediately on first paint.
  useEffect(() => {
    if (initialThreads?.length) seedThreads(initialThreads);
  }, [initialThreads, seedThreads]);

  useEffect(() => {
    if (startFresh) setShowNewChat(true);
  }, [startFresh]);

  // Handle ?jd= redirect — wait until we have threads (either from context or initial)
  useEffect(() => {
    if (!jdParam) return;
    if (didInit.current) return;
    const source = threads.length > 0 ? threads : (initialThreads ?? []);
    if (source.length === 0 && loadingThreads) return; // wait for data
    didInit.current = true;
    const match = source.find((t) => t.jd.id === jdParam);
    if (match) router.push(`/app/roles/${match.id}`);
    router.replace("/app/chat");
  }, [jdParam, threads, initialThreads, loadingThreads, router]);

  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) return threads;
    const q = searchQuery.toLowerCase();
    return threads.filter(
      (t) =>
        t.jd.company_name?.toLowerCase().includes(q) ||
        t.jd.role_title?.toLowerCase().includes(q)
    );
  }, [threads, searchQuery]);

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      <RoleList
        threads={filteredThreads}
        loading={loadingThreads}
        error={null}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onRetry={() => void refreshConversations()}
        onNewRole={() => setShowNewChat(true)}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {showNewChat ? (
          <JdInputForm
            getToken={getToken}
            onCancel={() => setShowNewChat(false)}
            onCreated={(conv) => {
              prependThread({
                id: conv.id,
                jd: conv.jd,
                current_step: conv.current_step,
                last_message: conv.messages[conv.messages.length - 1]?.content ?? null,
                updated_at: conv.updated_at,
              });
              router.push(`/app/roles/${conv.id}`);
            }}
          />
        ) : (
          <HubEmptyState onNewRole={() => setShowNewChat(true)} />
        )}
      </div>
    </div>
  );
}
