import { Suspense } from "react";
import { listConversations } from "@/lib/api-server";
import ChatClient from "./_components/ChatClient";

export default async function ChatPage() {
  const initialThreads = await listConversations();
  return (
    <Suspense>
      <ChatClient initialThreads={initialThreads} />
    </Suspense>
  );
}
