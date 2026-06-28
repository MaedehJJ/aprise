import { listDocuments, listMemories } from "@/lib/api-server";
import FilesClient from "./_components/FilesClient";

export default async function FilesPage() {
  const [initialFiles, initialMemories] = await Promise.all([
    listDocuments(),
    listMemories(),
  ]);
  return <FilesClient initialFiles={initialFiles} initialMemories={initialMemories} />;
}
