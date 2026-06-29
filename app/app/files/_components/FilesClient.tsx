"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  AlertCircle,
  BookOpen,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Code2,
  FileText,
  GraduationCap,
  Heart,
  Languages,
  Link2,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  Sparkles,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  addMemory,
  ApiError,
  ChunkType,
  deleteMemory,
  type Document,
  DocumentKind,
  ingestCv,
  listDocuments,
  listMemories,
  type Memory,
  updateMemory,
} from "@/lib/api";
import PageLoader from "../../_components/PageLoader";

/* ── Types ────────────────────────────────────────────────────────── */
type FileStatus = "ready" | "processing" | "error";
type FileKind = DocumentKind;

interface UploadedFile {
  id: string;
  name: string;
  kind: FileKind;
  status: FileStatus;
  uploadedAt: string;
  memoriesExtracted?: number;
  errorMessage?: string;
}

const kindMeta: Record<FileKind, { label: string; icon: typeof FileText }> = {
  resume: { label: "Resume", icon: FileText },
  linkedin: { label: "LinkedIn export", icon: Link2 },
  other: { label: "Document", icon: FileText },
};

const statusMeta: Record<
  FileStatus,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  ready: {
    label: "Ingested",
    className: "bg-emerald-100 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
  },
  processing: {
    label: "Processing",
    className: "bg-amber-100 text-amber-700 border-amber-200",
    icon: Loader2,
  },
  error: {
    label: "Failed",
    className: "bg-red-100 text-red-700 border-red-200",
    icon: AlertCircle,
  },
};

const chunkTypeMeta: Record<
  ChunkType,
  { label: string; icon: typeof FileText; color: string }
> = {
  EXPERIENCE: {
    label: "Experience",
    icon: Briefcase,
    color: "text-blue-600 bg-blue-50 border-blue-200",
  },
  EDUCATION: {
    label: "Education",
    icon: GraduationCap,
    color: "text-purple-600 bg-purple-50 border-purple-200",
  },
  SKILLS_SUMMARY: {
    label: "Skills",
    icon: Code2,
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
  },
  PROJECTS: {
    label: "Project",
    icon: BookOpen,
    color: "text-amber-600 bg-amber-50 border-amber-200",
  },
  LANGUAGES: {
    label: "Language",
    icon: Languages,
    color: "text-cyan-600 bg-cyan-50 border-cyan-200",
  },
  WAR_STORY: {
    label: "War story",
    icon: Star,
    color: "text-orange-600 bg-orange-50 border-orange-200",
  },
  PREFERENCE: {
    label: "Preference",
    icon: Heart,
    color: "text-pink-600 bg-pink-50 border-pink-200",
  },
  OTHER: {
    label: "Other",
    icon: MessageSquare,
    color: "text-muted-foreground bg-muted border-border",
  },
};

const CHUNK_TYPE_OPTIONS: ChunkType[] = [
  "EXPERIENCE",
  "EDUCATION",
  "SKILLS_SUMMARY",
  "PROJECTS",
  "LANGUAGES",
  "WAR_STORY",
  "PREFERENCE",
  "OTHER",
];

function docToUploadedFile(doc: Document): UploadedFile {
  return {
    id: doc.id,
    name: doc.filename,
    kind: doc.kind,
    status: "ready",
    uploadedAt: new Date(doc.created_at).toLocaleDateString(),
    memoriesExtracted: doc.memories_extracted,
  };
}

