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
    tier1 = ("hazard_agent", "damage_agent", "risk_agent")
    assert ("__start__", "context_collector") in edges
    for agent in tier1:
        assert ("context_collector", agent) in edges
        assert (agent, "evidence_retrieval") in edges
    assert ("evidence_retrieval", "precaution_agent") in edges
    assert ("evidence_retrieval", "response_agent") in edges
    assert ("precaution_agent", "resource_agent") in edges
    assert ("response_agent", "resource_agent") in edges
    assert ("resource_agent", "safety_validator") in edges
    assert ("safety_validator", "command_synthesizer") in edges
    assert ("command_synthesizer", "__end__") in edges
    # Agents within a tier never depend on each other.
    for a in tier1:
        for b in tier1:
            assert a == b or (a, b) not in edges
    assert ("precaution_agent", "response_agent") not in edges and ("response_agent", "precaution_agent") not in edges
    # Tier 1 never reaches Tier 2 directly — retrieval always sits between them.
    for a in tier1:
        assert (a, "precaution_agent") not in edges and (a, "response_agent") not in edges
    # Conditional routing: the validator is reachable straight from the
    # collector when there is no frame to analyse (evidence_retrieval is
    # skipped too — no LLM call, no retrieval, for an empty frame).
    assert ("context_collector", "safety_validator") in edges


def test_full_run_completes_with_grounded_brief(fake_data):
    result = _run(fake_data)
    state = result.state
    assert state.status == "COMPLETED"
    assert isinstance(state.command_brief, CommandBrief)
    brief = state.command_brief
    assert brief.human_review_required is True
    assert brief.frame_index == 4 and brief.simulation_run_id == "run"
    # Every specialised agent ran and the joins merged their tool records.
    tools = [t.tool for t in state.tools_called]
    for task in ("hazard_assessment", "damage_assessment", "risk_assessment", "precaution_set", "response_plan"):
        assert f"llm:local:{task}" in tools
    assert tools.index("get_scenario") < tools.index("llm:local:situation_narrative")
    # Bounded queries: a 3-frame window, never the whole timeline.
    assert ("get_frames", ("run", 4, 1)) in fake_data.calls
    # Every claim cites known evidence.
    known = {e.id for e in brief.evidence_references}
    for s in brief.hazard_progression:
        assert s.evidence_ids and set(s.evidence_ids) <= known
    for x in brief.key_exposures:
        assert set(x.evidence_ids) <= known and x.claim_kind in {"observed_simulation_fact", "spatial_exposure"}
    for a in [*brief.precautions, *brief.recommended_actions]:
        assert a.requires_human_approval is True
        assert a.resources == "RESOURCE_DATA_UNAVAILABLE"
        assert a.prerequisites is not None and a.risks
        assert set(a.evidence_ids) <= known
    assert any(p.subject == "Harbour" and p.level == "HIGH" for p in brief.priorities)
    assert all(v for v in state.agent_versions.values())
    assert state.agent_versions["prompt_version"]


def test_agent_execution_hud_record_covers_every_node(fake_data):
    brief = _run(fake_data).state.command_brief
    by_agent = {r.agent: r for r in brief.agent_runs}
    expected = {"context_collector", "hazard_agent", "damage_agent", "risk_agent", "precaution_agent", "response_agent", "resource_agent", "safety_validator", "command_synthesizer"}
    assert expected <= set(by_agent)
    assert by_agent["resource_agent"].status == "UNAVAILABLE"
    assert brief.resource_status == "RESOURCE_DATA_UNAVAILABLE"
    assert all(r.label for r in brief.agent_runs)
    # Graph order, so the HUD renders the pipeline in the order it ran.
    order = [r.agent for r in brief.agent_runs]
    assert order.index("context_collector") < order.index("hazard_agent") < order.index("precaution_agent") < order.index("safety_validator")


def test_events_stream_every_agent_milestone(fake_data):
    events: list[tuple[str, dict]] = []
    run_analysis(
        GraphDeps(data=fake_data, emit=lambda event, data: events.append((event, data))),
        AnalysisRequest(request_id="req", scenario_id="scn", simulation_run_id="run", frame_index=4),
    )
    names = [e for e, _ in events]
    assert names[0] == "AI_ANALYSIS_STARTED"
    started = {d["agent_name"] for e, d in events if e == "AGENT_STARTED"}
    completed = {d["agent_name"] for e, d in events if e == "AGENT_COMPLETED"}
    assert started == completed
    assert "hazard_agent" in started and "command_synthesizer" in completed
    assert all("frame_index" in d for e, d in events if e == "AGENT_STARTED")


