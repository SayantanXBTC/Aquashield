"""The AQUASHIELD analysis graph.

    START -> context_collector -> (impact_analyst || tactical_advisor) -> synthesis_safety -> END

Built with LangGraph's StateGraph over `AquaShieldAgentState`. The fan-out
after Agent 1 is two unconditional edges, so Agents 2 and 3 execute in the
same superstep (in parallel); the join is a node with two incoming edges,
which LangGraph runs once both branches have written their state.

Dependencies (data access, LLM provider, evidence retriever) are injected via
`GraphDeps` so the same graph runs against the backend's PostGIS-backed
services in production and against in-memory fakes in tests.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

from langgraph.graph import END, START, StateGraph

from agents.agents.command import synthesis
from agents.agents.state_evaluator.context_collector import ContextCollector
from agents.agents.tactical import tactical_advisor
from agents.agents.vulnerability import impact_analyst
from agents.llm.provider import LLMProvider, LLMProviderError, LocalDeterministicProvider
from agents.prompts.versions import AGENT_VERSIONS, PROMPT_VERSION
from agents.schemas.evidence import DataLimitation
from agents.schemas.state import AquaShieldAgentState, ToolCallRecord
from agents.tools.data_access import AnalysisDataAccess
from agents.tools.retrieval.evidence_retriever import EvidenceRetriever, NotConfiguredEvidenceRetriever


@dataclass
class GraphDeps:
    data: AnalysisDataAccess
    provider: LLMProvider = field(default_factory=LocalDeterministicProvider)
    retriever: EvidenceRetriever = field(default_factory=NotConfiguredEvidenceRetriever)


def _context_collector_node(deps: GraphDeps):
    def node(state: AquaShieldAgentState) -> dict[str, Any]:
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
        return {
            "context": payload,
            "tools_called": tools.calls,
            "uncertainties": uncertainties,
            "agent_versions": {"context_collector": AGENT_VERSIONS["context_collector"], "prompt_version": PROMPT_VERSION},
            "status": "RUNNING",
        }

    return node


def _impact_analyst_node(deps: GraphDeps):
    def node(state: AquaShieldAgentState) -> dict[str, Any]:
        started = time.perf_counter()
        if state.context is None:
            return {"errors": ["impact_analyst: no context"], "agent_versions": {"impact_analyst": AGENT_VERSIONS["impact_analyst"]}}
        try:
            analysis = impact_analyst.analyze_impact(deps.provider, state.context)
            record = ToolCallRecord(agent=impact_analyst.AGENT_NAME, tool=f"llm:{deps.provider.name}:{impact_analyst.TASK}", ok=True, duration_ms=round((time.perf_counter() - started) * 1000, 3))
            return {"impact_analysis": analysis, "tools_called": [record], "agent_versions": {"impact_analyst": AGENT_VERSIONS["impact_analyst"]}}
        except (LLMProviderError, ValueError) as exc:
            record = ToolCallRecord(agent=impact_analyst.AGENT_NAME, tool=f"llm:{deps.provider.name}:{impact_analyst.TASK}", ok=False, duration_ms=round((time.perf_counter() - started) * 1000, 3), note=str(exc)[:200])
            return {
                "tools_called": [record],
                "errors": [f"impact_analyst: {exc}"],
                "limitations": [DataLimitation(code="AGENT_FAILED", subject="impact_analysis", detail=str(exc)[:200])],
                "agent_versions": {"impact_analyst": AGENT_VERSIONS["impact_analyst"]},
            }

    return node


def _tactical_advisor_node(deps: GraphDeps):
    def node(state: AquaShieldAgentState) -> dict[str, Any]:
        started = time.perf_counter()
        if state.context is None:
            return {"errors": ["tactical_advisor: no context"], "agent_versions": {"tactical_advisor": AGENT_VERSIONS["tactical_advisor"]}}
        try:
            plan = tactical_advisor.advise(deps.provider, state.context)
            record = ToolCallRecord(agent=tactical_advisor.AGENT_NAME, tool=f"llm:{deps.provider.name}:{tactical_advisor.TASK}", ok=True, duration_ms=round((time.perf_counter() - started) * 1000, 3))
            return {"tactical_plan": plan, "tools_called": [record], "agent_versions": {"tactical_advisor": AGENT_VERSIONS["tactical_advisor"]}}
        except (LLMProviderError, ValueError) as exc:
            record = ToolCallRecord(agent=tactical_advisor.AGENT_NAME, tool=f"llm:{deps.provider.name}:{tactical_advisor.TASK}", ok=False, duration_ms=round((time.perf_counter() - started) * 1000, 3), note=str(exc)[:200])
            return {
                "tools_called": [record],
                "errors": [f"tactical_advisor: {exc}"],
                "limitations": [DataLimitation(code="AGENT_FAILED", subject="tactical_plan", detail=str(exc)[:200])],
                "agent_versions": {"tactical_advisor": AGENT_VERSIONS["tactical_advisor"]},
            }

    return node


def _synthesis_node(deps: GraphDeps):
    def node(state: AquaShieldAgentState) -> dict[str, Any]:
        started = time.perf_counter()
        if state.context is None:
            return {"status": "FAILED", "errors": ["synthesis: no context"], "agent_versions": {"synthesis_safety": AGENT_VERSIONS["synthesis_safety"]}}
        brief = synthesis.synthesize(
            provider=deps.provider,
            context=state.context,
            impact=state.impact_analysis,
            plan=state.tactical_plan,
            retriever=deps.retriever,
            extra_uncertainties=list(state.uncertainties),
            extra_limitations=list(state.limitations),
        )
        record = ToolCallRecord(agent=synthesis.AGENT_NAME, tool=f"llm:{deps.provider.name}:{synthesis.TASK}", ok=True, duration_ms=round((time.perf_counter() - started) * 1000, 3))
        return {"command_brief": brief, "tools_called": [record], "status": "COMPLETED", "agent_versions": {"synthesis_safety": AGENT_VERSIONS["synthesis_safety"]}}

    return node


def build_graph(deps: GraphDeps):
    graph = StateGraph(AquaShieldAgentState)
    graph.add_node("context_collector", _context_collector_node(deps))
    graph.add_node("impact_analyst", _impact_analyst_node(deps))
    graph.add_node("tactical_advisor", _tactical_advisor_node(deps))
    graph.add_node("synthesis_safety", _synthesis_node(deps))
    graph.add_edge(START, "context_collector")
    graph.add_edge("context_collector", "impact_analyst")
    graph.add_edge("context_collector", "tactical_advisor")
    graph.add_edge("impact_analyst", "synthesis_safety")
    graph.add_edge("tactical_advisor", "synthesis_safety")
    graph.add_edge("synthesis_safety", END)
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
    try:
        raw = compiled.invoke(initial)
        final = AquaShieldAgentState.model_validate(raw) if isinstance(raw, dict) else raw
    except Exception as exc:  # a bug in a node — fail loudly but structured
        final = initial.model_copy(update={"status": "FAILED", "errors": [f"{type(exc).__name__}: {exc}"[:300]]})
    execution_ms = round((time.perf_counter() - started) * 1000, 3)
    return AnalysisResult(state=final, execution_ms=execution_ms, provider=deps.provider.name, model=deps.provider.model)
