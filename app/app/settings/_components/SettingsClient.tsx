"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  Bell,
  Loader2,
  Trash2,
  Upload,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ApiError,
  CompanySize,
  Memory,
  Profile,
  ProfileUsage,
  deleteMemory,
  getMyProfile,
  getProfileUsage,
  ingestCv,
  ingestText,
  listMemories,
  updateProfile,
  updateProfilePreferences,
} from "@/lib/api";

const COMPANY_SIZES: { value: CompanySize; label: string }[] = [
  { value: "startup", label: "Startup" },
  { value: "scaleup", label: "Scale-up" },
  { value: "enterprise", label: "Enterprise" },
];

export default function SettingsClient() {
  const { getToken } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [usage, setUsage] = useState<ProfileUsage | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [targetRoles, setTargetRoles] = useState("");
  const [companySize, setCompanySize] = useState<CompanySize | "">("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const [emailReminders, setEmailReminders] = useState(false);
  const [reminderDays, setReminderDays] = useState(7);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [importingPaste, setImportingPaste] = useState(false);
  const [pasteMessage, setPasteMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, u, m] = await Promise.all([
        getMyProfile(getToken),
        getProfileUsage(getToken),
        listMemories(getToken, { limit: 100 }),
      ]);
      if (!p) {
        setError("Profile not found. Complete onboarding first.");
        return;
      }
      setProfile(p);
      setUsage(u);
      setMemories(m);
      setName(p.name);
      setYearsExperience(p.years_experience != null ? String(p.years_experience) : "");
      setTargetRoles(p.target_roles.join(", "));
      setCompanySize(p.preferred_company_size ?? "");
      setEmailReminders(p.preferences?.email_reminders === true);
      setReminderDays(
        typeof p.preferences?.reminder_days === "number"
          ? p.preferences.reminder_days
          : 7
      );
    } catch (err) {
      setError(
        err instanceof ApiError
          ? String(err.detail ?? err.message)
          : "Could not load settings."
      );
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setProfileSaved(false);
    try {
      const updated = await updateProfile(getToken, {
        name: name.trim(),
        years_experience: yearsExperience ? parseInt(yearsExperience, 10) : null,
        target_roles: targetRoles
          .split(",")
          .map((r) => r.trim())
          .filter(Boolean),
        preferred_company_size: companySize || null,
      });
      setProfile(updated);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? String(err.detail ?? err.message)
          : "Could not save profile."
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePrefs = async (overrides?: Partial<{ email_reminders: boolean; reminder_days: number }>) => {
    setSavingPrefs(true);
    const patch = {
      email_reminders: overrides?.email_reminders ?? emailReminders,
      reminder_days: Math.max(3, Math.min(30, overrides?.reminder_days ?? reminderDays)),
    };
    try {
      const updated = await updateProfilePreferences(getToken, patch);
      setProfile(updated);
      setEmailReminders(patch.email_reminders);
      setReminderDays(patch.reminder_days);
    } catch {
      // revert optimistic changes on failure — reload state from profile
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadMessage(null);
    try {
      const result = await ingestCv(getToken, file);
      setUploadMessage(
        result.memories_created
          ? `CV ingested — ${result.memories_created} memories created.`
          : "CV uploaded successfully."
      );
      const m = await listMemories(getToken, { limit: 100 });
      setMemories(m);
    } catch (err) {
      setUploadMessage(
        err instanceof ApiError
          ? String(err.detail ?? err.message)
          : "Upload failed."
      );
    } finally {
      setUploading(false);
    }
  };

  const handleImportPaste = async () => {
    if (pasteText.trim().length < 200) return;
    setImportingPaste(true);
    setPasteMessage(null);
    try {
      const result = await ingestText(getToken, pasteText.trim(), "linkedin");
      setPasteMessage(
        result.memories_created
          ? `Imported — ${result.memories_created} memories created.`
          : "Imported successfully."
      );
      setPasteText("");
      const m = await listMemories(getToken, { limit: 100 });
      setMemories(m);
    } catch (err) {
      setPasteMessage(
        err instanceof ApiError ? String(err.detail ?? err.message) : "Import failed."
      );
    } finally {
      setImportingPaste(false);
    }
  };

  const handleDeleteMemory = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteMemory(getToken, id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkDelete = async () => {
    if (!memories.length) return;
    if (!window.confirm(`Delete all ${memories.length} memories? This cannot be undone.`)) {
      return;
    }
    setBulkDeleting(true);
    try {
      for (const m of memories) {
        await deleteMemory(getToken, m.id);
      }
      setMemories([]);
    } finally {
      setBulkDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto p-6 space-y-8">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Profile, memory bank, and notification preferences.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Profile */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Profile</h2>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                Years of experience
              </span>
              <input
                type="number"
                min={0}
                value={yearsExperience}
                onChange={(e) => setYearsExperience(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                Target roles (comma-separated)
              </span>
              <input
                value={targetRoles}
                onChange={(e) => setTargetRoles(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                Preferred company size
              </span>
              <select
                value={companySize}
                onChange={(e) => setCompanySize(e.target.value as CompanySize | "")}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">Not specified</option>
                {COMPANY_SIZES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => void handleSaveProfile()}
                disabled={savingProfile || !name.trim()}
                className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {savingProfile ? "Saving…" : "Save profile"}
              </button>
              {profileSaved && (
                <span className="text-xs text-emerald-600">Saved</span>
              )}
            </div>
          </div>
        </section>

        {/* Usage */}
        {usage && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Usage this month</h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Job descriptions", value: usage.jds_this_month },
                { label: "Resumes", value: usage.resumes_this_month },
                { label: "Coaching messages", value: usage.coaching_messages_this_month },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-border/60 bg-card px-3 py-3 text-center"
                >
                  <p className="text-lg font-semibold text-foreground">{item.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{item.label}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Notifications */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Notifications</h2>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-4 space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm font-medium text-foreground">Email reminders</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Nudge you to follow up on stale applications.
                </p>
              </div>
              <input
                type="checkbox"
                checked={emailReminders}
                disabled={savingPrefs}
                onChange={(e) => void handleSavePrefs({ email_reminders: e.target.checked })}
                className="w-4 h-4 accent-primary"
              />
            </label>
            {emailReminders && (
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                  Remind me after
                </label>
                <input
                  type="number"
                  min={3}
                  max={30}
                  value={reminderDays}
                  disabled={savingPrefs}
                  onChange={(e) => setReminderDays(Number(e.target.value))}
                  onBlur={() => void handleSavePrefs()}
                  className="w-20 rounded-lg border border-border bg-background px-3 py-1.5 text-sm disabled:opacity-50"
                />
                <span className="text-xs text-muted-foreground">days of no activity</span>
              </div>
            )}
          </div>
        </section>

        {/* Memory bank */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Memory bank</h2>
            {memories.length > 0 && (
              <button
                type="button"
                onClick={() => void handleBulkDelete()}
                disabled={bulkDeleting}
                className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
              >
                {bulkDeleting ? "Deleting…" : "Delete all"}
              </button>
            )}
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUpload(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted/40 disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              Re-upload CV
            </button>
            {uploadMessage && (
              <p className="text-xs text-muted-foreground">{uploadMessage}</p>
            )}

            <div className="border-t border-border/40 pt-3 flex flex-col gap-2">
              <p className="text-xs font-medium text-foreground">Paste LinkedIn or profile text</p>
              <p className="text-[11px] text-muted-foreground">
                Select all text from your LinkedIn profile page and paste it here.
              </p>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste your LinkedIn profile, bio, or CV text…"
                rows={4}
                disabled={importingPaste}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/25 resize-none disabled:opacity-50"
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleImportPaste()}
                  disabled={importingPaste || pasteText.trim().length < 200}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted/40 disabled:opacity-50"
                >
                  {importingPaste ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  Import text
                </button>
                {pasteText.trim().length > 0 && pasteText.trim().length < 200 && (
                  <span className="text-[11px] text-amber-600">
                    {pasteText.trim().length}/200 chars min
                  </span>
                )}
              </div>
              {pasteMessage && (
                <p className="text-xs text-muted-foreground">{pasteMessage}</p>
              )}
            </div>
            {memories.length === 0 ? (
              <p className="text-xs text-muted-foreground">No memories stored yet.</p>
            ) : (
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {memories.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-start gap-2 rounded-lg border border-border/50 px-3 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                        {m.chunk_type}
                      </p>
                      <p className="text-xs text-foreground line-clamp-2 mt-0.5">{m.content}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDeleteMemory(m.id)}
                      disabled={deletingId === m.id}
                      className="shrink-0 text-muted-foreground hover:text-red-600 disabled:opacity-50"
                      aria-label="Delete memory"
                    >
                      {deletingId === m.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {profile && (
          <p className="text-[11px] text-muted-foreground pb-4">
            Signed in as {profile.name}
          </p>
        )}
      </div>
    </div>
  );
}
