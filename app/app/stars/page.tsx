import { listStarStories } from "@/lib/api-server";
import StarsClient from "./_components/StarsClient";

export default async function StarsPage() {
  const initialStories = await listStarStories();
  return <StarsClient initialStories={initialStories} />;
}
