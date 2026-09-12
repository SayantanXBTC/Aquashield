from agents.graph.workflow.graph import AnalysisRequest, GraphDeps, run_analysis
from agents.schemas.evidence import DATA_UNAVAILABLE, NOT_CONFIGURED
from agents.tests.conftest import FakeDataAccess


def _run(data, frame_index=4, **kw):
    return run_analysis(GraphDeps(data=data), AnalysisRequest(request_id="r", scenario_id=kw.pop("scenario_id", "scn"), simulation_run_id=kw.pop("run_id", "run"), frame_index=frame_index))


def test_pending_run_reports_data_unavailable_not_invention():
    result = _run(FakeDataAccess(run_status="pending", frame_count=None))
    brief = result.state.command_brief
    assert result.state.status == "COMPLETED"
    assert brief.hazard_progression == [] and brief.key_exposures == []
    assert any(l.code == DATA_UNAVAILABLE and l.subject == "timeline_frames" for l in brief.data_limitations)
    assert DATA_UNAVAILABLE in brief.current_hazard
    # No tool beyond scenario/run was called — bounded, no fishing.
    assert all(t.tool in {"get_scenario", "get_run"} or t.tool.startswith("llm:") for t in result.state.tools_called)


def test_out_of_range_frame_is_a_limitation():
    result = _run(FakeDataAccess(), frame_index=40)
    brief = result.state.command_brief
    assert any(l.subject == "timeline_frame" and "40" in l.detail for l in brief.data_limitations)
    assert brief.hazard_progression == []


def test_missing_scenario_and_run():
    result = _run(FakeDataAccess(), scenario_id="missing", run_id="missing")
    brief = result.state.command_brief
    assert result.state.status == "COMPLETED"
    subjects = {l.subject for l in brief.data_limitations}
    assert {"scenario", "simulation_run"} <= subjects
    assert brief.recommended_actions == [] and brief.priorities == []


def test_tool_failure_becomes_limitation_and_audit_entry():
    result = _run(FakeDataAccess(fail_footprint=True))
    state = result.state
    assert state.status == "COMPLETED"
    footprint_call = next(t for t in state.tools_called if t.tool == "get_hazard_footprint")
    assert footprint_call.ok is False and "PostGIS" in (footprint_call.note or "")
    assert any(l.subject == "hazard_footprint" and l.code == DATA_UNAVAILABLE for l in state.command_brief.data_limitations)


def test_rag_stub_reports_not_configured():
    brief = _run(FakeDataAccess()).state.command_brief
    assert any(l.code == NOT_CONFIGURED and l.subject == "regulatory_evidence" for l in brief.data_limitations)
