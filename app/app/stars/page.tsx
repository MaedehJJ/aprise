"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { BookOpen, Loader2, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiError, StarStory, deleteStarStory, listStarStories } from "@/lib/api";

export default function StarsPage() {
  const { getToken } = useAuth();
  const [stories, setStories] = useState<StarStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listStarStories(getToken);
      setStories(data);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? String(err.detail ?? err.message)
          : "Could not load STAR stories."
      );
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { load(); }, [load]);

  const allSkills = Array.from(
    new Set(stories.flatMap((s) => s.skills))
  ).sort();

  const filtered = selectedSkill
    ? stories.filter((s) => s.skills.includes(selectedSkill))
    : stories;

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await deleteStarStory(getToken, id);
      setStories((prev) => prev.filter((s) => s.id !== id));
      if (expanded === id) setExpanded(null);
    } catch {
      // silently fail
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Skill filter sidebar */}
      <div className="w-[220px] shrink-0 border-r border-border/60 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">STAR Library</h2>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {stories.length} {stories.length === 1 ? "story" : "stories"} extracted from coaching
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1">
          <button
            onClick={() => setSelectedSkill(null)}
            className={cn(
              "text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              selectedSkill === null
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            )}
          >
            All skills
          </button>
          {allSkills.map((skill) => (
            <button
              key={skill}
              onClick={() => setSelectedSkill(skill === selectedSkill ? null : skill)}
              className={cn(
                "text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                selectedSkill === skill
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              {skill}
            </button>
          ))}
        </div>
      </div>

      {/* Stories grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-red-700">{error}</p>
            <button onClick={load} className="text-xs text-red-700 underline font-medium">Retry</button>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center ring-1 ring-primary/15">
              <BookOpen className="w-7 h-7 text-accent-foreground" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-semibold text-foreground">No STAR stories yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                STAR stories are automatically extracted when you generate a resume.
                Complete a coaching session and generate your first resume to populate your library.
              </p>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl flex flex-col gap-3">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-base font-semibold text-foreground">
                {selectedSkill ? `Stories tagged "${selectedSkill}"` : "All STAR stories"}
              </h1>
              {selectedSkill && (
                <button
                  onClick={() => setSelectedSkill(null)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3 h-3" /> Clear filter
                </button>
              )}
            </div>

            {filtered.map((story) => (
              <div
                key={story.id}
                className="rounded-xl border border-border/60 bg-card overflow-hidden"
              >
                <button
                  onClick={() => setExpanded(expanded === story.id ? null : story.id)}
                  className="w-full flex items-start justify-between gap-3 px-4 py-3 text-left hover:bg-muted/20 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{story.title}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {story.skills.map((skill) => (
                        <span
                          key={skill}
                          className="px-2 py-0.5 rounded-full bg-primary/8 text-primary text-[10px] font-medium border border-primary/15"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(story.id);
                      }}
                      disabled={deleting === story.id}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                      title="Delete story"
                    >
                      {deleting === story.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />
                      }
                    </button>
                  </div>
                </button>

                {expanded === story.id && (
                  <div className="px-4 pb-4 flex flex-col gap-3 border-t border-border/40">
                    <div className="grid grid-cols-1 gap-3 pt-3">
                      <StorySection label="Situation" text={story.situation} />
                      <StorySection label="Task & Action" text={story.task_action} />
                      <StorySection label="Result" text={story.result} color="text-emerald-700" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StorySection({
  label,
  text,
  color = "text-foreground",
}: {
  label: string;
  text: string;
  color?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <p className={cn("text-sm leading-relaxed", color)}>{text}</p>
    </div>
  );
}
