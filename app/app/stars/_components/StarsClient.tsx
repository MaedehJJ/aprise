"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { BookOpen, Loader2, Mic, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ApiError, ConversationListItem, getJdConversation, StarStory,
  deleteStarStory, listConversations, listStarStories,
} from "@/lib/api";
import { useAppData } from "@/app/app/_components/AppDataProvider";
import PageLoader from "../../_components/PageLoader";
import { EmptyState } from "../../_components/EmptyState";

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

export default function StarsClient({
  initialStories,
}: {
  initialStories?: StarStory[];
}) {
  const { getToken } = useAuth();
  const router = useRouter();
  const { threads } = useAppData();
  const [stories, setStories] = useState<StarStory[]>(initialStories ?? []);
  const [loading, setLoading] = useState(initialStories === undefined);
  const [error, setError] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pickRoleStory, setPickRoleStory] = useState<StarStory | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    setLoading(true);
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

  useEffect(() => {
    if (initialStories !== undefined) return;
    reload();
  }, [initialStories, reload]);

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

  const handlePractice = async (story: StarStory) => {
    if (story.jd_id) {
      try {
        const { conversation_id } = await getJdConversation(getToken, story.jd_id);
        if (conversation_id) {
          router.push(`/app/roles/${conversation_id}?mode=interview&starId=${story.id}`);
          return;
        }
      } catch {}
    }
    // No direct JD match — open pick-role modal
    setPickRoleStory(story);
  };

  if (loading) {
    return <PageLoader />;
  }

  return (
    <>
    {pickRoleStory && (
      <PickRoleModal
        story={pickRoleStory}
        threads={threads}
        onPick={(convId) => {
          router.push(`/app/roles/${convId}?mode=interview&starId=${pickRoleStory.id}`);
          setPickRoleStory(null);
        }}
        onClose={() => setPickRoleStory(null)}
      />
    )}
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
            <button onClick={reload} className="text-xs text-red-700 underline font-medium">
              Retry
            </button>
          </div>
        )}

        {filtered.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="w-10 h-10" />}
            title="No STAR stories yet"
            description="STAR stories are extracted when you generate a resume. Complete coaching and generate your first resume to populate the library."
            actionLabel="Start coaching"
            actionHref="/app/chat?new=1"
          />
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
                      {deleting === story.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
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
                    <div className="pt-1">
                      <button
                        onClick={() => handlePractice(story)}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold bg-violet-600 text-white hover:bg-violet-700 transition-all"
                      >
                        <Mic className="w-3 h-3" />
                        Practice this story
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </>
  );
}

/* ── Pick-role modal ──────────────────────────────────────────────── */
function PickRoleModal({
  story,
  threads,
  onPick,
  onClose,
}: {
  story: StarStory;
  threads: ConversationListItem[];
  onPick: (conversationId: string) => void;
  onClose: () => void;
}) {
  const eligible = threads.filter(
    (t) =>
      t.current_step === "resume_generation" ||
      t.current_step === "interview_prep" ||
      t.current_step === "done"
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-background rounded-2xl border border-border shadow-xl w-full max-w-sm flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
          <p className="text-sm font-semibold text-foreground">Pick a role to practice in</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 flex flex-col gap-2 max-h-80 overflow-y-auto">
          {eligible.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              No roles with a generated resume yet. Complete coaching first.
            </p>
          ) : (
            eligible.map((t) => (
              <button
                key={t.id}
                onClick={() => onPick(t.id)}
                className="w-full text-left px-3 py-2.5 rounded-xl border border-border/60 hover:border-primary/30 hover:bg-muted/30 transition-all"
              >
                <p className="text-sm font-medium text-foreground">
                  {t.jd.company_name ?? "Unknown company"}
                </p>
                <p className="text-xs text-muted-foreground">{t.jd.role_title ?? "Untitled role"}</p>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
