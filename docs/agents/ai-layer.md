# AI Intelligence Layer (Prompt 14, extended in Prompt 15)

Read-only, UI-agnostic multi-agent analysis over recorded simulation frames. Package: `agents/`
(standalone, no FastAPI/SQLAlchemy imports); backend glue in `backend/app/services/ai_*.py` and
`backend/app/api/routes/ai.py`. Architecture: architecture.md ADR-006 / §30.

## Graph

```
START -> context_collector -> { impact_analyst || tactical_advisor } -> synthesis_safety -> END
```

LangGraph `StateGraph` over `AquaShieldAgentState` (`agents/schemas/state.py`, Pydantic; list fields carry
`operator.add` reducers so the parallel branch merges). Built in `agents/graph/workflow/graph.py`;
`run_analysis(deps, request)` runs it to completion and never raises for data problems.

| Node | Module | Does |
|---|---|---|
| Agent 1 Context Collector | `agents/agents/state_evaluator/context_collector.py` | Bounded tool calls (scenario, run, frames `[i-1, i+1]`, footprint at `i`, exposure at `i`); builds the evidence registry `E1..En`; sanitizes the operator question (`agents/tools/sanitize.py`). |
| Agent 2 Impact Analyst | `agents/agents/vulnerability/impact_analyst.py` | Hazard progression across the three frames + exposures, each claim typed `observed_simulation_fact` / `spatial_exposure` and citing evidence ids. |
| Agent 3 Tactical Advisor | `agents/agents/tactical/tactical_advisor.py` | Priorities (CRITICAL/HIGH/MEDIUM/LOW) and actions with prerequisites, risks, `resources=RESOURCE_DATA_UNAVAILABLE`, `requires_human_approval=true`. |
| Join Synthesis & Safety | `agents/agents/command/synthesis.py` | Drops any claim citing unknown evidence, any number absent from its cited evidence, any destruction/casualty wording; forces action guardrails; generates the narrative and re-checks it; emits the `CommandBrief`. |

## Data access (read-only)

`agents/tools/data_access.py` defines the `AnalysisDataAccess` Protocol (6 methods). The backend implements
it in `backend/app/services/ai_data_access.py` on top of the existing owner-scoped services:
Agent → `ToolRunner` (`agents/tools/registry.py`, records every call + timing for the audit trail) →
adapter → `ScenarioService` / `SimulationService` / `HazardFootprintService` / `ExposureService` →
repositories → PostGIS/DB. The AI layer writes exactly one table: `ai_requests`.

## Guardrails

- Every number in any statement/action must appear in the cited evidence's values or summary
  (`SafetyValidator.check_text`); otherwise the item is stripped and noted in `validation_notes`.
- `RecommendedAction.requires_human_approval` is `Literal[True]`; `resources` is coerced to
  `RESOURCE_DATA_UNAVAILABLE` by a validator.
- Missing data is reported as `DATA_UNAVAILABLE` limitations (pending run, out-of-range frame, tool
  failure, no real-world geometry for exposure); the RAG stub reports `NOT_CONFIGURED`
  (`agents/tools/retrieval/evidence_retriever.py`).
- Operator questions are scrubbed (control chars, fences, instruction-shaped phrases → `[removed]`),
  capped at 400 chars, quoted as data, never put in the system prompt.

## Providers

`agents/llm/provider.py`: `LocalDeterministicProvider` (default, `AI_PROVIDER=local`) runs transparent rules
(`agents/llm/local_rules.py`) that emit the same schemas an LLM would; `AnthropicProvider`
(`AI_PROVIDER=anthropic`, `AI_MODEL`, `ANTHROPIC_API_KEY`) calls the Claude API through the official SDK's
`messages.parse` with the Pydantic output schema. Both go through the same validator. Prompt text is
versioned in `agents/prompts/versions.py` (`PROMPT_VERSION`, `AGENT_VERSIONS`) and persisted per request.

