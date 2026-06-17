/**
 * Thin client for talking to our FastAPI backend (mounted at /api/* via
 * vercel.json rewrites). Every authenticated call needs the Clerk session
 * JWT in the Authorization header — pass the `getToken` function you get
 * from Clerk's `useAuth()` hook.
 */

export type GetToken = () => Promise<string | null>;

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, detail: unknown) {
    super(typeof detail === "string" ? detail : `Request failed (${status})`);
    this.status = status;
    this.detail = detail;
  }
}

/**
 * Wraps `fetch` with:
 *   - Authorization header
 *   - AbortController timeout (default 30 s; pass higher for LLM endpoints)
 */
async function authedFetch(
  path: string,
  getToken: GetToken,
  init: RequestInit = {},
  timeoutMs = 30_000
): Promise<Response> {
  const token = await getToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  try {
    return await fetch(path, { ...init, headers, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function parseOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail: unknown;
    try {
      const body = await res.json();
      detail = body?.detail ?? body;
    } catch {
      detail = res.statusText;
    }
    throw new ApiError(res.status, detail);
  }
  // 204 / empty bodies
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/* ── Profiles ─────────────────────────────────────────────────────── */

export type CompanySize = "startup" | "scaleup" | "enterprise";

export interface Profile {
  id: string;
  clerk_user_id: string;
  name: string;
  target_roles: string[];
  preferred_company_size: CompanySize | null;
  years_experience: number | null;
}

export interface CreateProfileInput {
  name: string;
  target_roles: string[];
  preferred_company_size?: CompanySize | null;
  years_experience?: number | null;
}

/** Returns the current user's profile, or null if they haven't onboarded yet. */
export async function getMyProfile(getToken: GetToken): Promise<Profile | null> {
  const res = await authedFetch("/api/profiles/me", getToken);
  if (res.status === 404) return null;
  return parseOrThrow<Profile>(res);
}

export async function createProfile(
  getToken: GetToken,
  input: CreateProfileInput
): Promise<Profile> {
  const res = await authedFetch("/api/profiles", getToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseOrThrow<Profile>(res);
}

/* ── Memory ingestion ─────────────────────────────────────────────── */

export interface IngestResult {
  status: string;
  char_count?: number;
  memories_created?: number;
}

export async function ingestCv(
  getToken: GetToken,
  file: File
): Promise<IngestResult> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await authedFetch("/api/memories/ingest", getToken, {
    method: "POST",
    body: formData,
  }, 120_000); // LLM extraction may take up to 2 min
  return parseOrThrow<IngestResult>(res);
}

/* ── Memories ─────────────────────────────────────────────────────── */

export type ChunkType =
  | "EXPERIENCE"
  | "EDUCATION"
  | "SKILLS_SUMMARY"
  | "PROJECTS"
  | "LANGUAGES"
  | "OTHER"
  | "WAR_STORY"
  | "PREFERENCE";

export interface Memory {
  id: string;
  content: string;
  chunk_type: ChunkType;
  created_at: string;
  updated_at: string;
}

export async function listMemories(
  getToken: GetToken,
  options?: { chunkType?: ChunkType; limit?: number; offset?: number }
): Promise<Memory[]> {
  const params = new URLSearchParams();
  if (options?.chunkType) params.set("chunk_type", options.chunkType);
  if (options?.limit != null) params.set("limit", String(options.limit));
  if (options?.offset != null) params.set("offset", String(options.offset));
  const qs = params.toString();
  const res = await authedFetch(`/api/memories${qs ? `?${qs}` : ""}`, getToken);
  return parseOrThrow<Memory[]>(res);
}

export async function searchMemories(
  getToken: GetToken,
  query: string,
  limit = 8
): Promise<Memory[]> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  const res = await authedFetch(`/api/memories/search?${params}`, getToken);
  return parseOrThrow<Memory[]>(res);
}

export async function addMemory(
  getToken: GetToken,
  content: string,
  chunkType: ChunkType
): Promise<Memory> {
  const res = await authedFetch("/api/memories", getToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, chunk_type: chunkType }),
  });
  return parseOrThrow<Memory>(res);
}

