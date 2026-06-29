"use client";

import { Clock } from "lucide-react";

export function RateLimitBanner({
  retryAfterSeconds,
  onDismiss,
}: {
  retryAfterSeconds: number | null;
  onDismiss?: () => void;
}) {
  const minutes = retryAfterSeconds ? Math.max(1, Math.ceil(retryAfterSeconds / 60)) : null;

  return (
    <div className="flex items-start gap-2.5 text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-3 mx-4 mb-2">
      <Clock className="w-4 h-4 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="font-medium">Rate limit reached</p>
        <p className="text-xs mt-0.5 opacity-90">
          {minutes
            ? `Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}. AI calls are limited to control cost.`
            : "Please wait a moment before trying again."}
        </p>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs font-medium underline shrink-0"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
