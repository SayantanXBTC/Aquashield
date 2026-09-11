from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes.health import router as health_router
from app.api.routes.scenarios import router as scenarios_router
from app.api.websocket.connectivity import router as websocket_router
from app.config.settings import settings
from app.services.scenario_service import ScenarioNotFoundError, ScenarioValidationError

app = FastAPI(title=settings.app_name)

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


app.include_router(health_router)
app.include_router(websocket_router)
app.include_router(scenarios_router)
