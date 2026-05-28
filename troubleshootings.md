# Travia — Troubleshooting Log

All bugs, fixes, and improvements across the project's development history.

---

## Improvements & Feature Additions

### 2026-05-28 — Intake Pipeline Fix (confidence-based, fewer turns)

**Problem:** The intake flow asked too many questions before generating a plan. Even when the user gave a clear destination, the model would still ask follow-ups for optional fields like preferences or exact dates.

**Improvements:**
- **`src/services/confidenceScore.js`** (new) — `computeConfidence()` scores the trip context using weighted fields (departure 30%, arrival 30%, destination 20%, duration 10%, date 10%). Planning proceeds when score ≥ 0.70 — origin + destination alone clears the bar.
- **`src/services/inferDefaults.js`** (new) — `inferAirport()` maps 50+ city names to IATA codes. `inferDatesFromSeason()` resolves month names and relative references ("next month", "in July") to concrete dates. `inferTripLength()` parses "a week", "weekend", "long weekend" into day counts.
- **`src/services/intentClassifier.js`** (new) — 13 regex patterns detect "you decide" intent ("surprise me", "up to you", "I trust you"). When detected, the pipeline skips intake questions and proceeds immediately with inferred defaults.
- **`fillDefaults()` in `tripPipeline.js`** — now calls all three inference helpers before falling back to hardcoded defaults. IATA codes can be inferred from city names, trip length from preference text, and dates from seasonal language.
- **Extraction prompt made aggressive** — `extractAndMergeTripInfo` now instructs the model to infer rather than return null. "Bali" → DPS, "a week" → 7 days, "in July" → July 15 next year.
- **`generateFollowUp()` prompt tightened** — only asks about the top 2 critical missing fields. Never asks about optional fields like preferences.
- **`MAX_INTAKE_TURNS = 3` in `useChat.js`** — after 3 back-and-forths, the pipeline force-runs with whatever context it has, filling gaps with inferred defaults. No more infinite intake loops.

---

### 2026-05-28 — Gemini LLM Provider (runtime toggle)

**Problem:** The app was hardwired to Ollama running locally. This required the Ollama daemon to be running at all times and made it hard to test on machines without it installed.

**Improvements:**
- **`src/services/ollamaClient.js`** (new) — `ollamaGenerate` and `ollamaStream` extracted from `tripPipeline.js` into their own module, removing the circular dependency that would otherwise arise.
- **`src/services/geminiClient.js`** (new) — `geminiGenerate()` and `geminiStream()` calling the Gemini v1beta REST API (`gemini-2.5-flash-lite`). Supports `system_instruction`, JSON mode via `responseMimeType`, and SSE streaming.
- **`src/services/llmProvider.js`** (new) — module-level singleton. Reads `VITE_LLM_PROVIDER` as the startup default, persists the active choice to `localStorage`, and fires a `llm-provider-change` custom event so React components stay in sync. Exports `llmGenerate` and `llmStream` that delegate to whichever provider is active.
- **`src/hooks/useLLMProvider.js`** (new) — React hook exposing `{ provider, toggle }`. Listens for the custom event so the toggle button re-renders immediately on change.
- **Sidebar toggle chip** — a small "Gemini" (blue) or "Ollama" (purple) pill button in the AppShell footer. One click switches the provider for all subsequent LLM calls without a page reload. Choice survives refreshes via localStorage.
- **Test isolation** — `vite.config.js` test env pins `VITE_LLM_PROVIDER=ollama` so all existing `fetch` mocks targeting the Ollama format continue to work regardless of the developer's local `.env`.

---

### 2026-05-28 — Smarter Refine Pipeline (4-mode + scoped rerun)

**Problem:** The refine pipeline was too aggressive — it treated every message as a plan change request and always did a full SearchAPI rerun when dates changed, which wasted quota and made casual conversation impossible.