/* ── Page ─────────────────────────────────────────────────────────── */
export default function FilesClient({
  initialFiles,
  initialMemories,
}: {
  initialFiles?: Document[];
  initialMemories?: Memory[];
}) {
  const { getToken } = useAuth();
  const [files, setFiles] = useState<UploadedFile[]>(
    (initialFiles ?? []).map(docToUploadedFile)
  );
  const [memories, setMemories] = useState<Memory[]>(initialMemories ?? []);
  const [memoryTypeFilter, setMemoryTypeFilter] = useState<ChunkType | "ALL">("ALL");
  const [pageLoading, setPageLoading] = useState(
    initialFiles === undefined && initialMemories === undefined
  );
  const [memoriesOpen, setMemoriesOpen] = useState(true);
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [memoriesError, setMemoriesError] = useState<string | null>(null);
  const [docsError, setDocsError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadMemories = useCallback(
    async (chunkType?: ChunkType | "ALL") => {
      const filter = chunkType ?? memoryTypeFilter;
      setMemoriesLoading(true);
      setMemoriesError(null);
      try {
        const data = await listMemories(getToken, {
          chunkType: filter === "ALL" ? undefined : filter,
        });
        setMemories(data);
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? String(err.detail ?? err.message)
            : "Could not load memories. Please refresh.";
        setMemoriesError(msg);
      } finally {
        setMemoriesLoading(false);
      }
    },
    [getToken, memoryTypeFilter]
  );

  const loadDocuments = useCallback(async () => {
    setDocsError(null);
    try {
      const docs = await listDocuments(getToken);
      setFiles(docs.map(docToUploadedFile));
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? String(err.detail ?? err.message)
          : "Could not load uploaded files. Please refresh.";
      setDocsError(msg);
    }
  }, [getToken]);

  useEffect(() => {
    if (initialFiles !== undefined && initialMemories !== undefined) return;
    setPageLoading(true);
    Promise.all([loadDocuments(), loadMemories()]).finally(() => setPageLoading(false));
  }, [initialFiles, initialMemories, loadDocuments, loadMemories]);

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
        await Promise.all([loadDocuments(), loadMemories()]);
      } catch (err) {
        const message =
          err instanceof ApiError
            ? String(err.detail ?? err.message)
            : "Upload failed. Please try again.";
        setFiles((prev) =>
          prev.map((f) =>
            f.id === id ? { ...f, status: "error", errorMessage: message } : f
          )
        );
      }
    }
  };

  if (pageLoading) {
    return <PageLoader />;
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-foreground">Your files & memory</h1>
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
          <StatCard icon={Sparkles} label="Memories" value={String(memories.length)} />
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
          <p className="text-sm font-medium text-foreground">
            Drop a PDF here, or click to browse
          </p>
          <p className="text-xs text-muted-foreground">
            Resumes and LinkedIn profile exports — PDF only, up to 5MB each
          </p>
        </div>

        {/* Docs load error */}
        {docsError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 flex items-center justify-between gap-3">
            <p className="text-xs text-amber-800">{docsError}</p>
            <button
              onClick={loadDocuments}
              className="text-xs font-medium text-amber-800 underline shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* File list */}
        {files.length > 0 && (
          <div className="flex flex-col gap-2.5">
            {files.map((file) => (
              <FileRow
                key={file.id}
                file={file}
                onRemove={(id) => setFiles((prev) => prev.filter((f) => f.id !== id))}
              />
            ))}
          </div>
        )}

        {/* Memories section */}
        <MemoriesSection
          memories={memories}
          typeFilter={memoryTypeFilter}
          onTypeFilterChange={(filter) => {
            setMemoryTypeFilter(filter);
            void loadMemories(filter);
          }}
          loading={memoriesLoading}
          loadError={memoriesError}
          onRetryLoad={() => loadMemories()}
          open={memoriesOpen}
          onToggle={() => setMemoriesOpen((v) => !v)}
          onAdd={async (content, chunkType) => {
            const mem = await addMemory(getToken, content, chunkType);
            setMemories((prev) => [mem, ...prev]);
          }}
          onUpdate={async (id, content) => {
            const updated = await updateMemory(getToken, id, content);
            setMemories((prev) => prev.map((m) => (m.id === id ? updated : m)));
          }}
          onDelete={async (id) => {
            await deleteMemory(getToken, id);
            setMemories((prev) => prev.filter((m) => m.id !== id));
          }}
        />
      </div>
    </div>
  );
}

/* ── Stat card ────────────────────────────────────────────────────── */
function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof FileText;
  label: string;
  value: string;
}) {
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

/* ── File row ─────────────────────────────────────────────────────── */
function FileRow({
  file,
  onRemove,
}: {
  file: UploadedFile;
  onRemove: (id: string) => void;
}) {
  const kind = kindMeta[file.kind];
  const statusInfo = statusMeta[file.status];

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
          statusInfo.className
        )}
      >
        <statusInfo.icon
          className={cn("w-3 h-3", file.status === "processing" && "animate-spin")}
        />
        {statusInfo.label}
      </span>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0">
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

