# Project Context

This file is a compact system map for AI agents and contributors working on RAG GFS.

## Purpose

RAG GFS is an AI-assisted travel-planning app. A user describes a trip in natural language, the app extracts trip details with Ollama, fetches flights/hotels/places from SearchAPI, produces three itinerary options, and lets the user refine one option through follow-up chat. Past chats and saved plans persist in a local Laravel + MySQL backend.

## High-Level Architecture

```text
User
  -> React UI
  -> useChat hook
  -> tripPipeline / refinePlan
  -> Ollama + SearchAPI
  -> Laravel API
  -> DB tables: chat_sessions, chat_messages, plans
```

There are two mostly separate product paths:

1. Planner path
   React chat UI -> local pipeline helpers -> Laravel persistence

2. Direct flight search path
   React form -> SearchAPI directly from the browser

## Main Runtime Flow

### 1. User sends a planner message

Handled in [src/hooks/useChat.js](/Users/marvelsompotan/Project/RAG%20GFS/src/hooks/useChat.js).

- `sendMessage()` creates a session if needed.
- The user message is persisted through `POST /api/sessions/{session}/messages`.
- The hook derives the current branch state using `deriveStateAt()`.
- `runAssistantTurn()` decides which mode to run.

### 2. Mode selection

`runAssistantTurn()` has three modes:

- `intake`: no prior plan state exists yet.
- `regenerate`: cached options exist, but no plan is currently locked.
- `refine`: a selected plan exists and the user wants changes.

### 3. Intake mode

Defined across [src/hooks/useChat.js](/Users/marvelsompotan/Project/RAG%20GFS/src/hooks/useChat.js) and [src/lib/tripPipeline.js](/Users/marvelsompotan/Project/RAG%20GFS/src/lib/tripPipeline.js).

- `extractTripInfo()` asks Ollama for structured trip fields.
- `getMissingFields()` checks required data.
- If required fields are missing, `pendingTrip` is set and the UI shows a confirmation form.
- Once complete, `runIntake()` fetches flights, hotels, and places.
- `selectPlans()` asks Ollama to pick Best, Budget, and Balanced options from cached search results.
- `assemblePlan()` builds user-facing plan objects.
- An assistant message is saved with:
  - `plan_snapshot`
  - `state_snapshot`

### 4. Refine mode

Refinement uses [src/lib/refinePlan.js](/Users/marvelsompotan/Project/RAG%20GFS/src/lib/refinePlan.js).

- `refinePlan()` decides between:
  - `repick`: reuse cached options and choose different items
  - `rerun`: destination/date/trip length changed, so `fetchTripOptions()` runs again and the cached_options snapshot is refreshed
- The hook then saves a new assistant message with an updated `selected_plan`.

### 5. Selecting a plan to refine

Clicking **Select to refine** on a 3-plan assistant bubble calls `selectPlanForRefine()`. The hook posts a synthetic user message (`Let's go with the "<title>" plan and refine it.`) and an assistant acknowledgement that carries `state_snapshot.selected_plan_index` and `state_snapshot.selected_plan`. From that point onward `runAssistantTurn()` enters refine mode for the active branch.

## Branching Chat Model

This is not a simple linear chat log.

Messages are stored as a tree using:

- `parent_id`
- `edited_from_id`
- `head_message_id` on the session

Important helpers live in [src/lib/chatTree.js](/Users/marvelsompotan/Project/RAG%20GFS/src/lib/chatTree.js):

- `buildPath(messages, headId)`: reconstructs the active branch.
- `childrenOf(messages, parentId)`: finds branch alternatives.
- `deepestDescendant(messages, startId)`: follows the newest branch leaf.

Implication for AI changes:

- Do not assume `allMessages` are shown in full.
- The UI primarily renders `pathMessages`, which is only the active branch.
- Editing a user message creates a new user node, then a fresh assistant subtree.
- Regenerating an assistant reply also creates a branch, not an overwrite.

### Branching UI affordances

Defined in [src/components/ChatMessage.jsx](/Users/marvelsompotan/Project/RAG%20GFS/src/components/ChatMessage.jsx):

- Hovering a **user** message exposes an `Edit` button (inline textarea + Save & resend).
- Hovering an **assistant** message exposes a `Regenerate` button.
- When a message has siblings (same `parent_id`), inline `‹ n / m ›` arrows appear and call `switchBranch(messageId)`, which `PATCH`es `head_message_id` to `deepestDescendant(allMessages, messageId)`.

