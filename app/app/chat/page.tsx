import { Suspense } from "react";
import ChatClient from "./_components/ChatClient";
import PageLoader from "../_components/PageLoader";

export default function ChatPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ChatClient />
    </Suspense>
  );
}
