"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  addJDNote,
  deleteJDNote,
  listJDNotes,
  type JDNote,
  type JDNoteType,
} from "@/lib/api";

const NOTE_TYPES: { value: JDNoteType; label: string }[] = [
  { value: "NOTE", label: "Notes" },
  { value: "WORRY", label: "Worries" },
  { value: "WAR_STORY", label: "War stories" },
];

export function RoleNotesPanel({
  jdId,
  getToken,
}: {
  jdId: string;
  getToken: () => Promise<string | null>;
}) {
  const [notes, setNotes] = useState<JDNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteType, setNoteType] = useState<JDNoteType>("NOTE");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const grouped = useMemo(() => {
    const map: Record<JDNoteType, JDNote[]> = {
      NOTE: [],
      WORRY: [],
      WAR_STORY: [],
    };
    for (const note of notes) {
      map[note.note_type].push(note);
    }
    return map;
  }, [notes]);

  const loadNotes = async () => {
    setLoading(true);
    try {
      setNotes(await listJDNotes(getToken, jdId));
    } catch {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadNotes();
  }, [jdId, getToken]);

  const handleAdd = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      const note = await addJDNote(getToken, jdId, noteType, content.trim());
      setNotes((prev) => [note, ...prev]);
      setContent("");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    try {
      await deleteJDNote(getToken, jdId, noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch {
      // silent
    }
  };

  return (
    <div className="shrink-0 border-t border-border/50 bg-muted/10">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30"
      >
        <span>Role notes ({notes.length})</span>
        <span>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-3 max-h-56 overflow-y-auto">
          <div className="flex gap-2">
            <select
              value={noteType}
              onChange={(e) => setNoteType(e.target.value as JDNoteType)}
              className="text-xs rounded-lg border border-border bg-background px-2 py-1.5"
            >
              {NOTE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label.replace(/s$/, "")}
                </option>
              ))}
            </select>
            <input
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Add a note for this role…"
              className="flex-1 text-xs rounded-lg border border-border bg-background px-2 py-1.5"
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={saving || !content.trim()}
              className="rounded-lg bg-primary text-primary-foreground px-2 py-1.5 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mx-auto" />
          ) : notes.length === 0 ? (
            <p className="text-[11px] text-muted-foreground text-center py-2">No notes yet.</p>
          ) : (
            NOTE_TYPES.map(({ value, label }) => {
              const items = grouped[value];
              if (items.length === 0) return null;
              return (
                <div key={value} className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {label} ({items.length})
                  </p>
                  {items.map((note) => (
                    <div
                      key={note.id}
                      className="flex items-start gap-2 rounded-lg border border-border/60 bg-background px-2.5 py-2"
                    >
                      <p className="flex-1 text-xs text-foreground whitespace-pre-wrap">
                        {note.content}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleDelete(note.id)}
                        className="text-muted-foreground hover:text-red-600 shrink-0"
                        aria-label="Delete note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
