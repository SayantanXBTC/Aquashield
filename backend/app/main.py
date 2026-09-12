import sys
from pathlib import Path

# `simulation/` is a sibling top-level domain (architecture.md §18/§21), not
# a backend-owned package, and this monorepo deliberately has no per-domain
# packaging step (architecture.md ADR-002) — so the repo root must be on
# sys.path before `app.services.simulation_service` imports `simulation.*`.
# See docs/development/simulation.md.
_REPO_ROOT = Path(__file__).resolve().parents[2]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes.ai import router as ai_router
from app.api.routes.auth import router as auth_router
from app.api.routes.disaster_types import router as disaster_types_router
from app.api.routes.geographic_features import router as geographic_features_router
from app.api.routes.health import router as health_router
from app.api.routes.infrastructure_assets import router as infrastructure_assets_router
from app.api.routes.scenarios import router as scenarios_router
from app.api.routes.simulation_runs import router as simulation_runs_router
from app.api.websocket.connectivity import router as websocket_router
from app.config.settings import settings
from app.services.ai_analysis_service import AIProviderConfigurationError, AIRequestNotFoundError
from app.services.scenario_service import ScenarioNotFoundError, ScenarioValidationError
from app.services.simulation_service import (
    SimulationConfigurationError,
    SimulationExecutionFailedError,
    SimulationRunConflictError,
    SimulationRunNotFoundError,
)

app = FastAPI(title=settings.app_name)

if settings.auth_dev_bypass_uid:
    import logging

    logging.getLogger("uvicorn.error").warning(
        "AUTH_DEV_BYPASS_UID is set (%s): unauthenticated requests are treated as that user. "
        "Local development only — never enable this in a deployed environment.",
        settings.auth_dev_bypass_uid,
    )

# Local development only — production CORS must be restricted to the
# deployed frontend origin(s), never allow_origins=["*"].
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ScenarioNotFoundError)
def handle_scenario_not_found(request: Request, exc: ScenarioNotFoundError) -> JSONResponse:
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(ScenarioValidationError)
def handle_scenario_validation_error(request: Request, exc: ScenarioValidationError) -> JSONResponse:
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.exception_handler(SimulationRunNotFoundError)
def handle_simulation_run_not_found(request: Request, exc: SimulationRunNotFoundError) -> JSONResponse:
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(SimulationRunConflictError)
def handle_simulation_run_conflict(request: Request, exc: SimulationRunConflictError) -> JSONResponse:
    return JSONResponse(status_code=409, content={"detail": str(exc)})


@app.exception_handler(SimulationConfigurationError)
def handle_simulation_configuration_error(request: Request, exc: SimulationConfigurationError) -> JSONResponse:
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.exception_handler(SimulationExecutionFailedError)
def handle_simulation_execution_failed(request: Request, exc: SimulationExecutionFailedError) -> JSONResponse:
    return JSONResponse(status_code=500, content={"detail": str(exc)})


@app.exception_handler(AIRequestNotFoundError)
def handle_ai_request_not_found(request: Request, exc: AIRequestNotFoundError) -> JSONResponse:
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(AIProviderConfigurationError)
def handle_ai_provider_configuration(request: Request, exc: AIProviderConfigurationError) -> JSONResponse:
    return JSONResponse(status_code=503, content={"detail": str(exc)})


app.include_router(health_router)
app.include_router(auth_router)
app.include_router(websocket_router)
app.include_router(scenarios_router)
app.include_router(simulation_runs_router)
app.include_router(disaster_types_router)
app.include_router(infrastructure_assets_router)
app.include_router(geographic_features_router)
app.include_router(ai_router)
