from fastapi import APIRouter

from app.core.auth import CurrentUser
from app.schemas.auth import AuthenticatedUserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=AuthenticatedUserOut)
def get_me(user: CurrentUser) -> AuthenticatedUserOut:
    """Echoes the verified identity behind the bearer token. The frontend
    calls this once after sign-in to confirm the backend accepts the
    Firebase project's tokens (a misconfigured FIREBASE_PROJECT_ID surfaces
    here as a 401/503 instead of as a mysterious empty scenario list)."""
    return AuthenticatedUserOut(
        uid=user.uid,
        email=user.email,
        name=user.name,
        picture=user.picture,
        sign_in_provider=user.sign_in_provider,
    )