**Improvements:**
- **`chat` mode** — if the model decides the user is just chatting or asking a general question, it returns `{ kind: "chat", reply: "..." }`. `useChat.js` streams the reply and leaves the plan snapshot completely unchanged.
- **`ask` mode** — when the user changes dates or destination but hasn't said whether hotels/places should also change, the model returns `{ kind: "ask", question: "...", proposed_changes: {...} }`. The question is posted to the chat, and `proposed_changes` is stored as `pending_refinement` in `state_snapshot`. The next user message resolves it.
- **`rerun` with `scope`** — the model now returns `scope: "flights"` or `scope: "full"` with rerun decisions. `scope: "flights"` only calls `searchFlights` and reuses cached hotels and places — saving two SearchAPI calls. `scope: "full"` does a complete fresh search as before.
- **Partial place updates** — the system prompt now provides the current plan's cached indices and instructs the model: "if the user wants to change only one place, keep the other place indices from the CURRENT PLAN and change only that one."
- **`findCurrentIndices()` helper** — reverse-maps the assembled plan's flight/hotel/places back to their indices in the cached lists, so the model can reference them correctly in partial repick decisions.

---

### 2026-05-27 — Multi-destination Mock Datasets

**Problem:** The mock data only covered one destination (Bali), making it impossible to test edge cases like remote destinations with no direct flights, or budget destinations with very different price ranges.

**Improvements:**
- Added full mock datasets for **Yogyakarta** (budget, cultural) and **Raja Ampat** (luxury, remote — no nonstop flights, higher prices).
- Each dataset includes: `MOCK_USER_PROMPT`, `MOCK_TRIP_INFO`, `MOCK_FLIGHTS`, `MOCK_HOTELS`, `MOCK_PLACES`, and `MOCK_TRIPADVISOR_PLACES`.
- **`mockData.test.js`** rewritten with `describe.each` across all 3 destinations and shared validator helpers (`validateTripInfo`, `validateFlights`, `validateHotels`, `validatePlaces`, `validateTripadvisor`). Cross-dataset consistency checks verify IATA codes, landmark names, and name alignment between Google Places and Tripadvisor fixtures.

---

### 2026-05-27 — Scenario Test Suite

**Problem:** Unit tests covered individual functions but no end-to-end pipeline flows. Regressions in how intake, experience selection, and refinement interact were invisible to the test suite.

**Improvements:**
- **`src/test/scenarios.test.js`** (new, 49 tests) — covers:
  - Intake: complete prompt, missing departure, missing destination, vague prompt
  - Multi-turn intake: gap fill across turns, mid-conversation correction
  - All 9 experience types via `describe.each`
  - `generatePlan` → `assemblePlan` end-to-end for budget/luxury/link cases
  - `refinePlan` hotel/flight/place swaps and destination/date reruns
  - `assemblePlan` edge cases (out-of-range indices, empty places)
  - `enrichPlacesWithReviews` match, no-match, network failure, partial match

---

### 2026-05-26 — Tripadvisor Review Enrichment

**Problem:** Plan detail showed Google Maps places with ratings but no real traveller opinions, making it hard for users to judge whether a place was worth visiting.

**Improvements:**
- **`searchTripadvisor(destinationName)`** — calls SearchAPI's Tripadvisor engine and returns up to 15 attractions with `tripadvisor_rating`, `tripadvisor_review_count`, and up to 3 `review_snippets` per place.
- **`enrichPlacesWithReviews(places, destinationName)`** — fuzzy-matches Google Places results against Tripadvisor results by name (exact, contains, or shared word ≥ 5 chars). Merges the Tripadvisor fields onto matched places; unmatched places are returned unchanged.
- **Plan detail** shows per-place Tripadvisor ratings and a collapsible "Traveller reviews" section with real snippets under each place.
- **`generatePlan` context** includes the first review snippet for each place so the LLM can reference real traveller sentiment in the plan brief.
- **Mock**: `MOCK_TRIPADVISOR_PLACES` added to `mockData.js`; `ollamaStream` and `searchTripadvisor` both respect the `VITE_MOCK_MODE` flag.

---

### 2026-05-26 — Experience Type Selection Flow

**Problem:** The pipeline generated only a single "balanced" plan with no way for the user to ask for something different without starting over.

