"""Agent 1 — Context Collector.

Fetches a bounded slice of deterministic data through read-only tools and
turns it into a `ContextPayload` with an evidence registry. Nothing is
interpreted here; every evidence summary is a restatement of returned
values. Untrusted operator text is sanitized and quoted."""

from __future__ import annotations

from typing import Any

from agents.prompts.versions import AGENT_VERSIONS
from agents.schemas.context import ContextPayload, FrameSnapshot
from agents.schemas.evidence import DATA_UNAVAILABLE, DataLimitation, EvidenceRef
from agents.tools.data_access import AnalysisDataAccess, FrameRecord
from agents.tools.registry import ToolRunner
from agents.tools.sanitize import sanitize_question

AGENT_NAME = "context_collector"

# Hazard-state keys a frame's evidence may carry — a whitelist, so a frame's
# evidence never balloons and the numbers agents may cite are enumerable.
FRAME_VALUE_KEYS = (
    "phase",
    "arrived",
    "distance_to_coast_km",
    "coast_distance_total_km",
    "eta_minutes",
    "traveled_km",
    "arrival_progress",
    "heading_deg",
    "speed_kmh",
    "intensity",
    "radius_km",
    "wave_height_m",
    "front_radius_km",
    "coastal_impact_m",
    "inundation_km",
    "wind_speed_kt",
    "hazard_radius_km",
    "wind_decay",
    "slick_radius_km",
    "slick_area_km2",
    "concentration_index",
    "beached",
    "water_level_m",
    "peak_level_m",
    "affected_radius_km",
)
SCENARIO_VALUE_KEYS = (
    "origin_x_km",
    "origin_y_km",
    "heading_deg",
    "speed_kmh",
    "intensity",
    "spread_radius_km",
    "dispersion_rate",
    "duration_hours",
)


def _fmt(value: Any) -> str:
    if isinstance(value, float):
        return f"{value:g}"
    return str(value)


def _frame_summary(frame: FrameRecord) -> tuple[str, dict[str, Any]]:
    values = {k: frame.hazard_state[k] for k in FRAME_VALUE_KEYS if k in frame.hazard_state and frame.hazard_state[k] is not None}
    values["frame_index"] = frame.frame_index
    values["timestep"] = frame.timestep
    parts = [f"{k}={_fmt(v)}" for k, v in values.items() if k not in ("frame_index", "timestep")]
    time_part = f" at {frame.simulation_time}" if frame.simulation_time else ""
    return f"frame {frame.frame_index} (timestep {frame.timestep}{time_part}): " + (", ".join(parts) or "no hazard values reported"), values


