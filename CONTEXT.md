# Project Context

This file is a compact system map for AI agents and contributors working on **Travia** (repo root: `RAG GFS`).

## Purpose

Travia is an AI-assisted travel-planning chat app. A user describes a trip in natural language; the app extracts trip details with Ollama, fetches flights / hotels / places / Tripadvisor reviews from SearchAPI, generates **one** itinerary tailored to a chosen experience type, and lets the user refine that plan through follow-up chat. Past chats and saved plans persist in a Laravel + MySQL backend behind Sanctum token auth.

## High-Level Architecture

```text
User
  -> React UI (Vite, port 5173)
  -> useChat hook
  -> tripPipeline / refinePlan
  -> Ollama (local) + SearchAPI (remote)
  -> Laravel API (port 8000, Sanctum auth)
  -> MySQL: users, chat_sessions, chat_messages, plans, personal_access_tokens
```

The frontend orchestrates the LLM and search pipeline; the backend only persists state and enforces auth/ownership.

## Main Runtime Flow

### 1. User sends a planner message

Handled in [src/hooks/useChat.js](src/hooks/useChat.js).

- `sendMessage()` creates a session if needed (title defaults to the first 60 chars of the user's prompt).
- The user message is persisted through `POST /api/sessions/{session}/messages`.
- The hook derives the current branch state via `deriveStateAt()` walking the active branch from `head_message_id`.
- `runAssistantTurn()` decides which mode to run.

### 2. Mode selection (single-plan model)

`runAssistantTurn()` picks one of three modes from the active snapshot:

- **`intake`** — `state_snapshot.current_plan` is empty. Still gathering trip details.
- **`experience`** — `current_plan` exists but `experience_confirmed` is false. Just produced a balanced first plan and is asking the user what vibe they want.
- **`refine`** — `current_plan` exists and `experience_confirmed` is true. Each turn either repicks from cached options or reruns the pipeline.

### 3. Intake mode (conversational, multi-turn)

Functions in [src/services/tripPipeline.js](src/services/tripPipeline.js):

- `extractAndMergeTripInfo(history, existingContext)` — single Ollama call that re-extracts the trip context from the full conversation, merging with anything already known. Returns `{ trip_context, ready_to_plan, missing_required, missing_optional }`. Replaces the old `extractTripInfo` + `getMissingFields` + `ConfirmForm` flow.
- If `ready_to_plan` is false, `generateFollowUp()` produces a warm, plain-text question about the missing fields and streams it back as the assistant reply.
- When all required fields are present, `generateReadyConfirmation()` produces a one-line acknowledgement; then the pipeline runs `fetchTripOptions()` and produces a first balanced plan.
- `fillDefaults()` injects `outbound_date = today + 7` if the user never specified a date.

### 4. Experience mode

After the first balanced plan renders, the assistant asks "what kind of trip do you want?" via `generateExperiencePrompt()`. The user's reply is classified by `parseExperienceType()` into one of nine types — `balanced`, `budget`, `luxury`, `adventure`, `food`, `relaxation`, `cultural`, `romantic`, `family`. `generatePlan()` then re-selects from the **already-cached** flights/hotels/places using a planning bias specific to that experience type. `experience_confirmed` is flipped to true on the new state snapshot.

### 5. Refine mode

Refinement uses [src/services/refinePlan.js](src/services/refinePlan.js).

- `refinePlan()` decides between:
  - `repick` — reuse cached options and choose different indices for flight / hotel / places.
  - `rerun` — destination, dates, or duration changed; the pipeline reruns `fetchTripOptions()` and refreshes `cached_options`.
- The hook then saves a new assistant message with the updated `current_plan`.

### 6. Streaming

Structured Ollama calls (`extractAndMergeTripInfo`, `generatePlan`, `parseExperienceType`, `refinePlan`) are non-streaming because half-parsed JSON is unrenderable. What streams is the natural-language assistant text that wraps each turn.

- `ollamaGenerate(system, prompt, { json = true })` in [src/services/tripPipeline.js](src/services/tripPipeline.js) wraps non-streaming `POST /api/generate` calls. When `json: true` (default) it sets `format: 'json'` so Ollama returns parseable JSON; text-generating callers (`generateFollowUp`, `generateReadyConfirmation`, `generateExperiencePrompt`) pass `json: false` so the response is plain prose.
- `ollamaStream()` reads NDJSON line-by-line and calls `onChunk(delta)` per token until `done: true`. Honors an `AbortSignal`.
- `streamNarrative()` in [src/hooks/useChat.js](src/hooks/useChat.js) dispatches `streaming-start` / `streaming-chunk` / `streaming-stop` reducer actions. The active bubble renders `streaming.content` with a blinking cursor.
- Only the **final** assistant message (text + plan snapshot + state snapshot) is persisted. Mid-stream tokens never round-trip; a refresh during streaming loses the in-flight reply.
- A `Stop` button on the composer replaces `Send` while busy and aborts the shared `AbortController` for that turn.

## Branching Chat Model

This is not a linear chat log. Messages form a tree using:

- `parent_id` — pointer to the message this one is a reply to.
- `edited_from_id` — optional provenance: links an edited user message back to the original it replaces.
- `head_message_id` on the session — the tip of the currently-rendered branch.

Helpers in [src/services/chatTree.js](src/services/chatTree.js):

- `buildPath(messages, headId)` — reconstructs the active branch by walking parents from head.
- `childrenOf(messages, parentId)` — finds branch alternatives.
- `deepestDescendant(messages, startId)` — follows the newest leaf along a branch.
- `siblingInfo(messages, message)` — used by `ChatMessage` to render `‹ n / m ›` arrows.

Implications for AI changes:

- `allMessages` contains the entire tree; the UI primarily renders `pathMessages` (active branch only).
- Editing a user message creates a new user node, then a fresh assistant subtree under it.
- Regenerating an assistant reply creates a sibling assistant subtree, not an overwrite.

### Branching UI affordances

Defined in [src/components/Molecules/ChatMessage/ChatMessage.jsx](src/components/Molecules/ChatMessage/ChatMessage.jsx):

- Hovering a **user** message exposes `Edit` (inline textarea + Save & resend).
- Hovering an **assistant** message exposes `Regenerate`.
- When a message has siblings, inline `‹ n / m ›` arrows call `switchBranch(messageId)`, which `PATCH`es `head_message_id` to `deepestDescendant(allMessages, messageId)`.

## State Snapshot Strategy

Each assistant message can contain:

- `plan_snapshot` — the rendered plan for that turn (currently an array with a single plan).
- `state_snapshot.trip_context` — extracted trip details.
- `state_snapshot.cached_options` — `{ flights, hotels, places }` arrays from the last SearchAPI run.
- `state_snapshot.current_plan` — the plan currently being refined on this branch.
- `state_snapshot.experience_confirmed` — whether the user has picked an experience type yet.

> **Note:** The old `selected_plan` / `selected_plan_index` fields from the three-plan era are gone. The active plan is `state_snapshot.current_plan`. `ChatMessage.jsx` derives `hasPlan` from this field.

Embedding state on each message makes branch replay trivial — switching branches is just changing `head_message_id` — but message payloads grow with cached options.

## Data Model

Migrations under [server/database/migrations/](server/database/migrations/).

### `users`

UUID primary key, `name`, `email` (unique), `password`, `remember_token`, timestamps.

### `personal_access_tokens`

Standard Sanctum table with `uuidMorphs('tokenable')` so it links to the UUID-keyed `users`.

### `chat_sessions`

- `id` UUID
- `user_id` UUID FK → `users.id` (cascade on user delete)
- `title`
- `head_message_id` bigint FK → `chat_messages.id` (set null on delete)
- timestamps

### `chat_messages`

- `id` bigint
- `session_id` UUID FK → `chat_sessions.id` (cascade)
- `parent_id` bigint nullable FK → `chat_messages.id`
- `role` enum('user', 'assistant')
- `content` text
- `plan_snapshot` JSON nullable
- `state_snapshot` JSON nullable
- `edited_from_id` bigint nullable
- `created_at`

### `plans`

- `id` bigint
- `session_id` UUID nullable FK → `chat_sessions.id` (set null on delete; saved plans outlive sessions)
- `user_id` UUID FK → `users.id` (cascade)
- `plan_key` unique — `${sessionId}::${plan.title}::${plan.total_price}`, makes `POST /api/plans` idempotent
- `title`
- `brief`
- `experience_type` string nullable — `balanced` / `budget` / `luxury` / etc.
- `plan` JSON
- `saved_at`

Saved plans act as bookmarks, separate from the chat tree.

## External Dependencies

### Ollama

- Model: `llama3.2`
- Endpoint: `http://localhost:11434/api/generate`
- Configured in [src/services/tripPipeline.js](src/services/tripPipeline.js)

Used for: structured trip extraction, plan selection, experience-type classification, refinement decisions, plus streaming assistant prose for every turn.

### SearchAPI (searchapi.io)

Four engines used in [src/services/tripPipeline.js](src/services/tripPipeline.js):

- `google_flights` — round-trip search keyed by departure/arrival IATA and dates.
- `google_hotels` — keyed by destination name and check-in/out.
- `google_maps` — top tourist attractions for the destination.
- `tripadvisor` — review snippets + rating enrichment, merged into Google places by name match in `enrichPlacesWithReviews()`.

Requires `VITE_SEARCHAPI_KEY`.

### Laravel API

Client wrapper in [src/services/api.js](src/services/api.js). Default base URL `http://localhost:8000`, overridable via `VITE_API_BASE`.

All endpoints under `/api`, defined in [server/routes/api.php](server/routes/api.php).

#### Public

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Create user account; returns Sanctum token |
| POST | `/api/auth/login` | Exchange email + password for Sanctum token |

#### Protected (`auth:sanctum`)

| Method | Path | Purpose |
|---|---|---|
| POST   | `/api/auth/logout` | Revoke current token |
| GET    | `/api/auth/me` | Return the authenticated user |
| GET    | `/api/sessions` | List the user's sessions, newest first |
| POST   | `/api/sessions` | Create an empty session |
| GET    | `/api/sessions/{session}` | Session row + ordered messages |
| PATCH  | `/api/sessions/{session}` | Update `title` and/or `head_message_id` |
| DELETE | `/api/sessions/{session}` | Cascade-delete session and its messages |
| POST   | `/api/sessions/{session}/messages` | Append a message (`role`, `content`, `parent_id?`, `plan_snapshot?`, `state_snapshot?`, `edited_from_id?`) |
| GET    | `/api/plans` | List all saved plans (newest first) |
| POST   | `/api/plans` | Upsert a saved plan by `plan_key` |
| DELETE | `/api/plans/{plan}` | Remove a saved plan |
| GET    | `/api/my-plans` | List only the authenticated user's plans |

Every protected controller scopes queries to `Auth::id()`. Laravel 11 does not auto-load `routes/api.php`; it is enabled in [server/bootstrap/app.php](server/bootstrap/app.php) via the `api:` slot with Sanctum middleware. CORS is restricted to `FRONTEND_URL` (default `http://localhost:5173`) in [server/config/cors.php](server/config/cors.php).

Session, cache, and queue drivers are intentionally set to non-database values (`SESSION_DRIVER=file`, `CACHE_STORE=file`, `QUEUE_CONNECTION=sync`) in `server/.env` so the Laravel 11 defaults that require `sessions` / `cache` / `jobs` tables do not apply.

## UI Map

Components are organised by atomic-design tier under [src/components/](src/components/):

### Layout
- [AppShell](src/components/Layout/AppShell/AppShell.jsx) — header + sidebar + main shell.

### Pages
- [Planner](src/components/Pages/Planner/Planner.jsx) — main chat surface (composer with Send/Stop, suggestion chips, ChatMessage list, error toast).
- [MyPlans](src/components/Pages/MyPlans/MyPlans.jsx) — saved plans grid, detail view, `Remove from My Plans`.
- [LoginPage](src/components/Pages/LoginPage/LoginPage.jsx) / [RegisterPage](src/components/Pages/RegisterPage/RegisterPage.jsx) — Sanctum auth entry points.

### Molecules
- [ChatMessage](src/components/Molecules/ChatMessage/ChatMessage.jsx) — user/assistant bubbles, hover Edit/Regenerate, branch arrows, inline plan card rendering. `hasPlan` reads `state_snapshot.current_plan`.
- [Composer](src/components/Molecules/Composer/) — textarea + Send/Stop.
- [ConfirmForm](src/components/Molecules/ConfirmForm/) — legacy missing-fields form, still in the tree but no longer routed to in the new conversational intake flow.
- [PlanCard](src/components/Molecules/PlanCard/) + [PlanDetail](src/components/Molecules/PlanDetail/) — plan summary card + full-detail view (flight, hotel, places with Tripadvisor snippets, totals, save button, collapsible reviews section).
- [PreviousChats](src/components/Molecules/PreviousChats/) — sidebar collapsible: new-chat button, session list with relative timestamps, hover-to-delete.
- [SidebarMenu](src/components/Molecules/SidebarMenu/), [HeaderBar](src/components/Molecules/HeaderBar/), [Hero](src/components/Molecules/Hero/), [SuggestionCards](src/components/Molecules/SuggestionCards/).

### Atoms
- [Button](src/components/Atoms/Button/), [Chip](src/components/Atoms/Chip/), [Toast](src/components/Atoms/Toast/), [TypingIndicator](src/components/Atoms/TypingIndicator/), [Avatar](src/components/Atoms/Avatar/), [StatusDot](src/components/Atoms/StatusDot/).

## Backend Responsibilities

The backend is intentionally thin:

- authenticate via Sanctum
- validate input
- persist sessions / messages / plans, scoped to the current user
- return JSON

The backend does **not** run the pipeline, call Ollama, or call SearchAPI. Most product logic lives in the frontend.

## Mock Mode

A `VITE_MOCK_MODE` flag in `.env` lets you exercise the full UI without consuming SearchAPI quota.

- When `VITE_MOCK_MODE=true`, `searchFlights`, `searchHotels`, `searchPlaces`, `searchTripadvisor`, and `ollamaStream` return fixtures from [src/services/mockData.js](src/services/mockData.js).
- **Ollama is still called** for intake, plan generation, experience-type classification, and refinement, so you can type any prompt and see real LLM behavior — only the external HTTP search calls are stubbed.
- Three full destination datasets ship in `mockData.js`: Bali, Yogyakarta, and Raja Ampat. Each has matching flights, hotels, places, and Tripadvisor fixtures.

## Tests

303 tests across 12 files under [src/test/](src/test/), run with Vitest:

- `tripPipeline.test.js` — unit tests for `addDays`, `daysFromNow`, `fillDefaults`, `normalizeTripInfo`, `pickIndex`, `assemblePlan`, `enrichPlacesWithReviews`, `ollamaGenerate` json option, `extractAndMergeTripInfo`, `generateFollowUp`, `generateReadyConfirmation`, `generateExperiencePrompt`, `parseExperienceType`.
- `scenarios.test.js` — end-to-end scenario tests: multi-turn intake, all 9 experience types, plan generation per experience, refinement (hotel/flight/place swap, destination change, date change), enrichment matching.
- `refinePlan.test.js` — repick / rerun mode parsing, error cases.
- `mockData.test.js` — shape and consistency checks across all three destination fixtures.
- `chatTree.test.js`, `hooks.test.js`, `formatBold.test.jsx`, `integration.test.jsx`, plus `components/atoms.test.jsx`, `components/molecules.test.jsx`, `components/pages.test.jsx`, `components/chatMessage.test.jsx`.

`vite.config.js` pins `VITE_MOCK_MODE=false` and `VITE_SEARCHAPI_KEY=test-key` in the Vitest env so tests run against the real code paths regardless of what's in `.env`. Fetch is spied per-test to control LLM and SearchAPI responses.

## Safe Change Zones

Usual entry points if asked to make changes:

- Planner behavior / state machine: [src/hooks/useChat.js](src/hooks/useChat.js)
- Search / extraction / plan generation: [src/services/tripPipeline.js](src/services/tripPipeline.js)
- Refinement rules: [src/services/refinePlan.js](src/services/refinePlan.js)
- Branch handling: [src/services/chatTree.js](src/services/chatTree.js)
- Mock fixtures: [src/services/mockData.js](src/services/mockData.js)
- Auth / API client: [src/services/api.js](src/services/api.js), [src/services/auth.js](src/services/auth.js), [src/hooks/useAuth.js](src/hooks/useAuth.js)
- API schema or persistence: `server/app/` and `server/database/migrations/`

## Environment And Setup

### Frontend `.env` (gitignored — see `.env.example`)

- `VITE_SEARCHAPI_KEY` — searchapi.io API key. Missing key throws a clear error before any pipeline step runs (unless `VITE_MOCK_MODE=true`).
- `VITE_API_BASE` — Laravel base URL. Defaults to `http://localhost:8000` if unset.
- `VITE_MOCK_MODE` — `true` to bypass SearchAPI and `ollamaStream`, `false` for production behavior.

### Backend `server/.env` (gitignored — see `server/.env.example`)

- `DB_CONNECTION=mysql`, `DB_HOST`, `DB_PORT`, `DB_DATABASE=ragflight`, `DB_USERNAME`, `DB_PASSWORD`
- `FRONTEND_URL=http://localhost:5173` — referenced by CORS config
- `APP_URL=http://localhost:8000`
- `SANCTUM_STATEFUL_DOMAINS` — keep default unless adding cookie auth

### Local services

- **MySQL** running locally with a `ragflight` database the configured user can read/write.
- **Ollama** at `localhost:11434` with `llama3.2` pulled (`ollama pull llama3.2`).
- **Laravel API:** `cd server && php artisan serve` (port 8000).
- **Vite dev server:** `npm run dev` from the repo root (port 5173).

## Current Constraints And Risks

- The frontend calls SearchAPI directly, so the API key is exposed to the browser runtime.
- The planner depends on a local Ollama instance; there is no remote-LLM fallback.
- State is duplicated inside message snapshots, so chats with many cached options can produce large rows.
- Sanctum tokens are stored in `localStorage` by the frontend; XSS would compromise them. Acceptable for local dev; revisit before any deploy.
- No password reset flow yet.
- The hotel SearchAPI schema changed once already (we now read `price_per_night.extracted_price` / `total_price.extracted_price` / `rating`). Any future drift will silently produce `null` prices again — watch for that if hotel totals start showing `—`.
- `ConfirmForm` is still in the molecules tree but no longer used by the conversational intake flow; remove it if a future refactor confirms nothing else depends on it.
