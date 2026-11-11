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
    # GESTOR solo si es lider de la rama Musica y para su propio artista o uno nuevo (se revisa abajo).
    "artist": {"ADMIN", "GESTOR"},
    "publication": {"ADMIN", "GESTOR"},
    "organization": {"GESTOR"},
    "avatar": {"ADMIN", "GESTOR", "CIUDADANO"},
    # GESTOR solo si es lider de su rama (se revisa abajo con la base).
    "talent": {"ADMIN", "GESTOR"},
    "category_cover": {"ADMIN", "GESTOR"},
}
# Scopes en los que un GESTOR necesita ser lider de su rama (de esta rama, si se indica en LEADER_BRANCH).
LEADER_SCOPES = {
    "talent": "Solo el líder de una rama o un administrador pueden subir fotos de talento",
    "artist": "Solo el líder de la rama Música o un administrador pueden subir fotos de artistas",
    "category_cover": "Solo el líder de una rama o un administrador pueden cambiar la portada de una categoría",
}
LEADER_BRANCH = {"artist": "MUSICA"}
# Fotos de un artista que aun no existe (el alta): carpeta fija; al crearlo la URL queda en sus datos.
NEW_ARTIST_FOLDER = "tejido/artistas/nuevos"
SCOPE_FOLDERS = {
    "publication": "tejido/publicaciones",
    "organization": "tejido/gestores",
    "avatar": "tejido/perfiles",
    "talent": "tejido/talento",
    "category_cover": "tejido/categorias",
}


def _folder(db: Session, payload: UploadSignInput, user: dict) -> str:
    if payload.scope != "artist":
        return SCOPE_FOLDERS[payload.scope]
    # Sin ref: el alta de un artista (todavia sin id ni slug) sube a una carpeta fija.
    if payload.ref is None:
        return NEW_ARTIST_FOLDER
    # Con ref: su carpeta por slug. Tambien archivados o en revision (el admin y el lider dueno los editan).
    artist = artists_service.get_artist_by_id(db, payload.ref, include_inactive=user["role"] == "ADMIN", any_status=True)
    if not artist:
        raise AppError(404, "NOT_FOUND", "Artista no encontrado")
    if user["role"] == "GESTOR" and user["id"] not in (artist.get("user_id"), artist.get("created_by_user_id")):
        raise AppError(403, "FORBIDDEN", "Solo puedes subir fotos de tus propios artistas")
    return f"tejido/artistas/{artist['slug']}"


@router.post("/sign")
def sign_upload(payload: UploadSignInput, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    require_login(user, "Inicia sesión para subir imágenes")
    if user["role"] not in SCOPE_ROLES[payload.scope]:
        raise AppError(403, "FORBIDDEN", "No puedes subir imágenes aquí")
    if payload.scope in LEADER_SCOPES and user["role"] == "GESTOR":
        branch = leader_of(db, user["id"])
        if branch is None or (payload.scope in LEADER_BRANCH and branch != LEADER_BRANCH[payload.scope]):
            raise AppError(403, "FORBIDDEN", LEADER_SCOPES[payload.scope])
    folder = _folder(db, payload, user)
    if not svc.is_configured():
        raise AppError(503, "UPLOADS_DISABLED", "La subida de imágenes no está configurada. Por ahora pega un enlace.")
    if not allow_upload_signature(user["id"]):
        raise AppError(429, "RATE_LIMITED", "Demasiadas subidas seguidas. Espera un minuto e inténtalo de nuevo.")
    return svc.signed_upload(folder)
