"""Carrusel del inicio (GET /api/home/carousel, services/home_carousel.py).

Las pruebas de composicion trabajan en una transaccion del schema de test que se deshace al final:
esconden el contenido sembrado, insertan el suyo y llaman al servicio. Nada queda guardado.
"""
import json
import uuid
from datetime import date, datetime, timedelta

import pytest
from sqlalchemy import delete, func, select, update

from backend.service.db.session import get_db
from backend.service.main import app
from backend.service.models.tables import (Artist, Category, CulturalBranch, HomeCarouselPick, HomeCarouselSettings, Publication,
                                           TalentProfile, User)
from backend.service.services import home_carousel
from backend.service.services.auth import now_utc

PRIVATE_KEYS = {"author_id", "user_id", "created_by", "representative_user_id", "email", "moderation_note",
                "status", "deleted", "act_number", "author"}
TODAY = date(2026, 11, 3)
BRANCHES = ["MUSICA", "DANZA", "TEATRO", "LITERATURA", "ARTESANIAS", "CINE_AUDIOVISUAL", "PATRIMONIO_MEMORIA",
            "ARTES_VISUALES", "GASTRONOMIA_CULTURAL", "EMPRENDIMIENTO_CULTURAL"]


@pytest.fixture
def db(client):  # el client instala el schema de test (dependency override)
    gen = app.dependency_overrides[get_db]()
    session = next(gen)
    # Sin contenido publico previo: lo sembrado y lo de otros tests queda fuera (y vuelve con el rollback).
    session.execute(update(Publication).values(deleted=True))
    session.execute(update(TalentProfile).values(deleted=True))
    session.execute(update(Artist).values(active=False))
    # Sin elegidos y con las cantidades por defecto: el carrusel automatico.
    session.execute(delete(HomeCarouselPick))
    session.execute(delete(HomeCarouselSettings))
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
        values = {"title": f"Pub {uuid.uuid4().hex[:6]}", "summary": "Resumen", "content": "Contenido", **extra}
        row = Publication(author_id=self.user_id, category_id=self.categories[kind], kind=kind, image=image,
                          status=status, cultural_category=branch, created_at=at, updated_at=at,
                          moderation_note="nota privada", **values)
        self.db.add(row)
        self.db.flush()
        return row

    def talent(self, status="PUBLISHED", branch="DANZA", cover="https://img.test/t.jpg", **extra):
        at = self._tick()
        values = {"slug": f"talento-{uuid.uuid4().hex[:8]}", "name": "Grupo de prueba", "category": branch,
                  "origin": "caucasia", "tagline": "Bullerengue", "cover_url": cover, "created_by": self.user_id,
                  "representative_user_id": self.user_id, "status": status, "created_at": at, "updated_at": at,
                  "published_at": at if status == "PUBLISHED" else None, **extra}
        row = TalentProfile(**values)
        self.db.add(row)
        self.db.flush()
        return row

    def artist(self, name, featured=False, active=True, image="https://img.test/a.jpg", bio="Bio", moneystack=True, **extra):
        row = Artist(user_id=self.user_id, name=name, stage_name=name, slug=f"{name.lower()}-{uuid.uuid4().hex[:6]}",
                     bio=bio, image=image, featured=featured, active=active, moneystack=moneystack, created_at=self._tick(), **extra)
        self.db.add(row)
        self.db.flush()
        return row


@pytest.fixture
def content(db):
    return Content(db)


def limits(db, content=10, moneystack=3, tejido=3):
    db.merge(HomeCarouselSettings(id=1, content_limit=content, moneystack_limit=moneystack, tejido_limit=tejido, updated_at=now_utc()))
    db.flush()


def keys(slides):
    return [slide["key"] for slide in slides]


def build(db):
    return home_carousel.build_carousel(db, today=TODAY)


def by_key(slides):
    return {slide["key"]: slide for slide in slides}


def at(day, hour=0):
    return datetime.combine(day, datetime.min.time()) + timedelta(hours=hour)


def test_empty_database_returns_no_slides(db):
    assert build(db) == []


