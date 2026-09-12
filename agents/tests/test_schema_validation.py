import pytest
from pydantic import ValidationError

from agents.agents.command.synthesis import SafetyValidator
from agents.agents.state_evaluator.context_collector import ContextCollector
from agents.schemas.evidence import RESOURCE_DATA_UNAVAILABLE
from agents.schemas.outputs import ExposureFinding, GroundedStatement, ImpactAnalysis, RecommendedAction, TacticalPlan
from agents.tests.conftest import FakeDataAccess


def test_recommended_action_is_always_human_gated_and_resource_honest():
    action = RecommendedAction(action="Do x", priority="HIGH", resources="two fire trucks and a helicopter")
    assert action.requires_human_approval is True
    assert action.resources == RESOURCE_DATA_UNAVAILABLE
    with pytest.raises(ValidationError):
        RecommendedAction(action="Do x", priority="HIGH", requires_human_approval=False)  # type: ignore[arg-type]
    with pytest.raises(ValidationError):
        RecommendedAction(action="Do x", priority="URGENT")  # type: ignore[arg-type]


def _context():
    payload, _, _ = ContextCollector(FakeDataAccess()).collect(scenario_id="scn", simulation_run_id="run", frame_index=4, user_question=None)
    return payload


def test_validator_strips_unknown_evidence_and_ungrounded_numbers():
    context = _context()
    frame_id = next(e.id for e in context.evidence if e.kind == "timeline_frame" and e.frame_index == 4)
    analysis = ImpactAnalysis(
        hazard_progression={"trend": "inland", "statements": [
            GroundedStatement(statement="Wave height 5 m at frame 4.", evidence_ids=[frame_id]),          # grounded (5.0 -> "5")
            GroundedStatement(statement="Wave height 12 m at frame 4.", evidence_ids=[frame_id]),         # invented number
            GroundedStatement(statement="Something cited nowhere.", evidence_ids=["E99"]),                # unknown id
            GroundedStatement(statement="No citation at all.", evidence_ids=[]),
        ]},
        exposures=[
            ExposureFinding(subject="Harbour", subject_ref="port", claim_kind="observed_simulation_fact", statement="Harbour was destroyed.", evidence_ids=[frame_id]),
        ],
    )
    validator = SafetyValidator(context)
    statements, exposures, trend = validator.validate_impact(analysis)
    assert trend == "inland"
    assert [s.statement for s in statements] == ["Wave height 5 m at frame 4."]
    assert exposures == []
    assert len(validator.notes) == 4
    assert any("12" in n for n in validator.notes) and any("destruction" in n for n in validator.notes)


def test_validator_forces_action_guardrails():
    context = _context()
    frame_id = next(e.id for e in context.evidence if e.kind == "timeline_frame" and e.frame_index == 4)
    plan = TacticalPlan(actions=[RecommendedAction(action="Brief responders on the ETA of 0 min.", priority="HIGH", risks=["model"], evidence_ids=[frame_id])])
    _, actions = SafetyValidator(context).validate_plan(plan)
    assert len(actions) == 1
    assert actions[0].requires_human_approval is True and actions[0].resources == RESOURCE_DATA_UNAVAILABLE


def test_context_evidence_ids_are_unique_and_traceable():
    context = _context()
    ids = [e.id for e in context.evidence]
    assert len(ids) == len(set(ids))
    kinds = {e.kind for e in context.evidence}
    assert {"scenario", "simulation_run", "timeline_frame", "hazard_footprint", "structure_impact"} <= kinds
    frame = next(e for e in context.evidence if e.kind == "timeline_frame" and e.frame_index == 4)
    assert frame.simulation_run_id == "run" and frame.values["wave_height_m"] == 5.0
    assert context.operator_question is None
