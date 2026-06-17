"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  Building2,
  Check,
  Clock,
  FileText,
  Loader2,
  MoreHorizontal,
  Plus,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ApiError,
  Application,
  ApplicationStatus,
  deleteApplication,
  listApplications,
  updateApplication,
} from "@/lib/api";

/* ── Stage config ─────────────────────────────────────────────────── */
const STAGES: ApplicationStatus[] = [
  "applied",
  "screening",
  "technical",
  "behavioral",
  "offer",
  "rejected",
];

const stageLabel: Record<ApplicationStatus, string> = {
  applied: "Applied",
  screening: "Screening",
  technical: "Technical",
  behavioral: "Behavioral",
  offer: "Offer",
  rejected: "Rejected",
};

const stageDot: Record<ApplicationStatus, string> = {
  applied: "bg-blue-500",
  screening: "bg-amber-500",
  technical: "bg-violet-500",
  behavioral: "bg-indigo-500",
  offer: "bg-emerald-500",
  rejected: "bg-gray-400",
};

const stageColors: Record<ApplicationStatus, string> = {
  applied: "bg-blue-100 text-blue-700 border-blue-200",
  screening: "bg-amber-100 text-amber-700 border-amber-200",
  technical: "bg-violet-100 text-violet-700 border-violet-200",
  behavioral: "bg-indigo-100 text-indigo-700 border-indigo-200",
  offer: "bg-emerald-100 text-emerald-700 border-emerald-200",
  rejected: "bg-gray-100 text-gray-500 border-gray-200",
};

/** Statuses a user can move an application to from a given status. */
const nextStages: Record<ApplicationStatus, ApplicationStatus[]> = {
  applied: ["screening", "rejected"],
  screening: ["technical", "behavioral", "rejected"],
  technical: ["behavioral", "offer", "rejected"],
  behavioral: ["offer", "rejected"],
  offer: ["rejected"],
  rejected: [],
};

