"""Oportunidades: campos del detalle (validacion y UPSERT), GET /api/opportunities por bloques, tipos
administrables, avisos de cierre (services/opportunity_reminders.py) y la migracion f3c1a9e7b5d2.

Las pruebas de bloques y avisos trabajan en una transaccion del schema de test que se deshace al final.
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
from backend.service.models.tables import (Category, Event, Favorite, Opportunity, OpportunityReminder, OpportunityType,
                                           Publication, Role, User)
from backend.service.services import home_carousel
from backend.service.services import opportunities as opportunities_service
from backend.service.services import opportunity_reminders
from backend.service.services.auth import now_utc
from backend.tests_fastapi.test_gestor_category import category_ids  # noqa: F401
from backend.tests_fastapi.test_gestores_invites import schema_session
from backend.tests_fastapi.test_parity import auth_header, tokens  # noqa: F401

ROOT = Path(__file__).resolve().parents[2]
TODAY = date(2026, 11, 4)
PRIVATE_KEYS = {"author_id", "author", "user_id", "email", "moderation_note", "status", "deleted", "featured",
                "created_at", "updated_at", "category_id", "content", "organization_name", "type_id"}
ITEM_KEYS = {"id", "title", "summary", "image", "municipality", "municipality_label", "cultural_category", "category_label",
             "type", "organizer", "audience", "prize", "requirements", "end_date", "location", "link", "closed"}


def type_id(slug="convocatoria"):
    with schema_session() as session:
        return session.execute(select(OpportunityType.id).where(OpportunityType.slug == slug)).scalar_one()


def opportunity_payload(category_ids, **extra):
    return {"kind": "OPORTUNIDAD", "category_id": category_ids["OPORTUNIDAD"], "title": "Convocatoria de prueba",
            "summary": "Resumen de la convocatoria de prueba.", "content": "Contenido suficiente de la convocatoria.",
            "location": "Casa de la Cultura", "municipality": "caucasia", "publish": True,
            "opportunity_type_id": type_id(), "organizer": "Casa de la Cultura de Caucasia",
            "link": "https://convocatorias.ejemplo.co/semillas", **extra}


@pytest.fixture
def admin(tokens):
    return auth_header(tokens, "admin")


@pytest.fixture
def gestor(tokens):
    return auth_header(tokens, "gestor")


@pytest.fixture
def ciudadano(tokens):
    return auth_header(tokens, "ciudadano")


def create(client, headers, category_ids, **extra):
    resp = client.post("/api/publications", json=opportunity_payload(category_ids, **extra), headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


# ───────────── validacion y salida ─────────────

def test_full_opportunity_is_normalized_and_public(client, admin, category_ids):
    pub = create(client, admin, category_ids, opportunity_type_id=type_id("taller"), organizer="  Casa de la <b>Cultura</b> ",
                 requirements=[" Ser mayor de 16 ", "ser mayor de 16", "", None, "<i>Vivir</i> en el Bajo Cauca"],
                 prize=" $2.000.000 ", audience="Jóvenes creadores", link="  https://ejemplo.co/taller ")
    data = client.get(f"/api/publications/{pub}").json()
    assert data["opportunity_type"] == {"id": type_id("taller"), "slug": "taller", "label": "Taller", "color": "menta"}
    assert data["organizer"] == "Casa de la Cultura" and data["prize"] == "$2.000.000" and data["audience"] == "Jóvenes creadores"
    assert data["requirements"] == ["Ser mayor de 16", "Vivir en el Bajo Cauca"] and data["link"] == "https://ejemplo.co/taller"
    assert "organization_name" not in data
    listed = next(p for p in client.get("/api/publications?kind=OPORTUNIDAD").json() if p["id"] == pub)
    assert listed["opportunity_type"]["slug"] == "taller" and listed["requirements"] == data["requirements"]
    client.delete(f"/api/publications/{pub}", headers=admin)


def test_minimal_opportunity(client, admin, category_ids):
    pub = create(client, admin, category_ids)
    data = client.get(f"/api/publications/{pub}").json()
    assert data["opportunity_type"]["slug"] == "convocatoria" and data["requirements"] == []
    assert data["prize"] is None and data["audience"] is None and data["end_date"] is None
    client.delete(f"/api/publications/{pub}", headers=admin)


@pytest.mark.parametrize("extra, code, message", [
    ({"opportunity_type_id": None}, "OPPORTUNITY_TYPE_REQUIRED", "Elige el tipo de oportunidad"),
    ({"opportunity_type_id": 99999}, "INVALID_OPPORTUNITY_TYPE", "Ese tipo de oportunidad no existe o está desactivado"),
    ({"opportunity_type_id": "abc"}, "INVALID_OPPORTUNITY_TYPE", "Ese tipo de oportunidad no existe o está desactivado"),
    ({"organizer": "   "}, "ORGANIZER_REQUIRED", "Escribe quién convoca"),
    ({"organizer": "<b></b>"}, "ORGANIZER_REQUIRED", "Escribe quién convoca"),
    ({"organizer": "x" * 121}, "INVALID_ORGANIZER", "Quién convoca puede tener hasta 120 caracteres"),
    ({"requirements": [f"Requisito {i}" for i in range(9)]}, "INVALID_REQUIREMENTS", "Máximo 8 requisitos"),
    ({"requirements": ["y" * 161]}, "INVALID_REQUIREMENTS", "Cada requisito puede tener hasta 160 caracteres"),
    ({"requirements": "uno, dos"}, "INVALID_REQUIREMENTS", "Los requisitos deben ser una lista"),
    ({"prize": "p" * 121}, "INVALID_PRIZE", "El premio o monto puede tener hasta 120 caracteres"),
    ({"audience": "a" * 161}, "INVALID_AUDIENCE", "«Dirigida a» puede tener hasta 160 caracteres"),
    ({"link": None}, "LINK_REQUIRED", "Agrega el enlace de postulación"),
    ({"link": "  "}, "LINK_REQUIRED", "Agrega el enlace de postulación"),
    ({"link": "ftp://ejemplo.co/x"}, "INVALID_LINK", "El enlace de postulación debe ser una dirección web que empiece por http:// o https://"),
    ({"link": "convocatorias.co"}, "INVALID_LINK", "El enlace de postulación debe ser una dirección web que empiece por http:// o https://"),
    ({"link": "https://ejemplo.co/con espacio"}, "INVALID_LINK", "El enlace de postulación debe ser una dirección web que empiece por http:// o https://"),
    ({"link": "javascript:alert(1)"}, "INVALID_LINK", "El enlace de postulación debe ser una dirección web que empiece por http:// o https://"),
])
def test_invalid_fields_answer_422_in_spanish(client, admin, category_ids, extra, code, message):
    resp = client.post("/api/publications", json=opportunity_payload(category_ids, **extra), headers=admin)
    assert resp.status_code == 422
    assert resp.json() == {"error": code, "message": message}


def test_limits_are_inclusive(client, admin, category_ids):
    pub = create(client, admin, category_ids, organizer="o" * 120, prize="p" * 120, audience="a" * 160,
                 requirements=[f"R{i} " + "x" * 150 for i in range(8)])
    data = client.get(f"/api/publications/{pub}").json()
    assert len(data["organizer"]) == 120 and len(data["prize"]) == 120 and len(data["audience"]) == 160
    assert len(data["requirements"]) == 8
    client.delete(f"/api/publications/{pub}", headers=admin)


def test_inactive_type_is_rejected_for_new_ones_but_kept_on_edit(client, admin, category_ids):
    curso = type_id("curso")
    pub = create(client, admin, category_ids, opportunity_type_id=curso)
    assert client.patch(f"/api/admin/opportunity-types/{curso}", json={"active": False}, headers=admin).status_code == 200
    try:
        resp = client.post("/api/publications", json=opportunity_payload(category_ids, opportunity_type_id=curso), headers=admin)
        assert resp.status_code == 422 and resp.json()["error"] == "INVALID_OPPORTUNITY_TYPE"
        resp = client.put(f"/api/publications/{pub}", json=opportunity_payload(category_ids, opportunity_type_id=curso, title="Editada con su tipo"), headers=admin)
        assert resp.status_code == 200, resp.text
    finally:
        client.patch(f"/api/admin/opportunity-types/{curso}", json={"active": True}, headers=admin)
        client.delete(f"/api/publications/{pub}", headers=admin)


def test_other_kinds_ignore_the_fields(client, admin, category_ids):
    payload = opportunity_payload(category_ids, kind="HISTORIA", category_id=category_ids["HISTORIA"], opportunity_type_id=None,
                                  organizer="x" * 300, requirements="no es lista", prize="p" * 500, link=None)
    resp = client.post("/api/publications", json=payload, headers=admin)
    assert resp.status_code == 201, resp.text
    data = client.get(f"/api/publications/{resp.json()['id']}").json()
    assert not {"opportunity_type", "organizer", "requirements", "prize", "audience"} & set(data)
    client.delete(f"/api/publications/{resp.json()['id']}", headers=admin)


def test_edit_upserts_and_keeps_the_row(client, admin, category_ids):
    pub = create(client, admin, category_ids, requirements=["Uno"], prize="Premio", audience="Jóvenes")
    with schema_session() as session:
        row_id = session.execute(select(Opportunity.id).where(Opportunity.publication_id == pub)).scalar_one()
    resp = client.put(f"/api/publications/{pub}", json=opportunity_payload(
        category_ids, title="Convocatoria editada", requirements=["Uno", "Dos"], prize="Premio mayor", audience="Jóvenes",
        end_date="2026-12-01T17:00", opportunity_type_id=type_id("concurso")), headers=admin)
    assert resp.status_code == 200, resp.text
    with schema_session() as session:
        rows = session.execute(select(Opportunity).where(Opportunity.publication_id == pub)).scalars().all()
        assert [r.id for r in rows] == [row_id]
        assert rows[0].requirements == ["Uno", "Dos"] and rows[0].prize == "Premio mayor"
        assert rows[0].deadline == datetime(2026, 12, 1, 17, 0)
    data = client.get(f"/api/publications/{pub}").json()
    assert data["opportunity_type"]["slug"] == "concurso" and data["deadline"].startswith("2026-12-01")
    # Cambiar a otro tipo de publicacion borra el detalle.
    history = opportunity_payload(category_ids, kind="HISTORIA", category_id=category_ids["HISTORIA"])
    assert client.put(f"/api/publications/{pub}", json=history, headers=admin).status_code == 200
    with schema_session() as session:
        assert session.execute(select(func.count()).select_from(Opportunity).where(Opportunity.publication_id == pub)).scalar_one() == 0
    client.delete(f"/api/publications/{pub}", headers=admin)


def test_event_detail_is_also_upserted(client, admin, category_ids):
    payload = opportunity_payload(category_ids, kind="EVENTO", category_id=category_ids["EVENTO"], location="Malecón")
    pub = client.post("/api/publications", json=payload, headers=admin).json()["id"]
    with schema_session() as session:
        session.execute(update(Event).where(Event.publication_id == pub).values(capacity=250))
    assert client.put(f"/api/publications/{pub}", json={**payload, "location": "Coliseo"}, headers=admin).status_code == 200
    data = client.get(f"/api/publications/{pub}").json()
    assert data["venue"] == "Coliseo" and data["capacity"] == 250
    client.delete(f"/api/publications/{pub}", headers=admin)


def test_gestor_flow_and_moderation_keep_the_fields(client, gestor, admin, category_ids):
    pub = create(client, gestor, category_ids, cultural_category="PATRIMONIO_MEMORIA", requirements=["Portafolio"], publish=False)
    mine = next(p for p in client.get("/api/publications?mine=1", headers=gestor).json() if p["id"] == pub)
    assert mine["status"] == "DRAFT" and mine["requirements"] == ["Portafolio"] and mine["organizer"]
    assert client.post(f"/api/publications/{pub}/submit", headers=gestor).status_code == 200
    queue = next(p for p in client.get("/api/publications?status=REVIEW", headers=admin).json() if p["id"] == pub)
    assert queue["opportunity_type"]["slug"] == "convocatoria"
    assert client.patch(f"/api/publications/{pub}/status", json={"status": "PUBLISHED"}, headers=admin).status_code == 200
    assert client.get(f"/api/publications/{pub}").json()["requirements"] == ["Portafolio"]
    client.delete(f"/api/publications/{pub}", headers=admin)


def test_saved_list_carries_the_fields(client, admin, ciudadano, category_ids):
    pub = create(client, admin, category_ids, end_date="2026-12-24T00:00", prize="Premio")
    assert client.post(f"/api/publications/{pub}/favorite", headers=ciudadano).status_code == 200
    assert client.post(f"/api/publications/{pub}/favorite", headers=ciudadano).status_code == 200  # idempotente
    saved = client.get("/api/me/saved", headers=ciudadano).json()
    item = next(p for p in saved["publications"] if p["id"] == pub)
    assert item["prize"] == "Premio" and item["end_date"].startswith("2026-12-24")
    assert client.post(f"/api/publications/{pub}/favorite", headers=admin).status_code == 403
    client.delete(f"/api/publications/{pub}/favorite", headers=ciudadano)
    client.delete(f"/api/publications/{pub}", headers=admin)


# ───────────── GET /api/opportunities ─────────────

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


class Opportunities:
    def __init__(self, db):
        self.db = db
        self.user_id = db.execute(select(func.min(User.id))).scalar_one()
        self.categories = {c.type: c.id for c in db.execute(select(Category)).scalars()}
        self.types = dict(db.execute(select(OpportunityType.slug, OpportunityType.id)).all())

    def add(self, title=None, kind="OPORTUNIDAD", status="PUBLISHED", branch="MUSICA", municipality="caucasia",
            type_slug="convocatoria", end_date=None, **extra):
        ts = now_utc()
        values = {"title": title or f"Oportunidad {uuid.uuid4().hex[:6]}", "summary": "Resumen", "content": "Contenido",
                  "image": "https://img.test/o.jpg", "location": "Casa de la Cultura", "link": "https://ejemplo.co/postular",
                  **extra}
        row = Publication(author_id=self.user_id, category_id=self.categories[kind], kind=kind, status=status,
                          cultural_category=branch, municipality=municipality, created_at=ts, updated_at=ts,
                          moderation_note="nota privada", end_date=end_date, **values)
        self.db.add(row)
        self.db.flush()
        if kind == "OPORTUNIDAD":
            self.db.add(Opportunity(publication_id=row.id, type_id=self.types.get(type_slug), organizer="Casa de la Cultura",
                                    audience="Jóvenes", prize="Premio", requirements=["Uno"], deadline=end_date))
            self.db.flush()
        return row


@pytest.fixture
def opps(db):
    return Opportunities(db)


def at(day, hour=0, minute=0):
    return datetime.combine(day, datetime.min.time()) + timedelta(hours=hour, minutes=minute)


def days(n):
    return TODAY + timedelta(days=n)


def build(db, **kwargs):
    return opportunities_service.build_opportunities(db, today=TODAY, **kwargs)


def ids(items):
    return [item["id"] for item in items]


def test_blocks_and_order(db, opps):
    later = opps.add(end_date=at(days(20)))
    today = opps.add(end_date=at(TODAY, 8))
    soon = opps.add(end_date=at(days(2), 17))
    open_old = opps.add(title="Sin fecha vieja")
    open_new = opps.add(title="Sin fecha nueva")
    yesterday = opps.add(end_date=at(days(-1), 23, 59))
    long_ago = opps.add(end_date=at(days(-90)))
    data = build(db)
    assert ids(data["open"]) == [today.id, soon.id, later.id]
    assert ids(data["open_ended"]) == [open_new.id, open_old.id]
    assert ids(data["closed"]) == [yesterday.id, long_ago.id]
    assert [i["closed"] for i in data["closed"]] == [True, True] and not any(i["closed"] for i in data["open"])
    assert data["counts"] == {"open": 3, "open_ended": 2, "closed": 2} and data["closed_next_offset"] is None


def test_soon_filter(db, opps):
    seven = opps.add(end_date=at(days(7), 23))
    eight = opps.add(end_date=at(days(8)))
    today = opps.add(end_date=at(TODAY, 1))
    opps.add()  # sin fecha
    opps.add(end_date=at(days(-1)))
    data = build(db, soon=True)
    assert ids(data["open"]) == [today.id, seven.id] and eight.id not in ids(data["open"])
    assert data["open_ended"] == [] and data["closed"] == [] and data["closed_next_offset"] is None


def test_filters(db, opps):
    nechi = opps.add(municipality="nechi", end_date=at(days(3)))
    taller = opps.add(type_slug="taller", end_date=at(days(3)))
    danza = opps.add(branch="DANZA", end_date=at(days(3)))
    assert ids(build(db, municipality="nechi")["open"]) == [nechi.id]
    assert ids(build(db, type_slug="taller")["open"]) == [taller.id]
    assert ids(build(db, category="DANZA")["open"]) == [danza.id]
    assert build(db, municipality="zaragoza")["counts"] == {"open": 0, "open_ended": 0, "closed": 0}


def test_closed_pages(db, opps, monkeypatch):
    monkeypatch.setattr(opportunities_service, "CLOSED_PAGE", 2)
    rows = [opps.add(end_date=at(days(-n))) for n in (1, 2, 3)]
    first = build(db)
    assert ids(first["closed"]) == [rows[0].id, rows[1].id] and first["closed_next_offset"] == 2
    last = build(db, offset=2)
    assert ids(last["closed"]) == [rows[2].id] and last["closed_next_offset"] is None


def test_only_published_opportunities(db, opps):
    visible = opps.add(end_date=at(days(3)))
    hidden = [opps.add(status=s, end_date=at(days(3))) for s in ("DRAFT", "REVIEW", "REJECTED")]
    hidden.append(opps.add(deleted=True, end_date=at(days(3))))
    for kind in ("EVENTO", "HISTORIA", "INICIATIVA", "LUGAR"):
        hidden.append(opps.add(kind=kind, end_date=at(days(3))))
    data = build(db)
    assert ids(data["open"] + data["open_ended"] + data["closed"]) == [visible.id]


def test_closes_today_late_in_bogota_is_open(db, opps, monkeypatch):
    """A las 03:00 UTC del 5 de noviembre en Bogota aun es el 4 (22:00): lo que cierra hoy 23:30 sigue abierto."""
    class Clock(datetime):
        @classmethod
        def now(cls, tz=None):
            return datetime(2026, 11, 5, 3, 0, tzinfo=timezone.utc).astimezone(tz)
    monkeypatch.setattr(home_carousel, "datetime", Clock)
    tonight = opps.add(end_date=at(TODAY, 23, 30))
    data = opportunities_service.build_opportunities(db)
    assert data["today"] == "2026-11-04" and ids(data["open"]) == [tonight.id] and data["open"][0]["closed"] is False


def test_public_fields(db, opps):
    full = opps.add(end_date=at(days(3), 17), tagline="Eslogan", tags=["Jóvenes"], branch="CINE_AUDIOVISUAL", municipality="elbagre")
    bare = opps.add(image="degradado-viejo(red, blue)", branch="DANZA", municipality=None, location=" ", type_slug="nada", link=None)
    data = build(db)
    item = data["open"][0]
    assert set(item) == ITEM_KEYS | {"tagline", "tags"}
    assert item["type"] == {"slug": "convocatoria", "label": "Convocatoria", "color": "ocre"} and item["organizer"] == "Casa de la Cultura"
    assert item["municipality"] == "elbagre" and item["municipality_label"] == "El Bagre"
    assert item["cultural_category"] == "cine-audiovisual" and item["end_date"] == "2026-11-07T17:00:00"
    other = next(i for i in data["open_ended"] if i["id"] == bare.id)
    assert set(other) == ITEM_KEYS and other["type"] is None and "danza" in other["image"]
    assert other["municipality"] is None and other["location"] is None and other["link"] is None
    dumped = json.dumps(data)
    for key in PRIVATE_KEYS:
        assert f'"{key}"' not in dumped, key
    assert "nota privada" not in dumped and "@" not in dumped and full


def test_endpoint_validation_and_cache(client):
    resp = client.get("/api/opportunities")
    assert resp.status_code == 200 and resp.headers["cache-control"] == "public, no-cache"
    assert {"today", "open", "open_ended", "closed", "counts", "closed_next_offset"} <= set(resp.json())
    assert client.get("/api/opportunities", headers={"If-None-Match": resp.headers["etag"]}).status_code == 304
    assert client.get("/api/opportunities?municipality=NECHI&type=taller&category=danza&soon=1").status_code == 200
    for query, code, message in (
        ("municipality=medellin", "INVALID_MUNICIPALITY", "Ese municipio no está en TEJIDO"),
        ("type=empleo", "INVALID_TYPE", "Ese tipo de oportunidad no existe"),
        ("category=MUSICA_X", "INVALID_CATEGORY", "Esa categoría cultural no existe"),
        ("soon=2", "INVALID_SOON", "El parámetro soon solo puede ser 0 o 1"),
        ("offset=-3", "INVALID_OFFSET", "El parámetro offset debe ser un número entero desde 0"),
    ):
        bad = client.get(f"/api/opportunities?{query}")
        assert bad.status_code == 422 and bad.json() == {"error": code, "message": message}, query


def test_carousel_still_leaves_out_closed_opportunities(db, opps):
    open_one = opps.add(end_date=at(days(5)))
    closed_one = opps.add(end_date=at(days(-1)), branch="DANZA")
    keys = [s["key"] for s in home_carousel.build_carousel(db, today=TODAY)]
    assert f"publication-{open_one.id}" in keys and f"publication-{closed_one.id}" not in keys


# ───────────── tipos ─────────────

def test_public_types_are_active_and_ordered(client):
    data = client.get("/api/opportunity-types").json()
    assert [t["slug"] for t in data][:5] == ["convocatoria", "taller", "audicion", "concurso", "curso"]
    assert data[2]["label"] == "Audición" and set(data[0]) == {"id", "slug", "label", "color"}
    assert [t["color"] for t in data][:5] == ["ocre", "menta", "morado", "amarillo", "crema"]


def test_types_admin_crud(client, admin):
    resp = client.post("/api/admin/opportunity-types", json={"label": "  Clínica de <b>escritura</b> "}, headers=admin)
    assert resp.status_code == 201, resp.text
    created = resp.json()
    assert created["slug"] == "clinica-de-escritura" and created["label"] == "Clínica de escritura"
    try:
        for label in ("clínica de escritura", "Clinica de escritura!"):
            dup = client.post("/api/admin/opportunity-types", json={"label": label}, headers=admin)
            assert dup.status_code == 409 and dup.json() == {"error": "TYPE_EXISTS", "message": "Ya existe un tipo con ese nombre"}
        assert client.post("/api/admin/opportunity-types", json={"label": "x"}, headers=admin).status_code == 422
        assert client.patch(f"/api/admin/opportunity-types/{created['id']}", json={"label": "Taller"}, headers=admin).status_code == 409
        assert client.patch(f"/api/admin/opportunity-types/{created['id']}", json={"label": "Clínica de lectura"}, headers=admin).status_code == 200
        rows = {t["id"]: t for t in client.get("/api/admin/opportunity-types", headers=admin).json()}
        assert rows[created["id"]]["slug"] == "clinica-de-escritura" and rows[created["id"]]["label"] == "Clínica de lectura"
        assert rows[created["id"]]["uses"] == 0 and rows[created["id"]]["active"] is True
        # Ordenar: el nuevo va al final; sube un puesto y vuelve a bajar.
        order = [t["id"] for t in client.get("/api/admin/opportunity-types", headers=admin).json()]
        assert order[-1] == created["id"]
        assert client.post(f"/api/admin/opportunity-types/{created['id']}/move", json={"direction": "up"}, headers=admin).status_code == 200
        order_up = [t["id"] for t in client.get("/api/admin/opportunity-types", headers=admin).json()]
        assert order_up[-2] == created["id"] and order_up[-1] == order[-2]
        assert client.post(f"/api/admin/opportunity-types/{created['id']}/move", json={"direction": "down"}, headers=admin).status_code == 200
        assert [t["id"] for t in client.get("/api/admin/opportunity-types", headers=admin).json()] == order
        assert client.post(f"/api/admin/opportunity-types/{created['id']}/move", json={"direction": "lado"}, headers=admin).status_code == 422
        # Desactivar: sale de la lista publica.
        assert client.patch(f"/api/admin/opportunity-types/{created['id']}", json={"active": False}, headers=admin).status_code == 200
        assert "clinica-de-escritura" not in [t["slug"] for t in client.get("/api/opportunity-types").json()]
        assert client.get("/api/opportunities?type=clinica-de-escritura").status_code == 422
    finally:
        client.delete(f"/api/admin/opportunity-types/{created['id']}", headers=admin)
    assert created["id"] not in [t["id"] for t in client.get("/api/admin/opportunity-types", headers=admin).json()]


def test_type_in_use_is_not_deleted(client, admin, category_ids):
    pub = create(client, admin, category_ids, opportunity_type_id=type_id("audicion"))
    resp = client.delete(f"/api/admin/opportunity-types/{type_id('audicion')}", headers=admin)
    assert resp.status_code == 409 and resp.json()["error"] == "TYPE_IN_USE"
    assert resp.json()["message"] == "No se puede borrar: 1 oportunidad lo usa. Desactívalo para que deje de ofrecerse."
    uses = {t["slug"]: t["uses"] for t in client.get("/api/admin/opportunity-types", headers=admin).json()}
    assert uses["audicion"] >= 1
    client.delete(f"/api/publications/{pub}", headers=admin)
    # Eliminada: ya no cuenta como uso visible, pero sigue bloqueando el borrado.
    assert {t["slug"]: t["uses"] for t in client.get("/api/admin/opportunity-types", headers=admin).json()}["audicion"] == uses["audicion"] - 1
    resp = client.delete(f"/api/admin/opportunity-types/{type_id('audicion')}", headers=admin)
    assert resp.status_code == 409 and "(contando las eliminadas)" in resp.json()["message"]


@pytest.mark.parametrize("role", ["gestor", "ciudadano", None])
def test_types_admin_is_forbidden_for_other_roles(client, tokens, role):
    headers = auth_header(tokens, role) if role else {}
    tid = type_id("taller")
    calls = [("get", "/api/admin/opportunity-types", None), ("post", "/api/admin/opportunity-types", {"label": "Otro tipo"}),
             ("patch", f"/api/admin/opportunity-types/{tid}", {"active": False}),
             ("post", f"/api/admin/opportunity-types/{tid}/move", {"direction": "up"}),
             ("delete", f"/api/admin/opportunity-types/{tid}", None)]
    for method, url, body in calls:
        resp = client.request(method.upper(), url, json=body, headers=headers)
        assert resp.status_code == 403 and resp.json()["error"] == "FORBIDDEN", (method, url)
    assert "taller" in [t["slug"] for t in client.get("/api/opportunity-types").json()]


# ───────────── avisos de cierre ─────────────

@pytest.fixture
def mailbox(monkeypatch, db):
    sent = []
    monkeypatch.setattr(opportunity_reminders.email_service, "send_gestor_notification",
                        lambda to, subject, text, html=None: sent.append({"to": to, "subject": subject, "text": text}))
    # send_reminders hace commit por aviso: aqui se queda en la transaccion de la prueba.
    monkeypatch.setattr(db, "commit", db.flush)
    return sent


def make_user(db, role, verified=True, active=True):
    role_id = db.execute(select(Role.id).where(Role.name == role)).scalar_one()
    user = User(role_id=role_id, name=f"{role.title()} Aviso", first_name="Ana", email=f"aviso-{uuid.uuid4().hex[:8]}@tejido-test.co",
                password_hash="x", active=active, created_at=now_utc(), email_verified_at=now_utc() if verified else None)
    db.add(user)
    db.flush()
    return user


def save(db, user, publication):
    db.add(Favorite(user_id=user.id, publication_id=publication.id, created_at=now_utc()))
    db.flush()


def test_reminders_three_and_one_day_only_once(db, opps, mailbox):
    citizen = make_user(db, "CIUDADANO")
    in_three = opps.add(title="Cierra en tres", end_date=at(days(3), 17))
    in_one = opps.add(title="Cierra mañana", end_date=at(days(1)))
    in_two = opps.add(end_date=at(days(2)))
    closed = opps.add(end_date=at(days(-1)))
    no_date = opps.add()
    draft = opps.add(status="DRAFT", end_date=at(days(3)))
    deleted = opps.add(deleted=True, end_date=at(days(1)))
    event = opps.add(kind="EVENTO", end_date=at(days(3)))
    for pub in (in_three, in_one, in_two, closed, no_date, draft, deleted, event):
        save(db, citizen, pub)

    dry = opportunity_reminders.send_reminders(db, today=TODAY)
    expected = sorted([(in_three.id, 3), (in_one.id, 1)])
    assert sorted((d["publication_id"], d["days_before"]) for d in dry["due"]) == expected
    assert mailbox == [] and db.execute(select(func.count()).select_from(OpportunityReminder)).scalar_one() == 0

    result = opportunity_reminders.send_reminders(db, today=TODAY, send=True)
    assert result["sent"] == 2 and result["failed"] == 0 and {m["to"] for m in mailbox} == {citizen.email}
    assert {m["subject"] for m in mailbox} == {"Cierra en 3 días: Cierra en tres", "Cierra mañana: Cierra mañana"}
    assert "Hola, Ana:" in mailbox[0]["text"] and "quítala de tus guardadas" in mailbox[0]["text"]
    again = opportunity_reminders.send_reminders(db, today=TODAY, send=True)
    assert again["due"] == [] and len(mailbox) == 2
    # Al dia siguiente solo toca la que cerraba en dos (ahora cierra mañana); dos dias despues, la de tres.
    assert [(d["publication_id"], d["days_before"]) for d in opportunity_reminders.send_reminders(db, today=days(1), send=True)["due"]] == [(in_two.id, 1)]
    assert [(d["publication_id"], d["days_before"]) for d in opportunity_reminders.send_reminders(db, today=days(2), send=True)["due"]] == [(in_three.id, 1)]
    assert len(mailbox) == 4


def test_reminders_only_for_verified_active_citizens(db, opps, mailbox):
    pub = opps.add(end_date=at(days(1)))
    citizen = make_user(db, "CIUDADANO")
    for other in (make_user(db, "GESTOR"), make_user(db, "ADMIN"), make_user(db, "CIUDADANO", verified=False),
                  make_user(db, "CIUDADANO", active=False), citizen):
        save(db, other, pub)
    result = opportunity_reminders.send_reminders(db, today=TODAY, send=True)
    assert [d["user_id"] for d in result["due"]] == [citizen.id] and [m["to"] for m in mailbox] == [citizen.email]


def test_failed_send_is_not_recorded(db, opps, monkeypatch, mailbox):
    citizen = make_user(db, "CIUDADANO")
    save(db, citizen, opps.add(end_date=at(days(3))))

    def broken(*args, **kwargs):
        raise RuntimeError("Resend caido")
    monkeypatch.setattr(opportunity_reminders.email_service, "send_gestor_notification", broken)
    result = opportunity_reminders.send_reminders(db, today=TODAY, send=True)
    assert result["failed"] == 1 and result["sent"] == 0
    assert db.execute(select(func.count()).select_from(OpportunityReminder)).scalar_one() == 0


def test_command_is_dry_run_by_default(monkeypatch, capsys):
    from backend.service.scripts import send_opportunity_reminders as command
    calls = []
    monkeypatch.setattr(command, "send_reminders", lambda db, today=None, send=False: calls.append(send) or
                        {"today": "2026-11-04", "due": [{"user_id": 3, "publication_id": 9, "days_before": 1}], "sent": 0, "failed": 0})
    assert command.main([]) == 0 and calls == [False]
    out = capsys.readouterr().out
    assert "DRY-RUN" in out and "publicacion 9 · usuario 3 · cierra en 1 dia(s)" in out and "@" not in out
    assert command.main(["--send", "--fecha", "2026-11-04"]) == 0 and calls == [False, True]


# ───────────── migracion ─────────────

def test_migration_up_and_down():
    path = ROOT / "backend" / "alembic" / "versions" / "f3c1a9e7b5d2_tipos_y_detalle_de_oportunidades.py"
    spec = importlib.util.spec_from_file_location("migracion_oportunidades", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    assert migration.down_revision == "e8b3c5d7f9a2"

    direct_url = settings.database_url.replace("-pooler.", ".")
    schema = f"test_mig_{uuid.uuid4().hex[:10]}"
    admin_engine = create_engine(direct_url)
    with admin_engine.begin() as conn:
        conn.execute(text(f'CREATE SCHEMA "{schema}"'))
    engine = create_engine(direct_url, connect_args={"options": f"-csearch_path={schema}"})

    def columns(conn, table):
        return {r[0] for r in conn.execute(text(
            "SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = :t"), {"t": table})}
    try:
        with engine.begin() as conn:
            conn.execute(text("CREATE TABLE users (id serial PRIMARY KEY)"))
            conn.execute(text("CREATE TABLE publications (id serial PRIMARY KEY)"))
            conn.execute(text("CREATE TABLE opportunities (id serial PRIMARY KEY, publication_id integer UNIQUE NOT NULL "
                              "REFERENCES publications(id), organization_name varchar, deadline timestamp)"))
            conn.execute(text("INSERT INTO publications DEFAULT VALUES; INSERT INTO publications DEFAULT VALUES"))
            conn.execute(text("INSERT INTO opportunities (publication_id, organization_name) VALUES (1, '  Alianza Bajo Cauca '), (2, NULL)"))
            with Operations.context(MigrationContext.configure(conn)):
                migration.upgrade()
            types = conn.execute(text("SELECT slug, label, sort_order, active FROM opportunity_types ORDER BY sort_order")).all()
            assert [tuple(t) for t in types] == [("convocatoria", "Convocatoria", 0, True), ("taller", "Taller", 1, True),
                                                 ("audicion", "Audición", 2, True), ("concurso", "Concurso", 3, True),
                                                 ("curso", "Curso", 4, True)]
            rows = conn.execute(text("SELECT publication_id, organizer, type_id, requirements, organization_name FROM opportunities ORDER BY publication_id")).all()
            assert [tuple(r) for r in rows] == [(1, "Alianza Bajo Cauca", None, [], "  Alianza Bajo Cauca "), (2, None, None, [], None)]
            assert {"type_id", "organizer", "requirements", "prize", "audience"} <= columns(conn, "opportunities")
            assert columns(conn, "opportunity_reminders") == {"id", "user_id", "publication_id", "days_before", "sent_at"}
        with engine.begin() as conn:
            with Operations.context(MigrationContext.configure(conn)):
                migration.downgrade()
            assert columns(conn, "opportunities") == {"id", "publication_id", "organization_name", "deadline"}
            assert columns(conn, "opportunity_types") == set() and columns(conn, "opportunity_reminders") == set()
            assert conn.execute(text("SELECT organization_name FROM opportunities WHERE publication_id = 1")).scalar_one() == "  Alianza Bajo Cauca "
    finally:
        engine.dispose()
        with admin_engine.begin() as conn:
            conn.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
        admin_engine.dispose()


# ───────────── color de los tipos ─────────────

def test_type_colors_create_edit_and_validate(client, admin):
    count = len(client.get("/api/admin/opportunity-types", headers=admin).json())
    auto = client.post("/api/admin/opportunity-types", json={"label": "Tipo sin color"}, headers=admin)
    chosen = client.post("/api/admin/opportunity-types", json={"label": "Tipo morado", "color": " MORADO "}, headers=admin)
    assert auto.status_code == 201 and chosen.status_code == 201
    try:
        palette = ["ocre", "menta", "morado", "amarillo", "crema"]
        assert auto.json()["color"] == palette[count % 5] and chosen.json()["color"] == "morado"
        bad = client.post("/api/admin/opportunity-types", json={"label": "Tipo rojo", "color": "rojo"}, headers=admin)
        message = "Elige un color de la paleta: ocre, menta, morado, amarillo o crema"
        assert bad.status_code == 422 and bad.json() == {"error": "INVALID_COLOR", "message": message}
        tid = chosen.json()["id"]
        assert client.patch(f"/api/admin/opportunity-types/{tid}", json={"color": "amarillo"}, headers=admin).status_code == 200
        bad = client.patch(f"/api/admin/opportunity-types/{tid}", json={"color": "#ff0000"}, headers=admin)
        assert bad.status_code == 422 and bad.json()["error"] == "INVALID_COLOR"
        rows = {t["id"]: t for t in client.get("/api/admin/opportunity-types", headers=admin).json()}
        assert rows[tid]["color"] == "amarillo" and rows[tid]["label"] == "Tipo morado"
        public = {t["slug"]: t["color"] for t in client.get("/api/opportunity-types").json()}
        assert public["tipo-morado"] == "amarillo"
    finally:
        for resp in (auto, chosen):
            client.delete(f"/api/admin/opportunity-types/{resp.json()['id']}", headers=admin)


def test_type_color_travels_with_the_opportunity(client, admin, category_ids):
    pub = create(client, admin, category_ids, opportunity_type_id=type_id("audicion"), end_date="2099-01-10T00:00")
    try:
        assert client.get(f"/api/publications/{pub}").json()["opportunity_type"]["color"] == "morado"
        listed = next(p for p in client.get("/api/publications?kind=OPORTUNIDAD").json() if p["id"] == pub)
        assert listed["opportunity_type"]["color"] == "morado"
        item = next(o for o in client.get("/api/opportunities").json()["open"] if o["id"] == pub)
        assert item["type"] == {"slug": "audicion", "label": "Audición", "color": "morado"}
    finally:
        client.delete(f"/api/publications/{pub}", headers=admin)


def test_color_migration_up_and_down():
    path = ROOT / "backend" / "alembic" / "versions" / "a6d2e8f4c1b9_color_de_los_tipos_de_oportunidad.py"
    spec = importlib.util.spec_from_file_location("migracion_color", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    assert migration.down_revision == "f3c1a9e7b5d2"
    direct_url = settings.database_url.replace("-pooler.", ".")
    schema = f"test_mig_{uuid.uuid4().hex[:10]}"
    admin_engine = create_engine(direct_url)
    with admin_engine.begin() as conn:
        conn.execute(text(f'CREATE SCHEMA "{schema}"'))
    engine = create_engine(direct_url, connect_args={"options": f"-csearch_path={schema}"})
    try:
        with engine.begin() as conn:
            conn.execute(text("CREATE TABLE opportunity_types (id serial PRIMARY KEY, slug varchar(60) UNIQUE NOT NULL, label varchar(60) NOT NULL)"))
            conn.execute(text("INSERT INTO opportunity_types (slug, label) VALUES ('convocatoria','Convocatoria'), ('taller','Taller'), "
                              "('audicion','Audición'), ('concurso','Concurso'), ('curso','Curso'), ('residencia','Residencia')"))
            with Operations.context(MigrationContext.configure(conn)):
                migration.upgrade()
            colors = dict(conn.execute(text("SELECT slug, color FROM opportunity_types")).all())
            assert colors == {"convocatoria": "ocre", "taller": "menta", "audicion": "morado", "concurso": "amarillo",
                              "curso": "crema", "residencia": "ocre"}
        with pytest.raises(Exception):
            with engine.begin() as conn:
                conn.execute(text("UPDATE opportunity_types SET color = 'rojo' WHERE slug = 'curso'"))
        with engine.begin() as conn:
            with Operations.context(MigrationContext.configure(conn)):
                migration.downgrade()
            columns = {r[0] for r in conn.execute(text(
                "SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'opportunity_types'"))}
            assert columns == {"id", "slug", "label"}
    finally:
        engine.dispose()
        with admin_engine.begin() as conn:
            conn.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
        admin_engine.dispose()
