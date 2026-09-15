"""
Modelos SQLAlchemy que reflejan backend/database/schema.sql tabla por tabla.

Fase 2 de la migración: PostgreSQL es ahora el motor real (antes SQLite).
Dos cambios de tipo respecto a la Fase 1:

  - Los timestamps de auditoria generados por el propio backend con
    `datetime.now(timezone.utc).isoformat()` (created_at, updated_at,
    expires_at, reviewed_at) pasan a `DateTime(timezone=True)` -> TIMESTAMPTZ
    real en Postgres. Se verificaron las 0 anomalias en los datos reales antes
    de este cambio (los 4 campos parsean limpio con `datetime.fromisoformat`).

  - `artist_metrics.metadata` pasa a JSONB.

Fase 6.1 (2026-09-14): las fechas de CONTENIDO ingresadas por usuarios ya NO
son String. Se auditaron los datos reales en Neon antes de tocar el esquema
(el 100% de las filas ya eran NULL o ISO valido -- el riesgo documentado
originalmente era sobre validacion de entrada a futuro, no sobre datos
existentes). Dos tipos segun el campo:

  - `DateTime` (sin timezone -- las fechas de contenido no traen tz) para
    publications.start_date/end_date y opportunities.deadline: mezclan a
    proposito fecha-sola (ISO se interpreta como medianoche) y fecha+hora,
    segun si la publicacion es un evento con horario o una convocatoria con
    plazo. opportunities.deadline copia siempre item.end_date (ver
    backend/service/services/publications.py::_sync_publication_detail), asi
    que debe ser del mismo tipo para que la asignacion directa siga siendo
    valida.
  - `Date` (fecha pura) para artist_timeline.fecha, artist_media.fecha,
    tracks.release_date y artist_metrics.fecha: en los datos reales siempre
    son solo-fecha, nunca fecha+hora.

La validacion de formato ahora vive en los schemas Pydantic
(backend/service/schemas/publications.py y schemas/artists.py) via los tipos
`datetime`/`date` nativos -- un valor no-ISO ya no se guarda nunca, se
rechaza con 400 antes de tocar la base de datos.
"""
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    active: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    role: Mapped["Role"] = relationship()


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)
    color: Mapped[str] = mapped_column(String, nullable=False)
    active: Mapped[bool] = mapped_column(default=True, nullable=False)


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    contact: Mapped[str | None] = mapped_column(String)
    active: Mapped[bool] = mapped_column(default=True, nullable=False)


