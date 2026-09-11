"""Aggregates hazard footprint + exposure + vulnerability into one impact
summary per (simulation_run_id, frame_index) — the "ImpactAssessment" the
Prompt 10 spec describes.

Reuses the existing RiskAssessment (category=INFRASTRUCTURE) and
VulnerabilityAssessment tables rather than adding a third, overlapping
concept: a RiskAssessment row IS this frame's impact summary (score = exposed
asset count, level = severity band, extra_metadata = the counts breakdown +
cache key), and one VulnerabilityAssessment row per exposed asset already
matches this exactly. See backend/app/db/models/risk_assessment.py /
vulnerability_assessment.py.

Caching: keyed by (simulation_run_id, frame_index, dataset_version,
analysis_version), stored as extra_metadata fields on the RiskAssessment/
VulnerabilityAssessment rows themselves (a simple DB-backed cache, per
Prompt 10 — no new caching subsystem). `dataset_version` here is
"infrastructure_assets-unversioned": InfrastructureAsset has no version
column yet (it's not ingested from an external provider like
GeographicDataset is), so this constant documents that limitation honestly
rather than inventing a fake version number.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.models.enums import RiskCategory
from app.db.models.risk_assessment import RiskAssessment
from app.db.models.vulnerability_assessment import VulnerabilityAssessment
from app.repositories.impact_repository import ImpactRepository
from app.services.exposure_service import ExposureService
from app.services.hazard_footprint_service import HazardFootprintService
from app.services.impact_severity import hazard_severity_band
from app.services.simulation_service import SimulationService
from app.services.vulnerability_service import (
    assess_vulnerability,
    build_vulnerability_reason,
    unknown_vulnerability_attributes,
)

ANALYSIS_VERSION = "impact-v1"
INFRASTRUCTURE_DATASET_VERSION = "infrastructure_assets-unversioned"


class ImpactServiceError(Exception):
    pass


class ImpactFrameNotFoundError(ImpactServiceError):
    pass


class ImpactService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.simulation_service = SimulationService(session)
        self.hazard_footprints = HazardFootprintService(self.simulation_service)
        self.exposure = ExposureService(session)
        self.repo = ImpactRepository(session)

    def get_impact(self, run_id: UUID, frame_index: int | None = None) -> dict[str, Any]:
        """Impact summary for `frame_index`, or the latest available frame if
        None. Returns a "data_quality: unavailable" shell (never a 404) when
        the run simply has no executed frames yet — that's a legitimate,
        honestly-reported state, not an error."""
        footprints = self.hazard_footprints.get_footprints(run_id)
        if not footprints:
            return _unavailable_result(str(run_id), frame_index)

        if frame_index is None:
            footprint = footprints[-1]
        else:
            matches = [f for f in footprints if f.frame_index == frame_index]
            if not matches:
                raise ImpactFrameNotFoundError(
                    f"SimulationRun {run_id} has no frame_index={frame_index}"
                )
            footprint = matches[0]

        severity = hazard_severity_band(footprint.disaster_type, footprint.intensity)
        exposure_results = (
            self.exposure.compute_exposure(footprint.geometry) if footprint.geometry else []
        )

        cached_risk = self.repo.find_cached_risk_assessment(run_id, footprint.frame_index, ANALYSIS_VERSION)
        if cached_risk is not None:
            vulnerability_rows = self.repo.find_vulnerability_assessments(
                run_id, footprint.frame_index, ANALYSIS_VERSION
            )
            return _build_response(
                footprint=footprint,
                severity=severity,
                exposure_results=exposure_results,
                risk_assessment=cached_risk,
                vulnerability_rows=vulnerability_rows,
                cached=True,
            )

        vulnerability_rows: list[VulnerabilityAssessment] = []
        for exposed in exposure_results:
            level = assess_vulnerability(
                _criticality_enum(exposed.criticality), exposed.status, severity
            )
            vulnerability_rows.append(
                VulnerabilityAssessment(
                    simulation_run_id=run_id,
                    infrastructure_asset_id=UUID(exposed.asset_id),
                    level=level,
                    reason=build_vulnerability_reason(
                        exposed.asset_name, _criticality_enum(exposed.criticality), exposed.status, severity, level
                    ),
                    impact_description=(
                        f"{exposed.status.replace('_', ' ')}"
                        + (f"; ~{exposed.distance_km} km from hazard footprint" if exposed.distance_km else "")
                    ),
                    timestep=footprint.frame_index,
                    extra_metadata={
                        "analysis_version": ANALYSIS_VERSION,
                        "dataset_version": INFRASTRUCTURE_DATASET_VERSION,
                        "exposure_status": exposed.status,
                        "asset_type": exposed.asset_type,
                        "hazard_severity_band": severity.value,
                        **unknown_vulnerability_attributes(),
                    },
                )
            )
        self.repo.add_vulnerability_assessments(vulnerability_rows)

        counts_by_type: dict[str, int] = {}
        counts_by_criticality: dict[str, int] = {}
        for exposed in exposure_results:
            counts_by_type[exposed.asset_type] = counts_by_type.get(exposed.asset_type, 0) + 1
            counts_by_criticality[exposed.criticality] = counts_by_criticality.get(exposed.criticality, 0) + 1

        risk_assessment = RiskAssessment(
            simulation_run_id=run_id,
            category=RiskCategory.INFRASTRUCTURE,
            level=severity,
            score=float(len(exposure_results)),
            explanation=(
                f"{len(exposure_results)} infrastructure asset(s) exposed to this "
                f"{footprint.disaster_type} hazard footprint at frame {footprint.frame_index} "
                f"(severity band: {severity.value}, AQUASHIELD demo model — not an official forecast)."
            ),
            timestep=footprint.frame_index,
            extra_metadata={
                "analysis_version": ANALYSIS_VERSION,
                "dataset_version": INFRASTRUCTURE_DATASET_VERSION,
                "exposed_counts_by_type": counts_by_type,
                "exposed_counts_by_criticality": counts_by_criticality,
                "hazard_intensity": footprint.intensity,
                "hazard_intensity_units": footprint.intensity_units,
                "is_demo_model": True,
            },
        )
        self.repo.add_risk_assessment(risk_assessment)
        self.session.commit()

        return _build_response(
            footprint=footprint,
            severity=severity,
            exposure_results=exposure_results,
            risk_assessment=risk_assessment,
            vulnerability_rows=vulnerability_rows,
            cached=False,
        )


def _criticality_enum(value: str):
    from app.db.models.enums import AssetCriticality

    return AssetCriticality(value)


def _build_response(
    *, footprint, severity, exposure_results, risk_assessment, vulnerability_rows, cached: bool
) -> dict[str, Any]:
    counts_by_type: dict[str, int] = {}
    counts_by_criticality: dict[str, int] = {}
    for exposed in exposure_results:
        counts_by_type[exposed.asset_type] = counts_by_type.get(exposed.asset_type, 0) + 1
        counts_by_criticality[exposed.criticality] = counts_by_criticality.get(exposed.criticality, 0) + 1

    return {
        "simulation_run_id": str(footprint.simulation_run_id),
        "frame_index": footprint.frame_index,
        "disaster_type": footprint.disaster_type,
        "data_quality": "available",
        "severity_band": severity.value,
        "exposed_asset_count": len(exposure_results),
        "exposed_counts_by_type": counts_by_type,
        "exposed_counts_by_criticality": counts_by_criticality,
        "hazard_footprint": footprint.to_dict(),
        "exposure_results": [vars(e) for e in exposure_results],
        "vulnerability_assessment_ids": [str(v.id) for v in vulnerability_rows],
        "risk_assessment_id": str(risk_assessment.id),
        "is_demo_model": True,
        "cached": cached,
    }


def _unavailable_result(run_id: str, frame_index: int | None) -> dict[str, Any]:
    return {
        "simulation_run_id": run_id,
        "frame_index": frame_index,
        "disaster_type": None,
        "data_quality": "unavailable",
        "severity_band": None,
        "exposed_asset_count": 0,
        "exposed_counts_by_type": {},
        "exposed_counts_by_criticality": {},
        "hazard_footprint": None,
        "exposure_results": [],
        "vulnerability_assessment_ids": [],
        "risk_assessment_id": None,
        "is_demo_model": True,
        "cached": False,
    }