def test_only_public_content(db, content):
    visible = content.publication()
    hidden = [content.publication(status=status, branch=branch)
              for status, branch in (("DRAFT", "DANZA"), ("REVIEW", "TEATRO"), ("REJECTED", "LITERATURA"))]
    hidden.append(content.publication(deleted=True, branch="ARTESANIAS"))
    hidden.append(content.publication(kind="TALENTO", branch="CINE_AUDIOVISUAL"))  # tipo legado
    talent = content.talent()
    draft_talent = content.talent(status="REVIEW")
    content.artist("Activo", featured=True)
    inactive = content.artist("Inactivo", active=False)

    found = keys(build(db))
    assert f"publication-{visible.id}" in found and f"talent-{talent.id}" in found
    assert not {f"publication-{p.id}" for p in hidden} & set(found)
    assert f"talent-{draft_talent.id}" not in found and f"artist-{inactive.id}" not in found


def test_one_publication_per_category_featured_then_most_recent(db, content):
    featured_old = content.publication(branch="MUSICA", featured=True)
    content.publication(branch="MUSICA")  # mas reciente pero sin destacar
    content.publication(branch="DANZA")
    newest_dance = content.publication(branch="DANZA")
    without_category = content.publication(branch=None)
    slides = build(db)
    publications = [s for s in slides if s["type"] == "PUBLICATION"]
    assert keys(publications) == [f"publication-{featured_old.id}", f"publication-{newest_dance.id}"]
    assert f"publication-{without_category.id}" not in keys(slides)


def test_one_per_each_of_the_ten_categories_plus_one_talent(db, content):
    for branch in BRANCHES:
        content.publication(branch=branch)
        content.publication(branch=branch)
    first_talent = content.talent()
    featured_talent = content.talent(featured=True)
    # Por defecto caben 10: de los 11 candidatos se cae el de menos prioridad (la publicacion mas antigua).
    default = build(db)
    assert len(default) == 10 and default[0]["key"] == f"talent-{featured_talent.id}"
    limits(db, content=12)
    slides = build(db)
    assert len(slides) == 11 and keys(default) == keys(slides)[:10]
    labels = dict(db.execute(select(CulturalBranch.key, CulturalBranch.label)).all())
    assert sorted(s["category_label"] for s in slides if s["type"] == "PUBLICATION") == sorted(
        labels[b] for b in BRANCHES)
    talents = [s for s in slides if s["type"] == "TALENT"]
    assert keys(talents) == [f"talent-{featured_talent.id}"] and f"talent-{first_talent.id}" not in keys(slides)
    # Orden del contenido: destacado primero y luego del mas reciente al mas antiguo.
    assert slides[0]["key"] == f"talent-{featured_talent.id}"
    assert all(s["type"] != "ARTIST" for s in slides)


def test_interleaves_artists_spread_evenly_starting_with_content(db, content):
    pubs = [content.publication(branch=branch) for branch in BRANCHES[:4]]
    talent = content.talent()
    a = content.artist("Uno", featured=True)
    b = content.artist("Dos")
    c = content.artist("Tres")
    content.artist("Zeta")  # ultimo por nombre: pasa de la cuota de Moneystack (3)
    slides = build(db)
    # 5 de contenido y 3 artistas: el artista i va detras del contenido floor(i * 5 / 3) = 0, 1, 3.
    assert [s["type"] for s in slides] == ["TALENT", "ARTIST", "PUBLICATION", "ARTIST", "PUBLICATION",
                                           "PUBLICATION", "ARTIST", "PUBLICATION"]
    # Contenido del mas reciente al mas antiguo (el talento es lo ultimo creado).
    assert keys([s for s in slides if s["type"] != "ARTIST"]) == [f"talent-{talent.id}"] + [f"publication-{p.id}" for p in reversed(pubs)]
    # Cada artista una sola vez, destacados primero y luego por nombre.
    assert artist_keys(slides) == [f"artist-{a.id}", f"artist-{b.id}", f"artist-{c.id}"]


