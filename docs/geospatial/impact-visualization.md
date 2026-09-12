# Geospatial Impact Visualization — Prompt 10.1

A corrective integration pass on top of Prompt 10's real geospatial infrastructure
(`geographic_datasets`/`geographic_features`, the ingested Natural Earth coastline dataset, hazard-footprint/
exposure/impact analysis, and their REST endpoints). Prompt 10's backend genuinely worked — a diagnostic
audit verified every endpoint live — but the Command Center never displayed any of it, because it was
looking at the wrong `SimulationRun`. This document covers what Prompt 10.1 changed to fix that connection
and the display it added. It does not re-document Prompt 10's analysis pipeline itself; see
`backend/app/services/{exposure_service,impact_service,hazard_footprint_service}.py` and
`backend/app/services/geospatial/` for that.

## The bug and the fix

`useCommandCenterSession.ts` picked a scenario's default run with `runList[0]?.id` —
`SimulationRunRepository.list_for_scenario` orders `created_at desc`, so this is "the newest run,
regardless of status." A scenario can easily end up with a newer `PENDING` run (e.g. someone clicked "New
run" to try a different configuration) sitting on top of an older `COMPLETED` run that already has real
frames, hazard footprints, exposure, and impact data. The UI would auto-select the empty pending run and
show nothing — not because the data didn't exist, but because nothing pointed at it.

**Live test case** (the exact scenario the diagnostic used, "Geo Test Flood", lat 23.81 / lon 90.41):

| Run id | Status | `created_at` | `frame_count` |
|---|---|---|---|
| `e35cfb6f-...` | PENDING | 05:24:34 (newest) | — |
| `4c2f1169-...` | COMPLETED | 05:16:35 | 25 |
| `bc682f2a-...` | COMPLETED | 05:16:11 (oldest) | 25 |

Before this fix: `e35cfb6f-...` (PENDING, no data) was auto-selected. After: `GET
/scenarios/{id}/runs/default` returns `4c2f1169-...` — the newest run that is both `COMPLETED` *and* has
usable frames — confirmed live against the real dev database (not just a unit test) via
`TestClient(app).get(f"/scenarios/{scenario_id}/runs/default")`, which returned
`{"id": "4c2f1169-...", "status": "completed", "frame_count": 25, ...}`.

## Run selection priority

Implemented as a pure, dependency-free function so the rule itself is unit-testable without a database:

```
backend/app/services/run_selection.py
  RunSelectionCandidate(id, status, created_at, frame_count)
  select_default_run_id(candidates) -> UUID | None
```

Priority:

1. The latest `COMPLETED` run that actually has `frame_count > 0`. A `COMPLETED` status is **never** assumed
   to mean usable frames exist — `frame_count` is read from `SimulationArtifact.extra_metadata["frame_count"]`
   (the same value `SimulationRunDetail.frame_count` already exposes), and a completed run with `0` or
   unknown frame count falls through to the next tier exactly like a pending one would.
2. The latest `RUNNING` run, if no usable completed run exists.
3. The latest `PENDING` run, if nothing else is usable.
4. `FAILED`/`CANCELLED` runs are **never** auto-selected — they're only reachable through an explicit user
   choice in the run selector (below).

`ScenarioService.get_default_run(scenario_id)` loads real candidates (`SimulationRunRepository.list_for_scenario`
+ `SimulationArtifactRepository.get_latest_for_run` per run) and applies the rule; `GET
/scenarios/{scenario_id}/runs/default` exposes it (`SimulationRunOut | null` — `null`, not `404`, when
nothing qualifies, e.g. a brand-new scenario with no runs, or a scenario whose only runs failed).
`SimulationRunOut`/the shared `SimulationRun` contract gained a `frame_count` field (mirroring
`SimulationRunDetail.frame_count`) so `GET /scenarios/{id}/runs` (the full list, still newest-first,
unchanged) and the default-run lookup both carry real per-run frame counts with no extra round trip per run.