**Improvements:**
- After the initial balanced plan is generated, the assistant asks what kind of experience the user wants (budget, luxury, food, adventure, relaxation, cultural, romantic, family).
- **`parseExperienceType(userMessage)`** — classifies the user's reply into one of 9 experience types using an LLM call.
- **`generatePlan(tripInfo, cachedOptions, experienceType)`** — the `EXPERIENCE_BIAS` map provides per-type planning instructions (e.g. budget: "Minimize total cost. Maximize review quality per dollar." / luxury: "Pick the highest-reviewed premium options regardless of price.").
- The experience-specific plan is auto-saved to the `plans` table.
- **State machine**: `experience_confirmed: false` → user picks a vibe → `experience_confirmed: true` → refine mode unlocks.

---

### 2026-05-26 — Conversational Multi-turn Intake (replaced ConfirmForm)

**Problem:** The original intake was a static form (`ConfirmForm`) that asked the user to fill in missing fields manually. It felt out of place in a chat interface.

**Improvements:**
- **`extractAndMergeTripInfo(history, existingContext)`** — merges each new user message into the accumulated trip context. Preserves previously extracted values; only overwrites fields the conversation explicitly changes.
- **`generateFollowUp(tripContext, missingRequired, ...)`** — produces a natural-language question asking only for what's still missing.
- **`generateReadyConfirmation(tripContext)`** — announces that all details are collected and the search is starting, without asking for another confirmation round.
- State machine: `intake` (no plan) → gathering → `ready_to_plan` → `runIntake` → `experience` → `refine`.
- The `ConfirmForm` component is retained in the codebase but is no longer mounted in the default flow.

---

### 2026-05-26 — Streaming Narrative (token-by-token assistant bubbles)

**Problem:** All assistant responses appeared all-at-once after a multi-second delay, giving the impression the app was frozen.

**Improvements:**
- **`ollamaStream(system, prompt, onChunk, { signal })`** — reads the Ollama `/api/generate` NDJSON stream line-by-line and calls `onChunk(delta)` for each token.
- **`streamNarrative(system, prompt, dispatch, signal)`** in `useChat.js` — manages the in-flight streaming bubble: `streaming-start` → `streaming-chunk` per token → `streaming-stop`. The reducer accumulates chunks into `streaming.content`.
- **Stop button** — replaces the Send button while streaming; calls `abortRef.current.abort()` to cancel via `AbortSignal`.
- **Mock streaming** — in `VITE_MOCK_MODE=true`, `ollamaStream` emits `MOCK_NARRATIVE` word-by-word with 40ms delays so the streaming UI path is exercisable without Ollama.

---

### 2026-05-26 — Laravel + MySQL Persistence

**Problem:** All chat state lived in React memory and was lost on page refresh. There was no way to resume a previous planning session.

**Improvements:**
- **`server/`** — Laravel 11 project with MySQL backend (`ragflight` DB).
- **Schema:** `chat_sessions` (UUID PK, title, trip_context JSON, cached_options JSON, head_message_id FK), `chat_messages` (parent_id for branching, role, content, plan_snapshot JSON, state_snapshot JSON), `plans` (session_id FK, plan_key, experience_type, plan JSON).
- **API endpoints:** `GET/POST /api/sessions`, `GET/PATCH/DELETE /api/sessions/{id}`, `POST /api/sessions/{id}/messages`, `GET/POST/DELETE /api/plans`.
- **`src/services/api.js`** — thin fetch wrapper around `VITE_API_BASE`.
- **Chat branching:** `parent_id` on messages + `head_message_id` on session allows editing past messages and creating sibling branches. `buildPath(allMessages, headId)` reconstructs the active branch for rendering.
- **Previous chats sidebar** — `PreviousChats` component lists all sessions newest-first; clicking restores the full transcript and resumes refine mode.

---

### 2026-05-26 — User Authentication (Laravel Sanctum)

**Problem:** With persistence added, there was no separation between users — anyone on `localhost` could see all sessions.

**Improvements:**
- **Laravel Sanctum** token-based auth. Register/login endpoints return a bearer token stored in `localStorage`.
- **`useAuth` hook** — manages token, login, register, logout lifecycle. Wraps all `api.*` calls with the `Authorization: Bearer <token>` header.
- **`LoginPage` / `RegisterPage`** — simple form components shown before the main app shell.
- All migrations use `uuidMorphs` for UUID primary keys compatible with Sanctum's model setup.
- `server/.env` is gitignored; credentials never committed.