def test_alternation_by_theme_counts_only_content(db, content):
    for branch in BRANCHES[:3]:
        content.publication(branch=branch)
    content.artist("Solo", featured=True)
    slides = build(db)
    # El frontend alterna A/B contando solo las que no son de artista: A, artista, B, artista, A, artista.
    content_positions = [i for i, s in enumerate(slides) if s["type"] != "ARTIST"]
    assert content_positions == [0, 2, 3] and [s["type"] for s in slides].count("ARTIST") == 1


def test_without_artists_only_content_and_without_content_only_artists(db, content):
    publication = content.publication()
    talent = content.talent()
    assert {s["type"] for s in build(db)} == {"PUBLICATION", "TALENT"}
    db.execute(update(Publication).values(deleted=True))
    db.execute(update(TalentProfile).values(deleted=True))
    a = content.artist("Uno", featured=True)
    b = content.artist("Dos")
    assert keys(build(db)) == [f"artist-{a.id}", f"artist-{b.id}"]
    assert publication and talent


def test_validity_by_bogota_date(db, content):
    yesterday, tomorrow = TODAY - timedelta(days=1), TODAY + timedelta(days=1)
    cases = {
        "past_event": ("EVENTO", "MUSICA", {"start_date": at(yesterday - timedelta(days=2)), "end_date": at(yesterday, 22)}, False),
        "past_single_day": ("EVENTO", "DANZA", {"start_date": at(yesterday, 18)}, False),
        "ongoing_event": ("EVENTO", "TEATRO", {"start_date": at(yesterday), "end_date": at(tomorrow)}, True),
        "event_today": ("EVENTO", "LITERATURA", {"start_date": at(TODAY, 19)}, True),
        "event_without_dates": ("EVENTO", "ARTESANIAS", {}, True),
        "closed_opportunity": ("OPORTUNIDAD", "CINE_AUDIOVISUAL", {"end_date": at(yesterday, 23)}, False),
        "closes_today": ("OPORTUNIDAD", "PATRIMONIO_MEMORIA", {"end_date": at(TODAY, 23)}, True),
        "open_without_close": ("OPORTUNIDAD", "ARTES_VISUALES", {}, True),
        "old_history": ("HISTORIA", "GASTRONOMIA_CULTURAL", {"start_date": at(yesterday - timedelta(days=90))}, True),
    }
    rows = {name: content.publication(kind=kind, branch=branch, **dates) for name, (kind, branch, dates, _) in cases.items()}
    found = set(keys(build(db)))
    for name, (_, _, _, expected) in cases.items():
        assert (f"publication-{rows[name].id}" in found) is expected, name


def test_an_expired_event_lets_the_next_one_of_its_category_in(db, content):
    still_open = content.publication(kind="EVENTO", start_date=at(TODAY + timedelta(days=5)))
    content.publication(kind="EVENTO", start_date=at(TODAY - timedelta(days=5)))  # mas reciente pero vencido
    assert keys(build(db)) == [f"publication-{still_open.id}"]


def test_badge_tags_tagline_and_sheet(db, content):
    event = content.publication(kind="EVENTO", branch="MUSICA", municipality="caucasia", location="Malecón de Caucasia",
                                start_date=at(TODAY + timedelta(days=4)), tagline="Una frase breve",
                                tags=["Música", "Río", "Comunidad"])
    story = content.publication(kind="HISTORIA", branch="DANZA", location=" ")
    talent = content.talent(branch="TEATRO", tagline="Teatro de calle", description="Descripcion larga")
    slides = by_key(build(db))
    ev = slides[f"publication-{event.id}"]
    assert ev["kind"] == "EVENTO" and ev["badge"] == "Evento · Caucasia" and ev["municipality"] == "Caucasia"
    assert ev["tags"] == ["Música", "Río", "Comunidad"][:1] + ["Río", "Comunidad"]  # sin repetir la categoria
    assert ev["tagline"] == "Una frase breve" and ev["category_label"] == "Música"
    assert ev["location"] == "Malecón de Caucasia" and ev["start_date"].startswith("2026-11-07") and "end_date" not in ev
    st = slides[f"publication-{story.id}"]
    assert st["badge"] == "Historia" and st["tags"] == ["Danza"]
    assert not {"municipality", "tagline", "location", "start_date", "end_date"} & set(st)
    tal = slides[f"talent-{talent.id}"]
    assert tal["kind"] == "TALENT" and tal["badge"] == "Talento · Caucasia" and tal["tags"] == ["Teatro"]
    assert tal["tagline"] == "Teatro de calle" and tal["summary"] == "Descripcion larga" and tal["municipality"] == "Caucasia"


