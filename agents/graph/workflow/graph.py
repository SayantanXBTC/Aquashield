"""The AQUASHIELD analysis graph (Prompt 15).

    START
      |
      v
    context_collector                       (read-only bounded frame slice)
      |
      +--> hazard_agent  --+
      +--> damage_agent  --+                (Tier 1, one superstep)
      +--> risk_agent    --+
                           |
              +------------+------------+
              v                         v
        precaution_agent          response_agent   (Tier 2, one superstep)
              +------------+------------+
                           v
                     resource_agent       (RESOURCE_DATA_UNAVAILABLE today)
                           v
                    safety_validator      (evidence gate — strips, never invents)
                           v
                   command_synthesizer    (the Command Brief)
                           v
                         END

Built with LangGraph's StateGraph over `AquaShieldAgentState`. Fan-out is a
set of unconditional edges, so the agents in a tier execute in the same
superstep; a join node with several incoming edges runs once every branch
has written its state.

Two properties the rest of the system depends on:

* **Conditional routing.** When the Context Collector finds no analysable
  frame (run not completed, frame out of range), the analysis tiers are
  skipped entirely and the graph routes straight to the validator — the
  brief still builds, stating the limitation, and no LLM call is billed for
  a frame with nothing in it.
* **Fail-safe partial runs.** A non-critical agent that raises is recorded
  as FAILED with a DataLimitation; the graph continues and the Command Brief
  loses only that agent's section.

Dependencies (data access, LLM provider, evidence retriever, event sink) are
injected via `GraphDeps`, so the same graph runs against the backend's
PostGIS-backed services in production and against in-memory fakes in tests.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Callable, Protocol

from langgraph.graph import END, START, StateGraph

from agents.agents.command import synthesis
from agents.agents.hazard import hazard_agent
from agents.agents.resource import resource_agent
from agents.agents.state_evaluator.context_collector import ContextCollector
from agents.agents.tactical import precaution_agent, response_agent
from agents.agents.vulnerability import damage_agent, risk_agent
from agents.llm.provider import LLMProvider, LLMProviderError, LocalDeterministicProvider
from agents.prompts.versions import AGENT_LABELS, AGENT_ORDER, AGENT_VERSIONS, PROMPT_VERSION
from agents.schemas.brief import AgentRun
from agents.schemas.context import ContextPayload
from agents.schemas.evidence import DataLimitation
from agents.schemas.outputs import ImpactAnalysis, TacticalPlan
from agents.schemas.state import AquaShieldAgentState, ToolCallRecord
from agents.tools.data_access import AnalysisDataAccess
from agents.tools.retrieval.evidence_retriever import EvidenceRetriever, NotConfiguredEvidenceRetriever


class EventSink(Protocol):
    """How a node reports a milestone. The backend pushes these to the
    command center over the AI event socket; tests collect them in a list.
    Never carries prompt text or chain-of-thought — agent name, status and a
    one-line factual summary only."""

    def __call__(self, event: str, data: dict[str, Any]) -> None: ...


def _no_events(event: str, data: dict[str, Any]) -> None:
    return None


@dataclass
class GraphDeps:
    data: AnalysisDataAccess
    provider: LLMProvider = field(default_factory=LocalDeterministicProvider)
    retriever: EvidenceRetriever = field(default_factory=NotConfiguredEvidenceRetriever)
    emit: EventSink = _no_events


def _run_record(agent: str, status: str, summary: str | None, started: float) -> AgentRun:
    return AgentRun(agent=agent, label=AGENT_LABELS[agent], status=status, summary=summary, duration_ms=round((time.perf_counter() - started) * 1000, 3))


def _started(deps: GraphDeps, agent: str, state: AquaShieldAgentState) -> float:
    deps.emit("AGENT_STARTED", {"agent_name": agent, "label": AGENT_LABELS[agent], "frame_index": state.frame_index})
    return time.perf_counter()


def _completed(deps: GraphDeps, record: AgentRun) -> AgentRun:
    deps.emit(
        "AGENT_COMPLETED",
        {"agent_name": record.agent, "label": record.label, "status": record.status, "summary": record.summary, "duration_ms": record.duration_ms},
    )
    return record


# --- Agent 1 ----------------------------------------------------------------


def _context_collector_node(deps: GraphDeps):
    def node(state: AquaShieldAgentState) -> dict[str, Any]:
        agent = "context_collector"
        started = _started(deps, agent, state)
        collector = ContextCollector(deps.data)
        payload, tools, injection_detected = collector.collect(
            scenario_id=state.scenario_id,
            simulation_run_id=state.simulation_run_id,
            frame_index=state.frame_index,
            user_question=state.user_question_raw,
        )
        uncertainties: list[str] = []
        if injection_detected:
            uncertainties.append("Operator question contained instruction-like text; it was neutralised and treated as data only.")
        summary = f"{len(payload.evidence)} evidence item(s), {len(payload.structures)} structure(s), {len(payload.asset_exposures)} asset exposure record(s)"
        return {
            "context": payload,
            "tools_called": tools.calls,
            "uncertainties": uncertainties,
            "agent_versions": {agent: AGENT_VERSIONS[agent], "prompt_version": PROMPT_VERSION},
            "agent_runs": [_completed(deps, _run_record(agent, "COMPLETED", summary, started))],
            "status": "RUNNING",
        }

    return node


# --- Tier 1 / Tier 2 agents -------------------------------------------------


def _analysis_node(
    deps: GraphDeps,
    *,
    agent: str,
    task: str,
    state_field: str,
    call: Callable[[ContextPayload, AquaShieldAgentState], Any],
    summarize: Callable[[Any], str],
):
    """One specialised agent node. Every one of them behaves identically on
    failure: record the error as a DataLimitation, mark the node FAILED and
    let the graph continue (fail-safe partial run)."""

    def node(state: AquaShieldAgentState) -> dict[str, Any]:
        started = _started(deps, agent, state)
        versions = {agent: AGENT_VERSIONS[agent]}
        if state.context is None:
            record = _completed(deps, _run_record(agent, "FAILED", "no context collected", started))
            return {"errors": [f"{agent}: no context"], "agent_versions": versions, "agent_runs": [record]}
        tool = f"llm:{deps.provider.name}:{task}"
        try:
            output = call(state.context, state)
        except (LLMProviderError, ValueError) as exc:
            duration = round((time.perf_counter() - started) * 1000, 3)
            record = _completed(deps, _run_record(agent, "FAILED", str(exc)[:200], started))
            return {
                "tools_called": [ToolCallRecord(agent=agent, tool=tool, ok=False, duration_ms=duration, note=str(exc)[:200])],
                "errors": [f"{agent}: {exc}"],
                "limitations": [DataLimitation(code="AGENT_FAILED", subject=state_field, detail=str(exc)[:200])],
                "agent_versions": versions,
                "agent_runs": [record],
            }
        duration = round((time.perf_counter() - started) * 1000, 3)
        record = _completed(deps, _run_record(agent, "COMPLETED", summarize(output), started))
        return {
            state_field: output,
            "tools_called": [ToolCallRecord(agent=agent, tool=tool, ok=True, duration_ms=duration)],
            "agent_versions": versions,
            "agent_runs": [record],
        }

    return node


def _tier1_findings(state: AquaShieldAgentState) -> dict[str, Any]:
    """What Tier 2 is allowed to see: the Tier 1 outputs, nothing more."""

    return {
        "hazard": state.hazard_assessment.model_dump(mode="json") if state.hazard_assessment else None,
        "damage": state.damage_assessment.model_dump(mode="json") if state.damage_assessment else None,
        "risk": state.risk_assessment.model_dump(mode="json") if state.risk_assessment else None,
    }


# --- Tier 3: resources ------------------------------------------------------


def _resource_node(deps: GraphDeps):
    def node(state: AquaShieldAgentState) -> dict[str, Any]:
        agent = "resource_agent"
        started = _started(deps, agent, state)
        versions = {agent: AGENT_VERSIONS[agent]}
        if state.context is None or not resource_agent.has_resource_inventory(state.context):
            # No verified inventory exists — the node reports the gap rather
            # than estimating one (CLAUDE.md §26a).
            assessment, limitation = resource_agent.assess_resources(state.context) if state.context else (None, DataLimitation(code="RESOURCE_DATA_UNAVAILABLE", subject="resource_inventory", detail=resource_agent.NOTE))
            record = _completed(deps, _run_record(agent, "UNAVAILABLE", resource_agent.NOTE, started))
            out: dict[str, Any] = {"limitations": [limitation], "agent_versions": versions, "agent_runs": [record]}
            if assessment is not None:
                out["resource_assessment"] = assessment
            return out
        assessment, limitation = resource_agent.assess_resources(state.context)
        record = _completed(deps, _run_record(agent, "COMPLETED", assessment.note, started))
        return {"resource_assessment": assessment, "limitations": [limitation], "agent_versions": versions, "agent_runs": [record]}

    return node


# --- Safety Validator and Command Synthesizer -------------------------------


def _safety_validator_node(deps: GraphDeps):
    def node(state: AquaShieldAgentState) -> dict[str, Any]:
        agent = "safety_validator"
        started = _started(deps, agent, state)
        versions = {agent: AGENT_VERSIONS[agent]}
        if state.context is None:
            record = _completed(deps, _run_record(agent, "FAILED", "no context collected", started))
            return {"status": "FAILED", "errors": ["safety_validator: no context"], "agent_versions": versions, "agent_runs": [record]}
        findings = synthesis.validate_findings(
            state.context,
            hazard=state.hazard_assessment,
            damage=state.damage_assessment,
            risk=state.risk_assessment,
            precautions=state.precaution_set,
            response=state.response_plan,
        )
        stripped = sum(1 for n in findings.notes if n.startswith("stripped"))
        summary = f"{len(findings.progression)} statement(s), {len(findings.exposures)} exposure(s), {len(findings.priorities)} priority(ies), {len(findings.precautions) + len(findings.actions)} action(s) kept; {stripped} claim(s) stripped"
        record = _completed(deps, _run_record(agent, "COMPLETED", summary, started))
        return {
            "validated_progression": findings.progression,
            "validated_exposures": findings.exposures,
            "validated_priorities": findings.priorities,
            "validated_precautions": findings.precautions,
            "validated_actions": findings.actions,
            "hazard_trend": findings.trend,
            "validation_notes": findings.notes,
            "uncertainties": findings.uncertainties,
            # Legacy composite views, so anything still reading the
            # pre-Prompt-15 shapes sees the validated findings.
            "impact_analysis": ImpactAnalysis(
                hazard_progression={"trend": findings.trend, "statements": findings.progression},
                exposures=findings.exposures,
                uncertainties=findings.uncertainties,
            ),
            "tactical_plan": TacticalPlan(priorities=findings.priorities, actions=[*findings.precautions, *findings.actions], uncertainties=findings.uncertainties),
            "agent_versions": versions,
            "agent_runs": [record],
        }

    return node


def _command_synthesizer_node(deps: GraphDeps):
    def node(state: AquaShieldAgentState) -> dict[str, Any]:
        agent = "command_synthesizer"
        started = _started(deps, agent, state)
        versions = {agent: AGENT_VERSIONS[agent]}
        if state.context is None:
            record = _completed(deps, _run_record(agent, "FAILED", "no context collected", started))
            return {"status": "FAILED", "errors": ["command_synthesizer: no context"], "agent_versions": versions, "agent_runs": [record]}
        findings = synthesis.ValidatedFindings(
            trend=state.hazard_trend,
            progression=list(state.validated_progression),
            exposures=list(state.validated_exposures),
            priorities=list(state.validated_priorities),
            precautions=list(state.validated_precautions),
            actions=list(state.validated_actions),
            notes=list(state.validation_notes),
            uncertainties=list(state.uncertainties),
        )
        # The HUD's chip row: every node that ran, plus this one, in graph order.
        runs = sorted(state.agent_runs, key=lambda r: AGENT_ORDER.index(r.agent) if r.agent in AGENT_ORDER else len(AGENT_ORDER))
        brief = synthesis.build_command_brief(
            provider=deps.provider,
            context=state.context,
            findings=findings,
            retriever=deps.retriever,
            resource=state.resource_assessment,
            agent_runs=[*runs, AgentRun(agent=agent, label=AGENT_LABELS[agent], status="COMPLETED", summary="Command Brief assembled")],
            extra_uncertainties=[],
            extra_limitations=list(state.limitations),
        )
        record = _completed(deps, _run_record(agent, "COMPLETED", "Command Brief assembled", started))
        return {
            "command_brief": brief,
            "tools_called": [ToolCallRecord(agent=agent, tool=f"llm:{deps.provider.name}:{synthesis.TASK}", ok=True, duration_ms=record.duration_ms)],
            "status": "COMPLETED",
            "agent_versions": versions,
            "agent_runs": [record],
        }

    return node


# --- Conditional routing ----------------------------------------------------

TIER_1 = ["hazard_agent", "damage_agent", "risk_agent"]


def _route_after_context(state: AquaShieldAgentState) -> list[str]:
    """No analysable frame => skip the analysis tiers entirely. The brief
    still builds and states the limitation; no LLM call is spent on a frame
    with no data in it."""

    if state.context is None or state.context.current_frame is None:
        return ["safety_validator"]
    return list(TIER_1)


def build_graph(deps: GraphDeps):
    graph = StateGraph(AquaShieldAgentState)
    graph.add_node("context_collector", _context_collector_node(deps))
    graph.add_node(
        "hazard_agent",
        _analysis_node(
            deps,
            agent="hazard_agent",
            task=hazard_agent.TASK,
            state_field="hazard_assessment",
            call=lambda context, _state: hazard_agent.assess_hazard(deps.provider, context),
            summarize=lambda out: f"trend {out.hazard_progression.trend}, {len(out.hazard_progression.statements)} statement(s)",
        ),
    )
    graph.add_node(
        "damage_agent",
        _analysis_node(
            deps,
            agent="damage_agent",
            task=damage_agent.TASK,
            state_field="damage_assessment",
            call=lambda context, _state: damage_agent.assess_damage(deps.provider, context),
            summarize=lambda out: f"{len(out.exposures)} potentially exposed subject(s)",
        ),
    )
    graph.add_node(
        "risk_agent",
        _analysis_node(
            deps,
            agent="risk_agent",
            task=risk_agent.TASK,
            state_field="risk_assessment",
            call=lambda context, _state: risk_agent.assess_risk(deps.provider, context),
            summarize=lambda out: f"{len(out.priorities)} ranked priority(ies)",
        ),
    )
    graph.add_node(
        "precaution_agent",
        _analysis_node(
            deps,
            agent="precaution_agent",
            task=precaution_agent.TASK,
            state_field="precaution_set",
            call=lambda context, state: precaution_agent.advise_precautions(deps.provider, context, _tier1_findings(state)),
            summarize=lambda out: f"{len(out.precautions)} precaution(s)",
        ),
    )
    graph.add_node(
        "response_agent",
        _analysis_node(
            deps,
            agent="response_agent",
            task=response_agent.TASK,
            state_field="response_plan",
            call=lambda context, state: response_agent.plan_response(deps.provider, context, _tier1_findings(state)),
            summarize=lambda out: f"{len(out.actions)} targeted action(s)",
        ),
    )
    graph.add_node("resource_agent", _resource_node(deps))
    graph.add_node("safety_validator", _safety_validator_node(deps))
    graph.add_node("command_synthesizer", _command_synthesizer_node(deps))

    graph.add_edge(START, "context_collector")
    graph.add_conditional_edges("context_collector", _route_after_context, [*TIER_1, "safety_validator"])
    for tier1 in TIER_1:
        graph.add_edge(tier1, "precaution_agent")
        graph.add_edge(tier1, "response_agent")
    graph.add_edge("precaution_agent", "resource_agent")
    graph.add_edge("response_agent", "resource_agent")
    graph.add_edge("resource_agent", "safety_validator")
    graph.add_edge("safety_validator", "command_synthesizer")
    graph.add_edge("command_synthesizer", END)
    return graph.compile()


@dataclass(frozen=True)
class AnalysisRequest:
    request_id: str
    scenario_id: str
    simulation_run_id: str
    frame_index: int
    user_question: str | None = None


@dataclass
class AnalysisResult:
    state: AquaShieldAgentState
    execution_ms: float
    provider: str
    model: str
    prompt_version: str = PROMPT_VERSION


def run_analysis(deps: GraphDeps, request: AnalysisRequest) -> AnalysisResult:
    """Runs the graph to completion. Never raises for data problems (those
    become limitations); a genuine bug surfaces as status FAILED with the
    error recorded, so the caller can persist it."""
    compiled = build_graph(deps)
    initial = AquaShieldAgentState(
        request_id=request.request_id,
        scenario_id=request.scenario_id,
        simulation_run_id=request.simulation_run_id,
        frame_index=request.frame_index,
        user_question_raw=request.user_question,
        status="RUNNING",
    )
    started = time.perf_counter()
    deps.emit("AI_ANALYSIS_STARTED", {"request_id": request.request_id, "frame_index": request.frame_index, "simulation_run_id": request.simulation_run_id})
    try:
        raw = compiled.invoke(initial)
        final = AquaShieldAgentState.model_validate(raw) if isinstance(raw, dict) else raw
    except Exception as exc:  # a bug in a node — fail loudly but structured
        final = initial.model_copy(update={"status": "FAILED", "errors": [f"{type(exc).__name__}: {exc}"[:300]]})
    execution_ms = round((time.perf_counter() - started) * 1000, 3)
    return AnalysisResult(state=final, execution_ms=execution_ms, provider=deps.provider.name, model=deps.provider.model)
