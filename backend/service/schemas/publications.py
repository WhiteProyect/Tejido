"""Reemplaza backend/services/validation.py::publication_input().

Mismas reglas exactas (rangos de longitud, kinds permitidos) para no cambiar
el comportamiento que ya espera el frontend.

Fase 6.1: start_date/end_date pasan de str a datetime -- Pydantic valida
formato ISO 8601 nativamente (fecha sola o fecha+hora), rechazando con 400
cualquier valor que no lo sea, en vez de guardarlo tal cual en la base de
datos como pasaba antes.
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator

ALLOWED_KINDS = {"HISTORIA", "EVENTO", "OPORTUNIDAD", "TALENTO", "INICIATIVA"}


class PublicationInput(BaseModel):
    kind: str = "HISTORIA"
    category_id: int
    title: str
    summary: str
    content: str
    location: str = "Caucasia"
    image: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    link: Optional[str] = None
    featured: bool = False
    publish: bool = False

    @field_validator("kind", mode="before")
    @classmethod
    def _normalize_kind(cls, v):
        v = str(v or "HISTORIA").strip().upper()
        if v not in ALLOWED_KINDS:
            raise ValueError("Selecciona un tipo de publicación válido")
        return v

    @field_validator("category_id", mode="before")
    @classmethod
    def _parse_category_id(cls, v):
        try:
            return int(v)
        except (TypeError, ValueError):
            raise ValueError("Selecciona una categoría válida")

    @field_validator("title")
    @classmethod
    def _check_title(cls, v):
        v = (v or "").strip()
        if not 5 <= len(v) <= 180:
            raise ValueError("El título debe tener entre 5 y 180 caracteres")
        return v

    @field_validator("summary")
    @classmethod
    def _check_summary(cls, v):
        v = (v or "").strip()
        if not 10 <= len(v) <= 500:
            raise ValueError("El resumen debe tener entre 10 y 500 caracteres")
        return v

    @field_validator("content")
    @classmethod
    def _check_content(cls, v):
        v = (v or "").strip()
        if not 20 <= len(v) <= 20000:
            raise ValueError("El contenido debe tener entre 20 y 20000 caracteres")
        return v

    @field_validator("location", mode="before")
    @classmethod
    def _check_location(cls, v):
        v = str(v if v is not None else "Caucasia").strip() or "Caucasia"
        if len(v) > 180:
            raise ValueError("El lugar es demasiado largo")
        return v


class PublicationStatusInput(BaseModel):
    status: str
    note: str = ""

    @field_validator("note", mode="before")
    @classmethod
    def _normalize_note(cls, v):
        return str(v or "").strip()