def test_cta_by_kind(db, content):
    expected = {"EVENTO": "Ver evento", "OPORTUNIDAD": "Ver convocatoria", "HISTORIA": "Leer historia",
                "INICIATIVA": "Conocer iniciativa", "LUGAR": "Ver lugar"}
    rows = {kind: content.publication(kind=kind, branch=branch) for kind, branch in zip(expected, BRANCHES)}
    talent = content.talent()
    content.artist("Uno", featured=True)
    slides = by_key(build(db))
    for kind, row in rows.items():
        assert slides[f"publication-{row.id}"]["cta_label"] == expected[kind]
    assert slides[f"talent-{talent.id}"]["cta_label"] == "Ver perfil"
    assert [s["cta_label"] for s in slides.values() if s["type"] == "ARTIST"] == ["Ver perfil"]


def test_summary_falls_back_to_a_plain_excerpt_of_the_content(db, content):
    row = content.publication(summary="", content="<p>Primer <b>parrafo</b></p> " + "texto " * 300)
    slide = by_key(build(db))[f"publication-{row.id}"]
    assert slide["summary"].startswith("Primer parrafo texto") and "<" not in slide["summary"]
    assert len(slide["summary"]) <= home_carousel.SUMMARY_LIMIT == 240


def test_artist_slide_payload_is_unchanged(db, content):
    artist = content.artist("Mauro", featured=True, bio="Bio " * 80)
    content.publication()
    slide = next(s for s in build(db) if s["type"] == "ARTIST")
    assert list(slide) == ["type", "key", "title", "summary", "image", "badge", "tags", "href", "cta_label", "artist",
                           "featured_track", "sello"]
    assert slide["key"] == f"artist-{artist.id}" and slide["badge"] == "Artista destacado"
    assert slide["tags"] == ["Moneystack", "Bajo Cauca", "Música Urbana"] and slide["cta_label"] == "Ver perfil"
    assert len(slide["summary"]) <= 180 and slide["href"] == f"#artista/{artist.slug}"
    assert set(slide["artist"]) == set(home_carousel.ARTIST_FIELDS) and slide["featured_track"] is None


def test_image_falls_back_to_branch_cover(db, content):
    db.execute(update(CulturalBranch).where(CulturalBranch.key.in_(("DANZA", "TEATRO"))).values(image_url=None))
    db.execute(update(CulturalBranch).where(CulturalBranch.key == "DANZA").values(image_url="https://img.test/portada-danza.jpg"))
    with_cover = content.publication(branch="DANZA", image=None)
    static = content.publication(kind="EVENTO", branch="TEATRO", image=None)
    slides = by_key(build(db))
    assert slides[f"publication-{with_cover.id}"]["image"] == "https://img.test/portada-danza.jpg"
    assert slides[f"publication-{static.id}"]["image"] == "/images/categorias/teatro.jpg"


def test_slides_have_public_fields_only(db, content):
    publication = content.publication(kind="EVENTO", tags=["Uno"], tagline="Eslogan")
    publication.summary = "<b>Texto</b> " + "largo " * 80
    talent = content.talent()
    artist = content.artist("Publico", featured=True)
    db.flush()
    slides = build(db)
    keyed = by_key(slides)
    pub = keyed[f"publication-{publication.id}"]
    assert pub["href"] == f"#publicacion/{publication.id}"
    assert "<b>" not in pub["summary"] and len(pub["summary"]) <= home_carousel.SUMMARY_LIMIT
    assert keyed[f"talent-{talent.id}"]["href"] == f"#talento/{talent.slug}"
    assert keyed[f"artist-{artist.id}"]["href"] == f"#artista/{artist.slug}"

    def walk(value):
        if isinstance(value, dict):
            for key, item in value.items():
                assert key not in PRIVATE_KEYS and not key.startswith("_"), key
                walk(item)
        elif isinstance(value, list):
            for item in value:
                walk(item)
    walk(slides)
    dumped = json.dumps(slides)
    assert "@" not in dumped and "nota privada" not in dumped
    assert '"id"' not in dumped


