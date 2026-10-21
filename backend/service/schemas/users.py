"""Entradas que el propio usuario puede enviar sobre su cuenta."""
from typing import Optional

from pydantic import BaseModel, field_validator

from backend.service.schemas.fields import optional_text as _optional_text
from backend.service.schemas.fields import url_or_path as image_url

MAX_NAME_LENGTH = 120


class UserSelfUpdateInput(BaseModel):
    """PATCH /api/me: solo se aplica lo enviado. Campos extra (id, role, email) se ignoran."""
    name: Optional[str] = None
    avatar_url: Optional[str] = None

    @field_validator("name", mode="before")
    @classmethod
    def _name(cls, v):
        if v is None:
            return None
        v = str(v).strip()
        if not v:
            raise ValueError("El nombre no puede quedar vacío")
        if len(v) > MAX_NAME_LENGTH:
            raise ValueError(f"El nombre no puede superar {MAX_NAME_LENGTH} caracteres")
        return v

    @field_validator("avatar_url", mode="before")
    @classmethod
    def _avatar_url(cls, v):
        return image_url(v)


MAX_DESCRIPTION_LENGTH = 2000


class OrganizationSelfUpdateInput(BaseModel):
    """PATCH /api/me/organization: el gestor edita su biografia publica. Solo lo enviado.
    branch y active NO estan: los decide un admin (/api/admin/gestores/{id}); si vienen en el
    body se ignoran."""
    name: Optional[str] = None
    description: Optional[str] = None
    photo_url: Optional[str] = None
    contact: Optional[str] = None

    @field_validator("name", mode="before")
    @classmethod
    def _name(cls, v):
        if v is None:
            return None
        v = str(v).strip()
        if not v:
            raise ValueError("El nombre de la organización no puede quedar vacío")
        if len(v) > MAX_NAME_LENGTH:
            raise ValueError(f"El nombre no puede superar {MAX_NAME_LENGTH} caracteres")
        return v

    @field_validator("description", mode="before")
    @classmethod
    def _description(cls, v):
        return _optional_text(v, MAX_DESCRIPTION_LENGTH, "La biografía")

    @field_validator("photo_url", mode="before")
    @classmethod
    def _photo_url(cls, v):
        return image_url(v)

    @field_validator("contact", mode="before")
    @classmethod
    def _contact(cls, v):
        return _optional_text(v, 200, "El contacto")
