# AI Content & Course Factory

An AI-powered system that discovers technology/AI topics from **real sources**, researches them,
and turns the approved ones into educational content: a research knowledge base (`MASTER.md`),
a curriculum (`COURSE.md`), per-lesson markdown, and a 15–30 second teaser script.

This repository contains **V1** of the pipeline:

```
Topic input / Discovery → Topic ranking → HUMAN APPROVAL → Research → MASTER.md
   → Course planning → COURSE.md → Sections → Lesson markdown → teaser.md
```

Deliberately **not** in V1: voice cloning, Remotion, FFmpeg, S3/CloudFront, auto-publishing,
Redis/BullMQ, Kubernetes, microservices, MCP. The service layer is shaped so each of those can be
added later without rewriting business logic.

---

## Architecture

```
AI-Video-Content/
├── backend/                 Node.js + TypeScript + Express + MongoDB + socket.io
│   └── src/
│       ├── infrastructure/  everything external: database, storage, AI provider, sources, realtime
│       ├── model/           Mongoose entities + ALL index definitions
│       ├── application/     the orchestrator and the business services
│       ├── controller/      HTTP endpoints (validate → call a service → respond)
│       ├── middleware/      global error handling, request context, input validation
│       └── server.ts        bootstrap
└── frontend/                React + TypeScript + Vite
    └── src/
        ├── shared/          sharedService.ts — the ONLY file that talks to the backend
        ├── components/      VC_* components (every element on screen)
        └── screens/         one file per screen; screens call sharedService only
```

### Backend layers

| Folder | Responsibility |
| --- | --- |
| `infrastructure/` | MongoDB connection + index sync, `StorageService` (local for V1), `AIService` (Anthropic + offline mock), real source fetching (GitHub releases + RSS/Atom), socket.io gateway, `AppError` |
| `model/` | The seven V1 entities — Topic, Research, Course, Section, Lesson, Teaser, GenerationJob — and every index they need |
| `application/` | `GenerationOrchestrator` sequences the pipeline; `Discovery/Topic/Research/Curriculum/Lesson/Teaser/Job` services do the work; prompts are versioned in `application/prompts` |
| `controller/` | Thin Express routers. No business logic |
| `middleware/` | **One global error handler** that every failure passes through, plus request ids and Zod input validation |

### Key decisions

**Three interchangeable AI providers.** `AI_PROVIDER` selects one; business services depend on
the `AIService` interface only, so switching costs nothing:

| Provider | Auth | Use it for |
| --- | --- | --- |
| `claude-cli` | your Claude subscription, via the local Claude Code CLI | local development — no API billing. Needs `claude` installed and logged in; **tools are disabled** (`--tools ""`) because an agent CLI will otherwise spend its turn attempting a tool call and die with `error_max_turns` |
| `anthropic` | `AI_API_KEY` | anything deployed; provider-enforced structured output |
| `mock` | none | offline plumbing tests only |

Structured output differs by provider — the API forces a tool schema, the CLI is asked for JSON
and corrected once on failure — but **both run the same Zod validators**, so malformed output can
never reach the application.

**One AI abstraction.** Business services depend on the `AIService` interface only. Every AI call
that feeds code uses *structured output* (a JSON Schema sent to the provider, then Zod validation on
the way back) — never free-text parsing. With no `AI_API_KEY` set, a deterministic **mock provider**
runs the whole pipeline offline so you can develop and test without cost.

**One storage abstraction.** `LocalStorageService` writes under `backend/generated/`. Paths are
normalised and verified to stay inside the storage root, so AI-generated file names cannot traverse
out. Phase 7 swaps in cloud storage behind the same interface.

**One error shape.** Controllers throw; the global error handler in `middleware/errorHandler.ts`
converts `AppError`, Zod errors, Mongoose validation/cast/duplicate-key errors and anything
unexpected into:

```json
{ "success": false, "error": { "message": "...", "code": "...", "status": 409, "details": [], "requestId": "..." } }
```

Stack traces are returned in development only.

**Background work, no long-lived requests.** `POST /api/topics/:id/generate` returns a `jobId`
immediately; the pipeline continues in-process and pushes progress over socket.io. Because all
progress reporting goes through `JobService`, Phase 5 can move execution into a BullMQ worker
without touching the API or the UI.

**The topic shape we hunt for.** The strongest topic is a *specific free tool, run on a real
project, with a surprising measurable result* — "here is a free tool, I ran it on a whole
project, here is what happened". Discovery is tuned end to end for that shape: `new-tool`
(repositories created in the last 90 days with a low star floor, so small new tools surface
instead of `microsoft/vscode`) and `tool-launch` (Show HN) rank above commentary, and each topic
records `toolName`, `toolUrl`, `isFreeOrOpenSource`, `measurableOutcome` and `credibilityAnchor`.
The number is the hook, so it must come from the sources — the prompt forbids inventing one, and
topics legitimately leave it empty.

