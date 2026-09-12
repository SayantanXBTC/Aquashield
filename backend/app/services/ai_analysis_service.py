"""AI analysis orchestration (Prompt 14, extended in Prompt 15).

Creates the audit row, builds the read-only data access for the caller,
runs the LangGraph analysis synchronously (same prototype choice as
simulation execution — CLAUDE.md §26), and persists the structured result.
The AI layer writes only `ai_requests`.

Prompt 15 adds two things the live command center needs:

* a **stale guard** — a request naming a scenario version the run was not
  produced from is refused, so a brief never describes a configuration the
  operator has already edited away; and
* **milestone events** — each graph node pushes its start/finish to the
  per-owner AI event bus, so the Agent Execution HUD can watch the pipeline
  while the synchronous call is still in flight."""

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
from app.services.ai_events import (
    AI_ANALYSIS_COMPLETED,
    AI_ANALYSIS_FAILED,
    AI_ANALYSIS_STALE,
    AIEventBus,
    bus as default_bus,
)
from app.services.scenario_service import ScenarioNotFoundError, ScenarioService
from app.services.simulation_service import SimulationRunNotFoundError, SimulationService

from agents.graph.workflow.graph import AnalysisRequest, GraphDeps, run_analysis
from agents.llm.provider import LLMProvider, LLMProviderError, build_provider
from agents.prompts.versions import PROMPT_VERSION
from app.services.rag_retrieval_service import get_retriever
from agents.tools.sanitize import sanitize_question


class AIRequestNotFoundError(Exception):
    pass


class AIProviderConfigurationError(Exception):
    pass


class AIAnalysisStaleError(Exception):
    """The client asked about a scenario version the run was not produced
    from — the operator has edited the configuration since. Answering would
    describe a world that is no longer on screen, so the request is refused
    and the client discards it (Prompt 15)."""


def _now() -> datetime:
    return datetime.now(timezone.utc)


class AIAnalysisService:
    def __init__(self, session: Session, *, owner_uid: str, provider: LLMProvider | None = None, events: AIEventBus | None = None) -> None:
        self.session = session
        self.owner_uid = owner_uid
        self.requests = AIRequestRepository(session)
        self._provider = provider
        self._events = events or default_bus

    def _build_provider(self) -> LLMProvider:
        if self._provider is not None:
            return self._provider
        try:
            return build_provider(settings.ai_provider, model=settings.ai_model, api_key=settings.anthropic_api_key)
        except LLMProviderError as exc:
            raise AIProviderConfigurationError(str(exc)) from exc

    def _emit(self, event: str, data: dict) -> None:
        self._events.publish_threadsafe(self.owner_uid, event, data)

    def analyze(self, data: AIAnalyzeRequest) -> AIRequest:
        # Ownership is verified up front (404 for another user's rows), so the
        # graph never even starts against data the caller may not read.
        scenarios = ScenarioService(self.session, owner_uid=self.owner_uid)
        scenarios.get_scenario(data.scenario_id)  # raises ScenarioNotFoundError
        simulation = SimulationService(self.session, owner_uid=self.owner_uid)
        run = simulation.get_run(data.simulation_run_id)  # raises SimulationRunNotFoundError
        if str(run.scenario_version.scenario_id) != str(data.scenario_id):
            raise SimulationRunNotFoundError(f"SimulationRun {data.simulation_run_id} does not belong to scenario {data.scenario_id}")

        # Stale guard: the client tells us which configuration version it was
        # looking at. If the run was produced from a different one, the answer
        # would describe a configuration the operator has already changed.
        if data.scenario_version_id is not None and str(run.scenario_version_id) != str(data.scenario_version_id):
            self._emit(
                AI_ANALYSIS_STALE,
                {
                    "scenario_id": str(data.scenario_id),
                    "simulation_run_id": str(data.simulation_run_id),
                    "scenario_version_id": str(data.scenario_version_id),
                    "frame_index": data.frame_index,
                },
            )
            raise AIAnalysisStaleError(
                f"Scenario version {data.scenario_version_id} is not the version simulation run {data.simulation_run_id} was produced from."
            )

        sanitized_question, _ = sanitize_question(data.user_question)
        provider = self._build_provider()

        request = AIRequest(
            owner_uid=self.owner_uid,
            scenario_id=data.scenario_id,
            simulation_run_id=data.simulation_run_id,
            scenario_version_id=run.scenario_version_id,
            frame_index=data.frame_index,
            request_type=data.request_type,
            user_question=sanitized_question,
            status=AIRequestStatus.RUNNING,
            provider=provider.name,
            model=provider.model,
            prompt_version=PROMPT_VERSION,
            started_at=_now(),
        )
        self.requests.add(request)
        self.session.commit()

        request_id = str(request.id)

        def emit(event: str, payload: dict) -> None:
            # Every milestone carries the request/frame it belongs to, so a
            # client that has already moved on can discard it as stale.
            self._emit(
                event,
                {
                    **payload,
                    "request_id": request_id,
                    "scenario_id": str(data.scenario_id),
                    "simulation_run_id": str(data.simulation_run_id),
                    "scenario_version_id": str(run.scenario_version_id),
                    "frame_index": payload.get("frame_index", data.frame_index),
                },
            )

        deps = GraphDeps(
            data=BackendAnalysisDataAccess(self.session, owner_uid=self.owner_uid),
            provider=provider,
            # RAG_PROVIDER=none (default) keeps the pre-Prompt-16 posture:
            # every regulatory_evidence limitation reads NOT_CONFIGURED, exactly
            # as before this layer existed. RAG_PROVIDER=chroma switches every
            # new analysis to the real hybrid retriever, cached at module level
            # (app/services/rag_retrieval_service.py) rather than rebuilt per request.
            retriever=get_retriever(),
            emit=emit,
        )
        result = run_analysis(
            deps,
            AnalysisRequest(
                request_id=request_id,
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
        if request.status == AIRequestStatus.COMPLETED:
            emit(AI_ANALYSIS_COMPLETED, {"command_brief": request.result, "execution_ms": request.execution_ms})
        else:
            emit(AI_ANALYSIS_FAILED, {"error": request.error})
        return request

    def get(self, request_id: UUID) -> AIRequest:
        request = self.requests.get(request_id, owner_uid=self.owner_uid)
        if request is None:
            raise AIRequestNotFoundError(f"AI request {request_id} not found")
        return request
