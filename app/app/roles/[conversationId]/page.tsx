import { Suspense } from "react";
import PageLoader from "../../_components/PageLoader";
import RoleWorkspaceClient from "./_components/RoleWorkspaceClient";

export default function RoleWorkspacePage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  return (
    <Suspense fallback={<PageLoader />}>
      <RoleWorkspacePageInner params={params} />
    </Suspense>
  );
}

async function RoleWorkspacePageInner({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  return <RoleWorkspaceClient conversationId={conversationId} />;
}