`useCommandCenterSession.ts` fetches `scenarioApi.getScenario`, `scenarioApi.getRuns`, and
`scenarioApi.getDefaultRun` in parallel on scenario selection, and sets `selectedRunId` from the default-run
result instead of `runList[0]`. The full `runs` list is still kept and rendered in the new run selector so a
user can always override the default and pick any run explicitly, including a pending or failed one.

## Run selector

`RunSelector.tsx` (rendered inside `SimulationStatusPanel`) is a compact native `<select>` — the same
pattern `ScenarioContextPanel`'s scenario picker already uses, not a new control. Each option shows real
status and frame count via `runFormatting.ts`'s pure, unit-tested helpers:

- `COMPLETED · 25 frames`
- `PENDING · No playback data available`
- `COMPLETED · No playback data available` (a completed run with zero persisted frames — never shown as if
  it had data)

`SimulationStatusPanel` also gained an explicit "No playback data available" empty state for a selected
pending/running/failed run (previously it silently rendered nothing in that case).

## Hazard footprint / exposure / impact — frame sync

Once run selection pointed at a real completed run, `useDataLayers.ts`'s existing hazard-footprint and
exposure fetches turned out to already be correct:

- The hazard-footprint fetch loads the full `footprints` list once per run and derives `currentFootprint =
  footprints.find(f => f.frame_index === frameIndex)` inline — this recomputes on every `frameIndex` change
  because it's a plain expression evaluated on render, not a fetch gated behind a stale dependency array.
  Verified directly: `useDataLayers.test.ts`'s new "frame sync" test renders at `frameIndex=0`, asserts the
  frame-0 footprint, rerenders at `frameIndex=1`, and asserts the returned footprint's `frame_index` is now
  `1` with different `geometry_type` — a real before/after comparison, not an assumption.
- The exposure fetch (`getExposure(runId, frameIndex)`) was already in a `useEffect` keyed on `frameIndex` —
  confirmed it refetches per frame in the same test (mocking a different exposure response after the
  rerender and asserting the new `status` value appears).
- **New in this phase:** impact was not previously fetched per frame at all. `useDataLayers.ts` gained an
  effect calling `geospatialApi.getImpact(runId, frameIndex)` — same shape as the exposure effect, keyed on
  `frameIndex` — feeding the new `ImpactPanel.tsx`. No debounce was added: exposure's existing per-frame
  fetch at the documented 150–1200ms playback interval (Prompt 9) was already deemed acceptable at this
  demo scale (tens of frames, small JSON payloads), and impact fetches the same size of payload on the same
  cadence — adding a separate debouncing mechanism for one of three parallel per-frame fetches would be
  inconsistent and unnecessary complexity for a problem that hasn't been observed.

`DataLayersPanel` gained a dedicated Exposure listing (name, type, and `within_hazard_footprint` /
`potentially_exposed` — never "damaged"/"destroyed", per the existing `ExposureStatus` wording rule) instead
of only aggregate counts. `ImpactPanel.tsx` (new) shows `severity_band`, `exposed_asset_count`, counts by
type/criticality, and the model id / demo-model disclaimer, straight from
`GET /simulation-runs/{id}/impact/frames/{frame_index}` — no field that endpoint doesn't return.

## Two hazard-visual systems (deliberate coexistence)

`three/core/SceneRoot.tsx` renders both:

- **(A)** the per-disaster-type `Visualizer` resolved from `three/disasters/registry.ts`
  (`FloodVisualizer`/`TsunamiVisualizer`/etc.), driven by `simulationVisualAdapter.toVisualState(currentFrame)`
  — a stylized, disaster-specific visual language established in Prompt 8 that reads clearly regardless of
  real-world geometry (an expanding disc for flood, rotating wind rings for cyclone, ...).
- **(B)** `HazardFootprintLayer`, driven by real `GET /simulation-runs/{id}/hazard-footprints` Polygon/Point
  geometry — geographically accurate to the underlying hazard footprint.

