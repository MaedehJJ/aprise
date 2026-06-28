import { listApplications } from "@/lib/api-server";
import ApplicationsClient from "./_components/ApplicationsClient";

export default async function ApplicationsPage() {
  const initialApps = await listApplications();
  return <ApplicationsClient initialApps={initialApps} />;
}
