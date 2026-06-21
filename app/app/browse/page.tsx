"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  ArrowRight,
  BookOpen,
  Building2,
  FileText,
  Loader2,
  Tag,
  Tags,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BrowseResult,
  TagCount,
  TaggedJD,
  TaggedResume,
  browseTag,
  listTags,
} from "@/lib/api";

export default function BrowsePage() {
  const { getToken } = useAuth();
  const router = useRouter();

  const [tags, setTags] = useState<TagCount[]>([]);
  const [tagsLoading, setTagsLoading] = useState(true);
  const [tagsError, setTagsError] = useState<string | null>(null);

  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [browseResult, setBrowseResult] = useState<BrowseResult | null>(null);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);

  // Load tag cloud on mount
  useEffect(() => {
    setTagsLoading(true);
    listTags(getToken)
      .then(setTags)
      .catch(() => setTagsError("Could not load tags."))
      .finally(() => setTagsLoading(false));
  }, [getToken]);

  // Load browse results when a tag is selected
  const handleSelectTag = useCallback(
    async (tag: string) => {
      if (selectedTag === tag) return;
      setSelectedTag(tag);
      setBrowseLoading(true);
      setBrowseResult(null);
      setBrowseError(null);
      try {
        const result = await browseTag(getToken, tag);
        setBrowseResult(result);
      } catch {
        setBrowseError("Could not load results for this tag. Please try again.");
      } finally {
        setBrowseLoading(false);
      }
    },
    [selectedTag, getToken]
  );

  const maxTotal = tags[0]?.total ?? 1;

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left: tag cloud ─────────────────────────────────────────── */}
      <aside className="w-64 shrink-0 border-r border-border/60 flex flex-col overflow-hidden">
        <div className="px-4 py-4 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-2">
            <Tags className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Tags</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Browse JDs and resumes by tag
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {tagsLoading && (
            <div className="flex items-center gap-2 py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Loading…</span>
            </div>
          )}

          {tagsError && (
            <p className="text-xs text-destructive px-2 py-4">{tagsError}</p>
          )}

          {!tagsLoading && !tagsError && tags.length === 0 && (
            <div className="px-2 py-8 text-center">
              <Tag className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">
                No tags yet. Generate a resume to get started.
              </p>
            </div>
          )}

          {tags.map((t) => {
            const active = selectedTag === t.tag;
            const barWidth = Math.max(8, Math.round((t.total / maxTotal) * 100));
            return (
              <button
                key={t.tag}
                onClick={() => handleSelectTag(t.tag)}
                className={cn(
                  "w-full text-left px-2.5 py-2 rounded-lg transition-all group",
                  active
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted/60 text-foreground"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium truncate">{t.tag}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0 ml-1">
                    {t.total}
                  </span>
                </div>
                {/* usage bar */}
                <div className="h-0.5 rounded-full bg-border/60 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      active ? "bg-primary" : "bg-muted-foreground/40 group-hover:bg-muted-foreground/60"
                    )}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <div className="flex gap-2 mt-1">
                  {t.jd_count > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      {t.jd_count} JD{t.jd_count !== 1 ? "s" : ""}
                    </span>
                  )}
                  {t.resume_count > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      {t.resume_count} resume{t.resume_count !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── Right: browse results ──────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto p-6">
        {!selectedTag && (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Tags className="w-6 h-6 text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground">Select a tag</p>
            <p className="text-xs text-muted-foreground mt-1">
              Pick a tag on the left to see all matching job descriptions and
              resumes.
            </p>
          </div>
        )}

        {selectedTag && browseLoading && (
          <div className="flex items-center gap-2 py-16 justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Loading results for <strong>{selectedTag}</strong>…
            </span>
          </div>
        )}

        {selectedTag && !browseLoading && browseError && (
          <div className="py-12 text-center">
            <p className="text-sm text-destructive">{browseError}</p>
          </div>
        )}

        {selectedTag && !browseLoading && !browseError && browseResult && (
          <div className="space-y-8 max-w-2xl">
            {/* Header */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                <Tag className="w-3.5 h-3.5 text-primary" />
                <span className="text-sm font-semibold text-primary">
                  {selectedTag}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {browseResult.jds.length} JD{browseResult.jds.length !== 1 ? "s" : ""},{" "}
                {browseResult.resumes.length} resume{browseResult.resumes.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* JDs section */}
            {browseResult.jds.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Job Descriptions
                </h2>
                <div className="space-y-2">
                  {browseResult.jds.map((jd) => (
                    <JDCard
                      key={jd.id}
                      jd={jd}
                      onOpen={() => router.push(`/app/chat?jd=${jd.id}`)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Resumes section */}
            {browseResult.resumes.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Generated Resumes
                </h2>
                <div className="space-y-2">
                  {browseResult.resumes.map((r) => (
                    <ResumeCard
                      key={r.id}
                      resume={r}
                      onOpen={() => router.push(`/app/chat?jd=${r.jd_id}`)}
                    />
                  ))}
                </div>
              </section>
            )}

            {browseResult.jds.length === 0 && browseResult.resumes.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  No results found for <strong>{selectedTag}</strong>.
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function JDCard({ jd, onOpen }: { jd: TaggedJD; onOpen: () => void }) {
  const labels = jd.labels ?? {};
  const tags: string[] = (labels.tags as string[]) ?? [];
  const initials = (jd.company_name ?? "?").slice(0, 1).toUpperCase();

  return (
    <div className="group flex items-start gap-3 p-3.5 rounded-xl border border-border/60 bg-card hover:border-border hover:shadow-sm transition-all">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0 mt-0.5">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {jd.company_name ?? "Unknown company"}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {jd.role_title ?? "Untitled role"}
        </p>
        {jd.company_research && (
          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
            <Building2 className="w-3 h-3 inline mr-1 opacity-60" />
            {jd.company_research}
          </p>
        )}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {tags.slice(0, 6).map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/60"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={onOpen}
        className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100 mt-0.5"
      >
        Open <ArrowRight className="w-3 h-3" />
      </button>
    </div>
  );
}

function ResumeCard({
  resume,
  onOpen,
}: {
  resume: TaggedResume;
  onOpen: () => void;
}) {
  const labels = resume.labels ?? {};
  const tags: string[] = (labels.tags as string[]) ?? [];
  const roleInfo = [labels.role_focus, labels.domain]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="group flex items-start gap-3 p-3.5 rounded-xl border border-border/60 bg-card hover:border-border hover:shadow-sm transition-all">
      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
        <FileText className="w-4 h-4 text-emerald-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          Generated resume
        </p>
        {roleInfo && (
          <p className="text-xs text-muted-foreground">{roleInfo}</p>
        )}
        <p className="text-xs text-muted-foreground mt-0.5">
          {new Date(resume.created_at).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </p>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {tags.slice(0, 6).map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={onOpen}
        className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100 mt-0.5"
      >
        <BookOpen className="w-3 h-3" /> Open
      </button>
    </div>
  );
}
