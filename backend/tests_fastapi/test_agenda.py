"""Agenda publica (GET /api/agenda, services/agenda.py) y texto de tradicion de los eventos.

Las pruebas de bloques trabajan en una transaccion del schema de test que se deshace al final:
esconden lo sembrado, insertan sus eventos y llaman al servicio con un "hoy" fijo.
"""
import importlib.util
import json
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, func, select, text, update

from backend.service.core.config import settings
from backend.service.db.session import get_db
from backend.service.main import app
from backend.service.models.tables import Category, Publication, User
from backend.service.services import agenda as agenda_service
from backend.service.services import home_carousel
from backend.service.services.auth import now_utc
from backend.tests_fastapi.test_gestor_category import category_ids  # noqa: F401
from backend.tests_fastapi.test_parity import auth_header, tokens  # noqa: F401

ROOT = Path(__file__).resolve().parents[2]
TODAY = date(2026, 11, 3)
PRIVATE_KEYS = {"author_id", "author", "user_id", "email", "moderation_note", "status", "deleted", "featured",
                "created_at", "updated_at", "category_id", "content", "link"}
EVENT_KEYS = {"id", "title", "summary", "image", "kind", "municipality", "municipality_label", "cultural_category",
              "category_label", "location", "start_date", "end_date", "tradition_text"}


def at(day, hour=0, minute=0):
    return datetime.combine(day, datetime.min.time()) + timedelta(hours=hour, minutes=minute)


def days(n):
    return TODAY + timedelta(days=n)


@pytest.fixture
def db(client):  # el client instala el schema de test (dependency override)
    gen = app.dependency_overrides[get_db]()
    session = next(gen)
    session.execute(update(Publication).values(deleted=True))
    try:
        yield session
    finally:
        session.rollback()
        gen.close()


class Events:
    def __init__(self, db):
        self.db = db
        self.user_id = db.execute(select(func.min(User.id))).scalar_one()
        self.categories = {c.type: c.id for c in db.execute(select(Category)).scalars()}

    def add(self, title=None, kind="EVENTO", status="PUBLISHED", branch="MUSICA", municipality="caucasia", **extra):
        ts = now_utc()
        values = {"title": title or f"Evento {uuid.uuid4().hex[:6]}", "summary": "Resumen del evento",
                  "content": "Contenido del evento", "image": "https://img.test/e.jpg", "location": "Malecón", **extra}
        row = Publication(author_id=self.user_id, category_id=self.categories[kind], kind=kind, status=status,
                          cultural_category=branch, municipality=municipality, created_at=ts, updated_at=ts,
                          moderation_note="nota privada", **values)
        self.db.add(row)
        self.db.flush()
        return row


@pytest.fixture
def events(db):
    return Events(db)


def build(db, **kwargs):
    return agenda_service.build_agenda(db, today=TODAY, **kwargs)


def ids(items):
    return [item["id"] for item in items]


def test_blocks(db, events):
    upcoming = events.add(start_date=at(days(5), 19))
    ongoing = events.add(start_date=at(days(-2)), end_date=at(days(2)))
    today = events.add(start_date=at(TODAY, 8))
    three_days_ago = events.add(start_date=at(days(-3), 20))
    forty_days_ago = events.add(start_date=at(days(-40)))
    no_date = events.add()
    with_tradition_past = events.add(start_date=at(days(-30)), tradition_text="Cada 20 de julio")
    with_tradition_future = events.add(start_date=at(days(10)), tradition_text="Cada noviembre")
    data = build(db)
    assert ids(data["upcoming"]) == [ongoing.id, today.id, upcoming.id, with_tradition_future.id]
    assert set(ids(data["traditions"])) == {no_date.id, with_tradition_past.id}
    assert ids(data["recent_past"]) == [three_days_ago.id]
    assert forty_days_ago.id not in ids(data["upcoming"] + data["traditions"] + data["recent_past"])
    assert "archive" not in data and "archive_next_offset" not in data
    assert data["counts"] == {"upcoming": 4, "traditions": 2, "recent_past": 1}
    assert data["today"] == "2026-11-03"


def test_recent_past_limit_is_fifteen_days(db, events):
    fifteen = events.add(start_date=at(days(-15), 10))
    sixteen = events.add(start_date=at(days(-16), 23, 59))
    ended_in_range = events.add(start_date=at(days(-30)), end_date=at(days(-14)))
    yesterday_late = events.add(start_date=at(days(-1), 23, 59))
    assert ids(build(db)["recent_past"]) == [yesterday_late.id, ended_in_range.id, fifteen.id]
    assert sixteen.id not in ids(build(db)["recent_past"])


