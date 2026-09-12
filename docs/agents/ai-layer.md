# AI Intelligence Layer (Prompt 14)

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
- No regulatory knowledge base: `NOT_CONFIGURED: regulatory_evidence` on every brief.
- No resource inventory: every action's `resources` is `RESOURCE_DATA_UNAVAILABLE`.
- Structure exposure bands and all hazard values come from SIMPLIFIED DEMONSTRATION MODELS.
