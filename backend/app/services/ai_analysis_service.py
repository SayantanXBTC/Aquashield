"""AI analysis orchestration (Prompt 14).

Creates the audit row, builds the read-only data access for the caller,
runs the LangGraph analysis synchronously (same prototype choice as
simulation execution — CLAUDE.md §26), and persists the structured result.
The AI layer writes only `ai_requests`."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app.config.settings import settings
from app.db.models.ai_request import AIRequest
from app.db.models.enums import AIRequestStatus
from app.repositories.ai_request_repository import AIRequestRepository
from app.schemas.ai import AIAnalyzeRequest
from app.services.ai_data_access import BackendAnalysisDataAccess
from app.services.scenario_service import ScenarioNotFoundError, ScenarioService
from app.services.simulation_service import SimulationRunNotFoundError, SimulationService

from agents.graph.workflow.graph import AnalysisRequest, GraphDeps, run_analysis
from agents.llm.provider import LLMProvider, LLMProviderError, build_provider
from agents.prompts.versions import PROMPT_VERSION
from agents.tools.retrieval.evidence_retriever import NotConfiguredEvidenceRetriever
from agents.tools.sanitize import sanitize_question


class AIRequestNotFoundError(Exception):
    pass


class AIProviderConfigurationError(Exception):
    pass


def _now() -> datetime:
    return datetime.now(timezone.utc)


class AIAnalysisService:
    def __init__(self, session: Session, *, owner_uid: str, provider: LLMProvider | None = None) -> None:
        self.session = session
        self.owner_uid = owner_uid
        self.requests = AIRequestRepository(session)
        self._provider = provider

    def _build_provider(self) -> LLMProvider:
        if self._provider is not None:
            return self._provider
        try:
            return build_provider(settings.ai_provider, model=settings.ai_model, api_key=settings.anthropic_api_key)
        except LLMProviderError as exc:
            raise AIProviderConfigurationError(str(exc)) from exc

    def analyze(self, data: AIAnalyzeRequest) -> AIRequest:
        # Ownership is verified up front (404 for another user's rows), so the
        # graph never even starts against data the caller may not read.
        scenarios = ScenarioService(self.session, owner_uid=self.owner_uid)
        scenarios.get_scenario(data.scenario_id)  # raises ScenarioNotFoundError
        simulation = SimulationService(self.session, owner_uid=self.owner_uid)
        run = simulation.get_run(data.simulation_run_id)  # raises SimulationRunNotFoundError
        if str(run.scenario_version.scenario_id) != str(data.scenario_id):
            raise SimulationRunNotFoundError(f"SimulationRun {data.simulation_run_id} does not belong to scenario {data.scenario_id}")

        sanitized_question, _ = sanitize_question(data.user_question)
        provider = self._build_provider()

        request = AIRequest(
            owner_uid=self.owner_uid,
            scenario_id=data.scenario_id,
            simulation_run_id=data.simulation_run_id,
            frame_index=data.frame_index,
            user_question=sanitized_question,
            status=AIRequestStatus.RUNNING,
            provider=provider.name,
            model=provider.model,
            prompt_version=PROMPT_VERSION,
            started_at=_now(),
        )
        self.requests.add(request)
        self.session.commit()

        deps = GraphDeps(data=BackendAnalysisDataAccess(self.session, owner_uid=self.owner_uid), provider=provider, retriever=NotConfiguredEvidenceRetriever())
        result = run_analysis(
            deps,
            AnalysisRequest(
                request_id=str(request.id),
                scenario_id=str(data.scenario_id),
                simulation_run_id=str(data.simulation_run_id),
                frame_index=data.frame_index,
                user_question=data.user_question,
            ),
        )
        state = result.state
        request.execution_ms = result.execution_ms
        request.agent_versions = dict(state.agent_versions)
        request.tools_called = [t.model_dump() for t in state.tools_called]
        request.completed_at = _now()
        if state.status == "COMPLETED" and state.command_brief is not None:
            request.status = AIRequestStatus.COMPLETED
            request.result = state.command_brief.model_dump(mode="json")
            request.error = "; ".join(state.errors) if state.errors else None
        else:
            request.status = AIRequestStatus.FAILED
            request.error = "; ".join(state.errors) or "analysis did not complete"
        self.session.commit()
        self.session.refresh(request)
        return request

    def get(self, request_id: UUID) -> AIRequest:
        request = self.requests.get(request_id, owner_uid=self.owner_uid)
        if request is None:
            raise AIRequestNotFoundError(f"AI request {request_id} not found")
        return request
