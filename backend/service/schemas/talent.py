"""Entradas del talento contratable (services/talent.py, api/routes/talent.py).

Textos con optional_text/required_text e imagenes con url_or_path; los videos solo https://.
Vacio = quitar el valor (None). Los limites de cada lista viven aqui y en la ruta no se repiten.
"""
from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from backend.service.schemas.artists import _slug_format
from backend.service.schemas.cultural_categories import CULTURAL_CATEGORIES
from backend.service.schemas.fields import external_url, optional_text, required_text, url_or_path
from backend.service.schemas.municipalities import MUNICIPALITIES

STATUSES = ("DRAFT", "REVIEW", "REJECTED", "PUBLISHED")
# "manage" choca con GET /api/talent/manage.
RESERVED_TALENT_SLUGS = {"manage"}
MAX_SERVICES = 10
MAX_SPECS = 12
MAX_MEDIA = 16
MAX_MILESTONES = 12
MAX_ENDORSEMENTS = 8
MAX_VENUES = 10
MAX_PRICE = 100_000_000
AVAILABILITY_WINDOW_DAYS = 366

# Colombia no tiene horario de verano: "hoy" es siempre UTC-5, este donde este el servidor.
COLOMBIA_TZ = timezone(timedelta(hours=-5))


def today_co() -> date:
    return datetime.now(COLOMBIA_TZ).date()


def talent_slug(v):
    v = _slug_format(v, "El slug")
    if v.isdigit():
        raise ValueError("El slug no puede ser solo números")
    if v in RESERVED_TALENT_SLUGS:
        raise ValueError(f"El slug '{v}' está reservado")
    return v


def _category(v):
    v = str(v or "").strip().upper()
    if v not in CULTURAL_CATEGORIES:
        raise ValueError("Categoría cultural no válida")
    return v


def _origin(v):
    v = str(v or "").strip().lower()
    if v not in MUNICIPALITIES:
        raise ValueError(f"Municipio no válido: usa {', '.join(sorted(MUNICIPALITIES))}")
    return v


def _max_items(v, limit, label):
    if v is not None and len(v) > limit:
        raise ValueError(f"Máximo {limit} {label}")
    return v


class TalentCoreFields(BaseModel):
    """Campos del perfil que puede escribir quien lo gestiona (admin o lider de la rama)."""
    name: Optional[str] = None
    category: Optional[str] = None
    origin: Optional[str] = None
    tagline: Optional[str] = None
    description: Optional[str] = None
    cover_url: Optional[str] = None
    representative_user_id: Optional[int] = None
    publish: bool = False  # solo admin: publicar directo

    @field_validator("name", mode="before")
    @classmethod
    def _name(cls, v):
        return None if v is None else required_text(v, 120, "El nombre")

    @field_validator("category", mode="before")
    @classmethod
    def _category(cls, v):
        return None if v is None else _category(v)

    @field_validator("origin", mode="before")
    @classmethod
    def _origin(cls, v):
        return None if v is None else _origin(v)

    @field_validator("tagline", mode="before")
    @classmethod
    def _tagline(cls, v):
        return optional_text(v, 200, "La frase de presentación")

    @field_validator("description", mode="before")
    @classmethod
    def _description(cls, v):
        return optional_text(v, 2000, "La descripción")

    @field_validator("cover_url", mode="before")
    @classmethod
    def _cover(cls, v):
        return url_or_path(v)


class TalentAdminFields(BaseModel):
    """Solo el admin: si un lider manda alguno de estos campos (aunque sea null), 403."""
    slug: Optional[str] = None
    verified: Optional[bool] = None
    act_number: Optional[str] = None
    act_date: Optional[date] = None
    featured: Optional[bool] = None
    # Nunca se editan por aqui (estado: publish, submit o /status), pero se declaran para
    # poder rechazarlos de forma explicita en vez de ignorarlos en silencio.
    status: Optional[Any] = None
    moderation_note: Optional[Any] = None
    created_by: Optional[Any] = None

    @field_validator("slug", mode="before")
    @classmethod
    def _slug(cls, v):
        return None if v is None else talent_slug(v)

    @field_validator("act_number", mode="before")
    @classmethod
    def _act_number(cls, v):
        return optional_text(v, 30, "El número de acta")


ADMIN_ONLY_FIELDS = tuple(TalentAdminFields.model_fields)
NOT_EDITABLE_FIELDS = ("status", "moderation_note", "created_by")


