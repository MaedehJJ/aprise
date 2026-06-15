"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { TrendingUp } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
        <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center ring-1 ring-red-200">
          <TrendingUp className="w-6 h-6 text-red-400" />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-foreground">Something went wrong</p>
          <p className="text-xs text-muted-foreground">
            {error.message || "An unexpected error occurred in this section."}
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground/50 font-mono">
              Ref: {error.digest}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={reset}
            className="text-xs font-medium px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Try again
          </button>
          <button
            onClick={() => router.push("/app/chat")}
            className="text-xs font-medium px-4 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            Go to chat
          </button>
        </div>
      </div>
    </div>
  );
}
