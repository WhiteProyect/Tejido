"""Modelos Pydantic para backend/service/api/routes/collaborators.py.

Fase 6: antes vivian inline en el router (unico modulo, junto con artists.py,
que todavia validaba a mano en vez de seguir el patron declarativo que ya
usa schemas/publications.py). Mismas reglas, sin cambio de comportamiento.
"""
from typing import Optional

from pydantic import BaseModel, field_validator


class ShareInput(BaseModel):
    publication_id: Optional[int] = None


class ReportActivityInput(BaseModel):
    type: str = ""
    description: str = ""
    evidence_url: Optional[str] = None

    @field_validator("type", "description", mode="before")
    @classmethod
    def _strip(cls, v):
        return str(v or "").strip()

    @field_validator("evidence_url", mode="before")
    @classmethod
    def _strip_evidence(cls, v):
        v = str(v or "").strip()
        return v or None


class RedeemInput(BaseModel):
    reward_id: Optional[int] = None