class TalentCreateInput(TalentCoreFields, TalentAdminFields):
    @model_validator(mode="after")
    def _required(self):
        for field, label in (("name", "El nombre"), ("origin", "El municipio de origen")):
            if getattr(self, field) is None:
                raise ValueError(f"{label} es requerido")
        return self


class TalentUpdateInput(TalentCoreFields, TalentAdminFields):
    """PATCH parcial: solo cuenta lo que llega en el body (model_fields_set)."""


class TalentStatusInput(BaseModel):
    status: str
    note: str = ""

    @field_validator("note", mode="before")
    @classmethod
    def _note(cls, v):
        return str(v or "").strip()[:1000]


class ServiceInput(BaseModel):
    title: str
    tag: Optional[str] = None
    description: Optional[str] = None
    price: Optional[int] = None
    price_note: Optional[str] = None

    @field_validator("title", mode="before")
    @classmethod
    def _title(cls, v):
        return required_text(v, 100, "El nombre del servicio")

    @field_validator("tag", mode="before")
    @classmethod
    def _tag(cls, v):
        return optional_text(v, 20, "La etiqueta")

    @field_validator("description", mode="before")
    @classmethod
    def _description(cls, v):
        return optional_text(v, 300, "La descripción del servicio")

    @field_validator("price", mode="before")
    @classmethod
    def _price(cls, v):
        if v in (None, ""):
            return None
        if isinstance(v, bool):
            raise ValueError("El precio debe ser un número entero de pesos")
        try:
            price = int(v)
        except (TypeError, ValueError):
            raise ValueError("El precio debe ser un número entero de pesos")
        if price != v and str(price) != str(v).strip():
            raise ValueError("El precio debe ser un número entero de pesos")
        if not 0 <= price <= MAX_PRICE:
            raise ValueError(f"El precio debe estar entre 0 y {MAX_PRICE:,}".replace(",", "."))
        return price

    @field_validator("price_note", mode="before")
    @classmethod
    def _price_note(cls, v):
        return optional_text(v, 60, "La nota del precio")


class ServicesInput(BaseModel):
    items: list[ServiceInput]

    @field_validator("items")
    @classmethod
    def _max(cls, v):
        return _max_items(v, MAX_SERVICES, "servicios")


class SpecInput(BaseModel):
    label: str
    value: str

    @field_validator("label", mode="before")
    @classmethod
    def _label(cls, v):
        return required_text(v, 60, "El nombre del dato")

    @field_validator("value", mode="before")
    @classmethod
    def _value(cls, v):
        return required_text(v, 200, "El valor del dato")


class SpecsInput(BaseModel):
    items: list[SpecInput]

    @field_validator("items")
    @classmethod
    def _max(cls, v):
        return _max_items(v, MAX_SPECS, "datos técnicos")


class MediaInput(BaseModel):
    type: str
    url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    title: Optional[str] = None
    caption: Optional[str] = None

    @field_validator("type", mode="before")
    @classmethod
    def _type(cls, v):
        v = str(v or "").strip().lower()
        if v not in ("image", "video"):
            raise ValueError("El tipo de medio debe ser image o video")
        return v

    @field_validator("thumbnail_url", mode="before")
    @classmethod
    def _thumbnail(cls, v):
        return url_or_path(v)

    @field_validator("title", mode="before")
    @classmethod
    def _title(cls, v):
        return optional_text(v, 100, "El título del medio")

    @field_validator("caption", mode="before")
    @classmethod
    def _caption(cls, v):
        return optional_text(v, 150, "El pie del medio")

    @model_validator(mode="before")
    @classmethod
    def _url(cls, data):
        if not isinstance(data, dict):
            return data
        kind = str(data.get("type") or "").strip().lower()
        if kind == "video":
            url = external_url(data.get("url"))
            if url is not None and not url.lower().startswith("https://"):
                raise ValueError("El enlace del video debe empezar por https://")
        else:
            url = url_or_path(data.get("url"))
        if url is None:
            raise ValueError("Cada medio necesita una URL")
        return {**data, "url": url}


class MediaListInput(BaseModel):
    items: list[MediaInput]

    @field_validator("items")
    @classmethod
    def _max(cls, v):
        return _max_items(v, MAX_MEDIA, "fotos o videos")


