from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.service.api.deps import get_current_user, require_login
from backend.service.core.rate_limit import allow_upload_signature
from backend.service.db.session import get_db
from backend.service.errors import AppError
from backend.service.schemas.uploads import UploadSignInput
from backend.service.services import artists as artists_service
from backend.service.services.branches import leader_of
from backend.service.services import uploads as svc

router = APIRouter(prefix="/api/uploads")

# Quien puede subir a cada scope. La carpeta la decide el servidor, nunca el cliente.
SCOPE_ROLES = {
    "artist": {"ADMIN"},
    "publication": {"ADMIN", "GESTOR"},
    "organization": {"GESTOR"},
    "avatar": {"ADMIN", "GESTOR", "CIUDADANO"},
    # GESTOR solo si es lider de su rama (se revisa abajo con la base).
    "talent": {"ADMIN", "GESTOR"},
}
SCOPE_FOLDERS = {
    "publication": "tejido/publicaciones",
    "organization": "tejido/gestores",
    "avatar": "tejido/perfiles",
    "talent": "tejido/talento",
}


def _folder(db: Session, payload: UploadSignInput) -> str:
    if payload.scope != "artist":
        return SCOPE_FOLDERS[payload.scope]
    # Un artista nuevo aun no tiene id: sus fotos se suben desde el editor, ya creado.
    if payload.ref is None:
        raise AppError(400, "VALIDATION", "Para subir fotos de un artista, primero hay que crearlo")
    artist = artists_service.get_artist_by_id(db, payload.ref, include_inactive=True)
    if not artist:
        raise AppError(404, "NOT_FOUND", "Artista no encontrado")
    return f"tejido/artistas/{artist['slug']}"


@router.post("/sign")
def sign_upload(payload: UploadSignInput, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    require_login(user, "Inicia sesión para subir imágenes")
    if user["role"] not in SCOPE_ROLES[payload.scope]:
        raise AppError(403, "FORBIDDEN", "No puedes subir imágenes aquí")
    if payload.scope == "talent" and user["role"] == "GESTOR" and leader_of(db, user["id"]) is None:
        raise AppError(403, "FORBIDDEN", "Solo el líder de una rama o un administrador pueden subir fotos de talento")
    folder = _folder(db, payload)
    if not svc.is_configured():
        raise AppError(503, "UPLOADS_DISABLED", "La subida de imágenes no está configurada. Por ahora pega un enlace.")
    if not allow_upload_signature(user["id"]):
        raise AppError(429, "RATE_LIMITED", "Demasiadas subidas seguidas. Espera un minuto e inténtalo de nuevo.")
    return svc.signed_upload(folder)