## API

| Method | Path | Notes |
|---|---|---|
| POST | `/ai/analyze` | `{scenario_id, simulation_run_id, frame_index, user_question?}` → `AIRequestOut` (201). Synchronous. |
| GET | `/ai/requests/{id}` | Audit record: status, provider, model, prompt/agent versions, tools called, execution_ms. |
| GET | `/ai/requests/{id}/status` | `{id, status, execution_ms, error}` |
| GET | `/ai/requests/{id}/result` | `{id, status, result: CommandBrief | null, error}` |

All owner-scoped (Firebase uid); another user's scenario/run/request is 404. TypeScript mirrors in
`shared/types/index.ts` (`CommandBrief`, `AIRequestOut`, …) and `frontend/src/features/command-center/api/aiApi.ts`.
The console gets one additive, collapsed-by-default "AI command brief" HUD panel that renders the brief
verbatim (`CommandBriefPanel.tsx`); no other UI changed.

## Tests

`agents/tests/` — graph topology/routing, parallel merge, degraded agent failure, injection defence,
missing-data fallbacks, schema/validator behaviour (17). `backend/tests/api/test_ai_analysis.py` — real
scenario → recorded run → brief, owner scoping, no writes to simulation tables, injection via API (6).
`scripts/ai_e2e_demo.py` — live HTTP run.

## Known data limitations

- Demo-world runs carry no real-world geometry, so PostGIS asset exposure is always `partial`
  (`DATA_UNAVAILABLE: asset_exposure`); exposures come from user-placed structures instead.
- No regulatory knowledge base **as originally shipped in Prompt 14** — since Prompt 16 this is
  configurable (`RAG_PROVIDER`); see the "Prompt 16" section below and docs/rag/pipeline.md. `NOT_CONFIGURED`
  remains the default until an operator ingests real sources.
- No resource inventory: every action's `resources` is `RESOURCE_DATA_UNAVAILABLE`.
- Structure exposure bands and all hazard values come from SIMPLIFIED DEMONSTRATION MODELS.


---

## Prompt 15 — frame-synchronised analysis in the command center

### The graph as originally shipped (9 nodes; superseded below)

```
START → context_collector
          ├─ (conditional) no analysable frame → safety_validator
          └─ hazard_agent ‖ damage_agent ‖ risk_agent      (Tier 1, one superstep)
                 └─ precaution_agent ‖ response_agent      (Tier 2, one superstep)
                        └─ resource_agent → safety_validator → command_synthesizer → END
```

| Node | Output schema | Deterministic generator |
|---|---|---|
| `context_collector` | `ContextPayload` | n/a (tool calls only) |
| `hazard_agent` | `HazardAssessment` | `local_rules.hazard_assessment` |
| `damage_agent` | `DamageAssessment` | `local_rules.damage_assessment` |
| `risk_agent` | `RiskAssessment` | `local_rules.risk_assessment` |
| `precaution_agent` | `PrecautionSet` | `local_rules.precaution_set` |
| `response_agent` | `ResponsePlan` | `local_rules.response_plan` |
| `resource_agent` | `ResourceAssessment` | none — always `RESOURCE_DATA_UNAVAILABLE` (removed — see "Resource Agent removed" below) |
| `safety_validator` | validated findings on state | n/a |
| `command_synthesizer` | `CommandBrief` | `local_rules.situation_narrative` |

See "The graph today" further down for the current, live topology (`evidence_retrieval` added by Prompt 16,
`resource_agent` removed after it).

`ImpactAnalysis` / `TacticalPlan` remain as composite views the validator writes back to state, so anything
reading the pre-Prompt-15 shapes still works.

**Fail-safe partial runs.** A Tier 1/Tier 2 agent that raises is recorded `FAILED` with an `AGENT_FAILED`
`DataLimitation`; the graph continues and the brief loses only that section. A bug inside a node (not a
provider error) still ends the run as `FAILED` with the error persisted.

