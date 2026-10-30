from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Header, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.service.api.deps import get_current_user, require_login, require_roles
from backend.service.core.rate_limit import (
    allow_password_reset, allow_verification_resend, is_login_locked, is_signup_locked, register_login_failure,
    register_signup_attempt,
)
from backend.service.db.session import get_db
from backend.service.errors import AppError
from backend.service.models.tables import User
from backend.service.schemas.users import (
    EmailInput, OrganizationSelfUpdateInput, ResetPasswordInput, SignupInput, TokenInput, UserSelfUpdateInput, full_name,
    normalize_email,
)
from backend.service.services import accounts, notifications
from backend.service.services.auth import login_user, logout_user
from backend.service.services.email_tokens import token_link
from backend.service.services.branches import me_branch
from backend.service.services.invites import accept_invite
from backend.service.services.organizations import get_my_organization, update_my_organization
from backend.service.services.publications import category_overview
from backend.service.services.signup import signup_user

router = APIRouter()


class LoginInput(BaseModel):
    email: Optional[str] = None
    password: str = ""


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
def signup(payload: SignupInput, request: Request, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Publico: crea una cuenta CIUDADANO activa, con el correo SIN verificar, y deja la sesion
    abierta (mismo shape de respuesta que /api/auth/login). El correo de verificacion sale en
    segundo plano: si falla, el registro no falla (se loguea)."""
    if not payload.accept_terms:
        raise AppError(422, "TERMS_REQUIRED",
                       "Para crear tu cuenta debes aceptar los Términos y Condiciones y la Política de Privacidad")
    client_ip = request.client.host if request.client else "unknown"
    if is_signup_locked(client_ip):
        raise AppError(429, "TOO_MANY_ATTEMPTS", "Demasiados intentos de registro. Intenta de nuevo en unos minutos.")
    register_signup_attempt(client_ip)

    token, user, verify_token = signup_user(db, payload)
    db.commit()
    background_tasks.add_task(notifications.notify_verify_email, user["email"], user["first_name"],
                              token_link("VERIFY", verify_token))
    return {"token": token, "user": user}


@router.post("/api/auth/verify-email")
def verify_email(payload: TokenInput, db: Session = Depends(get_db)):
    """Publico: marca el correo como verificado con el enlace del correo (idempotente)."""
    already = accounts.verify_email(db, payload.token)
    return {"ok": True, "already_verified": already,
            "message": "Tu correo ya estaba verificado." if already else "¡Listo! Tu correo quedó verificado."}


@router.post("/api/auth/resend-verification")
def resend_verification(background_tasks: BackgroundTasks, user: Optional[dict] = Depends(get_current_user),
                        db: Session = Depends(get_db)):
    """Con sesion: reenvia el correo de verificacion (1 por minuto y 5 por hora)."""
    require_login(user, "Inicia sesión para pedir el correo de verificación")
    if user["email_verified"]:
        return {"ok": True, "sent": False, "message": "Tu correo ya está verificado."}
    limited = allow_verification_resend(user["id"])
    if limited == "minute":
        raise AppError(429, "RATE_LIMITED", "Ya te enviamos un correo hace menos de un minuto. Espera un momento antes de pedir otro.")
    if limited == "hour":
        raise AppError(429, "RATE_LIMITED", "Pediste varios correos en la última hora. Inténtalo de nuevo más tarde.")
    pending = accounts.start_verification(db, user["id"])
    if pending is None:
        return {"ok": True, "sent": False, "message": "Tu correo ya está verificado."}
    email, name, verify_token = pending
    db.commit()
    background_tasks.add_task(notifications.notify_verify_email, email, name, token_link("VERIFY", verify_token))
    return {"ok": True, "sent": True, "message": f"Te enviamos un correo nuevo a {email}."}


FORGOT_MESSAGE = "Si hay una cuenta con ese correo, te enviamos un enlace para restablecer la contraseña. Revisa tu bandeja (y el spam)."


@router.post("/api/auth/forgot-password")
def forgot_password(payload: EmailInput, request: Request, background_tasks: BackgroundTasks,
                    db: Session = Depends(get_db)):
    """Publico: SIEMPRE el mismo mensaje, exista o no la cuenta (no revela cuales existen)."""
    try:
        email = normalize_email(payload.email)
    except ValueError:
        raise AppError(400, "VALIDATION", "Escribe un correo valido")
    client_ip = request.client.host if request.client else "unknown"
    if not allow_password_reset(client_ip, email):
        raise AppError(429, "RATE_LIMITED", "Pediste varios enlaces seguidos. Inténtalo de nuevo en unos minutos.")
    pending = accounts.start_password_reset(db, email)
    if pending is not None:
        to_email, name, reset_token = pending
        db.commit()
        background_tasks.add_task(notifications.notify_password_reset, to_email, name, token_link("RESET", reset_token))
    return {"ok": True, "message": FORGOT_MESSAGE}


@router.post("/api/auth/reset-password")
def reset_password(payload: ResetPasswordInput, db: Session = Depends(get_db)):
    """Publico: nueva contrasena con el enlace del correo. Cierra todas las sesiones anteriores y no
    abre una nueva: despues se inicia sesion como siempre."""
    accounts.reset_password(db, payload.token, payload.password)
    return {"ok": True, "message": "Tu contraseña cambió. Ya puedes iniciar sesión con la nueva."}


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
def me(user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    """Sesion actual. branch / is_leader: la rama de un GESTOR y si la lidera (null / false para
    los demas roles)."""
    return {"user": {**user, **me_branch(db, user)} if user else None}


@router.patch("/api/me")
def update_me(payload: UserSelfUpdateInput, user: Optional[dict] = Depends(get_current_user),
              db: Session = Depends(get_db)):
    """El usuario autenticado edita su nombre (o nombre y apellido), municipio y foto. Siempre sobre
    su propia fila (user["id"] de la sesion); el body no puede elegir otro usuario ni tocar email,
    rol ni la verificacion. Devuelve el mismo shape que GET /api/me."""
    require_login(user)
    row = db.get(User, user["id"])
    sent = payload.model_fields_set
    if "name" in sent and payload.name is not None:
        row.name = payload.name
    if "first_name" in sent and payload.first_name is not None:
        row.first_name = payload.first_name
    if "last_name" in sent and payload.last_name is not None:
        row.last_name = payload.last_name
    # Nombre y apellido mandan: `name` se recompone en cuanto estan los dos.
    if sent & {"first_name", "last_name"} and row.first_name and row.last_name:
        row.name = full_name(row.first_name, row.last_name)
    if "municipality" in sent:
        row.municipality = payload.municipality
    if "avatar_url" in sent:
        row.avatar_url = payload.avatar_url
    db.flush()
    return {"user": {**user, "name": row.name, "avatar_url": row.avatar_url, "first_name": row.first_name,
                     "last_name": row.last_name, "municipality": row.municipality, **me_branch(db, user)}}


GESTOR_ONLY = "Solo un gestor tiene una organización propia"


@router.get("/api/me/organization")
def my_organization(user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    """La organizacion (biografia publica) del gestor autenticado."""
    require_roles(user, ("GESTOR",), GESTOR_ONLY)
    return get_my_organization(db, user["id"])


@router.get("/api/me/category")
def my_category(user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    """La categoria del gestor: su rama, sus conteos por estado, sus colegas y lo publicado o en
    revision por otros autores de la misma categoria (solo lectura)."""
    require_roles(user, ("GESTOR",), GESTOR_ONLY)
    return category_overview(db, user["id"])


@router.patch("/api/me/organization")
def update_organization(payload: OrganizationSelfUpdateInput, user: Optional[dict] = Depends(get_current_user),
                        db: Session = Depends(get_db)):
    """El gestor edita nombre, biografia, foto y contacto de su organizacion. Rama y estado
    son del admin y se ignoran si llegan en el body."""
    require_roles(user, ("GESTOR",), GESTOR_ONLY)
    return update_my_organization(db, user["id"], payload)