def test_no_frame_skips_the_analysis_tiers_entirely():
    """Conditional routing: a run with no recorded frames must not spend an
    LLM call per agent — the graph goes straight to the validator."""

    result = _run(FakeDataAccess(run_status="pending", frame_count=None))
    state = result.state
    assert state.status == "COMPLETED"
    ran = {r.agent for r in state.command_brief.agent_runs}
    assert "hazard_agent" not in ran and "response_agent" not in ran
    assert {"context_collector", "safety_validator", "command_synthesizer"} <= ran
    assert state.command_brief.hazard_progression == []


def test_asset_exposure_is_reported_as_spatial_not_observed():
    data = FakeDataAccess(exposure_quality="available")
    brief = _run(data).state.command_brief
    clinic = next(x for x in brief.key_exposures if x.subject == "Coastal Clinic")
    assert clinic.claim_kind == "spatial_exposure"
    assert "potentially exposed" in clinic.statement
    assert "destroy" not in clinic.statement
    assert any(p.subject == "Coastal Clinic" and p.level == "CRITICAL" for p in brief.priorities)


def _flaky(failing_task: str):
    class FlakyProvider(LocalDeterministicProvider):
        def generate(self, *, task, system, payload, output_model):
            if task == failing_task:
                raise LLMProviderError("simulated provider outage")
            return super().generate(task=task, system=system, payload=payload, output_model=output_model)

    return FlakyProvider()


def test_tier1_agent_failure_degrades_to_limitation_not_crash(fake_data):
    result = run_analysis(GraphDeps(data=fake_data, provider=_flaky("damage_assessment")), AnalysisRequest(request_id="r", scenario_id="scn", simulation_run_id="run", frame_index=4))
    state = result.state
    assert state.status == "COMPLETED"
    assert any("damage_agent" in e for e in state.errors)
    brief = state.command_brief
    assert brief.key_exposures == []
    assert any(l.code == "AGENT_FAILED" and l.subject == "damage_assessment" for l in brief.data_limitations)
    # The other branches still delivered.
    assert brief.hazard_progression and brief.priorities and brief.recommended_actions
    assert next(r for r in brief.agent_runs if r.agent == "damage_agent").status == "FAILED"


def test_tier2_agent_failure_keeps_the_other_branch(fake_data):
    result = run_analysis(GraphDeps(data=fake_data, provider=_flaky("response_plan")), AnalysisRequest(request_id="r", scenario_id="scn", simulation_run_id="run", frame_index=4))
    brief = result.state.command_brief
    assert result.state.status == "COMPLETED"
    assert brief.recommended_actions == [] and brief.precautions
    assert any(l.subject == "response_plan" for l in brief.data_limitations)


def test_frame_context_is_isolated_to_the_requested_frame(fake_data):
    """Each analysis sees only its own frame window — frame 2's brief never
    carries frame 6's values."""

    brief_a = _run(fake_data, frame_index=2).state.command_brief
    brief_b = _run(FakeDataAccess(), frame_index=6).state.command_brief
    assert brief_a.frame_index == 2 and brief_b.frame_index == 6
    frames_a = {e.frame_index for e in brief_a.evidence_references if e.kind == "timeline_frame"}
    frames_b = {e.frame_index for e in brief_b.evidence_references if e.kind == "timeline_frame"}
    assert frames_a <= {1, 2, 3} and frames_b <= {5, 6, 7}
    assert not frames_a & frames_b


def test_bug_in_node_marks_failed(fake_data):
    class Broken(LocalDeterministicProvider):
        def generate(self, *, task, system, payload, output_model):
            raise TypeError("programming error inside a node")

    result = run_analysis(GraphDeps(data=fake_data, provider=Broken()), AnalysisRequest(request_id="r", scenario_id="scn", simulation_run_id="run", frame_index=4))
    assert result.state.status == "FAILED"
    assert result.state.errors
