"""Entradas de la pestaña Usuarios del admin (services/users.py y los cambios de rol de services/branches.py)."""
from typing import Optional

from pydantic import BaseModel, field_validator

from backend.service.schemas.branches import _optional_text


class UserUpdateInput(BaseModel):
    """Lo que el admin edita de una cuenta. El correo no se edita."""
    name: Optional[str] = None
    municipality: Optional[str] = None
    active: Optional[bool] = None

    @field_validator("municipality", mode="before")
    @classmethod
    def _municipality(cls, v):
        return str(v).strip().lower() or None if v is not None else None


class MakeGestorInput(BaseModel):
    """Ciudadano -> gestor de la rama (leader: ademas, lider)."""
    branch: str
    organization_name: Optional[str] = None
    leader: bool = False

    @field_validator("branch", mode="before")
    @classmethod
    def _branch(cls, v):
        return str(v or "").strip().upper()

    @field_validator("organization_name", mode="before")
    @classmethod
    def _organization_name(cls, v):
        return _optional_text(v, 120, "El nombre de la organización")


class MoveBranchInput(BaseModel):
    """Gestor -> otra rama (lead: y queda de lider)."""
    branch: str
    lead: bool = False

    @field_validator("branch", mode="before")
    @classmethod
    def _branch(cls, v):
        return str(v or "").strip().upper()
