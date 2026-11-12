"""Ramas de cultura (las "categorías" que el público ve en Explorar): única fuente de verdad, en la tabla
cultural_branches. Sin caché: son pocas filas y cada consulta es barata.

Una rama tiene clave inmutable (MAYÚSCULAS_CON_GUION_BAJO, la que guardan organizations.branch,
publications.cultural_category, branch_join_requests.branch y talent_profiles.category), etiqueta (única sin
distinguir mayúsculas ni tildes), slug (category_slug(clave), inmutable), orden, activa, protegida e imagen
de portada. Una rama desactivada no admite contenido nuevo, pero lo que ya tiene sigue guardado y se edita
sin cambiar de rama. MUSICA es la rama base (protected): se renombra y cambia de imagen, nunca se desactiva
ni se borra.
"""
import re
import unicodedata
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.service.errors import AppError
from backend.service.models.tables import BranchJoinRequest, CulturalBranch, Organization, Publication, Role, TalentProfile, User
from backend.service.schemas.cultural_categories import category_slug

KEY_MAX = 40
LABEL_MAX = 60

# Las 10 ramas iniciales, en su orden (las siembra la migracion f6b8d0a2c4e7; seed.py las usa para los
# schemas de prueba, que se crean con create_all).
BASE_BRANCHES = (
    ("MUSICA", "Música"), ("CINE_AUDIOVISUAL", "Cine y audiovisual"), ("DANZA", "Danza"), ("TEATRO", "Teatro"),
    ("ARTES_VISUALES", "Artes visuales"), ("LITERATURA", "Literatura"), ("ARTESANIAS", "Artesanías"),
    ("PATRIMONIO_MEMORIA", "Patrimonio y memoria"), ("GASTRONOMIA_CULTURAL", "Gastronomía cultural"),
    ("EMPRENDIMIENTO_CULTURAL", "Emprendimiento cultural"),
)
PROTECTED_KEYS = ("MUSICA",)


def now_utc():
    return datetime.now(timezone.utc)


def fold(text: str) -> str:
    """Sin tildes y en minúsculas, para comparar nombres."""
    return unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii").lower().strip()


def normalize_key(value) -> str:
    return str(value or "").strip().upper()


# ─────────────────────────── lectura ───────────────────────────

def list_branches(db: Session, active_only: bool = False) -> list[CulturalBranch]:
    query = select(CulturalBranch).order_by(CulturalBranch.position, CulturalBranch.key)
    if active_only:
        query = query.where(CulturalBranch.active.is_(True))
    return list(db.execute(query).scalars())


def get_branch(db: Session, key) -> Optional[CulturalBranch]:
    key = normalize_key(key)
    return db.get(CulturalBranch, key) if key else None


def is_valid_branch(db: Session, key, active_only: bool = True) -> bool:
    branch = get_branch(db, key)
    return branch is not None and (branch.active or not active_only)


def label_of(db: Session, key) -> Optional[str]:
    branch = get_branch(db, key)
    return branch.label if branch else None


def labels(db: Session) -> dict:
    """{clave: etiqueta} de TODAS las ramas (las desactivadas también: su contenido sigue a la vista)."""
    return dict(db.execute(select(CulturalBranch.key, CulturalBranch.label)).all())


def keys(db: Session, active_only: bool = True) -> list[str]:
    return [branch.key for branch in list_branches(db, active_only)]


def key_by_slug(db: Session, slug, active_only: bool = True) -> Optional[str]:
    """Clave de la rama con ese slug (filtros de agenda y oportunidades), o None."""
    slug = str(slug or "").strip().lower()
    if not slug:
        return None
    branch = db.execute(select(CulturalBranch).where(CulturalBranch.slug == slug)).scalars().first()
    return branch.key if branch is not None and (branch.active or not active_only) else None


def covers(db: Session) -> dict:
    """{clave: url} de las ramas con imagen (el carrusel y el respaldo de Explorar)."""
    return dict(db.execute(select(CulturalBranch.key, CulturalBranch.image_url).where(CulturalBranch.image_url.is_not(None))).all())


def public_dict(branch: CulturalBranch) -> dict:
    return {"key": branch.key, "label": branch.label, "slug": branch.slug, "image_url": branch.image_url}


def require_branch(db: Session, key, *, active_only: bool = True, current: Optional[str] = None, what: str = "rama cultural") -> str:
    """Clave valida para ESCRIBIR. Una rama inexistente es 422; una desactivada tambien, salvo que sea la que
    el registro ya tenia (current): lo existente se edita sin cambiar de rama."""
    key = normalize_key(key)
    branch = get_branch(db, key)
    if branch is None:
        raise AppError(422, "INVALID_BRANCH", f"Esa {what} no existe: elige una de la lista")
    if active_only and not branch.active and key != normalize_key(current):
        raise AppError(422, "INACTIVE_BRANCH", f"La rama {branch.label} está desactivada: no admite contenido nuevo")
    return key


