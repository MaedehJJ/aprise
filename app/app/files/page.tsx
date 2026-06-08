"use client";

import { useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  FileText,
  Link2,
  Plus,
  Sparkles,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Trash2,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ingestCv, ApiError } from "@/lib/api";

/* ── Types ────────────────────────────────────────────────────────── */
type FileStatus = "ready" | "processing" | "error";
type FileKind = "resume" | "linkedin" | "other";

interface UploadedFile {
  id: string;
  name: string;
  kind: FileKind;
  status: FileStatus;
  uploadedAt: string;
  memoriesExtracted?: number;
  errorMessage?: string;
}

const sampleFiles: UploadedFile[] = [
  {
    id: "f1",
    name: "Resume_2026_SeniorFrontend.pdf",
    kind: "resume",
    status: "ready",
    uploadedAt: "Jun 2",
    memoriesExtracted: 14,
  },
  {
    id: "f2",
    name: "LinkedIn_Profile_Export.pdf",
    kind: "linkedin",
    status: "ready",
    uploadedAt: "Jun 2",
    memoriesExtracted: 9,
  },
  {
    id: "f3",
    name: "Resume_Draft_v3.pdf",
    kind: "resume",
    status: "ready",
    uploadedAt: "May 28",
    memoriesExtracted: 11,
  },
];

const kindMeta: Record<FileKind, { label: string; icon: typeof FileText }> = {
  resume: { label: "Resume", icon: FileText },
  linkedin: { label: "LinkedIn export", icon: Link2 },
  other: { label: "Document", icon: FileText },
};

const statusMeta: Record<FileStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  ready: { label: "Ingested", className: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  processing: { label: "Processing", className: "bg-amber-100 text-amber-700 border-amber-200", icon: Loader2 },
  error: { label: "Failed", className: "bg-red-100 text-red-700 border-red-200", icon: AlertCircle },
};

export default function FilesPage() {
  const { getToken } = useAuth();
  const [files, setFiles] = useState<UploadedFile[]>(sampleFiles);
  const inputRef = useRef<HTMLInputElement>(null);

  const totalMemories = files.reduce((sum, f) => sum + (f.memoriesExtracted ?? 0), 0);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const incoming = Array.from(fileList).map((file) => {
      const id = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const kind: FileKind = /linkedin/i.test(file.name) ? "linkedin" : "resume";
      return {
        id,
        file,
        record: {
          id,
          name: file.name,
          kind,
          status: "processing" as FileStatus,
          uploadedAt: "Just now",
        },
      };
    });

    setFiles((prev) => [...incoming.map((i) => i.record), ...prev]);

    for (const { id, file } of incoming) {
      try {
        const result = await ingestCv(getToken, file);
        setFiles((prev) =>
          prev.map((f) =>
            f.id === id
              ? {
                  ...f,
                  status: "ready",
                  memoriesExtracted: result.memories_created ?? undefined,
                }
              : f
          )
        );
      } catch (err) {
        const message =
          err instanceof ApiError ? String(err.detail ?? err.message) : "Upload failed. Please try again.";
        setFiles((prev) =>
          prev.map((f) => (f.id === id ? { ...f, status: "error", errorMessage: message } : f))
        );
      }
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-foreground" style={{ fontFamily: "var(--font-instrument-serif)" }}>
              Your files & memory
            </h1>
            <p className="text-sm text-muted-foreground max-w-lg">
              Every resume and LinkedIn export you upload gets read, sanitized, and broken down
              into memories — the building blocks your coach uses to tailor advice and resumes.
            </p>
          </div>
          <button
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground btn-primary-glow hover:bg-primary/90 transition-all duration-200 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Upload file
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={FileText} label="Documents" value={String(files.length)} />
          <StatCard icon={Sparkles} label="Memories built" value={String(totalMemories)} />
          <StatCard
            icon={CheckCircle2}
            label="Ingested"
            value={String(files.filter((f) => f.status === "ready").length)}
          />
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border/60 bg-muted/20 hover:bg-muted/30 hover:border-primary/30 transition-all duration-200 cursor-pointer p-8 text-center"
        >
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center ring-1 ring-primary/15">
            <Plus className="w-5 h-5 text-accent-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">Drop a PDF here, or click to browse</p>
          <p className="text-xs text-muted-foreground">
            Resumes and LinkedIn profile exports — PDF only, up to 5MB each
          </p>
        </div>

        {/* File list */}
        <div className="flex flex-col gap-2.5">
          {files.map((file) => (
            <FileRow key={file.id} file={file} onRemove={(id) => setFiles((prev) => prev.filter((f) => f.id !== id))} />
          ))}

          {files.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border/60 bg-muted/20 p-10 text-center">
              <p className="text-sm text-muted-foreground">No files yet — upload your first resume to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Stat card ───────────────────────────────────────────────────── */
function StatCard({ icon: Icon, label, value }: { icon: typeof FileText; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4">
      <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center ring-1 ring-primary/15 shrink-0">
        <Icon className="w-4 h-4 text-accent-foreground" />
      </div>
      <div>
        <p className="text-lg font-semibold text-foreground leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </div>
    </div>
  );
}

/* ── File row ────────────────────────────────────────────────────── */
function FileRow({ file, onRemove }: { file: UploadedFile; onRemove: (id: string) => void }) {
  const kind = kindMeta[file.kind];
  const status = statusMeta[file.status];

  return (
    <div className="group flex items-center gap-3.5 rounded-2xl border border-border/60 bg-card p-4 hover:border-primary/20 hover:shadow-sm transition-all duration-200">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <kind.icon className="w-4.5 h-4.5 text-primary" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[11px] text-muted-foreground">{kind.label}</span>
          <span className="text-[11px] text-muted-foreground/50">·</span>
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="w-3 h-3" /> {file.uploadedAt}
          </span>
          {typeof file.memoriesExtracted === "number" && (
            <>
              <span className="text-[11px] text-muted-foreground/50">·</span>
              <span className="inline-flex items-center gap-1 text-[11px] text-primary font-medium">
                <Sparkles className="w-3 h-3" /> {file.memoriesExtracted} memories
              </span>
            </>
          )}
        </div>
        {file.status === "error" && file.errorMessage && (
          <p className="text-[11px] text-red-600 mt-1">{file.errorMessage}</p>
        )}
      </div>

      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full border shrink-0",
          status.className
        )}
      >
        <status.icon className={cn("w-3 h-3", file.status === "processing" && "animate-spin")} />
        {status.label}
      </span>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0">
        <button className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-150">
          <Eye className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onRemove(file.id)}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-all duration-150"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
