"""Entradas que el propio usuario puede enviar sobre su cuenta (registro, perfil, contrasena)."""
import re
from typing import Optional

from pydantic import BaseModel, field_validator

from backend.service.schemas.fields import optional_text as _optional_text
from backend.service.schemas.fields import url_or_path as image_url
from backend.service.schemas.municipalities import MUNICIPALITIES

MAX_NAME_LENGTH = 120
# Version de los Terminos y la Politica de Privacidad que acepta quien se registra (la fecha de
# frontend/src/screens/legal/legalContent.jsx). Cambiarla aqui cuando cambien los textos.
TERMS_VERSION = "2026-10"
PERSON_NAME_MIN, PERSON_NAME_MAX = 2, 60


def person_name(v, label):
    """Nombre o apellido: obligatorio, 2 a 60 caracteres, sin espacios sobrantes."""
    v = re.sub(r"\s+", " ", str(v or "")).strip()
    if not v:
        raise ValueError(f"{label} es obligatorio")
    if not PERSON_NAME_MIN <= len(v) <= PERSON_NAME_MAX:
        raise ValueError(f"{label} debe tener entre {PERSON_NAME_MIN} y {PERSON_NAME_MAX} caracteres")
    return v


def municipality(v):
    """Municipio opcional: vacio = sin municipio; si viene, uno de los 6 del Bajo Cauca."""
    v = str(v or "").strip().lower()
    if not v:
        return None
    if v not in MUNICIPALITIES:
        raise ValueError("Elige un municipio de la lista")
    return v


def full_name(first_name: str, last_name: str) -> str:
    return f"{first_name} {last_name}".strip()


def normalize_email(v):
    v = str(v or "").strip().lower()
    local, _, domain = v.partition("@")
    if not local or "." not in domain or " " in v:
        raise ValueError("Escribe un correo valido")
    return v


class SignupInput(BaseModel):
    """POST /api/auth/signup. accept_terms se revisa en la ruta (422 con mensaje propio)."""
    first_name: str
    last_name: str
    email: str
    password: str = ""
    municipality: Optional[str] = None
    accept_terms: bool = False

    @field_validator("first_name", mode="before")
    @classmethod
    def _first(cls, v):
        return person_name(v, "El nombre")

    @field_validator("last_name", mode="before")
    @classmethod
    def _last(cls, v):
        return person_name(v, "El apellido")

    @field_validator("email", mode="before")
    @classmethod
    def _email(cls, v):
        return normalize_email(v)

    @field_validator("municipality", mode="before")
    @classmethod
    def _municipality(cls, v):
        return municipality(v)


class EmailInput(BaseModel):
    email: str = ""


class TokenInput(BaseModel):
    token: str = ""


class ResetPasswordInput(BaseModel):
    token: str = ""
    password: str = ""


class UserSelfUpdateInput(BaseModel):
    """PATCH /api/me: solo se aplica lo enviado. Campos extra (id, role, email, verificacion) se
    ignoran. first_name / last_name recomponen `name`; `name` solo se sigue aceptando para las
    cuentas que no tienen nombre y apellido por separado."""
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    municipality: Optional[str] = None

    @field_validator("first_name", mode="before")
    @classmethod
    def _first(cls, v):
        return None if v is None else person_name(v, "El nombre")

    @field_validator("last_name", mode="before")
    @classmethod
    def _last(cls, v):
        return None if v is None else person_name(v, "El apellido")

    @field_validator("municipality", mode="before")
    @classmethod
    def _municipality(cls, v):
        return municipality(v)

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