class BranchLookup:
    """Las ramas leidas UNA vez para armar muchas tarjetas (carrusel, agenda, oportunidades, mapa).
    Llamarlo con una clave da su portada: la de la base o, para las 10 iniciales, la estatica
    (/images/categorias/<slug>.jpg); None si la clave no es una rama o una nueva no tiene imagen."""

    def __init__(self, db: Session):
        rows = list_branches(db)
        self.labels = {branch.key: branch.label for branch in rows}
        self.images = {branch.key: branch.image_url for branch in rows if branch.image_url}
        self.active_keys = [branch.key for branch in rows if branch.active]
        self._base = {key for key, _ in BASE_BRANCHES}

    def valid(self, key) -> bool:
        return key in self.labels

    def label(self, key) -> Optional[str]:
        return self.labels.get(key)

    def is_active(self, key) -> bool:
        return key in self.active_keys

    def __call__(self, key) -> Optional[str]:
        if key not in self.labels:
            return None
        return self.images.get(key) or (f"/images/categorias/{category_slug(key)}.jpg" if key in self._base else None)


# ─────────────────────────── administración ───────────────────────────

def _usage(db: Session) -> dict:
    """Conteos por rama: gestores (organizaciones), publicaciones, talento y solicitudes (todas y pendientes)."""
    def grouped(column, *where):
        return dict(db.execute(select(column, func.count()).where(*where).group_by(column)).all()) if where else dict(
            db.execute(select(column, func.count()).group_by(column)).all())
    return {
        "gestores": grouped(Organization.branch),
        "gestores_activos": dict(db.execute(
            select(Organization.branch, func.count()).join(User, User.id == Organization.user_id).join(Role, Role.id == User.role_id)
            .where(Organization.active.is_(True), Role.name == "GESTOR").group_by(Organization.branch)).all()),
        "publicaciones": grouped(Publication.cultural_category),
        "talento": grouped(TalentProfile.category),
        "solicitudes": grouped(BranchJoinRequest.branch),
        "pendientes": grouped(BranchJoinRequest.branch, BranchJoinRequest.status == "PENDING"),
    }


def _leaders(db: Session) -> dict:
    rows = db.execute(
        select(Organization.branch, User.name).join(User, User.id == Organization.user_id).where(Organization.is_leader.is_(True))
    ).all()
    return {branch: name for branch, name in rows}


def admin_list(db: Session) -> list[dict]:
    """Todas las ramas con lo que hace falta para decidir: conteos, lider y si se puede desactivar o borrar."""
    usage, leaders = _usage(db), _leaders(db)
    return [_admin_dict(branch, usage, leaders) for branch in list_branches(db)]


def _admin_dict(branch: CulturalBranch, usage: dict, leaders: dict) -> dict:
    count = lambda name: usage[name].get(branch.key, 0)  # noqa: E731
    refs = {"gestores": count("gestores"), "publicaciones": count("publicaciones"), "talento": count("talento"), "solicitudes": count("solicitudes")}
    return {
        **public_dict(branch), "position": branch.position, "active": branch.active, "protected": branch.protected,
        "counts": {**refs, "gestores_activos": count("gestores_activos"), "solicitudes_pendientes": count("pendientes")},
        "leader": leaders.get(branch.key),
        "can_delete": not branch.protected and not any(refs.values()),
        "delete_reason": None if not branch.protected and not any(refs.values()) else _delete_reason(branch, refs),
        "can_deactivate": branch.active and not branch.protected and not count("pendientes"),
        "deactivate_reason": _deactivate_reason(branch, count("pendientes")),
    }


def _plural(n: int, one: str, many: str) -> str:
    return f"{n} {one if n == 1 else many}"


def _delete_reason(branch: CulturalBranch, refs: dict) -> str:
    if branch.protected:
        return "Es la rama base: no se puede borrar"
    parts = [_plural(refs["publicaciones"], "publicación", "publicaciones") if refs["publicaciones"] else "",
             _plural(refs["gestores"], "gestor", "gestores") if refs["gestores"] else "",
             _plural(refs["talento"], "perfil de talento", "perfiles de talento") if refs["talento"] else "",
             _plural(refs["solicitudes"], "solicitud de ingreso", "solicitudes de ingreso") if refs["solicitudes"] else ""]
    used = ", ".join(part for part in parts if part)
    return f"Tiene {used}: desactívala en lugar de borrarla"


def _deactivate_reason(branch: CulturalBranch, pending: int) -> Optional[str]:
    if not branch.active:
        return None
    if branch.protected:
        return "Es la rama base: no se puede desactivar"
    if pending:
        return f"Tiene {_plural(pending, 'solicitud de ingreso pendiente', 'solicitudes de ingreso pendientes')}: resuélvelas primero"
    return None


def admin_detail(db: Session, key: str) -> dict:
    return _admin_dict(_required(db, key), _usage(db), _leaders(db))


def _required(db: Session, key) -> CulturalBranch:
    branch = get_branch(db, key)
    if branch is None:
        raise AppError(404, "NOT_FOUND", "Esa rama no existe")
    return branch


