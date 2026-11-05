"""Tipos de oportunidad (Convocatoria, Taller, Audicion...): lectura publica de los activos y gestion
del ADMIN (crear, renombrar, ordenar, activar/desactivar, borrar si nadie lo usa).

El slug nace de la etiqueta al crear (minusculas, sin tildes, con guiones) y no cambia al renombrar:
los filtros compartidos (#oportunidades?tipo=<slug>) siguen sirviendo. Un tipo en uso no se borra
(409): se desactiva y deja de ofrecerse al crear, pero las oportunidades que ya lo tienen lo conservan.
"""
import re
import unicodedata

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.service.errors import AppError
from backend.service.models.tables import Opportunity, OpportunityType, Publication

# Paleta cerrada de colores de los tipos (la misma de frontend/src/components/uiStyles.js::TYPE_COLORS).
PALETTE = ("ocre", "menta", "morado", "amarillo", "crema")
LABEL_MIN = 2
LABEL_MAX = 40
_HTML = re.compile(r"<[^>]*>")


def slugify(label: str) -> str:
    text = unicodedata.normalize("NFD", label.lower())
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")


def clean_label(value) -> str:
    label = " ".join(_HTML.sub(" ", str(value or "")).split())
    if not LABEL_MIN <= len(label) <= LABEL_MAX:
        raise AppError(422, "INVALID_LABEL", f"El nombre del tipo debe tener entre {LABEL_MIN} y {LABEL_MAX} caracteres")
    if not slugify(label):
        raise AppError(422, "INVALID_LABEL", "El nombre del tipo necesita letras o números")
    return label


def clean_color(value) -> str:
    color = str(value or "").strip().lower()
    if color not in PALETTE:
        raise AppError(422, "INVALID_COLOR", "Elige un color de la paleta: ocre, menta, morado, amarillo o crema")
    return color


def public_types(db: Session) -> list[dict]:
    rows = db.execute(
        select(OpportunityType.id, OpportunityType.slug, OpportunityType.label, OpportunityType.color)
        .where(OpportunityType.active.is_(True))
        .order_by(OpportunityType.sort_order, OpportunityType.id)
    ).all()
    return [{"id": row.id, "slug": row.slug, "label": row.label, "color": row.color} for row in rows]


def admin_types(db: Session) -> list[dict]:
    """Todos los tipos con `uses`: cuantas oportunidades (no eliminadas) lo tienen."""
    uses = (select(Opportunity.type_id, func.count().label("uses"))
            .join(Publication, Publication.id == Opportunity.publication_id)
            .where(Publication.deleted.is_(False))
            .group_by(Opportunity.type_id).subquery())
    rows = db.execute(
        select(OpportunityType, func.coalesce(uses.c.uses, 0))
        .join(uses, uses.c.type_id == OpportunityType.id, isouter=True)
        .order_by(OpportunityType.sort_order, OpportunityType.id)
    ).all()
    return [{"id": t.id, "slug": t.slug, "label": t.label, "color": t.color, "sort_order": t.sort_order, "active": t.active, "uses": uses_count}
            for t, uses_count in rows]


def _get(db: Session, type_id: int) -> OpportunityType:
    found = db.get(OpportunityType, type_id)
    if not found:
        raise AppError(404, "NOT_FOUND", "Ese tipo de oportunidad no existe")
    return found


def _label_taken(db: Session, label: str, exclude_id: int | None = None) -> bool:
    stmt = select(OpportunityType.id).where(
        (func.lower(OpportunityType.label) == label.lower()) | (OpportunityType.slug == slugify(label)))
    if exclude_id is not None:
        stmt = stmt.where(OpportunityType.id != exclude_id)
    return db.execute(stmt.limit(1)).first() is not None


def create_type(db: Session, label, color=None) -> OpportunityType:
    """Sin color, el siguiente de la paleta (segun cuantos tipos hay)."""
    label = clean_label(label)
    if color in (None, ""):
        count = db.execute(select(func.count()).select_from(OpportunityType)).scalar_one()
        color = PALETTE[count % len(PALETTE)]
    color = clean_color(color)
    slug = slugify(label)
    if db.execute(select(OpportunityType.id).where(OpportunityType.slug == slug)).first() or _label_taken(db, label):
        raise AppError(409, "TYPE_EXISTS", "Ya existe un tipo con ese nombre")
    last = db.execute(select(func.max(OpportunityType.sort_order))).scalar_one()
    created = OpportunityType(slug=slug, label=label, color=color, sort_order=(last + 1) if last is not None else 0, active=True)
    db.add(created)
    db.flush()
    return created


def rename_type(db: Session, type_id: int, label) -> OpportunityType:
    found = _get(db, type_id)
    label = clean_label(label)
    if _label_taken(db, label, exclude_id=type_id):
        raise AppError(409, "TYPE_EXISTS", "Ya existe un tipo con ese nombre")
    found.label = label
    return found


def set_color(db: Session, type_id: int, color) -> OpportunityType:
    found = _get(db, type_id)
    found.color = clean_color(color)
    return found


def set_active(db: Session, type_id: int, active: bool) -> OpportunityType:
    found = _get(db, type_id)
    found.active = bool(active)
    return found


def move_type(db: Session, type_id: int, direction: str) -> None:
    """Sube o baja un puesto: intercambia el orden con el vecino (y deja el orden consecutivo)."""
    if direction not in ("up", "down"):
        raise AppError(422, "INVALID_DIRECTION", "La dirección debe ser up o down")
    ordered = db.execute(select(OpportunityType).order_by(OpportunityType.sort_order, OpportunityType.id)).scalars().all()
    index = next((i for i, t in enumerate(ordered) if t.id == type_id), None)
    if index is None:
        raise AppError(404, "NOT_FOUND", "Ese tipo de oportunidad no existe")
    target = index - 1 if direction == "up" else index + 1
    if 0 <= target < len(ordered):
        ordered[index], ordered[target] = ordered[target], ordered[index]
    for position, item in enumerate(ordered):
        item.sort_order = position


def delete_type(db: Session, type_id: int) -> None:
    found = _get(db, type_id)
    # Cuentan tambien las oportunidades eliminadas (siguen en la base con su tipo: la FK no deja borrarlo).
    total, deleted = db.execute(
        select(func.count(), func.count().filter(Publication.deleted.is_(True)))
        .select_from(Opportunity).join(Publication, Publication.id == Opportunity.publication_id)
        .where(Opportunity.type_id == type_id)
    ).one()
    if total:
        noun = "oportunidad lo usa" if total == 1 else "oportunidades lo usan"
        extra = " (contando las eliminadas)" if deleted else ""
        raise AppError(409, "TYPE_IN_USE", f"No se puede borrar: {total} {noun}{extra}. Desactívalo para que deje de ofrecerse.")
    db.delete(found)
