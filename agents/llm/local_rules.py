"""Deterministic stand-ins for the LLM, one per task. They read the same
payload an LLM would and emit the same output schemas, citing evidence ids
exactly like a well-behaved model. Transparent, offline, unit-testable —
and they define the floor the real model must clear (the synthesis
validator treats both identically)."""

from __future__ import annotations

from typing import Any

from agents.schemas.evidence import DATA_UNAVAILABLE, RESOURCE_DATA_UNAVAILABLE

PRIORITY_BY_STATUS = {"severe": "CRITICAL", "impacted": "HIGH", "at_risk": "MEDIUM", "clear": "LOW"}
PRIORITY_BY_EXPOSURE_STATUS = {"within_hazard_footprint": "HIGH", "potentially_exposed": "MEDIUM", "not_exposed": "LOW"}
PRIORITY_RANK = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}


def _evidence_index(payload: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {e["id"]: e for e in payload.get("evidence", [])}


def _find(payload: dict[str, Any], kind: str, **match: Any) -> dict[str, Any] | None:
    for e in payload.get("evidence", []):
        if e.get("kind") != kind:
            continue
        if all(e.get(k) == v for k, v in match.items()):
            return e
    return None


def _frame_evidence(payload: dict[str, Any], which: str) -> dict[str, Any] | None:
    frame = payload.get(which)
    if not frame:
        return None
    return _find(payload, "timeline_frame", frame_index=frame["frame_index"])


def impact_analysis(payload: dict[str, Any]) -> dict[str, Any]:
    cur = payload.get("current_frame") or {}
    prev = payload.get("previous_frame")
    nxt = payload.get("next_frame")
    hz = cur.get("hazard_state", {}) if cur else {}
    e_cur = _frame_evidence(payload, "current_frame")
    e_prev = _frame_evidence(payload, "previous_frame")
    e_next = _frame_evidence(payload, "next_frame")

    phase = hz.get("phase")
    trend = "unknown"
    if phase == "landfall":
        trend = "landfall"
    elif phase == "inland":
        trend = "inland"
    elif phase == "offshore":
        trend = "approaching"
    if nxt and prev and phase == "inland":
        level_now = hz.get("water_level_m")
        level_next = (nxt.get("hazard_state") or {}).get("water_level_m")
        if isinstance(level_now, (int, float)) and isinstance(level_next, (int, float)) and level_next < level_now:
            trend = "receding"

    statements: list[dict[str, Any]] = []
    if e_cur:
        statements.append({"statement": f"Current frame {cur['frame_index']}: {e_cur['summary']}", "evidence_ids": [e_cur["id"]]})
    else:
        statements.append({"statement": f"Current frame state: {DATA_UNAVAILABLE}", "evidence_ids": []})
    if e_prev:
        statements.append({"statement": f"Previous frame {prev['frame_index']}: {e_prev['summary']}", "evidence_ids": [e_prev["id"]]})
    if e_next:
        statements.append({"statement": f"Next frame {nxt['frame_index']}: {e_next['summary']}", "evidence_ids": [e_next["id"]]})
    fp = _find(payload, "hazard_footprint")
    if fp:
        statements.append({"statement": f"Hazard footprint: {fp['summary']}", "evidence_ids": [fp["id"]]})

    exposures: list[dict[str, Any]] = []
    for s in payload.get("structures", []):
        ev = _find(payload, "structure_impact", structure_id=s.get("structure_id"))
        if not ev:
            continue
        status = s.get("status", "clear")
        if status == "clear":
            continue
        exposures.append(
            {
                "subject": s.get("name") or s.get("structure_id"),
                "subject_ref": s.get("structure_id"),
                "claim_kind": "observed_simulation_fact",
                "statement": f"Structure '{s.get('name')}' ({s.get('structure_type')}) reports exposure status {status} ({ev['summary']}).",
                "evidence_ids": [ev["id"]],
                "severity_hint": PRIORITY_BY_STATUS.get(status, "LOW"),
            }
        )
    for a in payload.get("asset_exposures", []):
        ev = _find(payload, "asset_exposure", asset_id=a.get("asset_id"))
        if not ev or a.get("status") == "not_exposed":
            continue
        exposures.append(
            {
                "subject": a.get("asset_name") or a.get("asset_id"),
                "subject_ref": a.get("asset_id"),
                "claim_kind": "spatial_exposure",
                "statement": f"Asset '{a.get('asset_name')}' ({a.get('asset_type')}, {a.get('criticality')}) is {a.get('status').replace('_', ' ')} — potentially exposed, not confirmed affected ({ev['summary']}).",
                "evidence_ids": [ev["id"]],
                "severity_hint": PRIORITY_BY_EXPOSURE_STATUS.get(a.get("status"), "LOW"),
            }
        )

    uncertainties = [f"{lim['code']}: {lim['subject']} — {lim['detail']}" for lim in payload.get("limitations", [])]
    if not payload.get("structures") and payload.get("exposure_data_quality") in {"unavailable", "partial", "unknown"}:
        uncertainties.append("No structure or asset exposure data for this frame; exposure findings are empty, not zero-risk.")
    return {
        "hazard_progression": {"trend": trend, "statements": statements},
        "exposures": exposures,
        "uncertainties": uncertainties,
    }


def tactical_plan(payload: dict[str, Any]) -> dict[str, Any]:
    cur = payload.get("current_frame") or {}
    hz = cur.get("hazard_state", {}) if cur else {}
    e_cur = _frame_evidence(payload, "current_frame")
    disaster = payload.get("disaster_type", "hazard")

    priorities: list[dict[str, Any]] = []
    actions: list[dict[str, Any]] = []

    def add_action(action: str, priority: str, evidence_ids: list[str], prerequisites: list[str], risks: list[str]) -> None:
        actions.append(
            {
                "action": action,
                "priority": priority,
                "prerequisites": prerequisites,
                "risks": risks,
                "resources": RESOURCE_DATA_UNAVAILABLE,
                "requires_human_approval": True,
                "evidence_ids": evidence_ids,
            }
        )

    for s in payload.get("structures", []):
        ev = _find(payload, "structure_impact", structure_id=s.get("structure_id"))
        status = s.get("status", "clear")
        if not ev or status == "clear":
            continue
        level = PRIORITY_BY_STATUS.get(status, "LOW")
        name = s.get("name") or s.get("structure_id")
        stype = s.get("structure_type", "structure")
        priorities.append({"level": level, "subject": name, "rationale": f"{stype} reports exposure status {status} in the current frame.", "evidence_ids": [ev["id"]]})
        if stype == "hospital":
            add_action(f"Assess continuity of care and patient evacuation options for {name}.", level, [ev["id"]], ["Confirm current occupancy and mobility needs", "Confirm access routes are passable"], ["Moving patients carries its own clinical risk", "Exposure band is a simplified model, not a damage assessment"])
        elif stype == "port":
            add_action(f"Consider suspending vessel movements and securing moored craft at {name}.", level, [ev["id"]], ["Harbour master concurrence", "Crew availability"], ["Economic disruption", "Exposure status does not confirm physical damage"])
        elif stype == "fuel_terminal":
            add_action(f"Consider isolating storage and halting transfers at {name} to limit secondary spill risk.", level, [ev["id"]], ["Site operator coordination", "Confirm isolation procedures are safe to execute"], ["Supply interruption", "Model exposure is an illustrative band"])
        elif stype == "power_plant":
            add_action(f"Review controlled shutdown / load transfer options for {name}.", level, [ev["id"]], ["Grid operator coordination"], ["Outage impact on other critical services"])
        else:
            add_action(f"Consider precautionary evacuation or shelter guidance for {name}.", level, [ev["id"]], ["Confirm population present", "Confirm evacuation routes and shelter capacity"], ["Unnecessary evacuation if exposure does not materialise", "Exposure is potential, not confirmed"])

    for a in payload.get("asset_exposures", []):
        ev = _find(payload, "asset_exposure", asset_id=a.get("asset_id"))
        if not ev or a.get("status") == "not_exposed":
            continue
        level = PRIORITY_BY_EXPOSURE_STATUS.get(a.get("status"), "LOW")
        if a.get("criticality") == "critical" and level == "HIGH":
            level = "CRITICAL"
        name = a.get("asset_name") or a.get("asset_id")
        priorities.append({"level": level, "subject": name, "rationale": f"{a.get('asset_type')} ({a.get('criticality')}) intersects or lies near the hazard footprint — potentially exposed.", "evidence_ids": [ev["id"]]})
        add_action(f"Verify status of {name} with the asset operator and pre-position monitoring.", level, [ev["id"]], ["Contact details for the asset operator"], ["Spatial intersection is not confirmation of impact"])

    phase = hz.get("phase")
    if e_cur:
        if phase == "offshore" and hz.get("eta_minutes") is not None:
            add_action(f"Use the remaining lead time before {disaster} landfall to brief coastal responders.", "HIGH", [e_cur["id"]], ["Command post staffed"], ["ETA comes from a simplified demonstration model"])
        elif phase in {"landfall", "inland"}:
            add_action(f"Hold responders clear of the active {disaster} zone until the hazard recedes; verify with observations.", "HIGH", [e_cur["id"]], ["Situational reports from the field"], ["Model extent is illustrative, not measured"])
    if not priorities:
        priorities.append({"level": "LOW", "subject": "Overall", "rationale": "No structure or asset reports exposure in the current frame; maintain monitoring.", "evidence_ids": [e_cur["id"]] if e_cur else []})
        add_action("Maintain monitoring and re-run the brief at the next frame.", "LOW", [e_cur["id"]] if e_cur else [], [], ["Absence of exposure data is not absence of risk"])

    priorities.sort(key=lambda p: PRIORITY_RANK[p["level"]])
    actions.sort(key=lambda a: PRIORITY_RANK[a["priority"]])
    return {"priorities": priorities, "actions": actions, "uncertainties": [f"{lim['code']}: {lim['subject']} — {lim['detail']}" for lim in payload.get("limitations", [])]}


def situation_narrative(payload: dict[str, Any]) -> dict[str, Any]:
    ctx = payload.get("context", {})
    findings = payload.get("validated", {})
    cur = ctx.get("current_frame") or {}
    hz = cur.get("hazard_state", {}) if cur else {}
    parts = [
        f"{ctx.get('scenario_name', 'Scenario')} ({ctx.get('disaster_type', 'hazard')}), simulation run {ctx.get('simulation_run_id')}, frame {ctx.get('frame_index')} of {ctx.get('frame_count')}.",
    ]
    prog = findings.get("hazard_progression", [])
    if prog:
        parts.append(f"Hazard trend: {findings.get('trend', 'unknown')}.")
    n_exp = len(findings.get("key_exposures", []))
    parts.append(f"{n_exp} exposure finding(s) grounded in simulation evidence." if n_exp else "No grounded exposure findings in this frame.")
    if ctx.get("operator_question"):
        parts.append("Operator question recorded; answers are limited to the evidence listed.")
    situation = " ".join(parts)

    hazard_bits = []
    for key, label, unit in (
        ("phase", "phase", ""),
        ("distance_to_coast_km", "distance to coast", " km"),
        ("eta_minutes", "ETA", " min"),
        ("wave_height_m", "wave height", " m"),
        ("wind_speed_kt", "wind", " kt"),
        ("water_level_m", "water level", " m"),
        ("concentration_index", "concentration index", ""),
        ("slick_radius_km", "slick radius", " km"),
        ("inundation_km", "inundation", " km"),
    ):
        v = hz.get(key)
        if v is not None:
            hazard_bits.append(f"{label} {v}{unit}")
    current_hazard = ("Current frame reports " + ", ".join(hazard_bits) + " (simplified demonstration model).") if hazard_bits else f"Current hazard state: {DATA_UNAVAILABLE}."
    return {"situation": situation, "current_hazard": current_hazard}


GENERATORS = {
    "impact_analysis": impact_analysis,
    "tactical_plan": tactical_plan,
    "situation_narrative": situation_narrative,
}
