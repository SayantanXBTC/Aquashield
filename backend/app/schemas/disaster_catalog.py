"""API response schema for GET /disaster-types. Mirrored on the frontend as
`DisasterCatalogEntry` in shared/types/index.ts — see that file's comment."""

from __future__ import annotations

from pydantic import BaseModel

from app.db.models.enums import DisasterType


class DisasterCatalogEntry(BaseModel):
    disaster_type: DisasterType
    display_name: str
    short_description: str
    category: str
    model_identifier: str
    parameter_keys: list[str]
