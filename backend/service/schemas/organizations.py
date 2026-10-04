"""Entradas del alta y edicion de gestores (organizacion + rama cultural).

Las ramas son las categorias culturales de schemas/cultural_categories.py, la misma lista
que usan las publicaciones.
"""
from typing import Optional

from pydantic import BaseModel, field_validator

from backend.service.schemas.cultural_categories import CULTURAL_CATEGORIES
from backend.service.schemas.users import image_url


def _branch(v):
    v = str(v or "").strip().upper()
    if v not in CULTURAL_CATEGORIES:
        raise ValueError("Selecciona una rama cultural valida")
    return v


def _required(v, message):
    v = str(v or "").strip()
    if not v:
        raise ValueError(message)
    return v


class GestorCreateInput(BaseModel):
    name: str
    email: str
    organization_name: str
    branch: str
    contact: Optional[str] = None

    @field_validator("name", mode="before")
    @classmethod
    def _name(cls, v):
        return _required(v, "El nombre es obligatorio")

    @field_validator("email", mode="before")
    @classmethod
    def _email(cls, v):
        v = _required(v, "El correo es obligatorio").lower()
        local, _, domain = v.partition("@")
        if not local or "." not in domain or " " in v:
            raise ValueError("Escribe un correo valido")
        return v

    @field_validator("organization_name", mode="before")
    @classmethod
    def _organization(cls, v):
        return _required(v, "El nombre de la organizacion es obligatorio")

    @field_validator("branch", mode="before")
    @classmethod
    def _validate_branch(cls, v):
        return _branch(v)

    @field_validator("contact", mode="before")
    @classmethod
    def _contact(cls, v):
        v = str(v or "").strip()
        return v or None


class GestorUpdateInput(BaseModel):
    """PATCH parcial: solo se aplican los campos enviados."""
    active: Optional[bool] = None
    organization_name: Optional[str] = None
    branch: Optional[str] = None
    contact: Optional[str] = None
    photo_url: Optional[str] = None

    @field_validator("organization_name", mode="before")
    @classmethod
    def _organization(cls, v):
        return None if v is None else _required(v, "El nombre de la organizacion no puede quedar vacio")

    @field_validator("branch", mode="before")
    @classmethod
    def _validate_branch(cls, v):
        return None if v is None else _branch(v)

    @field_validator("contact", mode="before")
    @classmethod
    def _contact(cls, v):
        return None if v is None else (str(v).strip() or "")

    @field_validator("photo_url", mode="before")
    @classmethod
    def _photo_url(cls, v):
        # Vacio = quitar la foto (None); mismas reglas que el avatar del usuario.
        return image_url(v)
