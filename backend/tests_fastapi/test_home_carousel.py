"""Carrusel del inicio (GET /api/home/carousel, services/home_carousel.py).

Las pruebas de composicion trabajan en una transaccion del schema de test que se deshace al final:
esconden el contenido sembrado, insertan el suyo y llaman al servicio. Nada queda guardado.
"""
import json
import uuid
from datetime import timedelta

import pytest
from sqlalchemy import delete, func, select, update

from backend.service.db.session import get_db
from backend.service.main import app
from backend.service.models.tables import (Artist, Category, CulturalCategoryCover, Publication, TalentProfile,
                                           User)
from backend.service.services import home_carousel
from backend.service.services.auth import now_utc

PRIVATE_KEYS = {"author_id", "user_id", "created_by", "representative_user_id", "email", "moderation_note",
                "status", "deleted", "act_number", "author"}


@pytest.fixture
def db(client):  # el client instala el schema de test (dependency override)
    gen = app.dependency_overrides[get_db]()
    session = next(gen)
    # Sin contenido publico previo: lo sembrado y lo de otros tests queda fuera (y vuelve con el rollback).
    session.execute(update(Publication).values(deleted=True))
    session.execute(update(TalentProfile).values(deleted=True))
    session.execute(update(Artist).values(active=False))
    try:
        yield session
    finally:
        session.rollback()
        gen.close()


class Content:
    def __init__(self, db):
        self.db = db
        self.user_id = db.execute(select(func.min(User.id))).scalar_one()
        self.categories = {c.type: c.id for c in db.execute(select(Category)).scalars()}
        self.clock = now_utc() - timedelta(days=30)

    def _tick(self):
        self.clock += timedelta(minutes=1)
        return self.clock

    def publication(self, kind="HISTORIA", branch="MUSICA", status="PUBLISHED", image="https://img.test/p.jpg", **extra):
        at = self._tick()
        row = Publication(author_id=self.user_id, category_id=self.categories[kind], kind=kind,
                          title=f"Pub {uuid.uuid4().hex[:6]}", summary="Resumen", content="Contenido", image=image,
                          status=status, cultural_category=branch, created_at=at, updated_at=at,
                          moderation_note="nota privada", **extra)
        self.db.add(row)
        self.db.flush()
        return row

    def talent(self, status="PUBLISHED", branch="DANZA", cover="https://img.test/t.jpg"):
        at = self._tick()
        row = TalentProfile(slug=f"talento-{uuid.uuid4().hex[:8]}", name="Grupo de prueba", category=branch,
                            origin="caucasia", tagline="Bullerengue", cover_url=cover, created_by=self.user_id,
                            representative_user_id=self.user_id, status=status, created_at=at, updated_at=at,
                            published_at=at if status == "PUBLISHED" else None)
        self.db.add(row)
        self.db.flush()
        return row

    def artist(self, name, featured=False, active=True, image="https://img.test/a.jpg"):
        row = Artist(user_id=self.user_id, name=name, stage_name=name, slug=f"{name.lower()}-{uuid.uuid4().hex[:6]}",
                     bio="Bio", image=image, featured=featured, active=active, created_at=self._tick())
        self.db.add(row)
        self.db.flush()
        return row


@pytest.fixture
def content(db):
    return Content(db)


def keys(slides):
    return [slide["key"] for slide in slides]


def branch_of(slide):
    """Rama visible de una diapositiva: la de la insignia de la publicacion o la del talento."""
    if slide["type"] == "PUBLICATION":
        parts = slide["badge"].split(" · ")
        return parts[1] if len(parts) > 1 else None
    return slide.get("category_label")


def assert_no_repeated_branch(slides):
    branches = [branch_of(slide) for slide in slides]
    assert all(not (a and a == b) for a, b in zip(branches, branches[1:])), branches


def test_empty_database_returns_no_slides(db):
    assert home_carousel.build_carousel(db) == []


def test_only_public_content(db, content):
    visible = content.publication()
    hidden = [content.publication(status=status) for status in ("DRAFT", "REVIEW", "REJECTED")]
    hidden.append(content.publication(deleted=True))
    hidden.append(content.publication(kind="TALENTO"))  # tipo legado
    talent = content.talent()
    draft_talent = content.talent(status="REVIEW")
    content.artist("Activo", featured=True)
    inactive = content.artist("Inactivo", active=False)

    slides = home_carousel.build_carousel(db)
    found = keys(slides)
    assert f"publication-{visible.id}" in found and f"talent-{talent.id}" in found
    assert not {f"publication-{p.id}" for p in hidden} & set(found)
    assert f"talent-{draft_talent.id}" not in found and f"artist-{inactive.id}" not in found


def test_composition_limits_and_order(db, content):
    branches = ["MUSICA", "DANZA", "TEATRO", "LITERATURA", "ARTESANIAS", "CINE_AUDIOVISUAL", "PATRIMONIO_MEMORIA"]
    for index, kind in enumerate(["HISTORIA"] * 4 + ["EVENTO"] * 3 + ["LUGAR"] * 3):
        content.publication(kind=kind, branch=branches[index % len(branches)])
    for _ in range(3):
        content.talent(branch="ARTES_VISUALES")
    featured = content.artist("Destacado", featured=True)
    content.artist("Segundo")
    content.artist("Tercero")

    slides = home_carousel.build_carousel(db)
    assert len(slides) == home_carousel.MAX_SLIDES
    assert slides[0]["key"] == f"artist-{featured.id}" and slides[0]["artist"]["stage_name"] == "Destacado"
    types = [slide["type"] for slide in slides]
    assert types.count("ARTIST") == 2 and types.count("TALENT") <= 2 and types.count("PUBLICATION") <= 5
    kinds = {}
    for slide in slides:
        if slide["type"] == "PUBLICATION":
            kind = slide["badge"].split(" · ")[0]
            kinds[kind] = kinds.get(kind, 0) + 1
    assert max(kinds.values()) <= home_carousel.MAX_PER_KIND
    assert_no_repeated_branch(slides)
    # Intercalado: las publicaciones no van todas juntas.
    assert types[:4] == ["ARTIST", "PUBLICATION", "TALENT", "PUBLICATION"]