def test_endpoint_is_public_and_revalidated_with_etag(client):
    resp = client.get("/api/home/carousel")
    assert resp.status_code == 200 and resp.headers["content-type"].startswith("application/json")
    assert resp.headers["cache-control"] == "public, no-cache"
    etag = resp.headers["etag"]
    slides = resp.json()["slides"]
    assert "@" not in resp.text
    for slide in slides:
        assert {"type", "key", "title", "summary", "image", "badge", "tags", "href", "cta_label"} <= set(slide)
    same = client.get("/api/home/carousel", headers={"If-None-Match": etag})
    assert same.status_code == 304 and same.content == b"" and same.headers["etag"] == etag
    other = client.get("/api/home/carousel", headers={"If-None-Match": '"otra"'})
    assert other.status_code == 200 and other.headers["etag"] == etag


def test_featuring_or_archiving_an_artist_is_seen_on_the_next_load(client):
    # Sesion aparte que confirma (como el editor del admin); el artista se borra al final.
    gen = app.dependency_overrides[get_db]()
    session = next(gen)
    user_id = session.execute(select(func.min(User.id))).scalar_one()
    artist = Artist(user_id=user_id, name="Etag", stage_name="Etag", slug=f"etag-{uuid.uuid4().hex[:6]}", bio="Bio",
                    featured=False, active=True, created_at=now_utc())
    session.add(artist)
    session.commit()
    try:
        def load(etag=None):
            resp = client.get("/api/home/carousel", headers={"If-None-Match": etag} if etag else {})
            return resp.status_code, resp.headers["etag"]

        _, plain = load()
        artist.featured = True
        session.commit()
        status, featured = load(plain)
        assert status == 200 and featured != plain
        assert load(featured)[0] == 304
        artist.active = False
        session.commit()
        status, archived = load(featured)
        assert status == 200 and archived != featured
        artist.active, artist.featured = True, False
        session.commit()
        assert load(featured) == (200, plain)
    finally:
        session.delete(artist)
        session.commit()
        gen.close()


# ───────────── artistas: cuota por sello, cada uno una vez ─────────────

def artist_keys(slides):
    return [s["key"] for s in slides if s["type"] == "ARTIST"]


def types(slides):
    return [s["type"] for s in slides]


@pytest.mark.parametrize("pieces", [0, 1, 2])
def test_featured_artist_first_with_little_content(db, content, pieces):
    for branch in BRANCHES[:pieces]:
        content.publication(branch=branch)
    others = [content.artist(name) for name in ("Ana", "Beto", "Caro")]
    star = content.artist("Zeta", featured=True)  # ultimo por nombre, primero por destacado
    slides = build(db)
    assert artist_keys(slides) == [f"artist-{a.id}" for a in [star, *others][:3]]
    if pieces == 1:
        assert types(slides) == ["PUBLICATION", "ARTIST", "ARTIST", "ARTIST"]
    if pieces == 2:
        assert types(slides) == ["PUBLICATION", "ARTIST", "ARTIST", "PUBLICATION", "ARTIST"]


def test_more_artists_than_content_go_in_even_blocks(db, content):
    pubs = [content.publication(branch=branch) for branch in BRANCHES[:2]]
    stars = [content.artist(name, featured=True) for name in ("Ana", "Beto", "Caro", "Dino", "Eva")]
    limits(db, moneystack=5)
    slides = build(db)
    assert types(slides) == ["PUBLICATION", "ARTIST", "ARTIST", "ARTIST", "PUBLICATION", "ARTIST", "ARTIST"]
    assert artist_keys(slides) == [f"artist-{a.id}" for a in stars]
    assert keys([s for s in slides if s["type"] != "ARTIST"]) == [f"publication-{p.id}" for p in reversed(pubs)]


