/**
 * Server-side API helpers. These run exclusively in Server Components and
 * use `auth()` from Clerk to obtain the session token without requiring a
 * `getToken` callback.
 *
 * Do NOT import this file in Client Components — it will throw at build time
 * because `@clerk/nextjs/server` is server-only.
 */

import { auth } from "@clerk/nextjs/server";
import type {
  Application,
  ConversationListItem,
  Document,
  Memory,
  Profile,
  StarStory,
  TagCount,
} from "./api";

async function serverFetch(path: string, timeoutMs = 30_000): Promise<Response> {
  const { getToken } = await auth();
  const token = await getToken();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // In production the FastAPI backend is proxied at /api via vercel.json rewrites,
  // but server-side we need to talk to the backend directly.
  const baseUrl =
    process.env.API_INTERNAL_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:8000";

  try {
    return await fetch(`${baseUrl}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal,
    });
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
    const err = Object.assign(new Error(String(detail)), { status: res.status });
    throw err;
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Returns the current user's profile, or null if they haven't onboarded yet. */
export async function getMyProfile(): Promise<Profile | null> {
  const res = await serverFetch("/api/profiles/me");
  if (res.status === 404) return null;
  return parseOrThrow<Profile>(res);
}

export async function listApplications(): Promise<Application[]> {
  const res = await serverFetch("/api/applications");
  return parseOrThrow<Application[]>(res);
}

export async function listStarStories(): Promise<StarStory[]> {
  const res = await serverFetch("/api/stars");
  return parseOrThrow<StarStory[]>(res);
}

export async function listTags(): Promise<TagCount[]> {
  const res = await serverFetch("/api/tags");
  return parseOrThrow<TagCount[]>(res);
}

export async function listDocuments(): Promise<Document[]> {
  const res = await serverFetch("/api/documents");
  return parseOrThrow<Document[]>(res);
}

export async function listMemories(): Promise<Memory[]> {
  const res = await serverFetch("/api/memories");
  return parseOrThrow<Memory[]>(res);
}

export async function listConversations(): Promise<ConversationListItem[]> {
  const res = await serverFetch("/api/conversations");
  return parseOrThrow<ConversationListItem[]>(res);
}