def test_no_two_consecutive_slides_share_a_branch(db, content):
    for _ in range(4):
        content.publication(kind="HISTORIA", branch="MUSICA")
        content.publication(kind="EVENTO", branch="MUSICA")
    slides = home_carousel.build_carousel(db)
    assert slides
    assert_no_repeated_branch(slides)


def test_featured_publications_go_first(db, content):
    older_featured = content.publication(kind="HISTORIA", branch="DANZA", featured=True)
    for branch in ("MUSICA", "TEATRO", "LITERATURA"):
        content.publication(kind="EVENTO", branch=branch)
    publications = [s for s in home_carousel.build_carousel(db) if s["type"] == "PUBLICATION"]
    assert publications[0]["key"] == f"publication-{older_featured.id}"


def test_badge_tags_and_sheet(db, content):
    with_sheet = content.publication(kind="EVENTO", branch="MUSICA", location="Parque principal",
                                     start_date=now_utc().replace(tzinfo=None))
    without_sheet = content.publication(kind="HISTORIA", branch=None)
    talent = content.talent(branch="DANZA")
    by_key = {slide["key"]: slide for slide in home_carousel.build_carousel(db)}
    event = by_key[f"publication-{with_sheet.id}"]
    assert event["badge"] == "Evento · Música" and event["cta_label"] == "Leer más"
    assert event["location"] == "Parque principal" and event["start_date"] and "end_date" not in event
    assert not set(event["tags"]) & {"Evento", "Música"}  # las etiquetas no repiten la insignia
    story = by_key[f"publication-{without_sheet.id}"]
    assert story["badge"] == "Historia" and not {"location", "start_date", "end_date"} & set(story)
    profile = by_key[f"talent-{talent.id}"]
    assert profile["badge"] == "Talento · Caucasia" and profile["tags"] == ["Danza"]
    assert profile["municipality"] == "Caucasia" and profile["category_label"] == "Danza" and profile["cta_label"] == "Ver perfil"


def test_without_featured_artist_the_carousel_still_works(db, content):
    publication = content.publication()
    talent = content.talent()
    slides = home_carousel.build_carousel(db)
    assert keys(slides) == [f"publication-{publication.id}", f"talent-{talent.id}"]
    assert all(slide["type"] != "ARTIST" for slide in slides)


def test_image_falls_back_to_branch_cover_or_is_skipped(db, content):
    db.execute(delete(CulturalCategoryCover).where(CulturalCategoryCover.category_key.in_(("DANZA", "TEATRO"))))
    db.add(CulturalCategoryCover(category_key="DANZA", image_url="https://img.test/portada-danza.jpg", updated_at=now_utc()))
    with_cover = content.publication(branch="DANZA", image=None)
    static = content.publication(kind="EVENTO", branch="TEATRO", image=None)
    nothing = content.publication(kind="LUGAR", branch=None, image=None)
    slides = {slide["key"]: slide for slide in home_carousel.build_carousel(db)}
    assert slides[f"publication-{with_cover.id}"]["image"] == "https://img.test/portada-danza.jpg"
    assert slides[f"publication-{static.id}"]["image"] == "/images/categorias/teatro.jpg"
    assert f"publication-{nothing.id}" not in slides


def test_slides_have_public_fields_only(db, content):
    publication = content.publication(kind="EVENTO")
    publication.summary = "<b>Texto</b> " + "largo " * 80
    talent = content.talent()
    artist = content.artist("Publico", featured=True)
    db.flush()
    slides = home_carousel.build_carousel(db)
    by_key = {slide["key"]: slide for slide in slides}
    pub = by_key[f"publication-{publication.id}"]
    assert pub["href"] == f"#publicacion/{publication.id}" and pub["badge"] == "Evento · Música"
    assert "<b>" not in pub["summary"] and len(pub["summary"]) <= home_carousel.SUMMARY_LIMIT
    assert by_key[f"talent-{talent.id}"]["href"] == f"#talento/{talent.slug}"
    assert by_key[f"talent-{talent.id}"]["municipality"] == "Caucasia"
    assert by_key[f"artist-{artist.id}"]["href"] == f"#artista/{artist.slug}"
    assert by_key[f"artist-{artist.id}"]["badge"] == "Artista destacado"

    def walk(value):
        if isinstance(value, dict):
            for key, item in value.items():
                assert key not in PRIVATE_KEYS, key
                walk(item)
        elif isinstance(value, list):
            for item in value:
                walk(item)
    walk(slides)
    dumped = json.dumps(slides)
    assert "@" not in dumped and "nota privada" not in dumped
    assert '"id"' not in dumped


def test_endpoint_is_public_and_cacheable(client):
    resp = client.get("/api/home/carousel")
    assert resp.status_code == 200
    assert resp.headers["cache-control"] == "public, max-age=120"
    slides = resp.json()["slides"]
    assert len(slides) <= home_carousel.MAX_SLIDES
    assert "@" not in resp.text
    for slide in slides:
        assert {"type", "key", "title", "summary", "image", "badge", "tags", "href", "cta_label"} <= set(slide)