## Streaming

Structured calls (`extractTripInfo`, `selectPlans`, `refinePlan`) stay non-streaming because half-parsed JSON is unrenderable. What streams is the natural-language acknowledgement that wraps each assistant turn.

- [`ollamaStream()`](/Users/marvelsompotan/Project/RAG%20GFS/src/lib/tripPipeline.js) hits `POST /api/generate` with `stream: true`, reads NDJSON line-by-line, and calls `onChunk(delta)` per token until `done: true`. Honors an `AbortSignal`.
- `streamNarrative()` inside [src/hooks/useChat.js](/Users/marvelsompotan/Project/RAG%20GFS/src/hooks/useChat.js) dispatches `streaming-start` / `streaming-chunk` / `streaming-stop` reducer actions; the active bubble renders `streaming.content` with a blinking cursor (`.chat-message--streaming` in [src/styles/shell.css](/Users/marvelsompotan/Project/RAG%20GFS/src/styles/shell.css)).
- Only the **final** assistant message (text + plan snapshot + state snapshot) is persisted to Laravel. Mid-stream tokens never round-trip; a refresh during streaming loses the in-flight reply.
- A `Stop` button on the composer replaces `Send` while busy and aborts the in-flight `AbortController` shared by all LLM and pipeline calls for that turn.

## State Snapshot Strategy

The planner avoids a separate workflow engine by embedding state in assistant messages.

Each assistant message may contain:

- `plan_snapshot`: rendered plans for that step
- `state_snapshot.trip_context`
- `state_snapshot.cached_options`
- `state_snapshot.selected_plan_index`
- `state_snapshot.selected_plan`

This makes branch replay possible, but it also means:

- message payloads can grow large
- backend persistence is intentionally dumb
- frontend logic is the real orchestration layer

## Data Model

### `chat_sessions`

Defined in [server/database/migrations/2026_05_21_100000_create_chat_sessions_table.php](/Users/marvelsompotan/Project/RAG%20GFS/server/database/migrations/2026_05_21_100000_create_chat_sessions_table.php) and [server/database/migrations/2026_05_21_100003_add_head_message_id_to_chat_sessions.php](/Users/marvelsompotan/Project/RAG%20GFS/server/database/migrations/2026_05_21_100003_add_head_message_id_to_chat_sessions.php).

- `id` UUID primary key
- `title`
- `head_message_id`
- timestamps

### `chat_messages`

Defined in [server/database/migrations/2026_05_21_100001_create_chat_messages_table.php](/Users/marvelsompotan/Project/RAG%20GFS/server/database/migrations/2026_05_21_100001_create_chat_messages_table.php).

- `session_id`
- `parent_id`
- `role`
- `content`
- `plan_snapshot` JSON
- `state_snapshot` JSON
- `edited_from_id`
- `created_at`

### `plans`

Defined in [server/database/migrations/2026_05_21_100002_create_plans_table.php](/Users/marvelsompotan/Project/RAG%20GFS/server/database/migrations/2026_05_21_100002_create_plans_table.php).

- `session_id` nullable
- `plan_key` unique
- `title`
- `brief`
- `plan` JSON
- `saved_at`

Saved plans are separate from the chat tree and act more like bookmarks. The unique `plan_key` (computed in [src/hooks/useChat.js](/Users/marvelsompotan/Project/RAG%20GFS/src/hooks/useChat.js) as `${sessionId}::${plan.title}::${plan.total_price}`) makes `POST /api/plans` idempotent — duplicate saves return the existing row with HTTP 200 instead of creating a duplicate ([server/app/Http/Controllers/PlanController.php](/Users/marvelsompotan/Project/RAG%20GFS/server/app/Http/Controllers/PlanController.php)).

## External Dependencies

### Ollama

Configured in [src/lib/tripPipeline.js](/Users/marvelsompotan/Project/RAG%20GFS/src/lib/tripPipeline.js):

- model: `llama3.2`
- endpoint: `http://localhost:11434/api/generate`

Used for:

- structured trip extraction
- plan tier selection
- short streaming narrative text
- refinement decision-making

### SearchAPI

Also used in [src/lib/tripPipeline.js](/Users/marvelsompotan/Project/RAG%20GFS/src/lib/tripPipeline.js) and directly in [src/App.jsx](/Users/marvelsompotan/Project/RAG%20GFS/src/App.jsx).

