"""Entradas de lider de rama y solicitudes de ingreso (services/branches.py)."""
from typing import Optional

from pydantic import BaseModel, field_validator


def _optional_text(v, limit: int, label: str):
    v = str(v or "").strip()
    if len(v) > limit:
        raise ValueError(f"{label} no puede superar {limit} caracteres")
    return v or None


class LeaderInput(BaseModel):
    gestor_id: int


class JoinRequestInput(BaseModel):
    branch: str
    message: Optional[str] = None

    @field_validator("branch", mode="before")
    @classmethod
    def _branch(cls, v):
        return str(v or "").strip().upper()

    @field_validator("message", mode="before")
    @classmethod
    def _message(cls, v):
        return _optional_text(v, 500, "El mensaje")


class RejectInput(BaseModel):
    note: Optional[str] = None

    @field_validator("note", mode="before")
    @classmethod
    def _note(cls, v):
        return _optional_text(v, 300, "La nota")
