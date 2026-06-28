import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getMyProfile } from "@/lib/api-server";
import AppShell from "./_components/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  try {
    const profile = await getMyProfile();
    if (!profile) {
      redirect("/onboarding");
    }
  } catch {
    // If the profile check fails for any reason (transient 5xx, network blip,
    // etc.), fall through and render the shell. The middleware has already
    // confirmed the user is authenticated. Individual pages handle their own
    // data errors via the segment error boundary (app/app/error.tsx).
  }

  return <AppShell>{children}</AppShell>;
}