class Publication(Base):
    __tablename__ = "publications"
    __table_args__ = (
        # Cubre el filtro mas comun de la app: listar publicaciones publicadas
        # y no borradas (list_publications, admin/stats, artist profile).
        Index("ix_publications_status_deleted", "status", "deleted"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), nullable=False, index=True)
    kind: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    image: Mapped[str | None] = mapped_column(String)
    location: Mapped[str | None] = mapped_column(String)
    start_date: Mapped[datetime | None] = mapped_column(DateTime)
    end_date: Mapped[datetime | None] = mapped_column(DateTime)
    link: Mapped[str | None] = mapped_column(String)
    featured: Mapped[bool] = mapped_column(default=False, nullable=False)
    status: Mapped[str] = mapped_column(String, default="DRAFT", nullable=False)
    moderation_note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    deleted: Mapped[bool] = mapped_column(default=False, nullable=False)

    category: Mapped["Category"] = relationship()
    author: Mapped["User"] = relationship()


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    publication_id: Mapped[int] = mapped_column(
        ForeignKey("publications.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    venue: Mapped[str | None] = mapped_column(String)
    capacity: Mapped[int | None] = mapped_column(Integer)


class Opportunity(Base):
    __tablename__ = "opportunities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    publication_id: Mapped[int] = mapped_column(
        ForeignKey("publications.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    organization_name: Mapped[str | None] = mapped_column(String)
    deadline: Mapped[datetime | None] = mapped_column(DateTime)


class Favorite(Base):
    __tablename__ = "favorites"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    publication_id: Mapped[int] = mapped_column(
        ForeignKey("publications.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    publication_id: Mapped[int] = mapped_column(ForeignKey("publications.id"), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String, default="OPEN", nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class Suggestion(Base):
    __tablename__ = "suggestions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String, default="NEW", nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class PublicationImage(Base):
    __tablename__ = "publication_images"
    __table_args__ = (UniqueConstraint("publication_id", "position"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    publication_id: Mapped[int] = mapped_column(
        ForeignKey("publications.id", ondelete="CASCADE"), nullable=False
    )
    url: Mapped[str] = mapped_column(String, nullable=False)
    alt_text: Mapped[str] = mapped_column(String, default="", nullable=False)
    caption: Mapped[str | None] = mapped_column(String)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class Session_(Base):
    __tablename__ = "sessions"

    token: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class Collaborator(Base):
    __tablename__ = "collaborators"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    code: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    points: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    level: Mapped[str] = mapped_column(String, default="INICIADO", nullable=False)
    active: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class CollaboratorActivity(Base):
    __tablename__ = "collaborator_activities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    collaborator_id: Mapped[int] = mapped_column(
        ForeignKey("collaborators.id", ondelete="CASCADE"), nullable=False, index=True
    )
    type: Mapped[str] = mapped_column(String, nullable=False)
    points: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    evidence_url: Mapped[str | None] = mapped_column(String)
    publication_id: Mapped[int | None] = mapped_column(
        ForeignKey("publications.id", ondelete="SET NULL")
    )
    status: Mapped[str] = mapped_column(String, default="APPROVED", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class Reward(Base):
    __tablename__ = "rewards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # UNIQUE agregado en Fase 2: el schema.sql original no lo tenia y el seed
    # del backend legado (INSERT OR IGNORE en cada arranque) duplico las 12
    # recompensas 11 veces en data/tejido.db al no tener nada contra que
    # chocar. Ver backend/scripts/migrate_sqlite_to_postgres.py.
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    points_cost: Mapped[int] = mapped_column(Integer, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)
    image: Mapped[str | None] = mapped_column(String)
    stock: Mapped[int] = mapped_column(Integer, default=-1, nullable=False)
    active: Mapped[bool] = mapped_column(default=True, nullable=False)


class RewardRedemption(Base):
    __tablename__ = "reward_redemptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    collaborator_id: Mapped[int] = mapped_column(ForeignKey("collaborators.id"), nullable=False, index=True)
    reward_id: Mapped[int] = mapped_column(ForeignKey("rewards.id"), nullable=False)
    points_cost: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String, default="PENDING", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class ActivityType(Base):
    __tablename__ = "activity_types"

    type: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    default_points: Mapped[int] = mapped_column(Integer, nullable=False)
    requires_evidence: Mapped[bool] = mapped_column(default=False, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)


class Artist(Base):
    __tablename__ = "artists"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String, nullable=False)
    stage_name: Mapped[str] = mapped_column(String, nullable=False)
    slug: Mapped[str | None] = mapped_column(String)
    real_name: Mapped[str | None] = mapped_column(String)
    bio: Mapped[str | None] = mapped_column(Text)
    image: Mapped[str | None] = mapped_column(String)
    hero_image: Mapped[str | None] = mapped_column(String)
    genre: Mapped[str | None] = mapped_column(String)
    city: Mapped[str | None] = mapped_column(String, default="Caucasia")
    region: Mapped[str | None] = mapped_column(String, default="Bajo Cauca, Antioquia")
    spotify_url: Mapped[str | None] = mapped_column(String)
    youtube_url: Mapped[str | None] = mapped_column(String)
    instagram_url: Mapped[str | None] = mapped_column(String)
    tiktok_url: Mapped[str | None] = mapped_column(String)
    featured: Mapped[bool] = mapped_column(default=False, nullable=False)
    active: Mapped[bool] = mapped_column(default=True, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Track(Base):
    __tablename__ = "tracks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    artist_id: Mapped[int] = mapped_column(ForeignKey("artists.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    slug: Mapped[str | None] = mapped_column(String)
    album: Mapped[str | None] = mapped_column(String)
    genre: Mapped[str | None] = mapped_column(String)
    duration: Mapped[str | None] = mapped_column(String)
    cover_image: Mapped[str | None] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(Text)
    spotify_url: Mapped[str | None] = mapped_column(String)
    youtube_url: Mapped[str | None] = mapped_column(String)
    apple_music_url: Mapped[str | None] = mapped_column(String)
    amazon_music_url: Mapped[str | None] = mapped_column(String)
    release_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String, default="published", nullable=False)
    featured: Mapped[bool] = mapped_column(default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class ArtistTimeline(Base):
    __tablename__ = "artist_timeline"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    artist_id: Mapped[int] = mapped_column(ForeignKey("artists.id", ondelete="CASCADE"), nullable=False, index=True)
    titulo: Mapped[str] = mapped_column(String, nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text)
    fecha: Mapped[date | None] = mapped_column(Date)
    imagen_url: Mapped[str | None] = mapped_column(String)
    video_url: Mapped[str | None] = mapped_column(String)
    orden: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class ArtistMedia(Base):
    __tablename__ = "artist_media"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    artist_id: Mapped[int] = mapped_column(ForeignKey("artists.id", ondelete="CASCADE"), nullable=False, index=True)
    tipo: Mapped[str] = mapped_column(String, default="image", nullable=False)
    url: Mapped[str] = mapped_column(String, nullable=False)
    titulo: Mapped[str | None] = mapped_column(String)
    descripcion: Mapped[str | None] = mapped_column(Text)
    fecha: Mapped[date | None] = mapped_column(Date)
    orden: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    destacado: Mapped[bool] = mapped_column(default=False, nullable=False)


class ArtistSocialLink(Base):
    __tablename__ = "artist_social_links"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    artist_id: Mapped[int] = mapped_column(ForeignKey("artists.id", ondelete="CASCADE"), nullable=False, index=True)
    platform: Mapped[str] = mapped_column(String, nullable=False)
    url: Mapped[str] = mapped_column(String, nullable=False)
    username: Mapped[str | None] = mapped_column(String)
    icon: Mapped[str | None] = mapped_column(String)
    orden: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class ArtistConnection(Base):
    __tablename__ = "artist_connections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    artist_id: Mapped[int] = mapped_column(ForeignKey("artists.id", ondelete="CASCADE"), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String, nullable=False)
    entity_id: Mapped[int | None] = mapped_column(Integer)
    titulo: Mapped[str] = mapped_column(String, nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text)
    imagen_url: Mapped[str | None] = mapped_column(String)
    url: Mapped[str | None] = mapped_column(String)
    orden: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class ArtistMetric(Base):
    __tablename__ = "artist_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    artist_id: Mapped[int] = mapped_column(ForeignKey("artists.id", ondelete="CASCADE"), nullable=False, index=True)
    tipo: Mapped[str] = mapped_column(String, nullable=False)
    valor: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    fecha: Mapped[date] = mapped_column(Date, nullable=False)
    metadata_: Mapped[dict | list | str | float | int | bool | None] = mapped_column("metadata", JSONB)