/* ── Page ─────────────────────────────────────────────────────────── */
export default function ApplicationsPage() {
  const { getToken } = useAuth();
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedApp = apps.find((a) => a.id === selectedId) ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listApplications(getToken);
      setApps(data);
      if (data.length > 0 && !selectedId) setSelectedId(data[0].id);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? String(err.detail ?? err.message)
          : "Could not load applications."
      );
    } finally {
      setLoading(false);
    }
  }, [getToken, selectedId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStatusChange = async (id: string, newStatus: ApplicationStatus) => {
    // Optimistic update
    setApps((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a))
    );
    try {
      const updated = await updateApplication(getToken, id, { status: newStatus });
      setApps((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch {
      // Roll back on failure
      load();
    }
  };

  const handleNotesChange = async (id: string, notes: string) => {
    try {
      const updated = await updateApplication(getToken, id, { notes });
      setApps((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch {
      /* silent — notes are best-effort */
    }
  };

  const handleDelete = async (id: string) => {
    setApps((prev) => prev.filter((a) => a.id !== id));
    if (selectedId === id) setSelectedId(apps.find((a) => a.id !== id)?.id ?? null);
    try {
      await deleteApplication(getToken, id);
    } catch {
      load(); // restore on failure
    }
  };

  const activeCount = apps.filter(
    (a) => a.status !== "rejected"
  ).length;

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Kanban board */}
      <div className="flex-1 overflow-auto p-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground leading-tight">
              Pipeline
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {loading ? "Loading…" : `${activeCount} active application${activeCount !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-700 flex-1">{error}</p>
            <button onClick={load} className="text-xs font-medium text-red-700 underline">
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex gap-4 min-w-max pb-4">
            {STAGES.map((stage) => (
              <KanbanColumn
                key={stage}
                stage={stage}
                apps={apps.filter((a) => a.status === stage)}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selectedApp && (
        <DetailPanel
          app={selectedApp}
          onClose={() => setSelectedId(null)}
          onStatusChange={(s) => handleStatusChange(selectedApp.id, s)}
          onNotesChange={(n) => handleNotesChange(selectedApp.id, n)}
          onDelete={() => handleDelete(selectedApp.id)}
        />
      )}
    </div>
  );
}

/* ── Kanban column ────────────────────────────────────────────────── */
function KanbanColumn({
  stage,
  apps,
  selectedId,
  onSelect,
}: {
  stage: ApplicationStatus;
  apps: Application[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5 w-[210px]">
      <div className="flex items-center gap-2 mb-1">
        <span className={cn("w-2 h-2 rounded-full", stageDot[stage])} />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {stageLabel[stage]}
        </span>
        <span className="ml-auto text-[10px] font-semibold bg-muted/80 text-muted-foreground rounded-full px-1.5 py-0.5">
          {apps.length}
        </span>
      </div>

      <div className="flex flex-col gap-2.5 min-h-[120px]">
        {apps.map((app) => (
          <AppCard
            key={app.id}
            app={app}
            selected={app.id === selectedId}
            onSelect={() => onSelect(app.id)}
          />
        ))}
        {apps.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 p-6 text-center">
            <span className="text-[10px] text-muted-foreground/60 font-medium">Empty</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Application card ─────────────────────────────────────────────── */
function AppCard({
  app,
  selected,
  onSelect,
}: {
  app: Application;
  selected: boolean;
  onSelect: () => void;
}) {
  const date = new Date(app.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      className={cn(
        "flex flex-col gap-2.5 p-3.5 rounded-xl border text-left transition-all duration-200 cursor-pointer",
        selected
          ? "border-primary/40 bg-accent/60 ring-2 ring-primary/20 shadow-sm"
          : "border-border/60 bg-card hover:border-primary/25 hover:shadow-md"
      )}
    >
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
          {(app.company_name || "?").slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">
            {app.company_name || "Unknown company"}
          </p>
        </div>
      </div>

      <p className="text-[11px] font-medium text-foreground leading-snug">
        {app.role_title || "Untitled role"}
      </p>

      <div className="flex items-center justify-between">
        <span
          className={cn(
            "text-[9px] font-semibold px-2 py-0.5 rounded-full border",
            stageColors[app.status]
          )}
        >
          {stageLabel[app.status]}
        </span>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="w-3 h-3" />
          {date}
        </div>
      </div>
    </div>
  );
}

/* ── Detail panel ─────────────────────────────────────────────────── */
function DetailPanel({
  app,
  onClose,
  onStatusChange,
  onNotesChange,
  onDelete,
}: {
  app: Application;
  onClose: () => void;
  onStatusChange: (s: ApplicationStatus) => void;
  onNotesChange: (notes: string) => void;
  onDelete: () => void;
}) {
  const [notes, setNotes] = useState(app.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sync notes if a different app is selected
  useEffect(() => {
    setNotes(app.notes ?? "");
    setSaved(false);
  }, [app.id, app.notes]);

  const handleSaveNotes = async () => {
    setSaving(true);
    await onNotesChange(notes);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const available = nextStages[app.status];
  const date = new Date(app.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <aside className="w-[300px] shrink-0 border-l border-border/60 bg-sidebar flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
            {(app.company_name || "?").slice(0, 1).toUpperCase()}
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">
              {app.company_name || "Unknown company"}
            </p>
            <p className="text-[10px] text-muted-foreground truncate max-w-[160px]">
              {app.role_title || "Untitled role"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onDelete}
            className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-all duration-150"
            title="Delete application"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-150"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-4 p-4">
        {/* Status badge + date */}
        <div className="flex items-center justify-between">
          <span
            className={cn(
              "text-[10px] font-semibold px-2.5 py-1 rounded-full border",
              stageColors[app.status]
            )}
          >
            {stageLabel[app.status]}
          </span>
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {date}
          </span>
        </div>

        {/* Move to stage */}
        {available.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Move to
            </p>
            <div className="flex flex-wrap gap-1.5">
              {available.map((s) => (
                <button
                  key={s}
                  onClick={() => onStatusChange(s)}
                  className={cn(
                    "text-[10px] font-medium px-2.5 py-1 rounded-lg border transition-all duration-150",
                    "border-border/60 bg-card hover:border-primary/30 hover:bg-accent/50 text-foreground"
                  )}
                >
                  {stageLabel[s]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Resume indicator */}
        {app.resume_id && (
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-3 py-2">
            <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">Resume attached</span>
          </div>
        )}

        {/* Notes */}
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Notes
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={5}
            placeholder="Add notes about this application…"
            className="w-full rounded-xl border border-border/60 bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/30 resize-none transition-all duration-200"
          />
          <div className="flex items-center justify-between">
            {saved && (
              <span className="text-[10px] text-emerald-600 flex items-center gap-1">
                <Check className="w-3 h-3" /> Saved
              </span>
            )}
            <button
              onClick={handleSaveNotes}
              disabled={saving || notes === (app.notes ?? "")}
              className={cn(
                "ml-auto text-[10px] font-medium px-2.5 py-1 rounded-lg transition-all",
                saving || notes === (app.notes ?? "")
                  ? "text-muted-foreground opacity-50 cursor-not-allowed"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        {/* Company info placeholder */}
        <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-3 py-2">
          <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground">
            Company research coming in Phase 6
          </span>
        </div>
      </div>
    </aside>
  );
}