def _clean_label(label) -> str:
    label = " ".join(str(label or "").split())
    if len(label) < 2:
        raise AppError(422, "INVALID_LABEL", "Escribe el nombre de la rama (al menos 2 caracteres)")
    if len(label) > LABEL_MAX:
        raise AppError(422, "INVALID_LABEL", f"El nombre no puede superar {LABEL_MAX} caracteres")
    return label


def _label_taken(db: Session, label: str, except_key: Optional[str] = None) -> Optional[CulturalBranch]:
    wanted = fold(label)
    for branch in list_branches(db):
        if branch.key != except_key and fold(branch.label) == wanted:
            return branch
    return None


def key_from_label(label: str) -> str:
    """Música y danza -> MUSICA_Y_DANZA (sin tildes, MAYÚSCULAS_GUION_BAJO, ≤ 40)."""
    text = unicodedata.normalize("NFKD", label).encode("ascii", "ignore").decode("ascii").upper()
    key = re.sub(r"[^A-Z0-9]+", "_", text).strip("_")[:KEY_MAX].strip("_")
    if not key or not key[0].isalpha():
        raise AppError(422, "INVALID_LABEL", "El nombre debe empezar con una letra")
    return key


def create_branch(db: Session, label, image_url: Optional[str]) -> CulturalBranch:
    label = _clean_label(label)
    key = key_from_label(label)
    slug = category_slug(key)
    clash = _label_taken(db, label) or get_branch(db, key) or db.execute(select(CulturalBranch).where(CulturalBranch.slug == slug)).scalars().first()
    if clash is not None:
        raise AppError(409, "BRANCH_EXISTS", f"Ya existe la rama «{clash.label}»: elige otro nombre")
    position = (db.execute(select(func.max(CulturalBranch.position))).scalar() or 0) + 1
    now = now_utc()
    branch = CulturalBranch(key=key, label=label, slug=slug, position=position, active=True, protected=False, image_url=image_url,
                            created_at=now, updated_at=now)
    db.add(branch)
    db.flush()
    return branch


def update_branch(db: Session, key, fields: dict) -> CulturalBranch:
    """Nombre e imagen (la clave y el slug nunca cambian) y activa/desactivada."""
    branch = _required(db, key)
    if "label" in fields:
        label = _clean_label(fields["label"])
        clash = _label_taken(db, label, except_key=branch.key)
        if clash is not None:
            raise AppError(409, "BRANCH_EXISTS", f"Ya existe la rama «{clash.label}»: elige otro nombre")
        branch.label = label
    if "image_url" in fields:
        branch.image_url = fields["image_url"] or None
    if "active" in fields and fields["active"] is not None and bool(fields["active"]) != branch.active:
        if not fields["active"]:
            if branch.protected:
                raise AppError(409, "PROTECTED_BRANCH", f"{branch.label} es la rama base: no se puede desactivar")
            pending = _usage(db)["pendientes"].get(branch.key, 0)
            if pending:
                raise AppError(409, "PENDING_REQUESTS", f"{branch.label} tiene {_plural(pending, 'solicitud de ingreso pendiente', 'solicitudes de ingreso pendientes')}: resuélvelas antes de desactivarla")
        branch.active = bool(fields["active"])
    branch.updated_at = now_utc()
    db.flush()
    return branch


def move_branch(db: Session, key, direction: str) -> list[CulturalBranch]:
    """Sube o baja una posicion (entre todas las ramas) y deja el orden compacto (0..n-1)."""
    if direction not in ("up", "down"):
        raise AppError(422, "INVALID_DIRECTION", "La dirección debe ser up o down")
    branches = list_branches(db)
    index = next((i for i, b in enumerate(branches) if b.key == normalize_key(key)), None)
    if index is None:
        raise AppError(404, "NOT_FOUND", "Esa rama no existe")
    target = index - 1 if direction == "up" else index + 1
    if 0 <= target < len(branches):
        branches[index], branches[target] = branches[target], branches[index]
    for position, branch in enumerate(branches):
        branch.position = position
    db.flush()
    return branches


def delete_branch(db: Session, key) -> None:
    """Solo sin ninguna referencia (gestores, publicaciones, talento, solicitudes): si las hay, 409."""
    branch = _required(db, key)
    usage = _usage(db)
    refs = {name: usage[name].get(branch.key, 0) for name in ("gestores", "publicaciones", "talento", "solicitudes")}
    if branch.protected or any(refs.values()):
        raise AppError(409, "BRANCH_IN_USE" if not branch.protected else "PROTECTED_BRANCH", _delete_reason(branch, refs))
    db.delete(branch)
    db.flush()


def seed_base_branches(db: Session, cover_urls: Optional[dict] = None) -> None:
    """Siembra las 10 ramas iniciales si faltan (schemas de prueba y bases locales)."""
    now = now_utc()
    existing = {key for (key,) in db.execute(select(CulturalBranch.key)).all()}
    for position, (key, label) in enumerate(BASE_BRANCHES):
        if key not in existing:
            db.add(CulturalBranch(key=key, label=label, slug=category_slug(key), position=position, active=True,
                                  protected=key in PROTECTED_KEYS, image_url=(cover_urls or {}).get(key), created_at=now, updated_at=now))
    db.flush()
