from typing import Optional

from fastapi import APIRouter, Depends, Header, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.service.api.deps import get_current_user
from backend.service.core.rate_limit import is_login_locked, register_login_failure
from backend.service.db.session import get_db
from backend.service.errors import AppError
from backend.service.services.auth import login_user, logout_user

router = APIRouter()


class LoginInput(BaseModel):
    email: Optional[str] = None
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


@router.post("/api/auth/logout")
def logout(authorization: Optional[str] = Header(default=None), db: Session = Depends(get_db)):
    token = authorization[7:] if authorization and authorization.startswith("Bearer ") else ""
    logout_user(db, token)
    return {"ok": True}


@router.get("/api/me")
def me(user: Optional[dict] = Depends(get_current_user)):
    return {"user": user}