---

### 2026-05-22 — Mock / Dev Mode (`VITE_MOCK_MODE`)

**Problem:** Every UI iteration required live Ollama + SearchAPI calls, burning quota and making offline development impossible.

**Improvements:**
- **`VITE_MOCK_MODE=true`** flag bypasses `searchFlights`, `searchHotels`, `searchPlaces`, and `ollamaStream`, returning fixture data instead.
- **`src/services/mockData.js`** — canonical fixture data for Bali (and later Yogyakarta and Raja Ampat): user prompts, trip info, flights, hotels, places, Tripadvisor reviews, and a streaming narrative string.
- Ollama still runs for `extractAndMergeTripInfo`, `generatePlan`, `refinePlan` — so the LLM decision path is exercised with predictable, quota-free inputs.
- `VITE_SEARCHAPI_KEY` is not validated when `MOCK=true`.

---

*Last updated: 2026-05-28*

## 2026-05-28

### [BUG] Model generates a new plan for unrelated questions
- **Symptom:** Asking anything in refine mode ("what do you think of Tokyo?", "thanks!") triggers a full `refinePlan` call and potentially a new plan card.
- **Root cause:** `refinePlan.js` had no intent classification — every message in refine mode was treated as a plan change request.
- **Fix:** Added `chat` mode to `refinePlan` system prompt. The LLM now returns `{ kind: "chat", reply: "..." }` for general conversation. `useChat.js` streams the reply and leaves the plan snapshot completely unchanged.
- **Files:** `src/services/refinePlan.js`, `src/hooks/useChat.js`

---

### [BUG] Date change in refine mode returns wrong date ("go on november" → June 16)
- **Symptom:** Asking to update the flight to November resulted in the wrong month being returned.
- **Root cause 1:** `refinePlan.js` was still importing `ollamaGenerate` directly instead of `llmGenerate` from the provider — so even in Gemini mode, it hit Ollama, which had no date context.
- **Root cause 2:** The `refinePlan` system prompt had no `today` date, so the LLM had no basis to resolve relative expressions like "November this year."
- **Fix:** Switched `refinePlan.js` to import `llmGenerate` from `llmProvider`. Added `Today is ${today}` to the system prompt. Also added an instruction: "For dates: resolve relative expressions like 'november this year', 'next month', 'in 3 weeks' to a concrete YYYY-MM-DD using today's date."
- **Files:** `src/services/refinePlan.js`

---

### [BUG] Save button stops working after generating a new plan in the same chat
- **Symptom:** Clicking "Save this plan" in Plan Detail had no effect after the plan was updated through refinement.
- **Root cause:** `savePlan()` in `useChat.js` was reading `snapshot?.selected_plan` — a leftover field name from the old 3-plan era. The current plan is stored as `current_plan` in `state_snapshot`.
- **Fix:** Changed `const plan = snapshot?.selected_plan` → `const plan = snapshot?.current_plan`.
- **Files:** `src/hooks/useChat.js`

---

### [BUG] Flight section in Plan Detail shows no city or IATA codes
- **Symptom:** The "Departs" and "Arrives" rows in Plan Detail only showed raw timestamps with no route information (no "Manado → Bali" or "MDC → DPS").
- **Root cause:** `assemblePlan()` did not copy `departure_iata`, `arrival_iata`, `departure_city`, or `destination_name` from `tripInfo` onto the assembled flight object. The component had no data to display.
- **Fix:** Added those four fields to the assembled flight object in `assemblePlan()`. Added a "Route" row to `FlightSection` in `PlanDetail.jsx` showing city names with IATA codes in a smaller monospace label.
- **Files:** `src/services/tripPipeline.js`, `src/components/Molecules/PlanDetail/PlanDetail.jsx`, `src/components/Molecules/PlanDetail/PlanDetail.css`

---

### [BUG] Gemini API — multiple model/endpoint mismatches

A series of errors while finding a working Gemini model for the API key:

| Error | Model / Endpoint tried | Cause | Fix |
|---|---|---|---|
| `429 RESOURCE_EXHAUSTED` (limit: 0) | `gemini-2.0-flash` on `v1beta` | `gemini-2.0-flash` has a free-tier quota of 0 for this key | Switch to `gemini-1.5-flash` |
| `404 NOT_FOUND` | `gemini-1.5-flash` on `v1beta` | Model not accessible on this key via v1beta | Switch to `v1` endpoint |
| `400 INVALID_ARGUMENT` — unknown field `system_instruction` | `gemini-1.5-flash` on `v1` | `v1` stable endpoint does not support `system_instruction` or `responseMimeType` | Revert to `v1beta`, try `gemini-1.5-flash-latest` |
| `404 NOT_FOUND` | `gemini-1.5-flash-latest` on `v1beta` | `gemini-1.5` series not in this key's model allowlist at all | Call `ListModels` API to see available models |
| ✅ Working | `gemini-2.5-flash-lite` on `v1beta` | Confirmed via direct curl: supports `system_instruction`, `responseMimeType`, and streaming | Use `gemini-2.5-flash-lite` |

- **Files:** `src/services/geminiClient.js`

---

### [BUG] `refinePlan` tests failing after switching to `llmGenerate`
- **Symptom:** All 11 `refinePlan.test.js` tests failed with timeout after `refinePlan.js` was updated to import from `llmProvider`.
- **Root cause:** Tests were mocking `ollamaGenerate` from `tripPipeline`, but `refinePlan.js` now calls `llmGenerate` from `llmProvider`. The mock was never hit.
- **Fix:** Updated `refinePlan.test.js` to mock `../services/llmProvider` instead, and replaced all `ollamaGenerate.mock*` references with `llmGenerate.mock*`.
- **Files:** `src/test/refinePlan.test.js`

---

## 2026-05-27

### [BUG] `chatMessage.test.jsx` failing — 3 tests about plan rendering
- **Symptom:** Tests that asserted a plan card renders when `state_snapshot` contains a plan were failing.
- **Root cause:** Test fixture used `state_snapshot: { selected_plan: ... }` but `ChatMessage.jsx` was reading `message.state_snapshot?.current_plan`.
- **Fix:** Updated test fixtures to use `state_snapshot: { current_plan: selectedPlan }`.
- **Files:** `src/test/components/chatMessage.test.jsx`

---

### [BUG] Enrichment tests failing — `tripadvisor_rating` is `undefined`
- **Symptom:** Tests for `enrichPlacesWithReviews` that mocked `fetch` were returning places with `tripadvisor_rating: undefined`.
- **Root cause:** `searchTripadvisor` calls `fetch` directly and expects the SearchAPI format `{ results: [...] }`. The test mock was returning the Ollama format `{ response: "..." }`, which the code then could not parse.
- **Fix:** Added a separate `mockTripadvisorFetch(items)` helper in the test that returns `{ results: items }` matching the real SearchAPI shape.
- **Files:** `src/test/scenarios.test.js`

---

### [BUG] Raja Ampat "direct flight" test failing
- **Symptom:** Test asserting `stops === 0` for Raja Ampat mock flights failed.
- **Root cause:** Raja Ampat (IATA: RJM/Waisai) has no nonstop flights from major cities — all routes require at least one stop. The test assertion was wrong.
- **Fix:** Changed assertion from `stops === 0` to `stops <= 1`.
- **Files:** `src/test/mockData.test.js`

---

### [BUG] `generateReadyConfirmation` returning fixture data instead of mocked fetch value in tests
- **Symptom:** Tests for `generateReadyConfirmation` were receiving `MOCK_READY_CONFIRMATION` (the fixture string) even though `VITE_MOCK_MODE` was not expected to be active.
- **Root cause:** Local `.env` had `VITE_MOCK_MODE=true`, which Vitest reads by default. The mock guard in the function was short-circuiting before the mocked `fetch` could be called.
- **Fix:** Added `env: { VITE_MOCK_MODE: 'false', VITE_SEARCHAPI_KEY: 'test-key' }` to the `test:` block in `vite.config.js` so test runs always override the local `.env`.
- **Files:** `vite.config.js`

---

## 2026-05-26