**Conditional routing.** No current frame (run not completed, frame out of range) routes straight to the
validator: the brief states the limitation and no LLM call is spent.

### Pacing, caching and staleness

Client policy lives in one file, `frontend/src/features/command-center/ai/analysisScheduler.ts`:

| Trigger | Behaviour |
|---|---|
| `playback` | at most one analysis per `AI_UPDATE_INTERVAL_MS` (5 s); requests in between coalesce to the newest frame |
| `scrub` | debounced `AI_SCRUB_DEBOUNCE_MS` (600 ms) — runs only once the playhead settles |
| `paused`, `complete`, `manual` | immediately, on the frame on screen |

Cache key: `(scenario_version_id, simulation_run_id, frame_index)`. The whole cache is dropped when the scope
(`scenario_id` + `scenario_version_id` + `simulation_run_id`) changes. A response is discarded when its scope
has changed (`scope-changed`) or a newer frame's request has already started (`superseded`) — never rendered
over the frame on screen. The server enforces the same contract: `POST /ai/analyze-frame` with a
`scenario_version_id` the run was not produced from answers `409 {"code": "AI_ANALYSIS_STALE"}`.

Because a recorded run is immutable, the target version is the **run's** `scenario_version_id` — editing
parameters afterwards does not invalidate briefs about an already-recorded run.

### Events (`/ws/ai`)

One socket per session, authenticated with the Firebase ID token as the `token` query parameter (a browser
cannot set an Authorization header on a WebSocket) and verified by the same verifier as every HTTP route.
`AIEventBus` fans out per verified uid, in-process, best effort — a full subscriber queue drops events rather
than stalling the analysis.

`AI_EVENTS_READY`, `AI_ANALYSIS_STARTED`, `AGENT_STARTED`, `AGENT_COMPLETED`, `AI_ANALYSIS_COMPLETED`,
`AI_ANALYSIS_FAILED`, `AI_ANALYSIS_STALE`, `heartbeat`. Events carry ids, agent name, status, a one-line
factual summary and durations — never prompt text, keys or chain-of-thought. The Command Brief always arrives
over HTTP, so a dropped socket costs liveness only.

*Known limitation:* the bus is in-process, so it assumes one uvicorn worker. Multi-worker deployment needs a
real broker.

### UI mount points

| Surface | File |
|---|---|
| Orchestration hook (pacing, cache, live chips) | `features/command-center/ai/useAIOrchestrator.ts` |
| Event socket | `features/command-center/ai/useAIEvents.ts` |
| Chip roster (mirrors `AGENT_LABELS`) | `features/command-center/ai/agentRoster.ts` |
| Agent Execution HUD | `features/command-center/components/AgentExecutionHud.tsx` (left rail) |
| Structured intelligence panel | `features/command-center/components/IntelligencePanel.tsx` (right rail) |
| Mount | `features/command-center/CommandCenterPage.tsx` |

The HUD groups its chips with `AGENT_STAGES` / `byStage` (`ai/agentRoster.ts`), which mirror the graph's
supersteps, so the branches that execute in tandem are drawn as one stage marked `‖ in tandem` rather than a
flat queue. Statuses still come only from the backend.

No chatbot surface, no sparkle icons: both are ordinary HUD panels using the existing design tokens.
`CommandBriefPanel.tsx` (Prompt 14) is superseded and removed.

### Tests

- `agents/tests/test_graph_routing.py` — topology, parallel tiers, conditional skip, per-tier partial failure,
  agent-run records, event emission, frame-context isolation.
- `backend/tests/api/test_ai_analysis.py` — `analyze-frame` trigger/version recording, `409` stale rejection,
  per-frame evidence isolation, `/ws/ai` milestone stream.
- `backend/tests/test_ai_events.py` — bus isolation, no-subscriber no-op, bounded queue (no DB needed).
- `frontend/src/features/command-center/ai/analysisScheduler.test.ts` — debounce, throttle, cache hits and
  eviction, stale/superseded discard.