@pytest.mark.parametrize("pieces,artists", [(1, 1), (3, 2), (5, 3), (10, 3), (10, 6), (4, 6)])
def test_each_artist_once_and_spread(db, content, pieces, artists):
    for branch in BRANCHES[:pieces]:
        content.publication(branch=branch)
    for i in range(artists):
        content.artist(f"Art{i}", featured=i == 0)
    limits(db, moneystack=6)
    slides = build(db)
    sequence = artist_keys(slides)
    assert len(sequence) == len(set(sequence)) == artists
    assert slides[0]["type"] != "ARTIST" and len(slides) == pieces + artists
    if artists <= pieces:
        # Un artista por bloque como mucho, y separados parejo.
        positions = [i for i, s in enumerate(slides) if s["type"] == "ARTIST"]
        assert all(slides[i - 1]["type"] != "ARTIST" for i in positions)
        assert all(b - a <= -(-pieces // artists) + 1 for a, b in zip(positions, positions[1:])), types(slides)


def test_quota_per_sello_and_fill_alternates_starting_with_moneystack(db, content):
    for branch in BRANCHES[:6]:
        content.publication(branch=branch)
    money = [content.artist(f"M{i}", featured=i == 0) for i in range(4)]
    tejido = [content.artist(f"T{i}", moneystack=False, featured=i == 2) for i in range(4)]
    slides = build(db)
    assert artist_keys(slides) == [f"artist-{a.id}" for a in (money[0], tejido[2], money[1], tejido[0], money[2], tejido[1])]
    limits(db, moneystack=1, tejido=4)
    assert artist_keys(build(db)) == [f"artist-{a.id}" for a in (money[0], tejido[2], tejido[0], tejido[1], tejido[3])]
    limits(db, moneystack=0, tejido=0)
    assert artist_keys(build(db)) == []


def test_tejido_artist_card(db, content):
    content.publication()
    artist = content.artist("Rio", moneystack=False, genre="Bullerengue", municipality="nechi", bio="Bio")
    money = content.artist("Mauro", featured=True)
    slides = by_key(build(db))
    card = slides[f"artist-{artist.id}"]
    assert card["sello"] == "TEJIDO" and card["badge"] == "Artista de TEJIDO"
    assert card["tags"] == ["Bullerengue", "Nechí", "Música"] and "Moneystack" not in card["tags"]
    assert card["href"] == f"#artista/{artist.slug}" and card["cta_label"] == "Ver perfil"
    assert slides[f"artist-{money.id}"]["sello"] == "MONEYSTACK"
    # Sin genero ni municipio: solo "Musica".
    bare = content.artist("Seco", moneystack=False)
    assert by_key(build(db))[f"artist-{bare.id}"]["tags"] == ["Música"]


def test_no_content_only_artists_featured_first(db, content):
    regular = content.artist("Ana")
    stars = [content.artist(name, featured=True) for name in ("Zeta", "Yuli")]
    assert keys(build(db)) == [f"artist-{a.id}" for a in (stars[1], stars[0], regular)]


def test_no_artists_only_content(db, content):
    pubs = [content.publication(branch=branch) for branch in BRANCHES[:2]]
    content.artist("Archivado", featured=True, active=False)
    content.artist("En revision", moneystack=False, status="REVIEW")
    assert keys(build(db)) == [f"publication-{p.id}" for p in reversed(pubs)]


def test_two_artists_together_keep_the_artist_card(db, content):
    content.publication()
    content.artist("Ana", featured=True, bio="Bio " * 80)
    content.artist("Beto", featured=True)
    slides = build(db)
    assert types(slides) == ["PUBLICATION", "ARTIST", "ARTIST"]
    for slide in slides[1:]:
        assert list(slide) == ["type", "key", "title", "summary", "image", "badge", "tags", "href", "cta_label",
                               "artist", "featured_track", "sello"]
        assert slide["badge"] == "Artista destacado" and slide["tags"] == ["Moneystack", "Bajo Cauca", "Música Urbana"]
        assert len(slide["summary"]) <= 180 and slide["featured_track"] is None
