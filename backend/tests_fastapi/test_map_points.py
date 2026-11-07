"""Punto exacto de los eventos (validacion y salida) y GET /api/map/points (services/map_points.py).

Las pruebas de puntos trabajan en una transaccion del schema de test que se deshace al final.
"""
import importlib.util
import json
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, func, select, text, update

from backend.service.core.config import settings
from backend.service.db.session import get_db
from backend.service.main import app
from backend.service.models.tables import Category, Publication, User
from backend.service.services import home_carousel
from backend.service.services import map_points as map_service
from backend.service.services.auth import now_utc
from backend.tests_fastapi.test_gestor_category import category_ids  # noqa: F401
from backend.tests_fastapi.test_gestores_invites import schema_session
from backend.tests_fastapi.test_parity import auth_header, tokens  # noqa: F401

ROOT = Path(__file__).resolve().parents[2]
TODAY = date(2026, 11, 5)
CAUCASIA = {"latitude": 7.9847, "longitude": -75.1953}
POINT_KEYS = {"key", "type", "id", "title", "summary", "image", "municipality", "municipality_label", "cultural_category",
              "category_label", "location", "start_date", "end_date", "tradition_text", "lat", "lng", "href"}
PRIVATE = {"author_id", "author", "user_id", "email", "moderation_note", "status", "deleted", "content", "link", "latitude"}


@pytest.fixture
def admin(tokens):
    return auth_header(tokens, "admin")


@pytest.fixture
def gestor(tokens):
    return auth_header(tokens, "gestor")


def payload(category_ids, kind="EVENTO", **extra):
    data = {"kind": kind, "category_id": category_ids[kind], "title": "Concierto en el malecón", "summary": "Resumen del concierto de prueba.",
            "content": "Contenido suficiente del concierto de prueba.", "location": "Malecón", "municipality": "caucasia",
            "publish": True, **CAUCASIA, **extra}
    return {key: value for key, value in data.items() if value is not ...}


