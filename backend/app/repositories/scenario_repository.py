from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.db.models.enums import DisasterType, ScenarioStatus
from app.db.models.scenario import Scenario
from app.db.models.scenario_version import ScenarioVersion

# Whitelisted sort fields — never accept a raw column/SQL string from the API.
SORTABLE_FIELDS = {
    "created_at": Scenario.created_at,
    "updated_at": Scenario.updated_at,
    "name": Scenario.name,
}


class ScenarioRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def add(self, scenario: Scenario) -> Scenario:
        self.session.add(scenario)
        self.session.flush()
        return scenario

    def get(self, scenario_id: UUID, *, owner_uid: str | None = None) -> Scenario | None:
        """`owner_uid` (when given) is applied as a filter, so a scenario
        owned by someone else reads as "not found" — never as "forbidden",
        which would leak that the id exists."""
        scenario = self.session.get(Scenario, scenario_id)
        if scenario is None:
            return None
        if owner_uid is not None and scenario.owner_uid != owner_uid:
            return None
        return scenario

    def get_with_versions(self, scenario_id: UUID) -> Scenario | None:
        stmt = (
            select(Scenario)
            .options(joinedload(Scenario.versions))
            .where(Scenario.id == scenario_id)
        )
        return self.session.execute(stmt).unique().scalar_one_or_none()

    def list(
        self,
        *,
        owner_uid: str,
        disaster_type: DisasterType | None = None,
        status: ScenarioStatus | None = None,
        search: str | None = None,
        sort_by: str = "created_at",
        sort_dir: str = "desc",
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[Scenario], int]:
        if sort_by not in SORTABLE_FIELDS:
            raise ValueError(f"Unsupported sort_by '{sort_by}'. Allowed: {sorted(SORTABLE_FIELDS)}")
        if sort_dir not in {"asc", "desc"}:
            raise ValueError("sort_dir must be 'asc' or 'desc'")

        stmt = select(Scenario).where(Scenario.owner_uid == owner_uid)
        count_stmt = select(func.count()).select_from(Scenario).where(Scenario.owner_uid == owner_uid)

        if disaster_type is not None:
            stmt = stmt.where(Scenario.disaster_type == disaster_type)
            count_stmt = count_stmt.where(Scenario.disaster_type == disaster_type)
        if status is not None:
            stmt = stmt.where(Scenario.status == status)
            count_stmt = count_stmt.where(Scenario.status == status)
        if search:
            pattern = f"%{search}%"
            stmt = stmt.where(Scenario.name.ilike(pattern))
            count_stmt = count_stmt.where(Scenario.name.ilike(pattern))

        column = SORTABLE_FIELDS[sort_by]
        stmt = stmt.order_by(column.asc() if sort_dir == "asc" else column.desc())
        stmt = stmt.limit(limit).offset(offset)

        items = list(self.session.execute(stmt).scalars().all())
        total = self.session.execute(count_stmt).scalar_one()
        return items, total

    def add_version(self, version: ScenarioVersion) -> ScenarioVersion:
        self.session.add(version)
        self.session.flush()
        return version

    def get_current_version(self, scenario_id: UUID) -> ScenarioVersion | None:
        stmt = (
            select(ScenarioVersion)
            .where(ScenarioVersion.scenario_id == scenario_id)
            .order_by(ScenarioVersion.version_number.desc())
            .limit(1)
        )
        return self.session.execute(stmt).scalar_one_or_none()

    def list_versions(self, scenario_id: UUID) -> list[ScenarioVersion]:
        stmt = (
            select(ScenarioVersion)
            .where(ScenarioVersion.scenario_id == scenario_id)
            .order_by(ScenarioVersion.version_number.asc())
        )
        return list(self.session.execute(stmt).scalars().all())

    def get_version(self, scenario_id: UUID, version_id: UUID) -> ScenarioVersion | None:
        stmt = select(ScenarioVersion).where(
            ScenarioVersion.scenario_id == scenario_id, ScenarioVersion.id == version_id
        )
        return self.session.execute(stmt).scalar_one_or_none()

    def next_version_number(self, scenario_id: UUID) -> int:
        current = self.get_current_version(scenario_id)
        return (current.version_number + 1) if current else 1
