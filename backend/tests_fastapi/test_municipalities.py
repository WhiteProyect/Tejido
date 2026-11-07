"""Municipio de publicaciones y artistas (Entrega 1 de "Pantallas de municipio").

- Obligatorio al crear y editar (422 MUNICIPALITY_REQUIRED) en todos los tipos y roles; moderar no
  lo exige.
- Filtros ?municipality= y GET /api/municipalities/{slug} (solo lo publico, sin claves privadas).
- scripts/backfill_municipality.py: el dry-run no escribe; la deduccion ignora tildes y mayusculas
  y deja "SIN DEDUCIR" lo que no coincide.
- La migracion c5e8a1d4f7b2, en un schema aparte: CHECK, indice y reversible.
"""
import importlib.util
import io
import json
import uuid
from contextlib import redirect_stdout
from pathlib import Path

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, delete, select, text, update
from sqlalchemy.exc import DBAPIError, IntegrityError

from backend.service.core.config import settings
from backend.service.db.session import get_db
from backend.service.main import app
from backend.service.models.tables import Artist, OpportunityType, PlaceCategory, Publication, TalentProfile
from backend.service.schemas.municipalities import deduce_municipality
from backend.service.services import municipalities as municipality_service
from backend.tests_fastapi.test_branches import admin, branch_cleanup, gestor, join, leader, sent  # noqa: F401
from backend.tests_fastapi.test_gestor_category import body, category_ids  # noqa: F401
from backend.tests_fastapi.test_gestores_invites import schema_session
from backend.tests_fastapi.test_home_carousel import Content, db  # noqa: F401
from backend.tests_fastapi.test_parity import tokens  # noqa: F401

ROOT = Path(__file__).resolve().parents[2]
KINDS = ("HISTORIA", "EVENTO", "OPORTUNIDAD", "TALENTO", "INICIATIVA", "LUGAR")
PRIVATE_KEYS = {"email", "author_id", "user_id", "created_by", "representative_user_id", "moderation_note",
                "status", "deleted", "author"}