export async function updateMemory(
  getToken: GetToken,
  id: string,
  content: string
): Promise<Memory> {
  const res = await authedFetch(`/api/memories/${id}`, getToken, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  return parseOrThrow<Memory>(res);
}

export async function deleteMemory(getToken: GetToken, id: string): Promise<void> {
  const res = await authedFetch(`/api/memories/${id}`, getToken, { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    await parseOrThrow<void>(res);
  }
}

/* ── Documents ────────────────────────────────────────────────────── */

export type DocumentKind = "resume" | "linkedin" | "other";

export interface Document {
  id: string;
  filename: string;
  kind: DocumentKind;
  memories_extracted: number;
  created_at: string;
}

export async function listDocuments(getToken: GetToken): Promise<Document[]> {
  const res = await authedFetch("/api/documents", getToken);
  return parseOrThrow<Document[]>(res);
}

/* ── JDs ──────────────────────────────────────────────────────────── */

export interface JDLabels {
  company_size: string;
  role_focus: string;
  tech_depth: string;
  domain: string;
}

export interface ParsedRequirements {
  required_skills: string[];
  nice_to_have: string[];
  years_required: number | null;
  responsibilities: string[];
  language_requirements: string[];
  visa_sponsorship: boolean | null;
  perks: string[];
}

export interface JD {
  id: string;
  raw_text: string;
  company_name: string | null;
  role_title: string | null;
  labels: JDLabels | null;
  parsed_requirements: ParsedRequirements | null;
  company_research: string | null;
}

export async function createJD(getToken: GetToken, rawText: string): Promise<JD> {
  const res = await authedFetch("/api/jds", getToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ raw_text: rawText }),
  }, 120_000); // JD parse + embed via LLM
  return parseOrThrow<JD>(res);
}

export async function listJDs(getToken: GetToken): Promise<JD[]> {
  const res = await authedFetch("/api/jds", getToken);
  return parseOrThrow<JD[]>(res);
}

export async function getJD(getToken: GetToken, id: string): Promise<JD> {
  const res = await authedFetch(`/api/jds/${id}`, getToken);
  return parseOrThrow<JD>(res);
}

/* ── Conversations ────────────────────────────────────────────────── */

export type ConversationStep =
  | "jd_parsing"
  | "gap_detection"
  | "gap_conversation"
  | "resume_generation"
  | "done";

export type MessageRole = "user" | "assistant";

export interface ConversationMessage {
  id: string;
  role: MessageRole;
  content: string;
  created_at: string;
}

export interface ConversationListItem {
  id: string;
  jd: Pick<JD, "id" | "company_name" | "role_title" | "labels">;
  current_step: ConversationStep;
  last_message: string | null;
  updated_at: string;
}

export interface ConversationDetail {
  id: string;
  jd: Pick<JD, "id" | "company_name" | "role_title" | "labels" | "company_research">;
  current_step: ConversationStep;
  state: {
    gaps: string[];
    questions_asked: string[];
    answers: string[];
    questions_remaining: number;
  };
  messages: ConversationMessage[];
  updated_at: string;
}

export async function createConversation(
  getToken: GetToken,
  jdId: string
): Promise<ConversationDetail> {
  const res = await authedFetch("/api/conversations", getToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jd_id: jdId }),
  }, 120_000); // gap detection is an LLM call
  return parseOrThrow<ConversationDetail>(res);
}

export async function listConversations(
  getToken: GetToken,
  options?: { limit?: number; offset?: number }
): Promise<ConversationListItem[]> {
  const params = new URLSearchParams();
  if (options?.limit != null) params.set("limit", String(options.limit));
  if (options?.offset != null) params.set("offset", String(options.offset));
  const qs = params.toString();
  const res = await authedFetch(`/api/conversations${qs ? `?${qs}` : ""}`, getToken);
  return parseOrThrow<ConversationListItem[]>(res);
}

export async function getConversation(
  getToken: GetToken,
  id: string
): Promise<ConversationDetail> {
  const res = await authedFetch(`/api/conversations/${id}`, getToken);
  return parseOrThrow<ConversationDetail>(res);
}