**Signals, not topics.** Discovery retrieves *signals* — engineering write-ups, community
tutorials, trending repositories, stories developers are discussing, and major stable releases — and
the AI's job is to propose what someone should **learn to build** because of them. A signal is
evidence, never the topic: "next.js v16.4.0-canary.59" is a signal; "Add streaming AI responses to a
Next.js app" is the course. Pre-releases and changelog-only bodies are dropped at the source, the
signal mix is balanced across kinds, and a **quality gate** in `DiscoveryService` rejects any
proposal shaped like a version number, an announcement, a repo name, or a theme with no concrete
deliverable — logging every rejection rather than dropping it silently.

Because turning signals into course ideas is pure synthesis, discovery **refuses to run** on the
mock provider instead of echoing headlines back as fake topics.

**Source provenance.** Research labels every claim as `verified-fact` / `ai-explanation` /
`recommendation` / `assumption`, stores the supporting URLs, and writes `SOURCES.md` with retrieval
dates — so generated teaching material can be audited.

### Frontend rules

* `src/shared/sharedService.ts` is the **only** file that calls the backend. Every request goes
  through one function, `clientProxy`, and every server error goes through one function,
  `handleServerError`, which returns the backend's error **and** raises the global alert.
* `<VC_Alert />` is mounted once in `App.tsx`; it renders whatever `handleServerError` publishes, so
  every server error is visible without a single screen wiring it up.
* `src/components/` holds the `VC_*` building blocks (`VC_Button`, `VC_Card`, `VC_TopicCard`,
  `VC_JobProgress`, `VC_Markdown`, …). Markdown is rendered into React elements, never injected as
  HTML, so AI-generated content cannot execute script in the dashboard.
* `src/screens/` holds one file per screen: Discover, Research, Courses, Course Details, Lesson
  Editor, Teasers, Generation.

---

## Database indexes

Indexes are declared on the schemas in `model/` and applied at boot by
`infrastructure/database/indexManager.ts` (`syncIndexes()` with `autoIndex: false`), so the schemas
are the single source of truth and index creation is an observable startup step.

| Collection | Index | Why |
| --- | --- | --- |
| `topics` | `status + score desc` | Discover screen lists candidates best-first |
| | | *(topics also carry `whatYouWillBuild` / `whoBenefits` / `whyNow` / `prerequisites`)* |
| | `discoveredAt desc` | newest-first browsing |
| | `dedupeKey` **unique** | the same topic can never be stored twice |
| | `title + description` **text** | similarity check against covered topics, `?search=` |
| | `audience + status` | audience-filtered lists |
| | `discoveryRunId` sparse | group one discovery run's output |
| `research` | `topicId` **unique** | one research doc per topic; blocks duplicate runs |
| | `status + updatedAt desc` | dashboard/worker queries |
| | `courseId` sparse | course → research lookup |
| `courses` | `topicId` **unique** | "avoid duplicate course generation" |
| | `status + createdAt desc`, `createdAt desc` | Courses screen |
| | `targetAudience + level` | browsing |
| | `title + description` **text** | find similar existing courses |
| `sections` | `courseId + order` **unique** | ordered curriculum, no collisions on re-plan |
| `lessons` | `sectionId + orderInSection` **unique** | ordered lessons per section |
| | `courseId + order` | whole curriculum in reading order |
| | `courseId + status` | progress and retry of failed lessons |
| `teasers` | `courseId` **unique** | one teaser per course |
| | `status + updatedAt desc` | Teasers screen |
| `generation_jobs` | `entityId + type + status` | refuse a second concurrent job for the same item |
| | `status + createdAt desc`, `createdAt desc` | Generation screen |

---

## Generated file layout

```
backend/generated/courses/{course-id}/
├── research/
│   ├── MASTER.md
│   └── SOURCES.md
├── course/
│   ├── COURSE.md
│   ├── section-01/lesson-01.md
│   └── section-02/lesson-01.md
└── marketing/
    ├── teaser.md
    └── teaser.json
```

---

## Running it

### Prerequisites
* Node.js 20+
* MongoDB running locally (`mongodb://127.0.0.1:27017`)

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env     # then set AI_API_KEY for real generation
npm run dev              # http://localhost:4500/api
```

Leaving `AI_API_KEY` empty is supported: the mock AI provider runs the full pipeline offline with
placeholder content, which is useful for testing the plumbing. Set it to generate real material.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env     # VITE_API_BASE_URL=http://localhost:4500
npm run dev              # http://localhost:5173
```

### Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `PORT` | backend | API port (default 4500) |
| `MONGODB_URI` | backend | MongoDB connection string |
| `CORS_ORIGIN` | backend | comma-separated allowed origins (any localhost port is allowed in dev) |
| `AI_PROVIDER` | backend | `claude-cli` \| `anthropic` \| `mock` (see above) |
| `AI_API_KEY` / `AI_MODEL` | backend | API credentials and model; **server-side only** |
| `AI_CLI_BINARY` / `AI_CLI_TIMEOUT_MS` | backend | `claude-cli` only: executable and per-call timeout |
| `AI_MAX_OUTPUT_TOKENS` | backend | per-request output cap |
| `GENERATED_ROOT` | backend | where generated markdown is written |
| `DISCOVERY_RSS_FEEDS` | backend | engineering blogs — the richest teaching signal |
| `DISCOVERY_TRENDING_TOPICS` | backend | subjects used to find trending repos and tutorials |
| `DISCOVERY_HN_MIN_POINTS` | backend | minimum Hacker News score for a story to count |
| `DISCOVERY_NEW_TOOL_MIN_STARS` | backend | star floor for repos created in the last 90 days (kept low on purpose) |
| `DISCOVERY_GITHUB_REPOS` | backend | optional `owner/repo` list watched for **major** releases |
| `DISCOVERY_MAX_CANDIDATES` | backend | candidates per discovery run |
| `GITHUB_TOKEN` | backend | optional, raises GitHub rate limits |
| `VITE_API_BASE_URL` | frontend | backend base URL (the only frontend config; no keys) |

No provider key is ever exposed to the browser.

---

## V1 user flow

1. **Discover** — type a topic, or press *Run discovery* to pull candidates from real sources.
2. Review each candidate's score, reasons and sources; **Approve** or **Reject**.
3. Press **Research** (or **Generate course** to run everything).
4. **Research screen** — read `MASTER.md`, check which claims are sourced, then approve.
5. The pipeline writes `COURSE.md`, the sections/lessons, and `teaser.md`.
6. **Course Details** — browse Course → Sections → Lessons, read `COURSE.md`, preview the teaser.
7. **Lesson Editor** — edit any lesson's markdown and save it back to disk, or regenerate it.
8. **Generation** — watch live progress and job history (socket.io).

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health`, `/api/meta` | status; dropdown vocabulary |
| `GET` `POST` | `/api/topics` | list / create a topic |
| `POST` | `/api/topics/discover` | run discovery (returns a `jobId`) |
| `GET` | `/api/topics/:id` | one topic |
| `POST` | `/api/topics/:id/approve` · `/reject` | the human approval gate |
| `POST` | `/api/topics/:id/research` | research only (returns a `jobId`) |
| `POST` | `/api/topics/:id/generate` | the full V1 pipeline (returns a `jobId`) |
| `GET` | `/api/research/topic/:topicId` · `/master` | research record; `MASTER.md` |
| `GET` | `/api/courses` · `/api/courses/:id` · `/:id/plan` | courses; curriculum tree; `COURSE.md` |
| `POST` | `/api/courses/:id/generate` · `/:id/teaser` | re-plan + lessons; teaser |
| `GET` `PUT` | `/api/lessons/:id/markdown` | read / save lesson markdown |
| `POST` | `/api/lessons/:id/regenerate` | retry one lesson |
| `GET` | `/api/teasers` · `/course/:courseId` · `/markdown` | teasers |
| `GET` | `/api/jobs` · `/api/jobs/:id` | generation jobs |

Realtime (socket.io, path `/realtime`): `job:updated`, `job:log`, `topic:updated`,
`course:updated`, `lesson:updated`, `teaser:updated`, `discovery:completed`.
Clients can join one job's room with `job:subscribe`.

---

## Later phases

| Phase | Addition | What changes |
| --- | --- | --- |
| 2 | Scene generation | markdown → structured scene JSON (`Teaser.scenesPath` already exists) |
| 3 | Voice | a `VoiceService` implementation behind a new interface |
| 4 | Remotion rendering | scene JSON + audio → MP4 (`Lesson.videoPath`, `Teaser.videoPath` exist) |
| 5 | Background processing | Redis + BullMQ worker replaces in-process execution in the orchestrator |
| 6 | Scheduled discovery | a scheduler calling the existing discovery job |
| 7 | Cloud storage | a second `StorageService` implementation |
| 8 | Publishing | an explicit, controlled distribution step |
