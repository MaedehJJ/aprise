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
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status && status >= 500) {
      // Let the error boundary (app/app/error.tsx) handle 5xx errors.
      throw err;
    }
    // For non-5xx errors (auth blips, aborted requests), fall through — Clerk
    // middleware has already verified the session so the page will load fine.
  }

  return <AppShell>{children}</AppShell>;
}
