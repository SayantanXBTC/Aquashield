from fastapi import APIRouter, HTTPException

from app.config.settings import settings
from app.db.init_db import check_connection

router = APIRouter()


@router.get("/health")
def get_health() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name}


@router.get("/health/db")
def get_health_db() -> dict[str, str]:
    """Dev-only connectivity check proving FastAPI -> SQLAlchemy -> PostgreSQL/PostGIS
    works. No credentials or query results are exposed in the response."""
    try:
        check_connection()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database unreachable: {type(exc).__name__}") from exc
    return {"status": "ok", "database": "reachable"}