- flights via `google_flights`
- hotels via `google_hotels`
- places via `google_maps`

Requires `VITE_SEARCHAPI_KEY`.

### Laravel API

Frontend client wrapper is in [src/lib/api.js](/Users/marvelsompotan/Project/RAG%20GFS/src/lib/api.js). Default base URL is `http://localhost:8000` and is overridable via `VITE_API_BASE`.

Endpoints (all under `/api`, defined in [server/routes/api.php](/Users/marvelsompotan/Project/RAG%20GFS/server/routes/api.php)):

| Method | Path | Purpose |
|---|---|---|
| GET    | `/api/sessions`                       | List sessions (id, title, head_message_id, updated_at), newest first |
| POST   | `/api/sessions`                       | Create an empty session |
| GET    | `/api/sessions/{session}`             | Session row + ordered messages |
| PATCH  | `/api/sessions/{session}`             | Update `title` and/or `head_message_id` |
| DELETE | `/api/sessions/{session}`             | Cascade-delete session and its messages |
| POST   | `/api/sessions/{session}/messages`    | Append a message (`role`, `content`, `parent_id?`, `plan_snapshot?`, `state_snapshot?`, `edited_from_id?`) |
| GET    | `/api/plans`                          | List saved plans (newest first) |
| POST   | `/api/plans`                          | Upsert a saved plan by `plan_key` |
| DELETE | `/api/plans/{plan}`                   | Remove a saved plan |

Laravel 11 does not auto-load `routes/api.php`; it is enabled explicitly in [server/bootstrap/app.php](/Users/marvelsompotan/Project/RAG%20GFS/server/bootstrap/app.php) via the `api:` slot. CORS is restricted to `FRONTEND_URL` (defaults to `http://localhost:5173`) in [server/config/cors.php](/Users/marvelsompotan/Project/RAG%20GFS/server/config/cors.php).

Session, cache, and queue drivers are intentionally set to non-database values (`SESSION_DRIVER=file`, `CACHE_STORE=file`, `QUEUE_CONNECTION=sync`) in [server/.env](/Users/marvelsompotan/Project/RAG%20GFS/server/.env) so the Laravel 11 defaults that require `sessions` / `cache` / `jobs` tables do not apply. The default users/cache/jobs migrations shipped by Laravel were removed; only the four migrations for `chat_sessions`, `chat_messages`, `plans`, and the head-pointer alter remain.

## UI Map

- [src/App.jsx](/Users/marvelsompotan/Project/RAG%20GFS/src/App.jsx): sidebar, three-tab shell (`planner` / `flights` / `plans`), header, raw flight-search form, saved-plans wiring
- [src/components/ChatView.jsx](/Users/marvelsompotan/Project/RAG%20GFS/src/components/ChatView.jsx): main planner view, composer with Send/Stop, missing-field `ConfirmForm`, suggestion chips
- [src/components/ChatMessage.jsx](/Users/marvelsompotan/Project/RAG%20GFS/src/components/ChatMessage.jsx): user/assistant bubbles, hover Edit/Regenerate, branch arrows, inline plan card rendering
- [src/components/PlanCard.jsx](/Users/marvelsompotan/Project/RAG%20GFS/src/components/PlanCard.jsx) + [src/components/PlanDetail.jsx](/Users/marvelsompotan/Project/RAG%20GFS/src/components/PlanDetail.jsx): plan summary card + full-detail view (flight, hotel, places, totals, save button)
- [src/components/PreviousChats.jsx](/Users/marvelsompotan/Project/RAG%20GFS/src/components/PreviousChats.jsx): sidebar collapsible — new-chat button, session list with relative timestamps, hover-to-delete
- [src/components/MyPlans.jsx](/Users/marvelsompotan/Project/RAG%20GFS/src/components/MyPlans.jsx): saved plans list, detail entry, and `Remove from My Plans` action
- [src/components/TypingIndicator.jsx](/Users/marvelsompotan/Project/RAG%20GFS/src/components/TypingIndicator.jsx) + [src/components/Toast.jsx](/Users/marvelsompotan/Project/RAG%20GFS/src/components/Toast.jsx): status spinner used while non-streaming pipeline steps run, and ephemeral confirmation toast

