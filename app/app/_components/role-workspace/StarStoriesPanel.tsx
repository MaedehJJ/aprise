"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Loader2 } from "lucide-react";
import { listStarStories, type StarStory } from "@/lib/api";

export function StarStoriesPanel({
  jdId,
  getToken,
}: {
  jdId: string;
  getToken: () => Promise<string | null>;
}) {
  const [stories, setStories] = useState<StarStory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listStarStories(getToken, jdId)
      .then(setStories)
      .catch(() => setStories([]))
      .finally(() => setLoading(false));
  }, [jdId, getToken]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (stories.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 px-4 text-center">
        <BookOpen className="w-8 h-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground max-w-xs">
          STAR stories for this role appear after you generate a resume.
        </p>
        <Link href="/app/stars" className="text-xs font-medium text-primary hover:underline">
          View full STAR Library →
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto p-4 space-y-3 max-h-full">
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          This role ({stories.length})
        </p>
        <Link href="/app/stars" className="text-[11px] font-medium text-primary hover:underline">
          All stories →
        </Link>
      </div>
      {stories.map((s) => (
        <article
          key={s.id}
          className="rounded-xl border border-border/60 bg-card p-3 space-y-1.5"
        >
          <p className="text-sm font-semibold text-foreground">{s.title}</p>
          <p className="text-xs text-muted-foreground line-clamp-2">{s.situation}</p>
          {s.skills?.length > 0 && (
            <p className="text-[10px] text-primary">{s.skills.slice(0, 4).join(" · ")}</p>
          )}
        </article>
      ))}
    </div>
  );
}