export async function sendMessage(
  getToken: GetToken,
  conversationId: string,
  content: string
): Promise<ConversationMessage> {
  const res = await authedFetch(
    `/api/conversations/${conversationId}/messages`,
    getToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    },
    120_000 // coaching response is an LLM call
  );
  return parseOrThrow<ConversationMessage>(res);
}

/* ── Resumes ──────────────────────────────────────────────────────── */

export interface ResumeExperienceEntry {
  company: string;
  role: string;
  dates: string;
  bullets: string[];
}

export interface ResumeContent {
  summary: string;
  experience: ResumeExperienceEntry[];
  skills: string[];
}

export interface Resume {
  id: string;
  jd_id: string;
  content: ResumeContent | null;
  /** Structured labels (company_size, role_focus, tech_depth, domain) plus generated tags. */
  labels: (JDLabels & { tags?: string[] }) | null;
  is_generated: boolean;
  created_at: string;
}

export async function generateResume(getToken: GetToken, jdId: string): Promise<Resume> {
  const res = await authedFetch(
    `/api/jds/${jdId}/resume`,
    getToken,
    { method: "POST" },
    180_000 // LLM resume generation can take up to 3 min
  );
  return parseOrThrow<Resume>(res);
}

export async function listResumes(getToken: GetToken, jdId: string): Promise<Resume[]> {
  const res = await authedFetch(`/api/jds/${jdId}/resumes`, getToken);
  return parseOrThrow<Resume[]>(res);
}

export async function getResume(getToken: GetToken, resumeId: string): Promise<Resume> {
  const res = await authedFetch(`/api/resumes/${resumeId}`, getToken);
  return parseOrThrow<Resume>(res);
}

/* ── Applications ─────────────────────────────────────────────────── */

export type ApplicationStatus =
  | "applied"
  | "screening"
  | "technical"
  | "behavioral"
  | "offer"
  | "rejected";

export interface Application {
  id: string;
  jd_id: string;
  resume_id: string | null;
  status: ApplicationStatus;
  company_name: string | null;
  role_title: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export async function createApplication(
  getToken: GetToken,
  input: { jd_id: string; resume_id?: string | null }
): Promise<Application> {
  const res = await authedFetch("/api/applications", getToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseOrThrow<Application>(res);
}

export async function listApplications(getToken: GetToken): Promise<Application[]> {
  const res = await authedFetch("/api/applications", getToken);
  return parseOrThrow<Application[]>(res);
}

export async function getApplication(
  getToken: GetToken,
  id: string
): Promise<Application> {
  const res = await authedFetch(`/api/applications/${id}`, getToken);
  return parseOrThrow<Application>(res);
}

export async function updateApplication(
  getToken: GetToken,
  id: string,
  input: { status?: ApplicationStatus; notes?: string | null }
): Promise<Application> {
  const res = await authedFetch(`/api/applications/${id}`, getToken, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseOrThrow<Application>(res);
}

export async function deleteApplication(getToken: GetToken, id: string): Promise<void> {
  const res = await authedFetch(`/api/applications/${id}`, getToken, { method: "DELETE" });
  if (!res.ok && res.status !== 204) await parseOrThrow<void>(res);
}

/* ── JD Notes ─────────────────────────────────────────────────────── */

export type JDNoteType = "NOTE" | "WAR_STORY" | "WORRY";

export interface JDNote {
  id: string;
  note_type: JDNoteType;
  content: string;
  created_at: string;
}

export async function addJDNote(
  getToken: GetToken,
  jdId: string,
  noteType: JDNoteType,
  content: string
): Promise<JDNote> {
  const res = await authedFetch(`/api/jds/${jdId}/notes`, getToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note_type: noteType, content }),
  });
  return parseOrThrow<JDNote>(res);
}

export async function listJDNotes(getToken: GetToken, jdId: string): Promise<JDNote[]> {
  const res = await authedFetch(`/api/jds/${jdId}/notes`, getToken);
  return parseOrThrow<JDNote[]>(res);
}

export async function deleteJDNote(
  getToken: GetToken,
  jdId: string,
  noteId: string
): Promise<void> {
  const res = await authedFetch(`/api/jds/${jdId}/notes/${noteId}`, getToken, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) {
    await parseOrThrow<void>(res);
  }
}