def test_past_one_brings_the_archive_newest_first_and_omits_recent(db, events):
    recent = events.add(start_date=at(days(-3)))
    old = events.add(start_date=at(days(-40)))
    older = events.add(start_date=at(days(-400)))
    events.add(start_date=at(days(-20)), tradition_text="Cada año")  # tradicion, no archivo
    data = build(db, past=True)
    assert "recent_past" not in data
    assert ids(data["archive"]) == [recent.id, old.id, older.id]
    assert data["counts"]["archive"] == 3 and data["archive_next_offset"] is None


def test_archive_pages(db, events, monkeypatch):
    monkeypatch.setattr(agenda_service, "ARCHIVE_PAGE", 2)
    rows = [events.add(start_date=at(days(-n))) for n in (1, 2, 3, 4, 5)]
    first = build(db, past=True)
    assert ids(first["archive"]) == [rows[0].id, rows[1].id] and first["archive_next_offset"] == 2
    second = build(db, past=True, offset=2)
    assert ids(second["archive"]) == [rows[2].id, rows[3].id] and second["archive_next_offset"] == 4
    last = build(db, past=True, offset=4)
    assert ids(last["archive"]) == [rows[4].id] and last["archive_next_offset"] is None


def test_order(db, events):
    late = events.add(start_date=at(days(9)))
    soon = events.add(start_date=at(days(1), 18))
    sooner = events.add(start_date=at(days(1), 9))
    zeta = events.add(title="Zeta tradición")
    alpha = events.add(title="alfa tradición")
    recent_a = events.add(start_date=at(days(-10)), end_date=at(days(-2)))
    recent_b = events.add(start_date=at(days(-4)))
    data = build(db)
    assert ids(data["upcoming"]) == [sooner.id, soon.id, late.id]
    assert ids(data["traditions"]) == [alpha.id, zeta.id]
    assert ids(data["recent_past"]) == [recent_a.id, recent_b.id]


def test_filters(db, events):
    caucasia_music = events.add(start_date=at(days(3)))
    nechi_music = events.add(start_date=at(days(3)), municipality="nechi")
    caucasia_dance = events.add(start_date=at(days(3)), branch="DANZA")
    assert ids(build(db, municipality="nechi")["upcoming"]) == [nechi_music.id]
    assert set(ids(build(db, category="DANZA")["upcoming"])) == {caucasia_dance.id}
    assert ids(build(db, municipality="caucasia", category="MUSICA")["upcoming"]) == [caucasia_music.id]
    assert build(db, municipality="zaragoza")["counts"] == {"upcoming": 0, "traditions": 0, "recent_past": 0}


def test_only_published_not_deleted_events(db, events):
    visible = events.add(start_date=at(days(2)))
    hidden = [events.add(start_date=at(days(2)), status=status) for status in ("DRAFT", "REVIEW", "REJECTED")]
    hidden.append(events.add(start_date=at(days(2)), deleted=True))
    for kind in ("OPORTUNIDAD", "HISTORIA", "INICIATIVA", "LUGAR"):
        hidden.append(events.add(kind=kind, start_date=at(days(2))))
    hidden.append(events.add(kind="OPORTUNIDAD"))  # sin fecha: tampoco es tradicion
    data = build(db, past=True)
    found = ids(data["upcoming"] + data["traditions"] + data["archive"])
    assert found == [visible.id]


def test_event_ending_today_late_is_upcoming(db, events):
    tonight = events.add(start_date=at(days(-1), 20), end_date=at(TODAY, 23, 30))
    assert ids(build(db)["upcoming"]) == [tonight.id]


def test_today_is_bogota_day(db, events, monkeypatch):
    """A las 03:00 UTC del 4 de noviembre en Bogota aun es el 3 (22:00): lo de hoy sigue en proximos."""
    class Clock(datetime):
        @classmethod
        def now(cls, tz=None):
            return datetime(2026, 11, 4, 3, 0, tzinfo=home_carousel.timezone.utc).astimezone(tz)
    monkeypatch.setattr(home_carousel, "datetime", Clock)
    assert agenda_service.today_bogota() == date(2026, 11, 3)
    tonight = events.add(start_date=at(TODAY, 18), end_date=at(TODAY, 23, 30))
    data = agenda_service.build_agenda(db)
    assert data["today"] == "2026-11-03" and ids(data["upcoming"]) == [tonight.id]