This phase makes **(B) authoritative** for the Data Layers / Impact panels and any geospatial reasoning —
those always read from the real footprint/exposure/impact endpoints, never from (A)'s stylized state. (A) is
**not removed**: it remains the "read clearly at a glance" visual language other code and earlier prompts
depend on, and nothing in this phase found a reason to delete it. Both are additive and independently
toggleable in practice (the Data Layers panel's `hazardFootprint` toggle only ever affects (B); (A) is
always driven by the current frame directly).

## Data layer provenance

`GeographicContextPanel.tsx` (new) shows, from real state/API data only:

| Field | Source | Notes |
|---|---|---|
| Coordinates | `ScenarioDetail.latitude/longitude` | Real, scenario-specific — never hardcoded. |
| Coastline | `GET /geographic-features/nearby` response's `source_provider`/`license` | "Natural Earth" / public-domain license text comes from the ingested `GeographicDataset` row (`backend/app/services/geospatial/natural_earth_provider.py`), not a literal in the component. Reads "Unavailable near this scenario" when the response is empty. |
| Infrastructure | Derived from `backend/app/db/seed.py` | Every seeded `InfrastructureAsset` carries `extra_metadata={"demo_data": true}` and no real-world source field — the panel honestly reads "Synthetic demo assets — no real-world provenance," never "OpenStreetMap" or any other real registry, because that would not be true. |
| Elevation | Static | "Unavailable" — no DEM exists in this codebase. |
| Terrain | Static | "Procedural Demo" — `three/terrain/Landmass.tsx`'s geometry is a procedurally-displaced patch, not GIS/elevation data. |

`DataLayersPanel` also gained a read-only Terrain status line ("Procedural Demo Terrain · Elevation:
Unavailable") — not a toggle, since the landmass/water always render regardless of any Data Layers setting;
this exists purely so the panel can never be read as implying real elevation data.

**Terrain remains procedural because DEM ingestion is not part of Prompt 10.1.**

## Explicitly out of scope (per this phase's brief)

- No DEM/elevation/rasterio/terrain raster ingestion of any kind.
- No AI/agents/RAG.
- No new database migration — this phase is query-ordering, a new read-only endpoint, and frontend
  wiring/display, not a schema change.
- The old per-disaster-type visualizers were not deleted (see "Two hazard-visual systems" above).

## Testing

Backend (148 passing total, up from 84 at Prompt 10):
`backend/tests/services/test_run_selection.py` (pure priority-function unit tests: no candidates, single
usable completed run, the exact "Geo Test Flood" shape, a completed run with zero/`None` frame_count is not
usable, falls back to running/pending, never auto-selects failed/cancelled, candidate order doesn't matter);
`backend/tests/api/test_scenarios.py` (new: `frame_count` on list/create responses, `GET .../runs/default`
returns `null` for a scenario with no runs, prefers a pending run when that's all there is, and — the key
regression test — prefers a completed run over a newer pending one created afterward).

Frontend (130 passing total): `useCommandCenterSession.test.ts` (default selection now driven by
`getDefaultRun`, including the exact newer-pending-vs-older-completed shape and the "nothing qualifies"
case); `useDataLayers.test.ts` (new impact fetch, and the frame-sync test proving footprint/exposure/impact
all change together when `frameIndex` changes); `RunSelector.test.tsx`, `runFormatting.test.ts` (new,
pure-function tests); `ImpactPanel.test.tsx`, `GeographicContextPanel.test.tsx`, `DataLayersPanel.test.tsx`
(new); `CommandCenterPage.test.tsx` (mocks updated for `getDefaultRun`/`getImpact`).

`npm run lint` and `npm run build` (`tsc --noEmit && vite build`) both clean; `CommandCenterPage` remains a
separate lazy-loaded chunk from the initial bundle.

**Browser verification:** not available in this environment (no browser automation tool) — the
"Geo Test Flood" default-run selection above was verified against the real dev PostgreSQL/PostGIS database
via a real `TestClient(app)` request (not a mock), which is as close to a live end-to-end check as this
environment allows; an actual browser walkthrough (selecting the scenario, confirming the run selector,
Data Layers, Impact, and Geographic Context panels render and update while scrubbing/playing the timeline)
remains the right next check before demo use.
