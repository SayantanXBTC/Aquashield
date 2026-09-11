# AQUASHIELD

AI-powered Water Disaster Intelligence, Simulation & Response Platform.

## What it is

AQUASHIELD lets a user create and configure a water-related disaster scenario, run it through a physics-based
simulation, watch it evolve as a 3D animation over time, and receive an AI-generated, RAG-grounded response
plan — then modify the scenario and re-run the loop.

## Core capabilities

- Disaster-agnostic scenario system: flood, flash flood, coastal flood, storm surge, cyclone, tsunami, oil
  spill, marine/chemical pollution, maritime search & rescue, and future water-related hazards — all through
  one common `Scenario` abstraction, not one disaster-specific app.
- Deterministic simulation engine producing time-series state; the AI interprets that state, it never invents
  physical outcomes.
- GPU-efficient 3D visualization (React Three Fiber / Three.js) with full timeline playback (play, pause,
  scrub, speed, compare).
- Multi-agent AI (LangGraph) for vulnerability analysis, tactical response, and Incident Action Plan synthesis.
- Disaster-aware RAG pipeline grounding recommendations in authoritative documents, scoped by disaster type,
  location, and simulation state.

## High-level architecture

```
Frontend → FastAPI → Scenario Manager → Simulation Engine → State Store → 3D Renderer
                                              │
                                              ▼
                                     AI Orchestrator → Risk Analysis → RAG → Response Strategy
                                              │
                                              ▼
                                          Frontend
```

See [architecture.md](architecture.md) for the full system design and [CLAUDE.md](CLAUDE.md) for development
rules.

## Technology stack

- **Frontend:** React, TypeScript, Vite, React Three Fiber, Three.js, Tailwind CSS, Anime.js
- **Backend:** Python, FastAPI, WebSockets, Pydantic
- **Database:** PostgreSQL, PostGIS, SQLAlchemy 2.0, Alembic, GeoAlchemy2
- **Simulation:** NumPy, SciPy, xarray, GeoPandas, Shapely, Rasterio
- **AI:** LangGraph (LLM provider to be decided)
- **RAG:** ChromaDB
- **Testing:** Playwright (e2e), domain-local unit/integration tests

## Development status

Technology bootstrap complete: frontend and backend both run, talk to each other, and have working
lint/type-check/test pipelines. No application features implemented yet — see architecture.md's Technology
Bootstrap section for exactly what's installed vs. implemented vs. planned.

## Development Setup

**Frontend:**

```
cd frontend
npm install
npm run dev       # http://localhost:5173
npm run build     # type-check + production build
npm run test       # Vitest
npm run lint       # ESLint
```

**Backend:**

```
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
docker compose -f infrastructure/docker-compose.yml up -d   # PostgreSQL + PostGIS
cd backend
alembic upgrade head && python -m app.db.seed
uvicorn app.main:app --reload   # http://127.0.0.1:8000
pytest
```

Full setup, environment variables, and troubleshooting: [docs/development/setup.md](docs/development/setup.md).
Database schema, migrations, seed data: [docs/development/database.md](docs/development/database.md).

## Repository organization

```
frontend/        React/TS/3D client
backend/         FastAPI service layer
simulation/      Disaster-agnostic physics/simulation engine
agents/          LangGraph multi-agent AI
rag/             Disaster-aware retrieval-augmented generation
data/            Environmental/geospatial data (bulk data gitignored)
shared/          Cross-domain schemas, types, contracts, constants
tests/           Cross-domain integration/e2e/contract tests
docs/            Supporting documentation
scripts/         Developer utility scripts
infrastructure/  Deployment configuration (future)
```

Each top-level directory has its own `README.md`. Start there when working in a domain. See
[docs/development/git-workflow.md](docs/development/git-workflow.md) for branch/ownership conventions.
