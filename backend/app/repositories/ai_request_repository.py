from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.ai_request import AIRequest


class AIRequestRepository:
    """The only table the AI layer writes. Reads are owner-scoped."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def add(self, request: AIRequest) -> AIRequest:
        self.session.add(request)
        self.session.flush()
        return request

    def get(self, request_id: UUID, *, owner_uid: str) -> AIRequest | None:
        stmt = select(AIRequest).where(AIRequest.id == request_id, AIRequest.owner_uid == owner_uid)
        return self.session.execute(stmt).scalar_one_or_none()

    def list_for_run(self, simulation_run_id: UUID, *, owner_uid: str, limit: int = 20) -> list[AIRequest]:
        stmt = (
            select(AIRequest)
            .where(AIRequest.simulation_run_id == simulation_run_id, AIRequest.owner_uid == owner_uid)
            .order_by(AIRequest.created_at.desc())
            .limit(limit)
        )
        return list(self.session.execute(stmt).scalars().all())
