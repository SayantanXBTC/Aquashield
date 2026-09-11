# Git Workflow — AQUASHIELD

## Branch Strategy

```
main
 │
 ├── develop                    (integration branch)
 │
 ├── feature/3d-ocean            → frontend/src/three/
 ├── feature/scenario-builder    → frontend/src/features/scenario-builder/
 ├── feature/flood-model         → simulation/models/flood/
 ├── feature/tsunami-model       → simulation/models/tsunami/
 ├── feature/websocket-stream    → backend/app/api/websocket/
 ├── feature/vulnerability-agent → agents/agents/vulnerability/
 └── feature/rag-ingestion       → rag/ingestion/
```

Branches are named after a bounded unit of work, not a domain. `frontend`, `backend`, `simulation`, `agents`,
and `rag` are domains (directories) — they are not branch names. A branch owns one feature inside one domain
and merges into `develop`.

## Ownership Mapping

Each domain maps to a working area a contributor can usually stay inside without touching another domain's files:

| Domain | Directory | Typical branch prefix |
|---|---|---|
| Frontend (UI) | `frontend/src/{app,components,features,hooks,stores,services,api,types,utils,constants,styles}` | `feature/frontend-*` |
| 3D visualization | `frontend/src/three/` | `feature/3d-*` |
| Animation | `frontend/src/animations/` | `feature/animation-*` |
| Backend | `backend/` | `feature/backend-*` |
| Simulation | `simulation/` | `feature/<disaster>-model` |
| Agents | `agents/` | `feature/agent-*` |
| RAG | `rag/` | `feature/rag-*` |
| Data | `data/` | `feature/data-*` |
| Testing (cross-domain) | `tests/` | `feature/testing-*` |
| Infrastructure | `infrastructure/` | `feature/infra-*` |

Cross-domain integration happens through `shared/` (schemas, types, contracts, constants) — not by one branch
editing another domain's internals.

## Conflict-Prevention Rules

- Avoid unnecessary modifications to shared root files (`README.md`, root configs).
- Don't repeatedly edit the same central index/barrel file from multiple branches — prefer domain-local exports.
- Prefer feature-local registration/configuration over a single global registry file.
- Keep `shared/` contracts stable. If a shared contract must change, treat it as a deliberate, reviewed
  integration change — not a side effect of unrelated work.
- Keep commits small and domain-focused. Avoid unrelated formatting changes riding along with a feature commit.
- Don't run a repo-wide formatter when modifying one domain unless the task requires it.
- Don't reorganize another contributor's directory while working on an unrelated feature.
- Rebase/merge `develop` into your feature branch before opening integration, per the team's agreed workflow.

## Barrel Files

Avoid giant global `index.ts` / `index.tsx` / `__init__.py` files that every contributor needs to touch.
Prefer direct imports or domain-local barrel files (e.g. `frontend/src/three/disasters/index.ts` exporting
only that folder's modules) over one repo-wide barrel file.
