import type { ChunkType, ConversationStep, MemoryUpdate } from "@/lib/api";

export type SystemUpdate = {
  id: string;
  kind: "memory" | "star" | "resume_ready" | "application";
  title: string;
  body?: string;
  href?: string;
  hrefLabel?: string;
};

export function chunkTypeLabel(chunkType: ChunkType): string {
  const labels: Record<ChunkType, string> = {
    EXPERIENCE: "Experience",
    EDUCATION: "Education",
    SKILLS_SUMMARY: "Skills",
    PROJECTS: "Project",
    LANGUAGES: "Language",
    OTHER: "Memory",
    WAR_STORY: "War story",
    PREFERENCE: "Preference",
  };
  return labels[chunkType] ?? "Memory";
}

export function memoryUpdatesToSystemUpdates(updates: MemoryUpdate[]): SystemUpdate[] {
  return updates.map((update, i) => ({
    id: `mem-${Date.now()}-${i}`,
    kind: "memory" as const,
    title: `${chunkTypeLabel(update.chunk_type)} saved to Memory Bank`,
    body: update.content,
    href: "/app/files",
    hrefLabel: "View in Files",
  }));
}

export type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { resultIndex: number; results: SpeechRecognitionResultList }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export type BrowserSpeechRecognitionCtor = new () => BrowserSpeechRecognition;

export function getSpeechRecognitionCtor(): BrowserSpeechRecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as Window & {
    SpeechRecognition?: BrowserSpeechRecognitionCtor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export const stepBadgeMeta: Record<ConversationStep, { label: string; className: string }> = {
  jd_parsing: {
    label: "Parsing JD",
    className: "bg-blue-100 text-blue-700 border-blue-200",
  },
  gap_detection: {
    label: "Detecting gaps",
    className: "bg-blue-100 text-blue-700 border-blue-200",
  },
  gap_conversation: {
    label: "Coaching",
    className: "bg-amber-100 text-amber-700 border-amber-200",
  },
  resume_generation: {
    label: "Resume ready",
    className: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  interview_prep: {
    label: "Interview prep",
    className: "bg-violet-100 text-violet-700 border-violet-200",
  },
  done: {
    label: "Done",
    className: "bg-muted text-muted-foreground border-border",
  },
};

export function logoLetter(item: { company_name?: string | null }) {
  return (item.company_name || "?").slice(0, 1).toUpperCase();
}