def test_public_fields_and_image_fallback(db, events):
    full = events.add(start_date=at(days(4), 19), end_date=at(days(5)), tagline="Una frase", tags=["Río", "Fiesta"],
                      tradition_text="Cada noviembre", branch="CINE_AUDIOVISUAL", municipality="elbagre")
    bare = events.add(image="degradado-viejo(red, blue)", branch="DANZA", municipality=None, location=" ")
    no_category = events.add(image=None, branch=None)
    data = build(db)
    item = next(i for i in data["upcoming"] if i["id"] == full.id)
    assert set(item) == EVENT_KEYS | {"tagline", "tags"}
    assert item["municipality"] == "elbagre" and item["municipality_label"] == "El Bagre"
    assert item["cultural_category"] == "cine-audiovisual" and item["category_label"] == "Cine y audiovisual"
    assert item["start_date"] == "2026-11-07T19:00:00" and item["end_date"] == "2026-11-08T00:00:00"
    assert item["tradition_text"] == "Cada noviembre" and item["tags"] == ["Río", "Fiesta"] and item["kind"] == "EVENTO"
    traditions = {i["id"]: i for i in data["traditions"]}
    assert set(traditions[bare.id]) == EVENT_KEYS
    assert "danza" in traditions[bare.id]["image"]  # portada de la categoria (el degradado viejo no vale)
    assert traditions[bare.id]["municipality"] is None and traditions[bare.id]["location"] is None
    assert traditions[no_category.id]["image"] is None and traditions[no_category.id]["cultural_category"] is None

    def walk(value):
        if isinstance(value, dict):
            for key, inner in value.items():
                assert key not in PRIVATE_KEYS, key
                walk(inner)
        elif isinstance(value, list):
            for inner in value:
                walk(inner)
    walk(data)
    assert "nota privada" not in json.dumps(data) and "@" not in json.dumps(data)


# ───────────── endpoint ─────────────

def test_endpoint_shape_validation_and_cache(client):
    resp = client.get("/api/agenda")
    assert resp.status_code == 200 and resp.headers["cache-control"] == "public, no-cache"
    data = resp.json()
    assert {"today", "upcoming", "traditions", "recent_past", "counts"} <= set(data) and "archive" not in data
    assert client.get("/api/agenda", headers={"If-None-Match": resp.headers["etag"]}).status_code == 304
    archive = client.get("/api/agenda?past=1&municipality=CAUCASIA&category=musica").json()
    assert "archive" in archive and "recent_past" not in archive and "archive_next_offset" in archive
    for query, code, message in (
        ("municipality=medellin", "INVALID_MUNICIPALITY", "Ese municipio no está en TEJIDO"),
        ("category=MUSICA_X", "INVALID_CATEGORY", "Esa categoría cultural no existe"),
        ("category=CINE_AUDIOVISUAL", "INVALID_CATEGORY", "Esa categoría cultural no existe"),  # clave, no slug
        ("past=2", "INVALID_PAST", "El parámetro past solo puede ser 0 o 1"),
        ("past=1&offset=-1", "INVALID_OFFSET", "El parámetro offset debe ser un número entero desde 0"),
    ):
        bad = client.get(f"/api/agenda?{query}")
        assert bad.status_code == 422 and bad.json() == {"error": code, "message": message}, query


# ───────────── texto de tradicion en las publicaciones ─────────────

@pytest.fixture
def admin(tokens):
    return auth_header(tokens, "admin")


def payload(category_ids, kind="EVENTO", **extra):
    return {"kind": kind, "category_id": category_ids[kind], "title": "Fiestas del río", "summary": "Resumen del evento de prueba.",
            "content": "Contenido suficiente del evento de prueba.", "location": "Caucasia", "municipality": "caucasia",
            "publish": True, **({"latitude": 7.9847, "longitude": -75.1953} if kind == "EVENTO" else {}), **extra}