def load_script():
    spec = importlib.util.spec_from_file_location("backfill_municipality", ROOT / "scripts" / "backfill_municipality.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def publication(category_ids, kind, title, **extra):
    data = body(category_ids, title, **extra)
    data.update(kind=kind, category_id=category_ids[kind])
    if kind in ("EVENTO", "LUGAR"):  # punto exacto obligatorio
        data.update({"latitude": 7.9847, "longitude": -75.1953})
    if kind == "LUGAR":  # categoria de lugar y direccion obligatorias
        with schema_session() as session:
            data["place_category_id"] = session.execute(select(PlaceCategory.id).order_by(PlaceCategory.id).limit(1)).scalar_one()
        data["location"] = "Calle 20 # 5-10"
    if kind == "OPORTUNIDAD":  # tipo, quien convoca y enlace son obligatorios en las oportunidades
        with schema_session() as session:
            data["opportunity_type_id"] = session.execute(select(OpportunityType.id).order_by(OpportunityType.id).limit(1)).scalar_one()
        data.update(organizer="Casa de la Cultura", link="https://ejemplo.co/convocatoria")
    return data


def walk_keys(value):
    if isinstance(value, dict):
        for key, item in value.items():
            yield key
            yield from walk_keys(item)
    elif isinstance(value, list):
        for item in value:
            yield from walk_keys(item)


# ─────────────────────────── publicaciones ───────────────────────────

@pytest.fixture
def roles(client, tokens, admin, sent, branch_cleanup):  # noqa: F811
    """Quien publica: admin, gestor (de otra rama), lider y participante de la rama TEATRO."""
    branch_cleanup.extend(["TEATRO", "DANZA"])
    lead_h, _, _ = leader(client, admin, "TEATRO", "Lider Municipio")
    part_h, _, _ = join(client, admin, lead_h, "TEATRO", "Participante Municipio")
    gest_h, _, _ = gestor(client, admin, "DANZA", "Gestora Municipio")
    return {"admin": admin, "gestor": gest_h, "lider": lead_h, "participante": part_h}


def test_publication_requires_valid_municipality_for_every_role_and_kind(client, category_ids, roles):  # noqa: F811
    for role, headers in roles.items():
        for kind in KINDS:
            title = f"Municipio {role} {kind} {uuid.uuid4().hex[:4]}"
            if kind == "LUGAR" and role in ("gestor", "participante"):  # solo admin y lider crean lugares
                resp = client.post("/api/publications", json=publication(category_ids, kind, title), headers=headers)
                assert resp.status_code == 403 and resp.json()["message"] == "Solo el equipo de TEJIDO y los líderes pueden agregar lugares"
                continue
            for bad in ({}, {"municipality": ""}, {"municipality": "medellin"}):
                data = publication(category_ids, kind, title)
                data.pop("municipality")
                resp = client.post("/api/publications", json={**data, **bad}, headers=headers)
                assert resp.status_code == 422, (role, kind, bad, resp.text)
                assert resp.json() == {"error": "MUNICIPALITY_REQUIRED", "message": "Elige el municipio de la publicación"}
            created = client.post("/api/publications", json=publication(category_ids, kind, title, municipality=" Nechi "),
                                  headers=headers)
            assert created.status_code == 201, (role, kind, created.text)
            detail = client.get(f"/api/publications/{created.json()['id']}", headers=headers).json()
            assert detail["municipality"] == "nechi"


def test_editing_an_old_publication_requires_the_municipality_but_moderation_does_not(client, category_ids, roles):  # noqa: F811
    part_h, lead_h = roles["participante"], roles["lider"]
    pub = client.post("/api/publications", json=publication(category_ids, "HISTORIA", "Antigua sin municipio"),
                      headers=part_h).json()["id"]
    with schema_session() as session:  # como las anteriores al campo
        session.execute(update(Publication).where(Publication.id == pub).values(municipality=None))
    data = publication(category_ids, "HISTORIA", "Antigua sin municipio, editada")
    data.pop("municipality")
    assert client.put(f"/api/publications/{pub}", json=data, headers=part_h).status_code == 422
    assert client.post(f"/api/publications/{pub}/submit", headers=part_h).status_code == 200
    # Moderar (aprobar) no pide municipio aunque la publicacion no lo tenga.
    approved = client.patch(f"/api/publications/{pub}/status", json={"status": "PUBLISHED", "note": ""}, headers=lead_h)
    assert approved.status_code == 200, approved.text
    with schema_session() as session:
        assert session.execute(select(Publication.municipality).where(Publication.id == pub)).scalar_one() is None
    edited = client.put(f"/api/publications/{pub}", json={**data, "municipality": "caceres"}, headers=part_h)
    assert edited.status_code == 200, edited.text
    assert client.get(f"/api/publications/{pub}", headers=part_h).json()["municipality"] == "caceres"


def test_publication_filter_by_municipality(client, category_ids, admin):  # noqa: F811
    title = f"Solo en Taraza {uuid.uuid4().hex[:6]}"
    pub = client.post("/api/publications", json=publication(category_ids, "EVENTO", title, municipality="taraza", publish=True),
                      headers=admin).json()["id"]
    listed = client.get("/api/publications?municipality=taraza").json()
    assert pub in [p["id"] for p in listed] and {p["municipality"] for p in listed} == {"taraza"}
    assert pub not in [p["id"] for p in client.get("/api/publications?municipality=caucasia").json()]
    bad = client.get("/api/publications?municipality=Medellin")
    assert bad.status_code == 422 and bad.json()["error"] == "INVALID_MUNICIPALITY"


# ─────────────────────────── artistas ───────────────────────────

def test_artist_requires_municipality_and_moneystack_defaults_to_true(client, admin):  # noqa: F811
    name = f"Artista Municipio {uuid.uuid4().hex[:6]}"
    for bad in ({}, {"municipality": ""}, {"municipality": "bello"}):
        resp = client.post("/api/artists", json={"stage_name": name, **bad}, headers=admin)
        assert resp.status_code == 422, resp.text
        assert resp.json() == {"error": "MUNICIPALITY_REQUIRED", "message": "Elige el municipio del artista"}
    created = client.post("/api/artists", json={"stage_name": name, "municipality": "ZARAGOZA"}, headers=admin)
    assert created.status_code == 201, created.text
    artist_id, slug = created.json()["id"], created.json()["slug"]
    profile = client.get(f"/api/artists/{slug}").json()["artist"]
    assert profile["municipality"] == "zaragoza" and profile["moneystack"] is True
    external = client.post("/api/artists", json={"stage_name": f"{name} externo", "municipality": "nechi", "moneystack": False},
                           headers=admin).json()
    assert client.get(f"/api/artists/{external['slug']}").json()["artist"]["moneystack"] is False

    # Editar: si viene, debe ser valido; no se puede vaciar.
    for bad in ("", "medellin", None):
        assert client.put(f"/api/artists/{artist_id}", json={"municipality": bad}, headers=admin).status_code in (400, 422)
    # Un artista antiguo sin municipio obliga a elegirlo al guardar.
    with schema_session() as session:
        session.execute(update(Artist).where(Artist.id == artist_id).values(municipality=None))
    assert client.put(f"/api/artists/{artist_id}", json={"genre": "Champeta"}, headers=admin).status_code == 422
    ok = client.put(f"/api/artists/{artist_id}", json={"genre": "Champeta", "municipality": "caceres"}, headers=admin)
    assert ok.status_code == 200, ok.text
    assert client.get(f"/api/artists/{slug}").json()["artist"]["municipality"] == "caceres"

    # Listados: municipio y sello en la respuesta; filtro por municipio.
    listed = client.get("/api/artists?municipality=caceres").json()
    assert slug in [a["slug"] for a in listed] and {a["municipality"] for a in listed} == {"caceres"}
    assert all("moneystack" in a for a in client.get("/api/artists").json())
    assert client.get("/api/artists?municipality=xx").status_code == 422
    home = client.get("/api/artists/home").json()
    assert "municipality" in home["artist"] and "moneystack" in home["artist"]


# ─────────────────────────── /api/municipalities/{slug} ───────────────────────────

def test_municipality_page_only_public_content(db):  # noqa: F811
    content = Content(db)
    visible = content.publication(kind="EVENTO", municipality="elbagre", location="Plaza de El Bagre")
    hidden = [content.publication(municipality="elbagre", status=s) for s in ("DRAFT", "REVIEW", "REJECTED")]
    hidden.append(content.publication(municipality="elbagre", deleted=True))
    other = content.publication(municipality="nechi")
    talent = content.talent()
    draft_talent = content.talent(status="REVIEW")
    for row in (talent, draft_talent):
        row.origin = "elbagre"
    active = content.artist("Bagreno")
    inactive = content.artist("Archivado", active=False)
    for row in (active, inactive):
        row.municipality = "elbagre"
    db.flush()

    page = municipality_service.municipality_page(db, "elbagre")
    assert page["slug"] == "elbagre"
    assert [p["id"] for p in page["publications"]] == [visible.id]
    assert not {p.id for p in [*hidden, other]} & {p["id"] for p in page["publications"]}
    assert [t["slug"] for t in page["talent"]] == [talent.slug] and draft_talent.slug not in json.dumps(page)
    assert [a["slug"] for a in page["artists"]] == [active.slug]
    assert page["counts"] == {"publications": 1, "talent": 1, "artists": 1}
    card = page["publications"][0]
    assert set(card) == {"id", "title", "summary", "image", "kind", "cultural_category", "location", "start_date", "municipality"}
    assert set(page["artists"][0]) == {"slug", "stage_name", "image", "genre", "moneystack", "municipality"}
    assert not PRIVATE_KEYS & set(walk_keys(page))
    assert "@" not in json.dumps(page, default=str)

    empty = municipality_service.municipality_page(db, "zaragoza")
    assert empty["publications"] == [] and empty["talent"] == [] and empty["artists"] == []
    assert empty["counts"] == {"publications": 0, "talent": 0, "artists": 0}


def test_municipality_endpoint(client):
    resp = client.get("/api/municipalities/caucasia")
    assert resp.status_code == 200
    assert resp.headers["cache-control"] == "public, max-age=120"
    data = resp.json()
    assert set(data) == {"slug", "counts", "publications", "talent", "artists"}
    assert not PRIVATE_KEYS & set(walk_keys(data)) and "@" not in resp.text
    for slug in ("medellin", "Caucasia", "caucasia ", "1"):
        assert client.get(f"/api/municipalities/{slug}").status_code == 404, slug


# ─────────────────────────── script de relleno ───────────────────────────

def test_deduction_ignores_accents_and_case_and_never_assumes_caucasia():
    assert deduce_municipality("NECHÍ, centro") == "nechi"
    assert deduce_municipality("parque de LAS BANDERAS") == "caucasia"
    assert deduce_municipality("Barrio El Pando") == "caucasia"
    assert deduce_municipality("CÁCERES") == "caceres"
    assert deduce_municipality("vereda de el bagre") == "elbagre"
    assert deduce_municipality("Tarazá") == "taraza"
    assert deduce_municipality("Zaragoza") == "zaragoza"
    for text_ in ("Medellín", "Parque del camello en las casetas de comida", "", None):
        assert deduce_municipality(text_) is None


@pytest.fixture
def script_db(monkeypatch, client):
    """El script usa SessionLocal: se apunta al schema de test."""
    from backend.service.db import session as session_module

    def session_local():
        gen = app.dependency_overrides[get_db]()
        return next(gen)
    monkeypatch.setattr(session_module, "SessionLocal", session_local)
    created = {"publications": [], "artists": []}
    yield created
    with schema_session() as session:
        session.execute(delete(Publication).where(Publication.id.in_(created["publications"])))
        session.execute(delete(Artist).where(Artist.id.in_(created["artists"])))


def test_backfill_dry_run_writes_nothing_and_apply_fills_only_deduced(script_db, client, admin, category_ids):  # noqa: F811
    script = load_script()
    rows = {}
    for key, location, municipality in (("deducible", "Nechí, sector el puerto", None),
                                        ("sin_deducir", "Casa de la cultura de Medellín", None),
                                        ("ya_tiene", "Malecón de Caucasia", "zaragoza")):
        pub = client.post("/api/publications", json=publication(category_ids, "HISTORIA", f"Relleno {key} {uuid.uuid4().hex[:4]}",
                                                                location=location), headers=admin).json()["id"]
        with schema_session() as session:
            session.execute(update(Publication).where(Publication.id == pub).values(municipality=municipality))
        rows[key] = pub
        script_db["publications"].append(pub)
    artist = client.post("/api/artists", json={"stage_name": f"Relleno {uuid.uuid4().hex[:6]}", "city": "Tarazá",
                                              "municipality": "caucasia"}, headers=admin).json()["id"]
    script_db["artists"].append(artist)
    with schema_session() as session:
        session.execute(update(Artist).where(Artist.id == artist).values(municipality=None))

    def current():
        with schema_session() as session:
            pubs = dict(session.execute(select(Publication.id, Publication.municipality).where(Publication.id.in_(rows.values()))).all())
            return pubs, session.execute(select(Artist.municipality).where(Artist.id == artist)).scalar_one()

    before = current()
    out = io.StringIO()
    with redirect_stdout(out):
        plan = script.main([])  # dry-run por defecto
    assert current() == before  # no escribio nada
    report = out.getvalue()
    missing = report.split("SIN DEDUCIR")[1]
    assert str(rows["sin_deducir"]) in missing.split("=== ARTISTAS")[0]
    deduced = {row["id"]: row["deduced"] for row in plan["publications"]["rows"]}
    assert deduced[rows["deducible"]] == "nechi" and deduced[rows["sin_deducir"]] is None
    assert rows["ya_tiene"] not in deduced  # ya tenia municipio: ni se propone

    # El dry-run es de solo lectura de verdad: en su transaccion la base rechaza escribir.
    with schema_session() as session:
        session.execute(text("SET TRANSACTION READ ONLY"))
        with pytest.raises(DBAPIError):
            script.apply_plan(session, plan)
        session.rollback()

    with pytest.raises(SystemExit):  # --apply sin --yes no corre
        script.main(["--apply"])
    assert current() == before

    with redirect_stdout(io.StringIO()):
        script.main(["--apply", "--yes"])
    pubs, artist_municipality = current()
    assert pubs[rows["deducible"]] == "nechi"
    assert pubs[rows["sin_deducir"]] is None  # no asume Caucasia
    assert pubs[rows["ya_tiene"]] == "zaragoza"  # nunca pisa
    assert artist_municipality == "taraza"


# ─────────────────────────── migracion ───────────────────────────

def test_migration_adds_checked_columns_and_is_reversible():
    path = ROOT / "backend" / "alembic" / "versions" / "c5e8a1d4f7b2_municipio_en_publicaciones_y_artistas.py"
    spec = importlib.util.spec_from_file_location("migracion_municipio", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)

    direct_url = settings.database_url.replace("-pooler.", ".")
    schema = f"test_mig_{uuid.uuid4().hex[:10]}"
    admin_engine = create_engine(direct_url)
    with admin_engine.begin() as conn:
        conn.execute(text(f'CREATE SCHEMA "{schema}"'))
    engine = create_engine(direct_url, connect_args={"options": f"-csearch_path={schema}"})
    try:
        with engine.begin() as conn:
            conn.execute(text("CREATE TABLE publications (id serial PRIMARY KEY, title varchar NOT NULL)"))
            conn.execute(text("CREATE TABLE artists (id serial PRIMARY KEY, stage_name varchar NOT NULL)"))
            conn.execute(text("INSERT INTO publications (title) VALUES ('Antigua')"))
            conn.execute(text("INSERT INTO artists (stage_name) VALUES ('Antiguo')"))
            with Operations.context(MigrationContext.configure(conn)):
                migration.upgrade()
            # No rellena: las existentes quedan sin municipio; el sello queda en true.
            assert conn.execute(text("SELECT municipality FROM publications")).scalar_one() is None
            assert conn.execute(text("SELECT municipality, moneystack FROM artists")).one() == (None, True)
            conn.execute(text("UPDATE publications SET municipality = 'nechi'"))
            indexes = {r[0] for r in conn.execute(text("SELECT indexname FROM pg_indexes WHERE schemaname = current_schema()"))}
            assert {"ix_publications_municipality", "ix_artists_municipality"} <= indexes
        for table in ("publications", "artists"):
            with pytest.raises(IntegrityError):
                with engine.begin() as conn:
                    conn.execute(text(f"UPDATE {table} SET municipality = 'medellin'"))
        with engine.begin() as conn:
            with Operations.context(MigrationContext.configure(conn)):
                migration.downgrade()
            for table, base in (("publications", {"id", "title"}), ("artists", {"id", "stage_name"})):
                columns = {r[0] for r in conn.execute(text(
                    "SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = :t"),
                    {"t": table})}
                assert columns == base
    finally:
        engine.dispose()
        with admin_engine.begin() as conn:
            conn.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
        admin_engine.dispose()