### [BUG] Plan cards not rendering in chat — `hasPlan` check reading wrong field
- **Symptom:** After selecting a plan, the chat showed the assistant text but no plan card was rendered.
- **Root cause:** `ChatMessage.jsx` was checking `message.state_snapshot?.selected_plan` to decide whether to render a plan card. The field was renamed to `current_plan` when moving to the single-plan model.
- **Fix:** Changed the `hasPlan` check to `message.state_snapshot?.current_plan`.
- **Files:** `src/components/Molecules/ChatMessage/ChatMessage.jsx`

---

### [BUG] JSON garbage / raw text appearing in chat assistant bubbles
- **Symptom:** Instead of clean narrative text, the assistant bubble would show raw JSON or garbled output.
- **Root cause:** `ollamaGenerate` always sent `format: 'json'` in the request body, even for prose-generating calls (`generateFollowUp`, `generateReadyConfirmation`, `generateExperiencePrompt`). Ollama forced JSON output for those calls, producing malformed chat text.
- **Fix:** Added a `{ json = true }` option to `ollamaGenerate`. All structured calls (`extractAndMergeTripInfo`, `generatePlan`, etc.) keep `json: true`. Prose calls pass `json: false`, which omits the `format` field from the Ollama request.
- **Files:** `src/services/tripPipeline.js`

---

### [BUG] Mock mode intercepting user prompts — user could not type freely
- **Symptom:** In `VITE_MOCK_MODE=true`, any user message was ignored and the pipeline used the hardcoded `MOCK_TRIP_INFO` instead, preventing manual testing with custom prompts.
- **Root cause:** `extractAndMergeTripInfo` and `generateReadyConfirmation` had MOCK guards that returned fixtures immediately, bypassing Ollama entirely.
- **Fix:** Removed the MOCK guards from those two functions. Mock mode now only bypasses SearchAPI calls (`searchFlights`, `searchHotels`, `searchPlaces`) and `ollamaStream`. Ollama still runs for intake and confirmation so the LLM processes whatever the user types.
- **Files:** `src/services/tripPipeline.js`, `src/services/mockData.js`

---

### [BUG] Mock mode throwing "Missing VITE_SEARCHAPI_KEY" even when mock is active
- **Symptom:** Setting `VITE_MOCK_MODE=true` and starting a chat would still throw an error about the missing SearchAPI key.
- **Root cause:** `fetchTripOptions` called `getApiKey()` as a guard before checking the `MOCK` flag, so the key check ran before the mock short-circuit.
- **Fix:** Moved the `if (!MOCK) getApiKey()` call inside `fetchTripOptions` to after the MOCK check.
- **Files:** `src/services/tripPipeline.js`

---

### [BUG] Blank chat — messages sent but nothing rendered; errors hidden
- **Symptom:** User message was posted but the chat view stayed blank with no assistant response and no visible error.
- **Root cause 1:** `head_message_id` was not set to the user message before the assistant turn started, so the chat tree rendered nothing while Ollama was processing.
- **Root cause 2:** Error state was not surfaced in the UI, so failures were silent.
- **Fix:** Called `setHead(sessionId, userMsg.id)` immediately after posting the user message (before the Ollama call). Wired the `error` state from `useChat` into the chat UI as a visible error toast.
- **Files:** `src/hooks/useChat.js`

---

### [BUG] CORS error — Vite dev server on a non-5173 port blocked by Laravel
- **Symptom:** API calls to `localhost:8000` were rejected with a CORS preflight error when the Vite dev server was on a port other than 5173.
- **Root cause:** `config/cors.php` had `allowed_origins: ['http://localhost:5173']` — an exact match instead of a wildcard.
- **Fix:** Changed to `['http://localhost:*']` (or a regex) to allow any localhost port.
- **Files:** `server/config/cors.php`

---

## 2026-05-22

### [BUG] `no-useless-assignment` lint error in `extractAndMergeTripInfo`
- **Symptom:** `npm run lint` failed with `no-useless-assignment` pointing to `let extracted = {}`.
- **Root cause:** The variable was initialized to `{}` and then unconditionally reassigned in the `try` block, making the initial assignment dead code.
- **Fix:** Removed the initial `let extracted = {}` declaration and inlined the assignment inside the `try/catch`.
- **Files:** `src/services/tripPipeline.js`

---

*Last updated: 2026-05-28*
