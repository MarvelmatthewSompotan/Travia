# Travia

Travia is a full-stack AI travel planner built around a conversational, single-plan-per-generation approach. Instead of a multi-step form or a fixed menu of plan tiers, you describe a trip in plain language and Travia generates one tailored plan per conversation turn — then refines it through follow-up chat.

The frontend is a React + Vite app in `src/`, and the backend is a Laravel API in `server/`. The planner uses a local Ollama model as an LLM-orchestrated tool-using agent — it extracts trip intent, calls SearchAPI for live flights, hotels, and places, selects and assembles a plan, and streams a natural-language response back. Plans can be refined indefinitely within the same session.

> **A note on naming:** The project directory is still `RAG GFS` for legacy reasons, but the app is Travia. There is no retrieval-augmented generation (RAG) in the traditional sense; the pipeline is a sequential tool-using agent orchestrated by an LLM.

For AI-assisted code analysis, start with [AI_CONTEXT.md](AI_CONTEXT.md).

## Features

- **Conversational trip intake with no forms** — the assistant asks naturally for any missing details (origin, destination, dates, duration) across as many turns as needed.
- **Single-plan generation with experience-type customization** — each generation produces one focused plan based on a chosen vibe: Balanced, Budget, Luxury, Adventure, Food, Relaxation, Cultural, Romantic, or Family.
- **Unlimited experience-type plans per trip, each independently refineable** — switching vibe generates a fresh plan; any plan can then be refined further without losing others.
- **Plan refinement** — follow-up messages swap flights, hotels, or places from the cached pool, or trigger a fresh SearchAPI search when dates or destination change.
- **Chat history with branching** — editing or regenerating a message creates a sibling branch; the original is preserved and navigable.
- **Saved plans stored separately from chat sessions** — plans survive session deletion.
- **User authentication** — email/password registration and login via Laravel Sanctum; all session and plan data is scoped per user.
- **Review-grounded recommendations using Tripadvisor + Google hybrid** — place results blend Tripadvisor ratings with Google Maps data via SearchAPI.

## Stack

- **Frontend:** React 19, Vite 8, plain CSS
- **Backend:** Laravel 12, PHP 8.2, Laravel Sanctum for authentication
- **Local model runtime:** Ollama at `http://localhost:11434` (model: `llama3.2`)
- **External search:** SearchAPI — engines `google_flights`, `google_hotels`, `google_maps`, Tripadvisor
- **Storage:** MySQL via Laravel (sessions, messages, saved plans, users)

## Repository Layout

```text
.
├── src/
│   ├── components/
│   │   ├── Atoms/           # Low-level UI primitives
│   │   ├── Molecules/       # Chat bubbles, plan cards, composer, sidebar
│   │   └── Pages/           # Planner, MyPlans, LoginPage, RegisterPage
│   ├── hooks/               # useChat.js, useAuth.js — state orchestration
│   ├── services/            # API client, trip pipeline, refinement, chat-tree helpers, auth helpers
│   └── styles/              # Design tokens and shell styling
├── public/                  # Static assets
├── server/
│   ├── app/
│   │   ├── Http/Controllers/
│   │   └── Models/
│   ├── database/migrations/
│   ├── routes/
│   └── config/
└── AI_CONTEXT.md            # AI-oriented system map and maintenance notes
```

## Key Frontend Files

- `src/App.jsx` — top-level auth gate, tab routing, session switching, saved plan refresh.
- `src/hooks/useChat.js` — core planner state machine: intake → experience → refine modes, persistence, streaming, branch navigation.
- `src/hooks/useAuth.js` — authentication state: login, register, logout, token persistence.
- `src/services/auth.js` — token/user localStorage helpers and auth API calls.
- `src/services/tripPipeline.js` — LLM agent functions: `extractAndMergeTripInfo`, `generateFollowUp`, `generatePlan`, `generateExperiencePrompt`, `parseExperienceType`, streaming, SearchAPI fetches.
- `src/services/refinePlan.js` — decides whether a refinement request can reuse cached options or must re-run search.
- `src/services/chatTree.js` — branch navigation helpers based on `parent_id`.
- `src/components/Pages/LoginPage/LoginPage.jsx` — email/password login form.
- `src/components/Pages/RegisterPage/RegisterPage.jsx` — registration form.

## Key Backend Files

- `server/routes/api.php` — route definitions; all routes except `/auth/login` and `/auth/register` require a Sanctum bearer token.
- `server/app/Http/Controllers/AuthController.php` — register, login, logout, and `me` endpoints.
- `server/app/Http/Controllers/ChatSessionController.php` — CRUD for sessions and active head pointer, scoped to the authenticated user.
- `server/app/Http/Controllers/ChatMessageController.php` — append-only message storage with `parent_id` for branching.
- `server/app/Http/Controllers/PlanController.php` — saved-plan persistence with de-duplication by `plan_key`; scoped to the authenticated user; supports unlimited `experience_type` variants.

## Environment

Frontend (`.env`):

```
VITE_API_BASE=http://localhost:8000
VITE_SEARCHAPI_KEY=your_key_here
VITE_MOCK_MODE=false
```

Backend (`server/.env`):

```
APP_KEY=base64:...          # required for Sanctum token signing
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=ragflight
DB_USERNAME=root
DB_PASSWORD=your_password
```

Runtime services:

- Laravel API at `http://localhost:8000`
- Ollama at `http://localhost:11434`
- A valid SearchAPI key

## Local Development

Frontend:

```bash
npm install
npm run dev
```

Backend:

```bash
cd server
composer install
php artisan migrate
php artisan serve
```

Optional all-in-one backend dev command:

```bash
cd server
composer run dev
```

First-time users must register at `/register` before using the planner.

## API Summary

Public (no token required):

- `POST /api/auth/register`
- `POST /api/auth/login`

Protected (Sanctum bearer token required):

- `POST /api/auth/logout`
- `GET  /api/auth/me`
- `GET    /api/sessions`
- `POST   /api/sessions`
- `GET    /api/sessions/{id}`
- `PATCH  /api/sessions/{id}`
- `DELETE /api/sessions/{id}`
- `POST   /api/sessions/{id}/messages`
- `GET    /api/plans`
- `POST   /api/plans`
- `DELETE /api/plans/{id}`
- `GET    /api/my-plans`

## Notes

- The planner stores conversation state snapshots (trip context, cached search results, current plan) inside assistant messages, not in a separate workflow table. This makes branch-safe state trivial — each branch carries its own snapshot.
- Chat history is tree-shaped, not linear: edits and regenerations branch from earlier messages; `head_message_id` on the session tracks the active tip.
- `VITE_MOCK_MODE=true` bypasses SearchAPI entirely and uses fixture data, while still calling Ollama, so the full LLM pipeline is exercised without consuming API quota.
