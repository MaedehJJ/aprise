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

async function authedFetch(
  path: string,
  getToken: GetToken,
  init: RequestInit = {}
): Promise<Response> {
  const token = await getToken();

  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  return fetch(path, { ...init, headers });
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
  });
  return parseOrThrow<IngestResult>(res);
}
