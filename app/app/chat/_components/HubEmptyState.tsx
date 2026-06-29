"use client";

import { Plus, Sparkles } from "lucide-react";

export function HubEmptyState({ onNewRole }: { onNewRole: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
      <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center ring-1 ring-primary/15 shadow-sm">
        <Sparkles className="w-7 h-7 text-accent-foreground" />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold text-foreground">Pick a role to continue</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Each role is anchored to a job description — select one from the list or paste a new JD
          to start coaching.
        </p>
      </div>
      <button
        type="button"
        onClick={onNewRole}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground btn-primary-glow hover:bg-primary/90 transition-all duration-200"
      >
        <Plus className="w-4 h-4" />
        New role
      </button>
    </div>
  );
}
