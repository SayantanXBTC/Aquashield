from fastapi import APIRouter

from app.config.settings import settings

router = APIRouter()


@router.get("/health")
def get_health() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name}
