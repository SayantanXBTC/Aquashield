# Development Setup — AQUASHIELD

## 1. Prerequisites

- Git
- Node.js (verified with v26.8.1 / npm 11.19.0 — any current Node LTS should work)
- Python 3.11+ (verified with Python 3.14.7)

## 2. Node.js Requirements

The frontend (`frontend/`) is a Vite + React + TypeScript project. `frontend/package.json` is the source of
truth for exact dependency versions — see it for what's actually installed.

## 3. Python Requirements

One shared virtual environment covers `backend/`, `simulation/`, `agents/`, and `rag/` (see architecture.md
ADR-002). Root `requirements.txt` is the source of truth for exact pinned versions.

## 4. Frontend Setup

```
cd frontend
npm install
cp .env.example .env.local   # optional — defaults already point at localhost:8000
```

## 5. Backend Setup

```
python3 -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp backend/.env.example backend/.env   # optional — defaults already work locally
```

## 6. Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `VITE_API_URL` | `frontend/.env*` | Backend REST base URL (default `http://127.0.0.1:8000`) |
| `VITE_WS_URL` | `frontend/.env*` | Backend WebSocket URL (default `ws://127.0.0.1:8000/ws`) |
| `HOST`, `PORT` | `backend/.env` | Uvicorn bind address |
| `CORS_ORIGINS` | `backend/.env` | Allowed local dev origins (never `*` in production) |

Root `.env.example` documents the full set of categories the platform will eventually need (LLM, embeddings,
external data providers) — most are not consumed by any code yet. Never commit `.env`, `.env.local`, or
`backend/.env`.

## 7. Running the Frontend

```
cd frontend
npm run dev       # http://localhost:5173
```

## 8. Running the Backend

```
source .venv/bin/activate
cd backend
uvicorn app.main:app --reload
```

`GET http://127.0.0.1:8000/health` should return `{"status": "ok", "service": "aquashield-backend"}`.
`ws://127.0.0.1:8000/ws` accepts a connection and sends a `heartbeat` message, then echoes anything sent to it.

## 9. Running Tests

```
cd frontend && npm run test     # Vitest
cd backend && pytest            # from within the activated venv
```

## 10. Running Lint / Type Checks

```
cd frontend
npm run lint      # ESLint (flat config)
npm run build     # tsc --noEmit + vite build — fails on type errors
npm run format    # Prettier, writes in place
```

## 11. Troubleshooting

- **`ERESOLVE` during `npm install`**: a dependency's peer range doesn't match a pinned version. Fix the
  version pin in `frontend/package.json` (see architecture.md's Technology Bootstrap section for known
  constraints, e.g. `@react-three/fiber@9.x` requires `react <19.3`) — don't reach for `--legacy-peer-deps`.
- **Frontend can't reach the backend**: confirm the backend is running on the port `VITE_API_URL` points at,
  and that the frontend's dev origin is listed in the backend's `CORS_ORIGINS`.
- **`geopandas`/`pyproj` install issues on other platforms**: these ship prebuilt wheels bundling GDAL/PROJ on
  macOS/Linux/Windows for common Python versions; if a platform lacks a wheel, consult the package's install
  docs rather than pinning an old version to force a wheel match.
