"""Categorias de lugar (Restaurantes, Hoteles, Miradores...): lectura publica de las activas y gestion del
ADMIN (crear, renombrar, cambiar icono y color, ordenar, activar/desactivar, borrar si nadie la usa).

Mismo patron que services/opportunity_types.py. El slug nace de la etiqueta al crear y no cambia al
renombrar. Una categoria en uso no se borra (409): se desactiva; deja de ofrecerse en el formulario, pero
los lugares que ya la tienen la conservan y se siguen mostrando con ella.
"""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.service.errors import AppError
from backend.service.models.tables import Place, PlaceCategory, Publication
from backend.service.schemas.places import PLACE_COLORS, PLACE_ICONS
from backend.service.services.opportunity_types import _HTML, slugify

LABEL_MIN = 2
LABEL_MAX = 40


def clean_label(value) -> str:
    label = " ".join(_HTML.sub(" ", str(value or "")).split())
    if not LABEL_MIN <= len(label) <= LABEL_MAX:
        raise AppError(422, "INVALID_LABEL", f"El nombre de la categoría debe tener entre {LABEL_MIN} y {LABEL_MAX} caracteres")
    if not slugify(label):
        raise AppError(422, "INVALID_LABEL", "El nombre de la categoría necesita letras o números")
    return label


def clean_icon(value) -> str:
    icon = str(value or "").strip().lower()
    if icon not in PLACE_ICONS:
        raise AppError(422, "INVALID_ICON", "Elige un ícono de la lista")
    return icon


def clean_color(value) -> str:
    color = str(value or "").strip().lower()
    if color not in PLACE_COLORS:
        raise AppError(422, "INVALID_COLOR", "Elige un color de la paleta: ocre, menta, morado, amarillo, crema, río o bosque")
    return color


def public_dict(category: PlaceCategory) -> dict:
    return {"id": category.id, "slug": category.slug, "label": category.label, "icon": category.icon, "color": category.color}


def public_categories(db: Session) -> list[dict]:
    rows = db.execute(
        select(PlaceCategory).where(PlaceCategory.active.is_(True)).order_by(PlaceCategory.sort_order, PlaceCategory.id)
    ).scalars().all()
    return [public_dict(row) for row in rows]


def admin_categories(db: Session) -> list[dict]:
    """Todas, con `uses`: cuantos lugares (no eliminados) la tienen."""
    uses = (select(Place.place_category_id, func.count().label("uses"))
            .join(Publication, Publication.id == Place.publication_id)
            .where(Publication.deleted.is_(False))
            .group_by(Place.place_category_id).subquery())
    rows = db.execute(
        select(PlaceCategory, func.coalesce(uses.c.uses, 0))
        .join(uses, uses.c.place_category_id == PlaceCategory.id, isouter=True)
        .order_by(PlaceCategory.sort_order, PlaceCategory.id)
    ).all()
    return [{**public_dict(category), "sort_order": category.sort_order, "active": category.active, "uses": count}
            for category, count in rows]


def _get(db: Session, category_id: int) -> PlaceCategory:
    found = db.get(PlaceCategory, category_id)
    if not found:
        raise AppError(404, "NOT_FOUND", "Esa categoría de lugar no existe")
    return found


def _label_taken(db: Session, label: str, exclude_id: int | None = None) -> bool:
    stmt = select(PlaceCategory.id).where(
        (func.lower(PlaceCategory.label) == label.lower()) | (PlaceCategory.slug == slugify(label)))
    if exclude_id is not None:
        stmt = stmt.where(PlaceCategory.id != exclude_id)
    return db.execute(stmt.limit(1)).first() is not None


def create_category(db: Session, label, icon=None, color=None) -> PlaceCategory:
    """Sin icono, el marcador generico (pin); sin color, el siguiente de la paleta."""
    label = clean_label(label)
    icon = clean_icon(icon or "pin")
    if color in (None, ""):
        count = db.execute(select(func.count()).select_from(PlaceCategory)).scalar_one()
        color = PLACE_COLORS[count % len(PLACE_COLORS)]
    color = clean_color(color)
    slug = slugify(label)
    if db.execute(select(PlaceCategory.id).where(PlaceCategory.slug == slug)).first() or _label_taken(db, label):
        raise AppError(409, "PLACE_CATEGORY_EXISTS", "Ya existe una categoría de lugar con ese nombre")
    last = db.execute(select(func.max(PlaceCategory.sort_order))).scalar_one()
    created = PlaceCategory(slug=slug, label=label, icon=icon, color=color,
                            sort_order=(last + 1) if last is not None else 0, active=True)
    db.add(created)
    db.flush()
    return created


def update_category(db: Session, category_id: int, label=None, icon=None, color=None, active=None) -> PlaceCategory:
    found = _get(db, category_id)
    if label is not None:
        label = clean_label(label)
        if _label_taken(db, label, exclude_id=category_id):
            raise AppError(409, "PLACE_CATEGORY_EXISTS", "Ya existe una categoría de lugar con ese nombre")
        found.label = label
    if icon is not None:
        found.icon = clean_icon(icon)
    if color is not None:
        found.color = clean_color(color)
    if active is not None:
        found.active = bool(active)
    return found


def move_category(db: Session, category_id: int, direction: str) -> None:
    """Sube o baja un puesto: intercambia el orden con la vecina (y deja el orden consecutivo)."""
    if direction not in ("up", "down"):
        raise AppError(422, "INVALID_DIRECTION", "La dirección debe ser up o down")
    ordered = db.execute(select(PlaceCategory).order_by(PlaceCategory.sort_order, PlaceCategory.id)).scalars().all()
    index = next((i for i, item in enumerate(ordered) if item.id == category_id), None)
    if index is None:
        raise AppError(404, "NOT_FOUND", "Esa categoría de lugar no existe")
    target = index - 1 if direction == "up" else index + 1
    if 0 <= target < len(ordered):
        ordered[index], ordered[target] = ordered[target], ordered[index]
    for position, item in enumerate(ordered):
        item.sort_order = position


def delete_category(db: Session, category_id: int) -> None:
    found = _get(db, category_id)
    # Cuentan tambien los lugares eliminados (siguen en la base con su categoria: la FK no deja borrarla).
    total, deleted = db.execute(
        select(func.count(), func.count().filter(Publication.deleted.is_(True)))
        .select_from(Place).join(Publication, Publication.id == Place.publication_id)
        .where(Place.place_category_id == category_id)
    ).one()
    if total:
        noun = "lugar la usa" if total == 1 else "lugares la usan"
        extra = " (contando los eliminados)" if deleted else ""
        raise AppError(409, "PLACE_CATEGORY_IN_USE",
                       f"No se puede borrar: {total} {noun}{extra}. Desactívala para que deje de ofrecerse.")
    db.delete(found)