/* ── Memories section ─────────────────────────────────────────────── */
function MemoriesSection({
  memories,
  typeFilter,
  onTypeFilterChange,
  loading,
  loadError,
  onRetryLoad,
  open,
  onToggle,
  onAdd,
  onUpdate,
  onDelete,
}: {
  memories: Memory[];
  typeFilter: ChunkType | "ALL";
  onTypeFilterChange: (filter: ChunkType | "ALL") => void;
  loading: boolean;
  loadError: string | null;
  onRetryLoad: () => void;
  open: boolean;
  onToggle: () => void;
  onAdd: (content: string, chunkType: ChunkType) => Promise<void>;
  onUpdate: (id: string, content: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [showAddForm, setShowAddForm] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {/* Section header */}
      <button onClick={onToggle} className="flex items-center justify-between w-full group">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Memory bank</h2>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {memories.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowAddForm((v) => !v);
              if (!open) onToggle();
            }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add memory
          </button>
          {open ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {open && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => onTypeFilterChange("ALL")}
              className={cn(
                "text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors",
                typeFilter === "ALL"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border/60 hover:border-primary/30 hover:text-foreground"
              )}
            >
              All types
            </button>
            {CHUNK_TYPE_OPTIONS.map((t) => {
              const meta = chunkTypeMeta[t];
              return (
                <button
                  key={t}
                  onClick={() => onTypeFilterChange(t)}
                  className={cn(
                    "inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors",
                    typeFilter === t
                      ? meta.color
                      : "bg-card text-muted-foreground border-border/60 hover:border-primary/30 hover:text-foreground"
                  )}
                >
                  <meta.icon className="w-3 h-3" />
                  {meta.label}
                </button>
              );
            })}
          </div>

          {showAddForm && (
            <AddMemoryForm
              onSave={async (content, chunkType) => {
                await onAdd(content, chunkType);
                setShowAddForm(false);
              }}
              onCancel={() => setShowAddForm(false)}
            />
          )}

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
            </div>
          ) : loadError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-center justify-between gap-3">
              <p className="text-xs text-red-700">{loadError}</p>
              <button
                onClick={onRetryLoad}
                className="text-xs font-medium text-red-700 underline shrink-0"
              >
                Retry
              </button>
            </div>
          ) : memories.length === 0 && !showAddForm ? (
            <div className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border/60 bg-muted/20 p-10 text-center">
              <p className="text-sm text-muted-foreground">
                {typeFilter === "ALL"
                  ? "No memories yet — upload a resume or add one manually."
                  : `No ${chunkTypeMeta[typeFilter].label.toLowerCase()} memories yet.`}
              </p>
            </div>
          ) : (
            memories.map((memory) => (
              <MemoryRow
                key={memory.id}
                memory={memory}
                onUpdate={onUpdate}
                onDelete={onDelete}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ── Add memory form ──────────────────────────────────────────────── */
function AddMemoryForm({
  onSave,
  onCancel,
}: {
  onSave: (content: string, chunkType: ChunkType) => Promise<void>;
  onCancel: () => void;
}) {
  const [content, setContent] = useState("");
  const [chunkType, setChunkType] = useState<ChunkType>("EXPERIENCE");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(content.trim(), chunkType);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? String(err.detail ?? err.message)
          : "Failed to save memory. Please try again.";
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-primary/30 bg-accent/30 p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Type
        </label>
        <select
          value={chunkType}
          onChange={(e) => setChunkType(e.target.value as ChunkType)}
          className="text-xs bg-card border border-border rounded-lg px-2 py-1 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25"
        >
          {CHUNK_TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {chunkTypeMeta[t].label}
            </option>
          ))}
        </select>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Describe the experience, skill, war story, or preference…"
        rows={3}
        autoFocus
        className="w-full text-sm text-foreground bg-card border border-border rounded-xl px-3 py-2.5 placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/25 resize-none"
      />
      {saveError && <p className="text-[11px] text-red-600 -mt-1">{saveError}</p>}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onCancel}
          className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-muted/60 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!content.trim() || saving}
          className={cn(
            "inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all",
            content.trim() && !saving
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
          )}
        >
          {saving && <Loader2 className="w-3 h-3 animate-spin" />}
          Save memory
        </button>
      </div>
    </div>
  );
}

/* ── Memory row ───────────────────────────────────────────────────── */
function MemoryRow({
  memory,
  onUpdate,
  onDelete,
}: {
  memory: Memory;
  onUpdate: (id: string, content: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const meta = chunkTypeMeta[memory.chunk_type] ?? chunkTypeMeta.OTHER;
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(memory.content);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!editValue.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onUpdate(memory.id, editValue.trim());
      setEditing(false);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? String(err.detail ?? err.message)
          : "Failed to update memory. Please try again.";
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await onDelete(memory.id);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? String(err.detail ?? err.message)
          : "Failed to delete memory. Please try again.";
      setDeleteError(msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="group rounded-2xl border border-border/60 bg-card p-4 hover:border-primary/20 hover:shadow-sm transition-all duration-200">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 mt-0.5",
            meta.color
          )}
        >
          <meta.icon className="w-3 h-3" />
          {meta.label}
        </span>

        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                autoFocus
                rows={3}
                className="w-full text-sm text-foreground bg-muted/30 border border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/25 resize-none"
              />
              {saveError && <p className="text-[11px] text-red-600">{saveError}</p>}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                >
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  Save
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setEditValue(memory.content);
                    setSaveError(null);
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-foreground leading-relaxed">{memory.content}</p>
          )}
        </div>

        {deleteError && (
          <p className="text-[11px] text-red-600 mt-1 col-span-2">{deleteError}</p>
        )}
        {!editing && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0">
            <button
              onClick={() => setEditing(true)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-150"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-all duration-150"
            >
              {deleting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