Session title defaults to the first 60 characters of the user's first prompt (set on session create in [src/hooks/useChat.js](/Users/marvelsompotan/Project/RAG%20GFS/src/hooks/useChat.js)).

## Backend Responsibilities

Backend code is intentionally thin:

- validate input
- persist sessions/messages/plans
- return JSON

The backend does not:

- run the planning pipeline
- call Ollama
- call SearchAPI
- compute plan branches

Most product logic lives in the frontend.

## Safe Change Zones

If an AI is asked to make changes, these are the usual entry points:

- Planner behavior: [src/hooks/useChat.js](/Users/marvelsompotan/Project/RAG%20GFS/src/hooks/useChat.js)
- Search/extraction logic: [src/lib/tripPipeline.js](/Users/marvelsompotan/Project/RAG%20GFS/src/lib/tripPipeline.js)
- Refinement rules: [src/lib/refinePlan.js](/Users/marvelsompotan/Project/RAG%20GFS/src/lib/refinePlan.js)
- Branch handling: [src/lib/chatTree.js](/Users/marvelsompotan/Project/RAG%20GFS/src/lib/chatTree.js)
- API schema or persistence: `server/app` and `server/database/migrations`

## Environment And Setup

### Required env vars

Frontend ([.env](/Users/marvelsompotan/Project/RAG%20GFS/.env), gitignored — see [.env.example](/Users/marvelsompotan/Project/RAG%20GFS/.env.example)):

- `VITE_SEARCHAPI_KEY` — searchapi.io API key. Missing key throws a clear error before any pipeline step runs.
- `VITE_API_BASE` — Laravel base URL. Defaults to `http://localhost:8000` if unset.

Backend ([server/.env](/Users/marvelsompotan/Project/RAG%20GFS/server/.env), gitignored — see [server/.env.example](/Users/marvelsompotan/Project/RAG%20GFS/server/.env.example)):

- `DB_CONNECTION=mysql`, `DB_HOST`, `DB_PORT`, `DB_DATABASE=ragflight`, `DB_USERNAME`, `DB_PASSWORD`
- `FRONTEND_URL=http://localhost:5173` — referenced by CORS config
- `APP_URL=http://localhost:8000`

### Local services

- **MySQL** running locally, with a `ragflight` database that the configured user can read/write.
- **Ollama** running at `localhost:11434` with `llama3.2` pulled (`ollama pull llama3.2`).
- **Laravel API**: `cd server && php artisan serve` (defaults to port 8000).
- **Vite dev server**: `npm run dev` from the repo root (port 5173).

### Removed legacy files

These no longer exist; do not look for them:

- `src/hooks/useOllama.js` — dead duplicate of the older single-shot hook
- `src/hooks/useTrip.js` — replaced by the pure module [src/lib/tripPipeline.js](/Users/marvelsompotan/Project/RAG%20GFS/src/lib/tripPipeline.js) plus [src/hooks/useChat.js](/Users/marvelsompotan/Project/RAG%20GFS/src/hooks/useChat.js)
- `src/components/TravelPlanner.jsx` — replaced by [src/components/ChatView.jsx](/Users/marvelsompotan/Project/RAG%20GFS/src/components/ChatView.jsx)
- `src/lib/planKey.js` — the plan-key formula now lives privately in `useChat.js`

## Current Constraints And Risks

- The frontend calls SearchAPI directly, so the API key is exposed to the browser runtime.
- The planner depends on a local Ollama instance being available; there is no remote-LLM fallback.
- State is duplicated inside message snapshots, which may become heavy as chats grow.
- There are very few tests right now, so behavior changes should be verified manually.
- The backend README is still the stock Laravel document and does not describe this project.
- No authentication: any caller with network access to the Laravel port can read/write every session and plan. Fine for local dev, unsafe for any deployment.
- The schema is auth-ready (per-user `user_id` columns can be added later without restructuring), but adding it requires a migration + middleware + scoping every controller query.
- The hotel SearchAPI schema changed once already (we now read `price_per_night.extracted_price` / `total_price.extracted_price` / `rating`). Any future drift will silently produce `null` prices again — watch for that if hotel totals start showing `—`.

## Recommended Next Docs

If more AI support is needed later, the next useful files would be:

- `docs/API_CONTRACT.md` for request/response payload examples
- `docs/STATE_MACHINE.md` for planner mode transitions
- `docs/ENVIRONMENT.md` for setup and service dependencies
