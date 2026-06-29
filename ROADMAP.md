# Aprise — Feature Roadmap

This file catalogues every feature in the product: what it does, what data it consumes, what it produces, and which other features it depends on or feeds into.

Use it to understand the full dependency graph before changing a feature, to onboard a new engineer, or to decide where to place a new capability.

For the phased build plan (Role Workspace, caching, UX polish, and sprints), see **[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)**.

---

## Changelog

### 2026-06-29 — Phase 5–8 complete

| Feature | What shipped |
|---|---|
| **F08 AI Coaching (role workspace)** | `/app/roles/[id]` — workspace split from hub; coaching, resume, cover letter in tabs; similar-role banner; step stepper |
| **F18 Interview Prep** | STAR → practice routing; picks role or opens modal; interview context badge |
| **F19 Email Reminders** | ✅ Vercel Cron + Resend integration; `CRON_SECRET` auth; `reminder_days` pref; dry-run mode |
| **F20 Multi-Resume Comparison** | ✅ Side-by-side diff view in role workspace |
| **F21 Settings Page** | ✅ `/app/settings` — profile, usage meter, memory management (dedup, delete, re-upload, text paste), notification prefs |
| **F22 LinkedIn Import** | ✅ Text-paste via onboarding tab + Settings; `POST /api/memories/ingest-text`; same extraction pipeline as PDF |
| **F23 PDF Magic-Byte Validation** | ✅ `%PDF-` check in `memory_service.validate_pdf_magic_bytes()` |
| **F06 Fit Score cache integrity** | Hash revalidated on `GET /api/jds/{id}`; stale scores omitted; `cache_hit|miss|stale` log lines |
| **429 UX** | `Retry-After` header in custom slowapi handler; `RateLimitBanner` wired to real seconds; composer disabled during cooldown |
| **Funnel analytics** | 6 Sentry events via `lib/analytics.ts` — onboarding, JD, coaching, resume, application, interview |
| **Eval coverage** | `test_fit_score_cache.py` (cache hit/miss/invalidation), `test_gap_detection.py` (output shape), `test_conversation_graph.py` extended (interview routing regression) |

### 2026-06-28 — Coaching UX, resume flow, and app polish

| Feature | What changed |
|---|---|
| **F08 AI Coaching** | SSE `thinking` events during memory retrieval and graph nodes; token streaming unchanged; `done` carries `current_step` + `memory_updates[]`; step badge updates live (Coaching → Resume ready) |
| **F09 Memory Promotion** | Promoted memories surfaced as in-chat system cards with link to Files |
| **F04 Company Research** | Collapsible **Company snapshot** banner in chat when `jd.company_research` is set |
| **F10 Resume Generation** | Resume tab auto-opens when coaching completes; `POST` response includes `stars_extracted`; DOCX generated on create |
| **F12 / exports** | Chat Resume panel: **Download DOCX** + **Download PDF** |
| **F15 STAR Extraction** | Count returned on resume generate; in-chat notification with link to STAR Library |
| **F17 Application Tracking** | **Mark as applied** on Resume tab creates the Kanban card; in-chat confirmation card |
| **Chat composer** | Taller auto-resizing input, blurred background, voice input (Web Speech API, Chrome/Safari) |
| **App shell** | Loading indicators on Files, Stars, Browse, Applications via shared `PageLoader` |

**Commits:** `79b42d0` (thinking phases), `7d997ba` (memory updates, stars_extracted, chat UX), `cf7f526` (DOCX generation).

---

## Status key

| Symbol | Meaning |
|---|---|
| ✅ | Built and live |
| 🔜 | Planned, not yet built |

---

## Feature index