class ContextCollector:
    def __init__(self, data: AnalysisDataAccess) -> None:
        self.data = data

    def collect(self, *, scenario_id: str, simulation_run_id: str, frame_index: int, user_question: str | None) -> tuple[ContextPayload, ToolRunner, bool]:
        tools = ToolRunner(data=self.data, agent=AGENT_NAME)
        evidence: list[EvidenceRef] = []
        limitations: list[DataLimitation] = []
        counter = 0

        def new_id() -> str:
            nonlocal counter
            counter += 1
            return f"E{counter}"

        question, injection_detected = sanitize_question(user_question)

        scenario = tools.call("get_scenario", lambda: self.data.get_scenario(scenario_id), subject="scenario", scenario_id=scenario_id)
        run = tools.call("get_run", lambda: self.data.get_run(simulation_run_id), subject="simulation_run", simulation_run_id=simulation_run_id)

        if scenario is None:
            limitations.append(DataLimitation(code=DATA_UNAVAILABLE, subject="scenario", detail=f"Scenario {scenario_id} not found or not accessible."))
        else:
            values = {k: scenario.scenario_config.get(k) for k in SCENARIO_VALUE_KEYS if scenario.scenario_config.get(k) is not None}
            evidence.append(
                EvidenceRef(
                    id=new_id(),
                    kind="scenario",
                    summary=f"scenario '{scenario.name}' ({scenario.disaster_type}) configured with " + (", ".join(f"{k}={_fmt(v)}" for k, v in values.items()) or "no propagation parameters"),
                    values=values,
                    source="get_scenario",
                )
            )
        if run is None:
            limitations.append(DataLimitation(code=DATA_UNAVAILABLE, subject="simulation_run", detail=f"Simulation run {simulation_run_id} not found or not accessible."))
        else:
            evidence.append(
                EvidenceRef(
                    id=new_id(),
                    kind="simulation_run",
                    simulation_run_id=run.id,
                    summary=f"simulation run {run.id} status={run.status}, model={run.model_identifier or DATA_UNAVAILABLE}, frame_count={run.frame_count if run.frame_count is not None else DATA_UNAVAILABLE}",
                    values={"status": run.status, "frame_count": run.frame_count, "model_identifier": run.model_identifier},
                    source="get_run",
                )
            )

        frames: list[FrameRecord] = []
        if run is not None and run.status == "completed" and (run.frame_count or 0) > 0:
            frames = tools.call("get_frames", lambda: self.data.get_frames(simulation_run_id, frame_index, window=1), subject="timeline_frames", simulation_run_id=simulation_run_id, frame_index=frame_index, window=1) or []
            if not any(f.frame_index == frame_index for f in frames):
                limitations.append(DataLimitation(code=DATA_UNAVAILABLE, subject="timeline_frame", detail=f"Frame {frame_index} does not exist for run {simulation_run_id} (frame_count={run.frame_count})."))
        elif run is not None:
            limitations.append(DataLimitation(code=DATA_UNAVAILABLE, subject="timeline_frames", detail=f"Run status is {run.status}; no recorded frames to analyze."))

        by_index = {f.frame_index: f for f in frames}
        snapshots: dict[str, FrameSnapshot | None] = {"previous_frame": None, "current_frame": None, "next_frame": None}
        for label, idx in (("previous_frame", frame_index - 1), ("current_frame", frame_index), ("next_frame", frame_index + 1)):
            frame = by_index.get(idx)
            if frame is None:
                continue
            summary, values = _frame_summary(frame)
            evidence.append(EvidenceRef(id=new_id(), kind="timeline_frame", simulation_run_id=simulation_run_id, frame_index=frame.frame_index, summary=summary, values=values, source="get_frames"))
            snapshots[label] = FrameSnapshot(
                frame_index=frame.frame_index,
                timestep=frame.timestep,
                simulation_time=frame.simulation_time,
                hazard_state={k: frame.hazard_state.get(k) for k in FRAME_VALUE_KEYS if k in frame.hazard_state},
                infrastructure_impacts=frame.infrastructure_impacts,
                is_key_event=frame.is_key_event,
            )

        footprint_out: dict[str, Any] | None = None
        if by_index.get(frame_index) is not None:
            fp = tools.call("get_hazard_footprint", lambda: self.data.get_hazard_footprint(simulation_run_id, frame_index), subject="hazard_footprint", simulation_run_id=simulation_run_id, frame_index=frame_index)
            if fp is not None:
                footprint_out = {"frame_index": fp.frame_index, "geometry_type": fp.geometry_type, "intensity": fp.intensity, "intensity_units": fp.intensity_units, "model_id": fp.model_id, "is_demo_model": fp.is_demo_model}
                evidence.append(
                    EvidenceRef(
                        id=new_id(),
                        kind="hazard_footprint",
                        simulation_run_id=simulation_run_id,
                        frame_index=frame_index,
                        summary=f"hazard footprint at frame {frame_index}: intensity={_fmt(fp.intensity) if fp.intensity is not None else DATA_UNAVAILABLE} {fp.intensity_units}, geometry={fp.geometry_type or 'none (demo world, no real-world geometry)'}, model={fp.model_id}",
                        values={"intensity": fp.intensity, "intensity_units": fp.intensity_units, "geometry_type": fp.geometry_type, "frame_index": frame_index},
                        source="get_hazard_footprint",
                    )
                )

        asset_exposures: list[dict[str, Any]] = []
        exposure_quality = "unknown"
        if by_index.get(frame_index) is not None:
            exposure = tools.call("get_exposure", lambda: self.data.get_exposure(simulation_run_id, frame_index), subject="asset_exposure", simulation_run_id=simulation_run_id, frame_index=frame_index)
            if exposure is not None:
                exposure_quality = exposure.data_quality
                if exposure.data_quality != "available":
                    limitations.append(DataLimitation(code=DATA_UNAVAILABLE, subject="asset_exposure", detail=f"Exposure data quality is '{exposure.data_quality}' for frame {frame_index}; no real-world asset intersections are available."))
                for r in exposure.results:
                    asset_exposures.append({"asset_id": r.asset_id, "asset_name": r.asset_name, "asset_type": r.asset_type, "criticality": r.criticality, "status": r.status, "distance_km": r.distance_km})
                    evidence.append(
                        EvidenceRef(
                            id=new_id(),
                            kind="asset_exposure",
                            simulation_run_id=simulation_run_id,
                            frame_index=frame_index,
                            asset_id=r.asset_id,
                            summary=f"asset '{r.asset_name}' ({r.asset_type}, criticality {r.criticality}) status={r.status}, distance_km={_fmt(r.distance_km) if r.distance_km is not None else DATA_UNAVAILABLE}",
                            values={"status": r.status, "distance_km": r.distance_km, "criticality": r.criticality, "frame_index": frame_index},
                            source="get_exposure",
                        )
                    )

        structures: list[dict[str, Any]] = []
        current = by_index.get(frame_index)
        if current is not None:
            for impact in current.infrastructure_impacts:
                sid = str(impact.get("structure_id", ""))
                if not sid:
                    continue
                entry = {
                    "structure_id": sid,
                    "structure_type": impact.get("structure_type"),
                    "name": impact.get("name"),
                    "status": impact.get("status"),
                    "exposure": impact.get("exposure"),
                    "distance_km": impact.get("distance_km"),
                }
                structures.append(entry)
                evidence.append(
                    EvidenceRef(
                        id=new_id(),
                        kind="structure_impact",
                        simulation_run_id=simulation_run_id,
                        frame_index=frame_index,
                        structure_id=sid,
                        summary=f"structure '{entry['name']}' ({entry['structure_type']}) status={entry['status']}, exposure={_fmt(entry['exposure'])}, distance_km={_fmt(entry['distance_km'])}",
                        values={"status": entry["status"], "exposure": entry["exposure"], "distance_km": entry["distance_km"], "frame_index": frame_index},
                        source="get_frames.infrastructure_impacts",
                    )
                )

        limitations.extend(tools.limitations)
        payload = ContextPayload(
            scenario_id=scenario_id,
            scenario_name=scenario.name if scenario else DATA_UNAVAILABLE,
            disaster_type=scenario.disaster_type if scenario else DATA_UNAVAILABLE,
            simulation_run_id=simulation_run_id,
            run_status=run.status if run else DATA_UNAVAILABLE,
            model_identifier=run.model_identifier if run else None,
            frame_index=frame_index,
            frame_count=run.frame_count or 0 if run else 0,
            previous_frame=snapshots["previous_frame"],
            current_frame=snapshots["current_frame"],
            next_frame=snapshots["next_frame"],
            hazard_footprint=footprint_out,
            asset_exposures=asset_exposures,
            exposure_data_quality=exposure_quality,
            structures=structures,
            operator_question=question,
            evidence=evidence,
            limitations=limitations,
        )
        return payload, tools, injection_detected


def context_collector_version() -> str:
    return AGENT_VERSIONS[AGENT_NAME]