def create(client, headers, category_ids, **extra):
    resp = client.post("/api/publications", json=payload(category_ids, **extra), headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def test_tradition_text_is_normalized_and_public(client, admin, category_ids):
    pub = create(client, admin, category_ids, tradition_text="  Cada <b>20</b>   de julio  ")
    assert client.get(f"/api/publications/{pub}").json()["tradition_text"] == "Cada 20 de julio"
    listed = next(p for p in client.get("/api/publications?kind=EVENTO").json() if p["id"] == pub)
    assert listed["tradition_text"] == "Cada 20 de julio"
    agenda = client.get("/api/agenda").json()
    assert next(e for e in agenda["traditions"] if e["id"] == pub)["tradition_text"] == "Cada 20 de julio"
    resp = client.put(f"/api/publications/{pub}", json=payload(category_ids, tradition_text="   "), headers=admin)
    assert resp.status_code == 200
    assert client.get(f"/api/publications/{pub}").json()["tradition_text"] is None
    client.delete(f"/api/publications/{pub}", headers=admin)


def test_tradition_text_limit_and_422(client, admin, category_ids):
    pub = create(client, admin, category_ids, tradition_text="x" * 80)
    assert len(client.get(f"/api/publications/{pub}").json()["tradition_text"]) == 80
    client.delete(f"/api/publications/{pub}", headers=admin)
    resp = client.post("/api/publications", json=payload(category_ids, tradition_text="x" * 81), headers=admin)
    assert resp.status_code == 422
    assert resp.json() == {"error": "INVALID_TRADITION_TEXT", "message": "El texto de tradición no puede pasar de 80 caracteres"}
    # El HTML no cuenta: 80 letras dentro de etiquetas caben.
    pub = create(client, admin, category_ids, tradition_text=f"<i>{'y' * 80}</i>")
    assert client.get(f"/api/publications/{pub}").json()["tradition_text"] == "y" * 80
    client.delete(f"/api/publications/{pub}", headers=admin)


def test_tradition_text_is_ignored_in_other_kinds(client, admin, category_ids):
    pub = create(client, admin, category_ids, kind="HISTORIA", tradition_text="x" * 200)
    assert client.get(f"/api/publications/{pub}").json()["tradition_text"] is None
    event = create(client, admin, category_ids, tradition_text="Cada año")
    resp = client.put(f"/api/publications/{event}", json=payload(category_ids, kind="HISTORIA", tradition_text="Cada año"), headers=admin)
    assert resp.status_code == 200
    assert client.get(f"/api/publications/{event}").json()["tradition_text"] is None
    for item in (pub, event):
        client.delete(f"/api/publications/{item}", headers=admin)


def test_dates_are_accepted_as_today(client, admin, category_ids):
    """El calendario manda lo mismo que el datetime-local: "AAAA-MM-DDTHH:mm" (sin hora = T00:00)."""
    pub = create(client, admin, category_ids, start_date="2026-12-20T00:00", end_date="2026-12-21T18:30")
    data = client.get(f"/api/publications/{pub}").json()
    assert data["start_date"] == "2026-12-20T00:00:00" and data["end_date"] == "2026-12-21T18:30:00"
    client.delete(f"/api/publications/{pub}", headers=admin)


def test_migration_adds_the_column_and_is_reversible():
    path = ROOT / "backend" / "alembic" / "versions" / "e8b3c5d7f9a2_texto_de_tradicion_de_eventos.py"
    spec = importlib.util.spec_from_file_location("migracion_tradicion", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    assert migration.down_revision == "d4f6a8c1e3b5"

    direct_url = settings.database_url.replace("-pooler.", ".")
    schema = f"test_mig_{uuid.uuid4().hex[:10]}"
    admin_engine = create_engine(direct_url)
    with admin_engine.begin() as conn:
        conn.execute(text(f'CREATE SCHEMA "{schema}"'))
    engine = create_engine(direct_url, connect_args={"options": f"-csearch_path={schema}"})
    try:
        with engine.begin() as conn:
            conn.execute(text("CREATE TABLE publications (id serial PRIMARY KEY, title varchar NOT NULL)"))
            conn.execute(text("INSERT INTO publications (title) VALUES ('Antigua')"))
            with Operations.context(MigrationContext.configure(conn)):
                migration.upgrade()
            assert conn.execute(text("SELECT tradition_text FROM publications")).scalar_one() is None
            length = conn.execute(text(
                "SELECT character_maximum_length FROM information_schema.columns WHERE table_schema = current_schema() "
                "AND table_name = 'publications' AND column_name = 'tradition_text'")).scalar_one()
            assert length == 80
        with engine.begin() as conn:
            with Operations.context(MigrationContext.configure(conn)):
                migration.downgrade()
            columns = {r[0] for r in conn.execute(text(
                "SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'publications'"))}
            assert columns == {"id", "title"}
            assert conn.execute(text("SELECT title FROM publications")).scalar_one() == "Antigua"
    finally:
        engine.dispose()
        with admin_engine.begin() as conn:
            conn.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
        admin_engine.dispose()
