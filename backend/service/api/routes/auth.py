from typing import Optional

from fastapi import APIRouter, Depends, Header, Request
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from backend.service.api.deps import get_current_user, require_login, require_roles
from backend.service.core.rate_limit import (
    is_login_locked, is_signup_locked, register_login_failure, register_signup_attempt,
)
from backend.service.db.session import get_db
from backend.service.errors import AppError
from backend.service.models.tables import User
from backend.service.schemas.users import OrganizationSelfUpdateInput, UserSelfUpdateInput
from backend.service.services.auth import login_user, logout_user
from backend.service.services.invites import accept_invite
from backend.service.services.organizations import get_my_organization, update_my_organization
from backend.service.services.signup import signup_user

router = APIRouter()


class LoginInput(BaseModel):
    email: Optional[str] = None
    password: str = ""


class SignupInput(BaseModel):
    name: str
    email: str
    password: str = ""

    @field_validator("name", mode="before")
    @classmethod
    def _name(cls, v):
        v = str(v or "").strip()
        if not v:
            raise ValueError("El nombre es obligatorio")
        return v

    @field_validator("email", mode="before")
    @classmethod
    def _email(cls, v):
        v = str(v or "").strip().lower()
        local, _, domain = v.partition("@")
        if not local or "." not in domain or " " in v:
            raise ValueError("Escribe un correo valido")
        return v


class AcceptInviteInput(BaseModel):
    token: str = ""
    password: str = ""


@router.post("/api/auth/login")
def login(payload: LoginInput, request: Request, db: Session = Depends(get_db)):
    email = str(payload.email or "").strip().lower()
    client_ip = request.client.host if request.client else "unknown"

    if is_login_locked(client_ip, email):
        raise AppError(429, "TOO_MANY_ATTEMPTS", "Demasiados intentos fallidos. Intenta de nuevo en unos minutos.")

    result = login_user(db, payload.email, payload.password)
    if not result:
        register_login_failure(client_ip, email)
        raise AppError(401, "INVALID_CREDENTIALS", "Correo o contrasena incorrectos")
    token, user = result
    return {"token": token, "user": user}


@router.post("/api/auth/signup")
def signup(payload: SignupInput, request: Request, db: Session = Depends(get_db)):
    """Publico: crea una cuenta CIUDADANO activa y deja la sesion abierta
    (mismo shape de respuesta que /api/auth/login)."""
    client_ip = request.client.host if request.client else "unknown"
    if is_signup_locked(client_ip):
        raise AppError(429, "TOO_MANY_ATTEMPTS", "Demasiados intentos de registro. Intenta de nuevo en unos minutos.")
    register_signup_attempt(client_ip)

    token, user = signup_user(db, payload.name, payload.email, payload.password)
    return {"token": token, "user": user}


@router.post("/api/auth/accept-invite")
def accept_invite_route(payload: AcceptInviteInput, db: Session = Depends(get_db)):
    """Publico: define la contrasena desde el link de invitacion y deja la sesion abierta
    (mismo shape de respuesta que /api/auth/login)."""
    token, user = accept_invite(db, payload.token, payload.password)
    return {"token": token, "user": user}


@router.post("/api/auth/logout")
def logout(authorization: Optional[str] = Header(default=None), db: Session = Depends(get_db)):
    token = authorization[7:] if authorization and authorization.startswith("Bearer ") else ""
    logout_user(db, token)
    return {"ok": True}


@router.get("/api/me")
def me(user: Optional[dict] = Depends(get_current_user)):
    return {"user": user}


@router.patch("/api/me")
def update_me(payload: UserSelfUpdateInput, user: Optional[dict] = Depends(get_current_user),
              db: Session = Depends(get_db)):
    """El usuario autenticado edita su nombre y su foto. Siempre sobre su propia fila
    (user["id"] de la sesion); el body no puede elegir otro usuario ni tocar email o rol.
    Devuelve el mismo shape que GET /api/me."""
    require_login(user)
    row = db.get(User, user["id"])
    sent = payload.model_fields_set
    if "name" in sent and payload.name is not None:
        row.name = payload.name
    if "avatar_url" in sent:
        row.avatar_url = payload.avatar_url
    db.flush()
    return {"user": {**user, "name": row.name, "avatar_url": row.avatar_url}}


GESTOR_ONLY = "Solo un gestor tiene una organización propia"


@router.get("/api/me/organization")
def my_organization(user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    """La organizacion (biografia publica) del gestor autenticado."""
    require_roles(user, ("GESTOR",), GESTOR_ONLY)
    return get_my_organization(db, user["id"])


@router.patch("/api/me/organization")
def update_organization(payload: OrganizationSelfUpdateInput, user: Optional[dict] = Depends(get_current_user),
                        db: Session = Depends(get_db)):
    """El gestor edita nombre, biografia, foto y contacto de su organizacion. Rama y estado
    son del admin y se ignoran si llegan en el body."""
    require_roles(user, ("GESTOR",), GESTOR_ONLY)
    return update_my_organization(db, user["id"], payload)
