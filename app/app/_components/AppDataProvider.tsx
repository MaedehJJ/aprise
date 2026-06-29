"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "@clerk/nextjs";
import { ConversationListItem, listConversations } from "@/lib/api";

interface AppDataContextValue {
  threads: ConversationListItem[];
  loadingThreads: boolean;
  refreshConversations: () => Promise<void>;
  prependThread: (thread: ConversationListItem) => void;
  seedThreads: (threads: ConversationListItem[]) => void;
}

const AppDataContext = createContext<AppDataContextValue>({
  threads: [],
  loadingThreads: false,
  refreshConversations: async () => {},
  prependThread: () => {},
  seedThreads: () => {},
});

export function useAppData() {
  return useContext(AppDataContext);
}

export function AppDataProvider({
  initialThreads,
  children,
}: {
  initialThreads?: ConversationListItem[];
  children: React.ReactNode;
}) {
  const { getToken } = useAuth();
  const [threads, setThreads] = useState<ConversationListItem[]>(
    initialThreads ?? []
  );
  const [loadingThreads, setLoadingThreads] = useState(!initialThreads);
  const hasFetched = useRef(false);

  const refreshConversations = useCallback(async () => {
    setLoadingThreads(true);
    try {
      const data = await listConversations(getToken);
      setThreads(data);
    } finally {
      setLoadingThreads(false);
    }
  }, [getToken]);

  const prependThread = useCallback((thread: ConversationListItem) => {
    setThreads((prev) => [thread, ...prev.filter((t) => t.id !== thread.id)]);
  }, []);

  const seedThreads = useCallback((data: ConversationListItem[]) => {
    setThreads((prev) => (prev.length === 0 ? data : prev));
  }, []);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    // Always revalidate in background — even if initialThreads was provided
    void refreshConversations();
  }, [refreshConversations]);

  return (
    <AppDataContext.Provider
      value={{ threads, loadingThreads, refreshConversations, prependThread, seedThreads }}
    >
      {children}
    </AppDataContext.Provider>
  );
}
