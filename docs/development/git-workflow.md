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

## Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `refactor:`, `docs:`,
`test:`, `perf:`, `chore:`, `build:`, `ci:`. Scope to the domain when useful:

```
feat(3d): add ocean particle renderer
feat(simulation): add flood model
feat(agents): add vulnerability analysis
feat(rag): add document ingestion
feat(frontend): add scenario builder
fix(backend): handle websocket disconnect
docs(architecture): document simulation boundary
test(simulation): add flood model tests
```

Keep commits small and logically complete — one commit should represent one coherent change, not a mix of
unrelated edits.

## Feature Workflow

```
switch to develop
  ↓
pull latest develop
  ↓
create feature branch
  ↓
implement → test → document → commit
  ↓
update feature branch with develop (rebase/merge)
  ↓
integrate into develop
  ↓
run integration tests
  ↓
promote stable state to main
```

```
git switch develop
git pull origin develop
git switch -c feature/flood-simulation
```

Resolve conflicts on the feature branch whenever possible — never resolve large conflicts directly on `main`.
`develop` is the integration branch; `main` holds stable, release/demo-ready code only. Do not merge unfinished
feature branches into `main`.

## Shared Contract Changes

`shared/` (schemas, types, contracts, constants) is high-impact — every domain depends on it. If a feature
requires changing a shared contract (`Scenario`, `SimulationState`, `TimelineFrame`, `AgentResponse`,
`WebSocketEvent`, etc.):

1. Identify every domain affected by the change.
2. Document the change (commit message + architecture.md/CHANGELOG.md if the contract's shape changes).
3. Keep the change backward-compatible where practical.
4. Clearly flag breaking changes in the commit message and CHANGELOG.md.

Never change a shared contract silently just to make one branch's implementation easier — other domains rely
on that shape staying stable.

## Emergency Rules

- Never force push (`git push --force`), especially to `main` or `develop`.
- Never delete another contributor's branch without their permission.
- Never rewrite shared history (`rebase`/`reset` on pushed commits) without agreement from whoever else is on
  that branch.
- Never commit secrets, `.env`, credentials, or large generated datasets.
- If a push is rejected because the remote has commits you don't have locally, stop and reconcile
  (fetch + rebase/merge) — do not force past it.
