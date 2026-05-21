# RAG GFS

RAG GFS is a full-stack AI travel planner with three main surfaces:

- A chat-based planner that turns a trip request into three travel plan options.
- A saved-plans area for keeping selected itineraries.
- A direct flight-search form powered by SearchAPI.

The frontend is a React + Vite app in [`src/`](/Users/marvelsompotan/Project/RAG%20GFS/src), and the backend is a Laravel API in [`server/`](/Users/marvelsompotan/Project/RAG%20GFS/server). The planner uses a local Ollama model for extraction, selection, and refinement, while SearchAPI provides flights, hotels, and places.

For AI-assisted code analysis, start with [AI_CONTEXT.md](/Users/marvelsompotan/Project/RAG%20GFS/AI_CONTEXT.md).

## Features

- Chat-driven trip intake with missing-field follow-up.
- Three generated plan tiers: Best, Budget, and Balanced.
- Plan refinement after selection.
- Chat history with branching via edited/regenerated messages.
- Saved plans stored separately from chat sessions.
- Standalone flight search UI.

## Stack

- Frontend: React 19, Vite 8, plain CSS
- Backend: Laravel 12, PHP 8.2
- Local model runtime: Ollama at `http://localhost:11434`
- External search provider: SearchAPI
- Storage: Laravel database tables for sessions, messages, and saved plans

## Repository Layout

```text
.
├── src/
│   ├── components/      # Planner UI, plans UI, previous chats UI
│   ├── hooks/           # Main chat/session/plans state orchestration
│   ├── lib/             # API client, travel pipeline, refinement, chat-tree helpers
│   └── styles/          # Theme and shell styling
├── public/              # Static assets
├── server/
│   ├── app/
│   │   ├── Http/Controllers/
│   │   └── Models/
│   ├── database/migrations/
│   ├── routes/
│   └── config/
└── AI_CONTEXT.md        # AI-oriented system map and maintenance notes
```

## Key Frontend Files

- [src/App.jsx](/Users/marvelsompotan/Project/RAG%20GFS/src/App.jsx): top-level shell, tabs, flight-search form, session switching, saved plan refresh.
- [src/hooks/useChat.js](/Users/marvelsompotan/Project/RAG%20GFS/src/hooks/useChat.js): core planner state machine and persistence flow.
- [src/lib/tripPipeline.js](/Users/marvelsompotan/Project/RAG%20GFS/src/lib/tripPipeline.js): Ollama extraction/streaming plus SearchAPI flight, hotel, and place fetches.
- [src/lib/refinePlan.js](/Users/marvelsompotan/Project/RAG%20GFS/src/lib/refinePlan.js): decides whether a user request can reuse cached options or must rerun search.
- [src/lib/chatTree.js](/Users/marvelsompotan/Project/RAG%20GFS/src/lib/chatTree.js): branch navigation helpers based on `parent_id`.

## Key Backend Files

- [server/routes/api.php](/Users/marvelsompotan/Project/RAG%20GFS/server/routes/api.php): API route definitions.
- [server/app/Http/Controllers/ChatSessionController.php](/Users/marvelsompotan/Project/RAG%20GFS/server/app/Http/Controllers/ChatSessionController.php): CRUD for sessions and active head pointer.
- [server/app/Http/Controllers/ChatMessageController.php](/Users/marvelsompotan/Project/RAG%20GFS/server/app/Http/Controllers/ChatMessageController.php): append-only message storage.
- [server/app/Http/Controllers/PlanController.php](/Users/marvelsompotan/Project/RAG%20GFS/server/app/Http/Controllers/PlanController.php): saved-plan persistence with de-duplication by `plan_key`.

## Environment

Frontend expects:

- `VITE_API_BASE`
- `VITE_SEARCHAPI_KEY`

Runtime services expected by the planner:

- Laravel API at `http://localhost:8000` unless `VITE_API_BASE` overrides it
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
npm install
php artisan migrate
php artisan serve
```

Optional backend all-in-one dev command:

```bash
cd server
composer run dev
```

## API Summary

- `GET /api/sessions`
- `POST /api/sessions`
- `GET /api/sessions/{id}`
- `PATCH /api/sessions/{id}`
- `DELETE /api/sessions/{id}`
- `POST /api/sessions/{id}/messages`
- `GET /api/plans`
- `POST /api/plans`
- `DELETE /api/plans/{id}`

## Notes

- The planner stores conversation state snapshots inside assistant messages, not in a separate workflow table.
- Chat history is tree-shaped, not strictly linear, because edits and regenerations branch from earlier messages.
- The current root-level README and `server/README.md` originally came from framework templates; the root README is now project-specific, while the server README still reflects Laravel defaults.