class MilestoneInput(BaseModel):
    year: int
    title: str
    description: Optional[str] = None

    @field_validator("year", mode="before")
    @classmethod
    def _year(cls, v):
        try:
            year = int(v)
        except (TypeError, ValueError):
            raise ValueError("El año del hito debe ser un número")
        last = today_co().year + 1
        if not 1900 <= year <= last:
            raise ValueError(f"El año del hito debe estar entre 1900 y {last}")
        return year

    @field_validator("title", mode="before")
    @classmethod
    def _title(cls, v):
        return required_text(v, 100, "El título del hito")

    @field_validator("description", mode="before")
    @classmethod
    def _description(cls, v):
        return optional_text(v, 400, "La descripción del hito")


class MilestonesInput(BaseModel):
    items: list[MilestoneInput]

    @field_validator("items")
    @classmethod
    def _max(cls, v):
        return _max_items(v, MAX_MILESTONES, "hitos")


class EndorsementInput(BaseModel):
    kind: str
    title: str
    text: Optional[str] = None
    rating: Optional[int] = None

    @field_validator("kind", mode="before")
    @classmethod
    def _kind(cls, v):
        v = str(v or "").strip().upper()
        if v not in ("RECOGNITION", "TESTIMONIAL"):
            raise ValueError("El tipo debe ser RECOGNITION o TESTIMONIAL")
        return v

    @field_validator("title", mode="before")
    @classmethod
    def _title(cls, v):
        return required_text(v, 100, "El título")

    @field_validator("text", mode="before")
    @classmethod
    def _text(cls, v):
        return optional_text(v, 400, "El texto")

    @model_validator(mode="after")
    def _rating(self):
        if self.rating is not None:
            if self.kind != "TESTIMONIAL":
                raise ValueError("Solo un testimonio lleva calificación")
            if not 1 <= self.rating <= 5:
                raise ValueError("La calificación debe estar entre 1 y 5")
        return self


class EndorsementsInput(BaseModel):
    items: list[EndorsementInput]

    @field_validator("items")
    @classmethod
    def _max(cls, v):
        return _max_items(v, MAX_ENDORSEMENTS, "reconocimientos o testimonios")


class VenueInput(BaseModel):
    name: str
    municipality: Optional[str] = None

    @field_validator("name", mode="before")
    @classmethod
    def _name(cls, v):
        return required_text(v, 100, "El nombre del lugar")

    @field_validator("municipality", mode="before")
    @classmethod
    def _municipality(cls, v):
        return None if v in (None, "") else _origin(v)


class VenuesInput(BaseModel):
    items: list[VenueInput]

    @field_validator("items")
    @classmethod
    def _max(cls, v):
        return _max_items(v, MAX_VENUES, "lugares")


class AvailabilityDayInput(BaseModel):
    day: date
    state: str

    @field_validator("state", mode="before")
    @classmethod
    def _state(cls, v):
        v = str(v or "").strip().upper()
        if v not in ("AVAILABLE", "BUSY"):
            raise ValueError("El estado del día debe ser AVAILABLE o BUSY")
        return v


class AvailabilityInput(BaseModel):
    """Reemplaza solo el rango [from, to]: los dias del rango que no vienen quedan sin informacion."""
    model_config = ConfigDict(populate_by_name=True)

    from_day: date = Field(alias="from")
    to_day: date = Field(alias="to")
    days: list[AvailabilityDayInput]

    @model_validator(mode="after")
    def _range(self):
        today = today_co()
        last = today + timedelta(days=AVAILABILITY_WINDOW_DAYS)
        if self.from_day > self.to_day:
            raise ValueError("La fecha inicial no puede ser posterior a la final")
        if (self.to_day - self.from_day).days > AVAILABILITY_WINDOW_DAYS:
            raise ValueError(f"El rango no puede superar {AVAILABILITY_WINDOW_DAYS} días")
        if self.from_day < today or self.to_day > last:
            raise ValueError(f"El calendario va de hoy hasta {AVAILABILITY_WINDOW_DAYS} días adelante")
        seen = set()
        for item in self.days:
            if not self.from_day <= item.day <= self.to_day:
                raise ValueError(f"El día {item.day.isoformat()} está fuera del rango enviado")
            if item.day in seen:
                raise ValueError(f"El día {item.day.isoformat()} está repetido")
            seen.add(item.day)
        return self

