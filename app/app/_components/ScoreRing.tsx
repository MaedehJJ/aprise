"use client";

import { cn } from "@/lib/utils";
import type { FitLevel } from "@/lib/api";

const levelStyles: Record<FitLevel, string> = {
  strong: "text-emerald-700 border-emerald-200 bg-emerald-50",
  moderate: "text-amber-700 border-amber-200 bg-amber-50",
  weak: "text-red-700 border-red-200 bg-red-50",
};

export function ScoreRing({
  score,
  fitLevel,
  label = "Fit",
  size = "sm",
  className,
}: {
  score: number;
  fitLevel?: FitLevel;
  label?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const level: FitLevel =
    fitLevel ??
    (score >= 75 ? "strong" : score >= 50 ? "moderate" : "weak");

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 font-semibold rounded-full border",
        size === "sm" ? "text-xs px-2.5 py-1" : "text-sm px-3 py-1.5",
        levelStyles[level],
        className
      )}
      title={`${label} ${score}%`}
    >
      <span className="opacity-80">{label}</span>
      <span>{score}%</span>
    </div>
  );
}