| # | Feature | Status |
|---|---|---|
| F01 | [Authentication & Onboarding](#f01-authentication--onboarding) | ✅ |
| F02 | [Document Ingestion & Memory](#f02-document-ingestion--memory) | ✅ |
| F03 | [Job Description Processing](#f03-job-description-processing) | ✅ |
| F04 | [Company Research](#f04-company-research) | ✅ |
| F05 | [JD Similarity Search](#f05-jd-similarity-search) | ✅ |
| F06 | [Fit Scoring](#f06-fit-scoring) | ✅ |
| F07 | [Gap Detection](#f07-gap-detection) | ✅ |
| F08 | [AI Coaching](#f08-ai-coaching) | ✅ |
| F09 | [Memory Promotion](#f09-memory-promotion) | ✅ |
| F10 | [Resume Generation](#f10-resume-generation) | ✅ |
| F11 | [ATS Scoring](#f11-ats-scoring) | ✅ |
| F12 | [Resume PDF Export](#f12-resume-pdf-export) | ✅ |
| F13 | [Cover Letter Generation](#f13-cover-letter-generation) | ✅ |
| F14 | [Cover Letter PDF Export](#f14-cover-letter-pdf-export) | ✅ |
| F15 | [STAR Story Extraction](#f15-star-story-extraction) | ✅ |
| F16 | [Tag-Based Browser](#f16-tag-based-browser) | ✅ |
| F17 | [Application Tracking](#f17-application-tracking) | ✅ |
| F18 | [Interview Prep Coaching](#f18-interview-prep-coaching) | ✅ |
| F19 | [Email & Calendar Reminders](#f19-email--calendar-reminders) | ✅ |
| F20 | [Multi-Resume Comparison](#f20-multi-resume-comparison) | ✅ |
| F21 | [Settings Page](#f21-settings-page) | ✅ |
| F22 | [LinkedIn Import](#f22-linkedin-import) | ✅ |
| F23 | [PDF Magic-Byte Validation](#f23-pdf-magic-byte-validation) | ✅ |
| F24 | [Team / Recruiter Mode](#f24-team--recruiter-mode) | 🔜 |

---

## Dependency graph

Read arrows as "depends on" or "is fed by".

```
F01 Authentication & Onboarding
  └─► F02 Document Ingestion & Memory ◄──────────────────────────────────┐
            │                                                              │
            │ memories[]                                                  F09 Memory Promotion
            ▼                                                              ▲
F03 Job Description Processing ──► F04 Company Research                   │
  │         │                                                              │
  │         │ parsed JD + embeddings                                       │
  │         ▼                                                              │
  │    F05 JD Similarity Search ─────────────────────────────────────► F07 Gap Detection
  │                                                                        │
  │                                                                        │ gaps[]
  ├──────────────────────────────────────────────────────────────────► F06 Fit Scoring
  │                                                                        │
  │                                                                        ▼
  │                                                                   F08 AI Coaching ─────────────────────────────┐
  │                                                                        │                                        │
  │                                                                        │ coaching answers                       │
  │                                                                        ▼                                        │
  │                                                                   F10 Resume Generation ──► F11 ATS Scoring     │
  │                                                                        │              └────► F12 Resume PDF      │
  │                                                                        │                                        │
  │                                                                        ├──────────────────► F13 Cover Letter ──► F14 Cover Letter PDF
  │                                                                        │
  │                                                                        └──────────────────► F15 STAR Extraction
  │                                                                                                  │
  │                                                                        ┌─────────────────────────┘
  │                                                                        │ story library
  │                                                                        ▼
  │                                                                   F16 Tag Browser     F17 Application Tracking
  │                                                                                              │
  │                                                                                              │ status: technical/behavioral
  │                                                                                              ▼
  └────────────────────────────────────────────────────────────────────────────────────── F18 Interview Prep
                                                                                                (uses F15 STAR library)
```

---

## Built features

---

### F01 Authentication & Onboarding

**What it does:** Authenticates the user via Clerk, then walks them through a 4-step first-run setup that populates their profile and seeds their memory with an initial CV.

**Input:**
- User signs in via Clerk (email/password or OAuth)
- Step 1: full name
- Step 2: years of experience + seniority level
- Step 3: target roles / industries
- Step 4: CV or LinkedIn PDF upload

**Output:**
- `profiles` row (name, experience, target roles)
- `documents` row (uploaded file metadata)
- Initial `memories[]` rows (extracted from CV — see F02)
- Clerk JWT attached to every subsequent API request

**Depends on:**
- Clerk (external auth provider)
- F02 Document Ingestion & Memory (CV upload in step 4 calls the ingest endpoint)

**Used by:**
- Every authenticated feature — the profile row is required before any other route works
- F07 Gap Detection (profile data used to personalise gap analysis)

**Key files:**
- `app/onboarding/page.tsx`
- `middleware.ts`
- `api/routers/auth.py`
- `api/routers/profile.py`

---

### F02 Document Ingestion & Memory

**What it does:** Takes a PDF (CV, LinkedIn export, or any document), extracts its text, and uses an LLM to segment it into typed semantic chunks. Each chunk is embedded and stored as a memory — a reusable, queryable fact about the user's career.

**Input:**
- PDF file (multipart upload)
- Authenticated user (`profile_id`)

**Output:**
- `documents` row (file metadata, extraction status)
- `memories[]` rows, each with:
  - `chunk_type`: EXPERIENCE | EDUCATION | SKILLS_SUMMARY | PROJECTS | LANGUAGES | WAR_STORY | PREFERENCE | OTHER
  - `content`: plain text
  - `embedding`: 1536-dim float vector

**Depends on:**
- F01 Authentication & Onboarding (requires a profile)
- OpenAI `text-embedding-3-small` (embeddings)
- OpenAI `MemoryExtractionPrompt` LLM call
- Prompt injection scan (F09 Memory Promotion uses the same guard)

**Used by:**
- F06 Fit Scoring (retrieves relevant memories to compare against JD)
- F07 Gap Detection (retrieves relevant memories to identify what the user can/can't demonstrate)
- F08 AI Coaching (retrieves top-10 memories each turn for context)
- F10 Resume Generation (retrieves memories for bullet point material)
- F13 Cover Letter Generation (retrieves memories for specific anecdotes)
- F18 Interview Prep Coaching (retrieves memories for coaching context)

**Key files:**
- `api/routers/memory.py`
- `api/services/memory_service.py`
- `api/prompts/memory_extraction.py`

---

### F03 Job Description Processing

**What it does:** Takes raw JD text pasted by the user, calls an LLM to extract structured requirements and metadata labels, embeds the full JD text for similarity search, and triggers company research in a separate transaction.

**Input:**
- Raw JD text (string)
- Authenticated user (`profile_id`)

**Output:**
- `jds` row with:
  - `company_name`, `role_title`
  - `parsed_requirements`: structured list of required and preferred skills/responsibilities
  - `labels`: `{ company_size, role_focus, tech_depth, domain }`
  - `company_research`: plain text Tavily summary (may be null if F04 fails or key is absent)
- `jd_memories` row: embedded JD text chunk (for F05)

**Depends on:**
- F01 Authentication & Onboarding
- OpenAI `JDParsingPrompt` LLM call
- OpenAI `text-embedding-3-small`
- F04 Company Research (best-effort, separate transaction)

**Used by:**
- F05 JD Similarity Search (uses `jd_memories` embedding)
- F06 Fit Scoring (uses `parsed_requirements` and `labels`)
- F07 Gap Detection (uses `parsed_requirements`, `labels`, `company_research`)
- F08 AI Coaching (uses JD labels to calibrate coaching tone)
- F10 Resume Generation (uses `parsed_requirements` and `labels`)
- F13 Cover Letter Generation (uses `parsed_requirements` and `company_research`)
- F16 Tag-Based Browser (uses `labels.tags` once written back by F10)

**Key files:**
- `api/routers/jd.py`
- `api/services/jd_service.py`
- `api/prompts/jd_parsing.py`

---

### F04 Company Research

**What it does:** Given a company name extracted from the JD, performs a live web search (Tavily) and returns a 2–4 sentence summary of the company's engineering culture, tech stack, and recent news. Runs as a best-effort second phase after JD parsing; failure never blocks JD creation. When present, shown in chat as a collapsible **Company snapshot** banner.

**Input:**
- `company_name` (from F03 parsing output)

**Output:**
- `jd.company_research` (plain text, written back to the JD row)

**Depends on:**
- F03 Job Description Processing (triggered from `JDService.create_jd`)
- Tavily API (`TAVILY_API_KEY` env var; gracefully absent if not set)

**Used by:**
- F07 Gap Detection (injected into gap detection prompt for stack-awareness)
- F08 AI Coaching (injected each turn so coach can reference company culture)
- F13 Cover Letter Generation (used to personalise the opening paragraph)

**Key files:**
- `api/services/company_research_service.py`

---

### F05 JD Similarity Search

**What it does:** Given a new JD, finds the user's most semantically similar past JDs by comparing embeddings. Groups chunk hits by JD ID and ranks by hit count to identify the top 3 most similar past roles.

**Input:**
- New JD embedding (from F03)
- User's historical `jd_memories` rows (all past JDs for the same user)

**Output:**
- List of up to 3 similar past JDs with their summaries — passed as context to other features, not stored separately

**Depends on:**
- F03 Job Description Processing (provides the embedding and the historical `jd_memories` table)
- pgvector HNSW index on `jd_memories.embedding`

**Used by:**
- F07 Gap Detection (provides "you applied to similar roles before" context)
- F10 Resume Generation (provides past resumes with matching labels as style inspiration)

**Key files:**
- `api/services/jd_similarity_service.py`

---

### F06 Fit Scoring

**What it does:** Before starting a coaching session, computes a holistic fit score by comparing the user's memory embeddings against the JD's required skills and responsibilities. An LLM pass categorises the findings into strengths, gaps, and an overall recommendation (pursue / borderline / skip).

**Input:**
- User's `memories[]` (from F02)
- JD `parsed_requirements` and `labels` (from F03)

**Output:**
- `{ strengths: string[], gaps: string[], recommendation: "pursue" | "borderline" | "skip", score: number }`
- Returned as JSON at `GET /api/jds/{id}/fit-score`; not persisted to DB

**Depends on:**
- F02 Document Ingestion & Memory
- F03 Job Description Processing
- OpenAI LLM call (fit analysis prompt)
- pgvector cosine distance search

**Used by:**
- Chat UI (displayed in the JD detail panel before coaching begins)
- Helps user decide whether to start a coaching session at all

**Key files:**
- `api/routers/jd.py` (`/fit-score` endpoint)
- `api/services/jd_service.py`

---

### F07 Gap Detection

**What it does:** Runs once when a coaching conversation is created. Compares what the JD requires against what the user's memories demonstrate, calibrated by JD labels and informed by past similar applications (F05) and company research (F04). Produces an ordered list of gaps and an opening coaching message.

**Input:**
- JD `parsed_requirements`, `labels` (from F03)
- User's top-N relevant `memories[]` (semantic search via F02 embeddings)
- Company research text (from F04, may be empty)
- Similar past JD context (from F05)

**Output:**
- `conversations` row created with initial state:
  - `gaps: string[]` — ordered list of skill/experience gaps to address
  - `questions_remaining: number`
  - `answers: {}`  — empty at creation
- First `conversation_messages` row (assistant's opening message)

**Depends on:**
- F02 Document Ingestion & Memory
- F03 Job Description Processing
- F04 Company Research
- F05 JD Similarity Search
- OpenAI `GapDetectionPrompt` LLM call

**Used by:**
- F08 AI Coaching (the `gaps[]` list drives which questions are asked each turn)

**Key files:**
- `api/services/gap_detection_service.py`
- `api/prompts/gap_detection.py`

---

### F08 AI Coaching

**What it does:** The core interactive coaching loop. Each user message triggers a LangGraph graph that routes to the correct node (gap-filling, resume drafting, or interview prep), generates an assistant response, and updates the conversation state. Streams the response token-by-token via SSE, with **thinking phase** events so the UI can show what the system is doing before tokens arrive.

**Input (per turn):**
- User message text (max 10,000 chars)
- Current `conversation.state` (gaps, answers so far, current step)
- Top-10 relevant `memories[]` (semantic search, per turn)
- JD details and labels
- Company research text

**Output (per turn):**
- New `conversation_messages` row (user)
- New `conversation_messages` row (assistant, streamed via SSE)
- Updated `conversation.state` (marks gap as addressed if answer extracted)
- Updated `conversation.current_step` (e.g. `gap_conversation` → `resume_generation` when gaps cleared)
- SSE `memory_updates[]` on `done` when F09 fires (content preview + chunk_type)
- Optionally: new `memories[]` row (if F09 memory promotion fires)

**SSE event types (`POST /api/conversations/{id}/messages`):**

| Event | Purpose |
|---|---|
| `thinking` | Phase label — memory search, gap check, coaching generation |
| `token` | Streaming assistant text fragment |
| `done` | Final message id, full text, `current_step`, `memory_updates[]` |
| `error` | Failure detail |

**Chat UI (`ChatClient.tsx`):**
- Streaming bubble shows latest `thinking` phase until first token
- System update cards for memory promotion, resume-ready, STAR extraction, application tracked
- Auto-resizing composer with optional voice input (Web Speech API)
- Step badge: **Coaching** during gap-filling, **Resume ready** after transition
- Resume / Cover letter tabs appear when `current_step` is `resume_generation`, `interview_prep`, or `done`

**Depends on:**
- F02 Document Ingestion & Memory (memory retrieval each turn)
- F03 Job Description Processing (JD context)
- F04 Company Research (injected into every turn)
- F07 Gap Detection (conversation state / gaps list created here)
- F09 Memory Promotion (may fire after answer extraction)
- OpenAI `ConversationResponsePrompt` LLM call
- OpenAI `ExtractAnswerPrompt` (cheap gpt-5-nano call to pull structured answer)
- LangGraph graph (`conversation_graph.py`)
- `slowapi` rate limit: 30 requests/minute

**Used by:**
- F10 Resume Generation (consumes `conversation.state.answers`)
- F13 Cover Letter Generation (consumes `conversation.state.answers`)
- F15 STAR Story Extraction (consumes coaching answers + resume bullets)
- F18 Interview Prep Coaching (same conversation, different graph node)

**Key files:**
- `api/services/conversation_service.py`
- `api/services/conversation_graph.py`
- `api/prompts/conversation_response.py`
- `api/prompts/extract_answer.py`
- `api/prompts/resume_transition.py`
- `app/app/chat/_components/ChatClient.tsx`
- `lib/api.ts` (`streamMessage` SSE parser)

---

### F09 Memory Promotion

**What it does:** During coaching, when a user shares a new experience, skill, or preference that isn't already in their memory bank, the `promote_memory_node` in the LangGraph graph extracts it as a new memory chunk and writes it to the database. This makes the coach progressively richer across all future sessions.

**Input:**
- User message (current coaching turn)
- Existing memories (for deduplication — top-8 nearest by vector)
- Extraction prompt judgment: is there new, non-duplicate information?

**Output:**
- New `memories` row (if promotion fires):
  - `chunk_type`: typically EXPERIENCE, WAR_STORY, SKILLS_SUMMARY, or PREFERENCE
  - `content`: extracted text
  - `embedding`: 1536-dim vector
- In-chat system update card (via F08 `done.memory_updates[]`) with link to `/app/files`

**Depends on:**
- F08 AI Coaching (fires as a node inside the LangGraph graph)
- F02 Document Ingestion & Memory (deduplication uses the same embeddings table)
- OpenAI `MemoryPromotionPrompt` LLM call
- OpenAI `text-embedding-3-small`

**Used by:**
- F02 Document Ingestion & Memory (writes to the same `memories` table; promoted memories are treated identically to ingested ones in all downstream features)

**Key files:**
- `api/services/conversation_graph.py` (`promote_memory_node`)
- `api/prompts/memory_promotion.py`

---

### F10 Resume Generation

**What it does:** Generates a fully tailored resume by combining coaching answers, user memories, JD requirements, and style inspiration from past similar resumes. Writes retrieval tags back to the JD for future similarity searches. Triggers STAR extraction automatically. Persists an ATS-friendly DOCX alongside structured JSON content.

**Input:**
- `conversation.state.answers` (from F08)
- User `memories[]` relevant to this JD (semantic search)
- JD `parsed_requirements`, `labels` (from F03)
- Past similar resumes with matching `role_focus` / `domain` (from F05, style reference)

**Output:**
- `resumes` row with:
  - `content`: `{ summary, experience: [{company, role, dates, bullets[]}], skills[] }`
  - `docx_content`: binary DOCX (generated on create)
  - `labels`: JD labels + generated `tags[]`
- `jd.labels.tags` updated (tags written back)
- F15 STAR Story Extraction (count returned as `stars_extracted` on `POST /api/jds/{id}/resume`)
- Chat UI: user must open **Resume** tab and click **Generate tailored resume** (not emitted as a chat bubble)

**Depends on:**
- F08 AI Coaching (answers must be gathered before generation makes sense)
- F02 Document Ingestion & Memory
- F03 Job Description Processing
- F05 JD Similarity Search (past resume style reference)
- OpenAI `ResumeGenerationPrompt` LLM call (structured output)

**Used by:**
- F11 ATS Scoring (runs on the generated resume)
- F12 Resume PDF Export (exports the generated resume)
- F13 Cover Letter Generation (uses resume as voice/tone reference)
- F15 STAR Story Extraction (triggered automatically after generation)
- F16 Tag-Based Browser (tags written to JD are queryable)
- F20 Multi-Resume Comparison (planned — compares multiple versions per JD)

**Key files:**
- `api/routers/resume.py`
- `api/services/resume_service.py`
- `api/prompts/resume_generation.py`

---

### F11 ATS Scoring

**What it does:** After a resume is generated, performs a keyword coverage pass: checks whether the resume text covers the JD's required and preferred skill terms, and flags structural issues (missing dates, unexplained gaps, non-standard section names). Returns a score (0–100) and a list of specific findings.

**Input:**
- Generated resume `content` (from F10)
- JD `parsed_requirements` (required keywords and preferred phrases from F03)

**Output:**
- `{ score: number, covered_keywords: string[], missing_keywords: string[], structural_flags: string[] }`
- Returned as JSON at `GET /api/resumes/{id}/ats-score`; not persisted to DB

**Depends on:**
- F10 Resume Generation (must have a resume to score)
- F03 Job Description Processing (provides keyword list)
- OpenAI LLM call (ATS analysis prompt)
- `slowapi` rate limit: 20 requests/hour

**Used by:**
- Chat UI (displayed in the resume panel immediately after generation)
- User decides whether to re-generate or proceed to application

**Key files:**
- `api/routers/resume.py` (`/ats-score` endpoint)
- `api/services/resume_service.py`

---

### F12 Resume PDF Export

**What it does:** Generates a formatted, downloadable PDF of the resume using server-side reportlab. Produces a consistent PDF regardless of browser settings or OS font rendering. (DOCX export is generated at F10 create time and served at `GET /api/resumes/{id}/docx`.)

**Input:**
- `resumes.content` JSONB (from F10)

**Output:**
- PDF binary stream (`application/pdf`)
- Served at `GET /api/resumes/{id}/pdf`

**Depends on:**
- F10 Resume Generation
- reportlab Python library

**Used by:**
- Chat UI ("Download PDF" and "Download DOCX" buttons in the resume panel)

**Key files:**
- `api/routers/resume.py` (`/pdf` endpoint)
- `api/services/resume_service.py`

---

### F13 Cover Letter Generation

**What it does:** Generates a tailored cover letter for the role. Uses the generated resume as a voice and content reference (ensuring both documents tell the same story), coaching answers for specific anecdotes, and company research for an opening paragraph personalised to the company.

**Input:**
- Most recently generated `resumes.content` for this JD (from F10 — voice/tone reference)
- `conversation.state.answers` (from F08 — specific anecdotes)
- JD `parsed_requirements` (from F03)
- `jd.company_research` (from F04 — personalises opening)

**Output:**
- `cover_letters` row with:
  - `content`: `{ opening, body_paragraphs[], closing, signature }`

**Depends on:**
- F10 Resume Generation (cover letter should only be generated after a resume exists)
- F08 AI Coaching (coaching answers provide anecdote material)
- F03 Job Description Processing
- F04 Company Research
- OpenAI `CoverLetterGenerationPrompt` LLM call
- `slowapi` rate limit: 10 requests/hour

**Used by:**
- F14 Cover Letter PDF Export
- Chat UI (cover letter panel alongside the resume panel)

**Key files:**
- `api/routers/cover_letter.py`
- `api/services/cover_letter_service.py`
- `api/prompts/cover_letter_generation.py`

---

### F14 Cover Letter PDF Export

**What it does:** Same pipeline as F12 but for cover letters. Generates a downloadable PDF via reportlab.

**Input:**
- `cover_letters.content` JSONB (from F13)

**Output:**
- PDF binary stream (`application/pdf`)
- Served at `GET /api/cover-letters/{id}/pdf`

**Depends on:**
- F13 Cover Letter Generation
- reportlab Python library

**Used by:**
- Chat UI ("Download PDF" button in the cover letter panel)

**Key files:**
- `api/routers/cover_letter.py` (`/pdf` endpoint)
- `api/services/cover_letter_service.py`

---

### F15 STAR Story Extraction

**What it does:** Automatically runs after resume generation. Mines the coaching answers and resume bullets for concrete experiences that can be reframed as STAR (Situation, Task, Action, Result) stories. Each extracted story is embedded and stored in the STAR library for use in future sessions and interview prep.

**Input:**
- `conversation.state.answers` (from F08)
- Generated `resumes.content` bullets (from F10)

**Output:**
- `star_stories[]` rows, each with:
  - `situation`, `task`, `action`, `result` (structured text)
  - `skill_tags[]` (e.g. `["Python", "team leadership", "incident response"]`)
  - `embedding`: 1536-dim vector (full story text embedded for retrieval)
- `stars_extracted` count on `POST /api/jds/{id}/resume` response
- In-chat notification with link to `/app/stars` when count > 0

**Depends on:**
- F10 Resume Generation (triggered automatically after generation completes)
- F08 AI Coaching (coaching answers are the primary raw material)
- OpenAI LLM call (STAR extraction prompt)
- OpenAI `text-embedding-3-small`

**Used by:**
- F16 Tag-Based Browser (skill tags are browsable)
- F18 Interview Prep Coaching (STAR stories retrieved by vector similarity and injected into interview coaching context)

**Key files:**
- `api/routers/star.py`
- `api/services/star_service.py`
- `app/app/stars/page.tsx`

---

### F16 Tag-Based Browser

**What it does:** Surfaces a tag cloud built from `labels.tags` across all the user's JDs and resumes. Clicking a tag shows all JDs and resumes associated with it, giving a cross-application view of the user's career themes.

**Input:**
- `jd.labels.tags[]` written back during F10
- `resumes.labels.tags[]` also written during F10

**Output:**
- `GET /api/tags` → `{ tag: string, count: number }[]` (tag cloud)
- `GET /api/tags/{tag}/browse` → `{ jds: JD[], resumes: Resume[] }`

**Depends on:**
- F10 Resume Generation (tags are generated and written back during this step; tags do not exist on a JD until a resume has been generated for it)

**Used by:**
- Browse page (`/app/browse`) — frontend only

**Key files:**
- `api/routers/tags.py`
- `app/app/browse/page.tsx`

---

### F17 Application Tracking

**What it does:** Tracks job applications through a 6-stage Kanban pipeline. Each application is linked to a JD and optionally a resume. Status changes are made via drag-and-drop or a detail panel. Applications are **not** created automatically — the user clicks **Mark as applied** on the chat Resume tab after generating a resume.

**Input:**
- `jd_id` (required), `resume_id` (optional) — provided when creating an application (`POST /api/applications` or **Mark as applied** in chat)
- Status updates via `PATCH /api/applications/{id}`

**Output:**
- `applications` row with:
  - `status`: applied | screening | technical | behavioral | offer | rejected
  - `company_name`, `role_title` (denormalised from JD at creation time)
  - `notes` (free text)
  - Timestamps: `applied_at`, `updated_at`
- In-chat confirmation card with link to `/app/applications`

**Depends on:**
- F03 Job Description Processing (must have a JD to create an application)
- F10 Resume Generation (optional: attach a specific resume version to the application)

**Used by:**
- F19 Email & Calendar Reminders (planned — watches for stale applications)

**Key files:**
- `api/routers/application.py`
- `api/services/application_service.py`
- `app/app/applications/page.tsx`

---

### F18 Interview Prep Coaching

**What it does:** Transitions the existing coaching conversation to `interview_prep` mode when the user clicks **Start interview prep** on the chat Resume tab (`POST /api/conversations/{id}/interview-prep`). The LangGraph graph routes to `interview_coaching_node`, which uses a different system prompt — focused on realistic interview questions, STAR technique practice, and scenario-based feedback rather than gap-filling. Retrieves relevant STAR stories from F15 to give the coach real examples to work with.

**Input:**
- `conversation_id` (the existing coaching conversation for this JD)
- User messages (via the same SSE streaming endpoint as F08, including `thinking` events)
- Top-N STAR stories by vector similarity to the current interview question (from F15)
- User `memories[]` for background context

**Output:**
- New `conversation_messages` rows (user + assistant, streamed via SSE)
- `conversation.current_step` set to `interview_prep`

**Depends on:**
- F08 AI Coaching (reuses the same conversation, LangGraph graph, and SSE infrastructure)
- F10 Resume Generation (entry point is on the Resume tab after a resume exists)
- F15 STAR Story Extraction (STAR stories are the primary coaching material)
- F02 Document Ingestion & Memory (memories provide background context)
- OpenAI `InterviewCoachingPrompt` LLM call

**Used by:**
- Chat UI (same conversation view, different mode)

**Key files:**
- `api/routers/conversation.py` (`/interview-prep` endpoint)
- `api/services/conversation_graph.py` (`interview_coaching_node`)
- `api/prompts/interview_coaching.py`

---

## Planned features

---

### F19 Email & Calendar Reminders

**What it does:** Sends a follow-up reminder when an application has been in `applied` or `screening` status for a configurable number of days with no update. Optionally creates a calendar event for interview stages.

**Input:**
- `applications` rows with stale `updated_at` (from F17)
- User notification preferences (email address, reminder threshold)

**Output:**
- Email notification (via Resend / Postmark)
- Optional calendar event (via Google Calendar / iCal)

**Depends on:**
- F17 Application Tracking (watches application status and timestamps)
- External: email provider (Resend or Postmark) + optional calendar API
- A background worker or Vercel Cron Job (not the request/response API)

**Used by:**
- Nothing downstream — this is a leaf feature

**Implementation notes:**
Status transition events already exist in `application_service.py`. Adding reminders is a notification layer on top: a cron job queries for applications where `updated_at < now() - interval` and `status NOT IN ('offer', 'rejected')`, then sends the notification. Should not be added inline to the PATCH handler — that would add latency and coupling.

---

### F20 Multi-Resume Comparison

**What it does:** Allows the user to view two resume versions for the same JD side by side, with a visual diff highlighting added and removed bullets.

**Input:**
- Two `resume.id` values for the same JD (from F10 — users can generate multiple)

**Output:**
- Diff view in the frontend (added/removed/changed bullets highlighted)

**Depends on:**
- F10 Resume Generation (the `GET /api/jds/{id}/resumes` endpoint already returns all versions — no backend changes needed)

**Used by:**
- Nothing downstream — this is a leaf feature

**Implementation notes:**
Purely a frontend feature. The data already exists. The work is a React component that renders two `ResumePanel` components side by side using a text diff algorithm (e.g. `diff-match-patch`).

---

### F21 Settings Page

**What it does:** Exposes user-controlled preferences and management tools: edit profile (name, experience, target roles), bulk-delete memories, re-extract memories from a previously uploaded document, and configure notification preferences.

**Input:**
- User actions (form submissions, delete confirmations)

**Output:**
- Updated `profiles` row
- Deleted `memories` rows
- Updated notification preferences (new field on `profiles` or a new table)

**Depends on:**
- F01 Authentication & Onboarding (profile management)
- F02 Document Ingestion & Memory (re-extraction reuses the same ingest endpoint)
- F19 Email & Calendar Reminders (planned — notification preferences managed here)

**Used by:**
- Nothing downstream — this is a management surface

**Implementation notes:**
All required API endpoints already exist (`PATCH /api/profiles`, `DELETE /api/memories/{id}`, `POST /api/memories/ingest`). This is a new frontend route (`/app/settings`) and UI components only.

---

### F22 LinkedIn Import

**What it does:** Allows the user to provide a LinkedIn profile URL instead of uploading a PDF during onboarding. Fetches and parses their LinkedIn data directly into the memory pipeline.

**Input:**
- LinkedIn profile URL (provided during onboarding or settings)

**Output:**
- Same as F02: `documents` row + `memories[]` rows with embeddings

**Depends on:**
- F01 Authentication & Onboarding (replaces or augments the PDF upload step)
- F02 Document Ingestion & Memory (uses the same extraction and embedding pipeline downstream)
- External: LinkedIn API or a structured scraping approach

**Used by:**
- All features that use F02's output

**Implementation notes:**
The memory extraction pipeline in F02 accepts text, not just PDFs. The LinkedIn integration's job is to produce a clean text representation of the profile and hand it to `memory_service.py`. The main challenge is obtaining the data — LinkedIn's official API is restricted for this use case.

---

### F23 PDF Magic-Byte Validation

**What it does:** Adds a file integrity check to the document upload flow: reads the first 4 bytes of every uploaded file and verifies they are `%PDF` before attempting text extraction. Prevents a renamed `.html` or `.txt` file from being silently parsed as a PDF.

**Input:**
- First 4 bytes of uploaded file (during F02 ingest)

**Output:**
- HTTP 400 with a clear error message if the magic bytes don't match
- No change to happy-path output

**Depends on:**
- F02 Document Ingestion & Memory (one additional check before pypdf parsing)

**Used by:**
- Nothing downstream — this is a hardening measure

**Implementation notes:**
One-line addition to `memory_service.py` before the `pypdf` call:
```python
if file_bytes[:4] != b"%PDF":
    raise ValueError("Uploaded file is not a valid PDF")
```

---

### F24 Team / Recruiter Mode

**What it does:** Allows a recruiter to manage multiple candidate profiles from a single account. Each candidate has their own isolated memory, JDs, resumes, and application pipeline. The recruiter sees a unified Kanban view across all candidates.

**Input:**
- Recruiter creates candidate profiles (name, email, uploads their CV on their behalf)
- Recruiter assigns JDs to candidates and triggers coaching sessions

**Output:**
- Multi-tenant data model: a `recruiter_profiles` table referencing multiple `profiles`
- Shared Kanban view filtered to a specific candidate or across all candidates

**Depends on:**
- All features (every feature becomes multi-user at the recruiter level)
- F01 Authentication & Onboarding (recruiter needs a different onboarding flow)
- F17 Application Tracking (unified Kanban)

**Used by:**
- Nothing downstream — this is a new top-level persona

**Implementation notes:**
This is a significant architectural addition. The current data model is strictly per-user (`user_id` on every row). Recruiter mode requires either a many-to-many between recruiters and candidate profiles, or a new `managed_by` field on `profiles`. Every service method's ownership check would need to be extended to allow a recruiter to read/write a candidate's data.

---

## Feature × feature dependency matrix

A ✓ in row X / column Y means **X depends on Y**.

|  | F01 | F02 | F03 | F04 | F05 | F06 | F07 | F08 | F09 | F10 | F11 | F12 | F13 | F14 | F15 | F16 | F17 | F18 |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **F02** Document Ingestion | ✓ | | | | | | | | | | | | | | | | | |
| **F03** JD Processing | ✓ | | | | | | | | | | | | | | | | | |
| **F04** Company Research | | | ✓ | | | | | | | | | | | | | | | |
| **F05** JD Similarity | | | ✓ | | | | | | | | | | | | | | | |
| **F06** Fit Scoring | | ✓ | ✓ | | | | | | | | | | | | | | | |
| **F07** Gap Detection | | ✓ | ✓ | ✓ | ✓ | | | | | | | | | | | | | |
| **F08** AI Coaching | | ✓ | ✓ | ✓ | | | ✓ | | | | | | | | | | | |
| **F09** Memory Promotion | | ✓ | | | | | | ✓ | | | | | | | | | | |
| **F10** Resume Generation | | ✓ | ✓ | | ✓ | | | ✓ | | | | | | | | | | |
| **F11** ATS Scoring | | | ✓ | | | | | | | ✓ | | | | | | | | |
| **F12** Resume PDF | | | | | | | | | | ✓ | | | | | | | | |
| **F13** Cover Letter | | ✓ | ✓ | ✓ | | | | ✓ | | ✓ | | | | | | | | |
| **F14** Cover Letter PDF | | | | | | | | | | | | | ✓ | | | | | |
| **F15** STAR Extraction | | | | | | | | ✓ | | ✓ | | | | | | | | |
| **F16** Tag Browser | | | | | | | | | | ✓ | | | | | | | | |
| **F17** Application Tracking | | | ✓ | | | | | | | ✓ | | | | | | | | |
| **F18** Interview Prep | | ✓ | | | | | | ✓ | | | | | | | ✓ | | ✓ | |
| **F19** Reminders 🔜 | | | | | | | | | | | | | | | | | ✓ | |
| **F20** Resume Comparison 🔜 | | | | | | | | | | ✓ | | | | | | | | |
| **F21** Settings 🔜 | ✓ | ✓ | | | | | | | | | | | | | | | | |
| **F22** LinkedIn Import 🔜 | ✓ | ✓ | | | | | | | | | | | | | | | | |
| **F23** PDF Validation 🔜 | | ✓ | | | | | | | | | | | | | | | | |
| **F24** Recruiter Mode 🔜 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## Production deployment

New features shipped in 2026-06 share a single migration and a few API fixes. **Deploying code without the migration causes 500s on `/api/stars`, cover letter routes, and interview prep.**

### Required steps

1. **`alembic upgrade head`** — applies `a1b2c3d4e5f6` (`cover_letters`, `star_stories`, `interview_prep` enum value).
2. **Rebuild API container** if using Docker — `slowapi` and `reportlab` must be in the image (`docker compose build api`).
3. **Smoke test** after deploy:

| Check | Endpoint / page | Expected |
|---|---|---|
| Health | `GET /api/health` | 200 |
| STAR library | `GET /api/stars` | 200 `[]` or list |
| Tags | `GET /api/tags` | 200 (empty until first resume) |
| Browse UI | `/app/browse` | Loads without "Could not load tags" |
| Cover letter | `POST /api/jds/{id}/cover-letter` | 201 or 422 (no conversation) |
| Interview prep | `POST /api/conversations/{id}/interview-prep` | 200 or 422 (wrong step) |

### Regression fixes (do not revert)

- **`api/routers/tags.py`**: SQL bind params use `CAST(:uid AS uuid)`, not `:uid::uuid`.
- **`api/routers/tags.py`**: Browse filters `labels->'tags'`, not top-level `labels`.
- **`api/routers/resume.py`**, **`cover_letter.py`**: `selectinload` for async JD relationship on PDF/ATS routes.

### Feature activation order (first user journey)

For QA or demos, exercise features in dependency order:

1. F01 Onboarding → F02 CV ingest  
2. F03 Paste JD → F06 Fit score → confirm **Company snapshot** in chat (if `TAVILY_API_KEY` set)  
3. F07/F08 Start coaching → complete gaps (watch **thinking** phases + step badge → **Resume ready**)  
4. F10 **Resume tab** → Generate resume → F11 ATS, F12 DOCX/PDF, F15 STAR notification  
5. F17 **Mark as applied** → card on `/app/applications`  
6. F13 Cover letter → F14 PDF  
7. F18 **Start interview prep** from Resume tab (not from Kanban)  
