from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.health import router as health_router
from app.api.websocket.connectivity import router as websocket_router
from app.config.settings import settings

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

app.include_router(health_router)
app.include_router(websocket_router)