- `frontend/src/features/command-center/components/IntelligencePanel.test.tsx` — unexposed → potentially
  exposed transition, placeholders for missing values, agent chip statuses.


---

## Prompt 16 — RAG-grounded Precaution/Response citations

The graph gains one node, `evidence_retrieval`, between Tier 1 and Tier 2 (see docs/rag/pipeline.md for the
full pipeline). It produces one role-scoped `EvidencePack` each for the Precaution and Response agents;
either may cite a retrieved `EvidenceItem.evidence_id` in its `citations`, verified by
`SafetyValidator.validate_citations` against the pack the node actually received — the same evidence-gate
discipline `evidence_ids` already had, extended to authoritative-source citations.

`CommandBrief` gains `evidence_citations` (every citation actually resolved, deduped) and `claim_mappings`
(an audit record per kept claim: `claim_type` OBSERVED/CALCULATED/EVIDENCE_GROUNDED/RECOMMENDED,
`validation_status`). `RecommendedAction.citations` is separate from `evidence_ids` — one for authoritative
guidance, one for simulation facts; neither can stand in for the other (`RAG_GUARDRAILS`,
agents/prompts/versions.py).

`RAG_PROVIDER=none` (default) keeps every Prompt 14/15 behaviour and test byte-for-byte unchanged:
`NotConfiguredEvidenceRetriever` still returns the same `NOT_CONFIGURED` posture, now as a
`regulatory_evidence:<role>` `DataLimitation` (role-scoped — was a single unscoped `regulatory_evidence`
subject before Prompt 16). `RAG_PROVIDER=chroma` switches on the real `HybridRetriever`.

`IntelligencePanel` shows a small book-icon badge on a cited action (tooltip: authority, title, section/page)
and lists every resolved citation with trust level in the audit block ("Sources cited").

Tests: `agents/tests/test_rag_integration.py` (8, incl. one real end-to-end run against the actual
`ChromaVectorStore`), `backend/tests/api/test_rag.py` (11), `backend/tests/test_rag_ingestion_service.py`
(7), `rag/tests/` (25), plus the extended `test_analyze_frame_carries_real_rag_citations_end_to_end` in
`backend/tests/api/test_ai_analysis.py`. Full detail: docs/rag/pipeline.md.

## Resource Agent removed

`resource_agent` never did anything but stamp `RESOURCE_DATA_UNAVAILABLE` — no verified resource inventory
exists to back it (still true; see "Known data limitations" above), and it added a permanently-UNAVAILABLE
chip to the HUD with no way for it to ever read otherwise. Removed as a graph node, an
`AquaShieldAgentState` field, an `AGENT_LABELS`/`AGENT_ROSTER` entry and a frontend HUD stage.
`RecommendedAction.resources` and `CommandBrief.resource_status` still read `RESOURCE_DATA_UNAVAILABLE`
directly (`agents/schemas/evidence.py`'s `RESOURCE_DATA_UNAVAILABLE` constant, stamped in
`agents/llm/local_rules.py` and `agents/agents/command/synthesis.py`) — that honesty guarantee (CLAUDE.md
§26a) does not depend on a dedicated node to exist. `AGENT_VERSIONS["resource_agent"]` is kept so an
`ai_requests` row recorded before the removal still resolves. `PROMPT_VERSION` bumped to `2026-09-12.4`.

### The graph today (9 nodes)

```
START → context_collector
          ├─ (conditional) no analysable frame → safety_validator
          └─ hazard_agent ‖ damage_agent ‖ risk_agent      (Tier 1, one superstep)
                 └─ evidence_retrieval                     (role-scoped RAG; see Prompt 16 above)
                        └─ precaution_agent ‖ response_agent  (Tier 2, one superstep)
                               └─ safety_validator → command_synthesizer → END
```
