from agents.graph.workflow.graph import AnalysisRequest, GraphDeps, build_graph, run_analysis
from agents.llm.provider import LLMProviderError, LocalDeterministicProvider
from agents.schemas.brief import CommandBrief
from agents.tests.conftest import FakeDataAccess


def _run(data, **kw):
    return run_analysis(GraphDeps(data=data), AnalysisRequest(request_id="req", scenario_id="scn", simulation_run_id="run", frame_index=kw.pop("frame_index", 4), **kw))


def test_graph_topology_matches_spec(fake_data):
    compiled = build_graph(GraphDeps(data=fake_data))
    g = compiled.get_graph()
    edges = {(e.source, e.target) for e in g.edges}
    assert ("__start__", "context_collector") in edges
    assert ("context_collector", "impact_analyst") in edges
    assert ("context_collector", "tactical_advisor") in edges
    assert ("impact_analyst", "synthesis_safety") in edges
    assert ("tactical_advisor", "synthesis_safety") in edges
    assert ("synthesis_safety", "__end__") in edges
    # Agents 2 and 3 never depend on each other.
    assert ("impact_analyst", "tactical_advisor") not in edges and ("tactical_advisor", "impact_analyst") not in edges


def test_full_run_completes_with_grounded_brief(fake_data):
    result = _run(fake_data)
    state = result.state
    assert state.status == "COMPLETED"
    assert isinstance(state.command_brief, CommandBrief)
    brief = state.command_brief
    assert brief.human_review_required is True
    assert brief.frame_index == 4 and brief.simulation_run_id == "run"
    # Both parallel agents ran and the join merged their tool records.
    tools = [t.tool for t in state.tools_called]
    assert "llm:local:impact_analysis" in tools and "llm:local:tactical_plan" in tools
    assert tools.index("get_scenario") < tools.index("llm:local:situation_narrative")
    # Bounded queries: a 3-frame window, never the whole timeline.
    assert ("get_frames", ("run", 4, 1)) in fake_data.calls
    # Every claim cites known evidence.
    known = {e.id for e in brief.evidence_references}
    for s in brief.hazard_progression:
        assert s.evidence_ids and set(s.evidence_ids) <= known
    for x in brief.key_exposures:
        assert set(x.evidence_ids) <= known and x.claim_kind in {"observed_simulation_fact", "spatial_exposure"}
    for a in brief.recommended_actions:
        assert a.requires_human_approval is True
        assert a.resources == "RESOURCE_DATA_UNAVAILABLE"
        assert a.prerequisites is not None and a.risks
        assert set(a.evidence_ids) <= known
    assert any(p.subject == "Harbour" and p.level == "HIGH" for p in brief.priorities)
    assert all(v for v in state.agent_versions.values())
    assert state.agent_versions["prompt_version"]


def test_asset_exposure_is_reported_as_spatial_not_observed():
    data = FakeDataAccess(exposure_quality="available")
    brief = _run(data).state.command_brief
    clinic = next(x for x in brief.key_exposures if x.subject == "Coastal Clinic")
    assert clinic.claim_kind == "spatial_exposure"
    assert "potentially exposed" in clinic.statement
    assert "destroy" not in clinic.statement
    assert any(p.subject == "Coastal Clinic" and p.level == "CRITICAL" for p in brief.priorities)


def test_agent_failure_degrades_to_limitation_not_crash(fake_data):
    class FlakyProvider(LocalDeterministicProvider):
        def generate(self, *, task, system, payload, output_model):
            if task == "impact_analysis":
                raise LLMProviderError("simulated provider outage")
            return super().generate(task=task, system=system, payload=payload, output_model=output_model)

    result = run_analysis(GraphDeps(data=fake_data, provider=FlakyProvider()), AnalysisRequest(request_id="r", scenario_id="scn", simulation_run_id="run", frame_index=4))
    state = result.state
    assert state.status == "COMPLETED"
    assert any("impact_analyst" in e for e in state.errors)
    brief = state.command_brief
    assert brief.hazard_progression == [] and brief.key_exposures == []
    assert any(l.code == "AGENT_FAILED" and l.subject == "impact_analysis" for l in brief.data_limitations)
    assert brief.recommended_actions  # the tactical branch still delivered


def test_bug_in_node_marks_failed(fake_data):
    class Broken(LocalDeterministicProvider):
        def generate(self, *, task, system, payload, output_model):
            raise TypeError("programming error inside a node")

    result = run_analysis(GraphDeps(data=fake_data, provider=Broken()), AnalysisRequest(request_id="r", scenario_id="scn", simulation_run_id="run", frame_index=4))
    assert result.state.status == "FAILED"
    assert result.state.errors