def create(client, headers, category_ids, **extra):
    resp = client.post("/api/publications", json=payload(category_ids, **extra), headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


# ───────────── validacion y salida ─────────────

def test_event_point_is_stored_and_public_as_numbers(client, admin, category_ids):
    pub = create(client, admin, category_ids, latitude="7.98471234", longitude=-75.1953)
    try:
        data = client.get(f"/api/publications/{pub}").json()
        assert data["latitude"] == 7.984712 and data["longitude"] == -75.1953
        assert isinstance(data["latitude"], float) and isinstance(data["longitude"], float)
        listed = next(p for p in client.get("/api/publications?kind=EVENTO").json() if p["id"] == pub)
        assert (listed["latitude"], listed["longitude"]) == (7.984712, -75.1953)
        mine = next(p for p in client.get("/api/publications?mine=1", headers=admin).json() if p["id"] == pub)
        assert isinstance(mine["latitude"], float)
        review = client.get("/api/publications?status=PUBLISHED", headers=admin).json()
        assert next(p for p in review if p["id"] == pub)["longitude"] == -75.1953
    finally:
        client.delete(f"/api/publications/{pub}", headers=admin)


@pytest.mark.parametrize("extra, code, message", [
    ({"latitude": ..., "longitude": ...}, "POINT_REQUIRED", "Marca el punto exacto del evento en el mapa"),
    ({"latitude": None, "longitude": None}, "POINT_REQUIRED", "Marca el punto exacto del evento en el mapa"),
    ({"latitude": 7.98, "longitude": None}, "POINT_REQUIRED", "Marca el punto exacto del evento en el mapa"),
    ({"latitude": "", "longitude": -75.19}, "POINT_REQUIRED", "Marca el punto exacto del evento en el mapa"),
    ({"latitude": "siete", "longitude": -75.19}, "INVALID_POINT", "Las coordenadas del punto deben ser números"),
    ({"latitude": True, "longitude": -75.19}, "INVALID_POINT", "Las coordenadas del punto deben ser números"),
    ({"latitude": "NaN", "longitude": -75.19}, "INVALID_POINT", "Las coordenadas del punto deben ser números"),
    ({"latitude": [7.9], "longitude": -75.19}, "INVALID_POINT", "Las coordenadas del punto deben ser números"),
    ({"latitude": 6.25, "longitude": -75.56}, "POINT_OUT_OF_AREA", "El punto debe estar dentro del Bajo Cauca"),  # Medellín
    ({"latitude": 8.9, "longitude": -75.0}, "POINT_OUT_OF_AREA", "El punto debe estar dentro del Bajo Cauca"),
    ({"latitude": 7.9, "longitude": -73.9}, "POINT_OUT_OF_AREA", "El punto debe estar dentro del Bajo Cauca"),
    ({"latitude": 95, "longitude": -75.0}, "POINT_OUT_OF_AREA", "El punto debe estar dentro del Bajo Cauca"),
])
def test_invalid_points_answer_422_in_spanish(client, admin, category_ids, extra, code, message):
    resp = client.post("/api/publications", json=payload(category_ids, **extra), headers=admin)
    assert resp.status_code == 422 and resp.json() == {"error": code, "message": message}


def test_box_edges_are_inclusive(client, admin, category_ids):
    for lat, lng in ((6.8, -76.0), (8.8, -74.0)):
        pub = create(client, admin, category_ids, latitude=lat, longitude=lng)
        client.delete(f"/api/publications/{pub}", headers=admin)


def test_edit_requires_the_point_even_for_an_old_event(client, admin, gestor, category_ids):
    pub = create(client, gestor, category_ids, cultural_category="PATRIMONIO_MEMORIA", publish=False)
    with schema_session() as session:  # como un evento anterior al campo
        session.execute(update(Publication).where(Publication.id == pub).values(latitude=None, longitude=None))
    data = payload(category_ids, cultural_category="PATRIMONIO_MEMORIA", publish=False, title="Evento antiguo editado",
                   latitude=..., longitude=...)
    resp = client.put(f"/api/publications/{pub}", json=data, headers=gestor)
    assert resp.status_code == 422 and resp.json()["error"] == "POINT_REQUIRED"
    resp = client.put(f"/api/publications/{pub}", json={**data, **CAUCASIA}, headers=gestor)
    assert resp.status_code == 200, resp.text
    assert client.get(f"/api/publications/{pub}", headers=gestor).json()["latitude"] == 7.9847
    # La moderacion no pide el punto: se aprueba como siempre.
    assert client.post(f"/api/publications/{pub}/submit", headers=gestor).status_code == 200
    assert client.patch(f"/api/publications/{pub}/status", json={"status": "PUBLISHED"}, headers=admin).status_code == 200
    client.delete(f"/api/publications/{pub}", headers=admin)


def test_other_kinds_discard_the_point(client, admin, category_ids):
    pub = create(client, admin, category_ids, kind="HISTORIA", latitude=6.25, longitude=-75.56)
    try:
        data = client.get(f"/api/publications/{pub}").json()
        assert data["latitude"] is None and data["longitude"] is None
    finally:
        client.delete(f"/api/publications/{pub}", headers=admin)
    event = create(client, admin, category_ids)
    resp = client.put(f"/api/publications/{event}", json=payload(category_ids, kind="HISTORIA"), headers=admin)
    assert resp.status_code == 200
    assert client.get(f"/api/publications/{event}").json()["latitude"] is None
    client.delete(f"/api/publications/{event}", headers=admin)


def test_database_check_rejects_half_a_point(client):
    with pytest.raises(Exception):
        with schema_session() as session:
            pub = session.execute(select(func.min(Publication.id))).scalar_one()
            session.execute(update(Publication).where(Publication.id == pub).values(latitude=7.9, longitude=None))


# ───────────── GET /api/map/points ─────────────

@pytest.fixture
def db(client):
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

    def add(self, kind="EVENTO", status="PUBLISHED", municipality="caucasia", point=(7.9847, -75.1953), **extra):
        ts = now_utc()
        values = {"title": f"Evento {uuid.uuid4().hex[:6]}", "summary": "Resumen " + "largo " * 40, "content": "Contenido",
                  "image": "https://img.test/e.jpg", "location": "Malecón", "cultural_category": "MUSICA", **extra}
        lat, lng = point if point else (None, None)
        row = Publication(author_id=self.user_id, category_id=self.categories[kind], kind=kind, status=status,
                          municipality=municipality, created_at=ts, updated_at=ts, moderation_note="nota privada",
                          latitude=lat, longitude=lng, **values)
        self.db.add(row)
        self.db.flush()
        return row


@pytest.fixture
def events(db):
    return Events(db)


def at(day, hour=0, minute=0):
    return datetime.combine(day, datetime.min.time()) + timedelta(hours=hour, minutes=minute)


def days(n):
    return TODAY + timedelta(days=n)


def ids(data):
    return [p["id"] for p in data["points"]]


def test_only_current_events_with_a_point(db, events):
    future = events.add(start_date=at(days(4), 19))
    today = events.add(start_date=at(TODAY, 8))
    ongoing = events.add(start_date=at(days(-3)), end_date=at(days(1)))
    tradition_no_date = events.add(tradition_text="Cada 20 de julio")
    tradition_past = events.add(start_date=at(days(-200)), tradition_text="Cada noviembre")
    no_date = events.add()
    hidden = [
        events.add(start_date=at(days(-1), 23, 59)),  # paso ayer
        events.add(start_date=at(days(4)), point=None),  # sin punto
        events.add(start_date=at(days(4)), status="REVIEW"),
        events.add(start_date=at(days(4)), status="DRAFT"),
        events.add(start_date=at(days(4)), deleted=True),
        events.add(kind="HISTORIA", start_date=at(days(4))),
        events.add(kind="OPORTUNIDAD", end_date=at(days(4))),
    ]
    found = ids(map_service.build_map_points(db, today=TODAY))
    assert set(found) == {future.id, today.id, ongoing.id, tradition_no_date.id, tradition_past.id, no_date.id}
    assert not {h.id for h in hidden} & set(found)
    # Orden: por inicio, sin fecha al final.
    assert found.index(tradition_past.id) < found.index(today.id) < found.index(future.id) < found.index(no_date.id)


def test_point_payload_is_generic_and_public(db, events):
    row = events.add(start_date=at(days(2), 18, 30), end_date=at(days(2), 22), tradition_text="Cada año",
                     municipality="elbagre", cultural_category="CINE_AUDIOVISUAL", point=(7.5973, -74.812))
    bare = events.add(image="degradado-viejo(red, blue)", municipality=None, cultural_category="DANZA", location=" ")
    data = map_service.build_map_points(db, today=TODAY)
    point = next(p for p in data["points"] if p["id"] == row.id)
    assert set(point) == POINT_KEYS
    assert point["key"] == f"evento-{row.id}" and point["type"] == "EVENTO" and point["href"] == f"#publicacion/{row.id}"
    assert (point["lat"], point["lng"]) == (7.5973, -74.812) and isinstance(point["lat"], float)
    assert point["municipality"] == "elbagre" and point["municipality_label"] == "El Bagre"
    assert point["cultural_category"] == "cine-audiovisual" and point["category_label"] == "Cine y audiovisual"
    assert point["start_date"] == f"{days(2).isoformat()}T18:30:00" and point["tradition_text"] == "Cada año"
    assert len(point["summary"]) <= 140
    other = next(p for p in data["points"] if p["id"] == bare.id)
    assert "danza" in other["image"] and other["municipality"] is None and other["location"] is None
    dumped = json.dumps(data)
    for key in PRIVATE:
        assert f'"{key}"' not in dumped, key
    assert "nota privada" not in dumped and "@" not in dumped


def test_municipality_filter(db, events):
    caucasia = events.add(start_date=at(days(1)))
    nechi = events.add(start_date=at(days(1)), municipality="nechi", point=(8.0941, -74.7788))
    assert ids(map_service.build_map_points(db, municipality="nechi", today=TODAY)) == [nechi.id]
    assert ids(map_service.build_map_points(db, municipality="caucasia", today=TODAY)) == [caucasia.id]


def test_event_ending_tonight_in_bogota_is_on_the_map(db, events, monkeypatch):
    """A las 03:00 UTC del 6 de noviembre en Bogota aun es el 5 (22:00)."""
    class Clock(datetime):
        @classmethod
        def now(cls, tz=None):
            return datetime(2026, 11, 6, 3, 0, tzinfo=timezone.utc).astimezone(tz)
    monkeypatch.setattr(home_carousel, "datetime", Clock)
    tonight = events.add(start_date=at(TODAY, 18), end_date=at(TODAY, 23, 30))
    data = map_service.build_map_points(db)
    assert data["today"] == "2026-11-05" and ids(data) == [tonight.id]


def test_points_limit(db, events, monkeypatch):
    monkeypatch.setattr(map_service, "EVENTS_LIMIT", 2)
    for n in range(3):
        events.add(start_date=at(days(n + 1)))
    assert len(map_service.build_map_points(db, today=TODAY)["points"]) == 2


def test_endpoint_validation_and_cache(client):
    resp = client.get("/api/map/points")
    assert resp.status_code == 200 and resp.headers["cache-control"] == "public, no-cache" and "points" in resp.json()
    assert client.get("/api/map/points", headers={"If-None-Match": resp.headers["etag"]}).status_code == 304
    assert client.get("/api/map/points?municipality=CAUCASIA").status_code == 200
    bad = client.get("/api/map/points?municipality=medellin")
    assert bad.status_code == 422 and bad.json() == {"error": "INVALID_MUNICIPALITY", "message": "Ese municipio no está en TEJIDO"}


def test_seeded_events_have_a_point(client):
    with schema_session() as session:
        rows = session.execute(select(Publication.title, Publication.latitude).where(Publication.kind == "EVENTO",
                                                                                     Publication.title.in_(("Festival Rio y Sabana 2026", "Mercado Hecho en Caucasia")))).all()
    assert len(rows) == 2 and all(lat is not None for _, lat in rows)


# ───────────── migracion ─────────────

def test_point_migration_up_and_down():
    path = ROOT / "backend" / "alembic" / "versions" / "b8e1f3a5c7d9_punto_exacto_de_publicaciones.py"
    spec = importlib.util.spec_from_file_location("migracion_punto", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    assert migration.down_revision == "a6d2e8f4c1b9"
    direct_url = settings.database_url.replace("-pooler.", ".")
    schema = f"test_mig_{uuid.uuid4().hex[:10]}"
    admin_engine = create_engine(direct_url)
    with admin_engine.begin() as conn:
        conn.execute(text(f'CREATE SCHEMA "{schema}"'))
    engine = create_engine(direct_url, connect_args={"options": f"-csearch_path={schema}"})

    def columns(conn):
        return {r[0] for r in conn.execute(text(
            "SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'publications'"))}
    try:
        with engine.begin() as conn:
            conn.execute(text("CREATE TABLE publications (id serial PRIMARY KEY, title varchar NOT NULL)"))
            conn.execute(text("INSERT INTO publications (title) VALUES ('Antigua')"))
            with Operations.context(MigrationContext.configure(conn)):
                migration.upgrade()
            assert conn.execute(text("SELECT latitude, longitude FROM publications")).one() == (None, None)
            conn.execute(text("UPDATE publications SET latitude = 7.9847, longitude = -75.1953"))
        for bad in ("latitude = 7.9, longitude = NULL", "latitude = 91, longitude = -75", "latitude = 7.9, longitude = -181"):
            with pytest.raises(Exception):
                with engine.begin() as conn:
                    conn.execute(text(f"UPDATE publications SET {bad}"))
        with engine.begin() as conn:
            with Operations.context(MigrationContext.configure(conn)):
                migration.downgrade()
            assert columns(conn) == {"id", "title"}
    finally:
        engine.dispose()
        with admin_engine.begin() as conn:
            conn.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
        admin_engine.dispose()
