import { listTags } from "@/lib/api-server";
import BrowseClient from "./_components/BrowseClient";

export default async function BrowsePage() {
  const initialTags = await listTags();
  return <BrowseClient initialTags={initialTags} />;
}
