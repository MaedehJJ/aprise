import { Suspense } from "react";
import ChatClient from "./_components/ChatClient";
import PageLoader from "../_components/PageLoader";
import { listConversations } from "@/lib/api-server";

export default async function ChatPage() {
  const initialThreads = await listConversations().catch(() => undefined);

  return (
    <Suspense fallback={<PageLoader />}>
      <ChatClient initialThreads={initialThreads} />
    </Suspense>
  );
}
