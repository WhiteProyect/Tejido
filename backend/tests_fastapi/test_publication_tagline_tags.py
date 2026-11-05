"""Eslogan (tagline) y etiquetas (tags) opcionales de las publicaciones.

- Validacion al crear y editar: recorte, sin HTML, sin vacias ni duplicadas (sin distinguir
  mayusculas), maximo 3 de 24 caracteres; eslogan de hasta 100. Errores 422 en español.
- Salida publica (listado y detalle), de "mis publicaciones", del listado del admin por estado y tras
  moderar. La cadena de moderacion no cambia.
- La migracion d4f6a8c1e3b5, en un schema aparte: sube con '[]' por defecto y baja limpia.
"""
import importlib.util
import uuid
from pathlib import Path

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, text

from backend.service.core.config import settings
from backend.tests_fastapi.test_gestor_category import category_ids  # noqa: F401
from backend.tests_fastapi.test_parity import auth_header, tokens  # noqa: F401

ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture
def admin(tokens):
    return auth_header(tokens, "admin")


@pytest.fixture
def gestor(tokens):
    return auth_header(tokens, "gestor")


def payload(category_ids, **extra):
    return {"kind": "HISTORIA", "category_id": category_ids["HISTORIA"], "title": "Historia con eslogan",
            "summary": "Resumen de la historia con eslogan.", "content": "Contenido suficiente de la historia.",
            "location": "Caucasia", "municipality": "caucasia", **extra}


def create(client, headers, category_ids, **extra):
    resp = client.post("/api/publications", json=payload(category_ids, **extra), headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def test_optional_fields_default_to_nothing(client, admin, category_ids):
    pub = create(client, admin, category_ids, publish=True)
    data = client.get(f"/api/publications/{pub}").json()
    assert data["tagline"] is None and data["tags"] == []


def test_values_are_normalized(client, admin, category_ids):
    pub = create(client, admin, category_ids, publish=True, tagline="  Una <b>frase</b>   breve  ",
                 tags=[" Río ", "río", "", "  ", "<i>Memoria</i>", None])
    data = client.get(f"/api/publications/{pub}").json()
    assert data["tagline"] == "Una frase breve"
    assert data["tags"] == ["Río", "Memoria"]
    listed = next(p for p in client.get("/api/publications").json() if p["id"] == pub)
    assert listed["tagline"] == "Una frase breve" and listed["tags"] == ["Río", "Memoria"]


@pytest.mark.parametrize("extra, code, message", [
    ({"tagline": "x" * 101}, "INVALID_TAGLINE", "El eslogan no puede pasar de 100 caracteres"),
    ({"tags": ["uno", "dos", "tres", "cuatro"]}, "INVALID_TAGS", "Máximo 3 etiquetas"),
    ({"tags": ["y" * 25]}, "INVALID_TAGS", "Cada etiqueta puede tener hasta 24 caracteres"),
    ({"tags": "uno, dos"}, "INVALID_TAGS", "Las etiquetas deben ser una lista"),
])
def test_invalid_values_answer_422_in_spanish(client, admin, category_ids, extra, code, message):
    resp = client.post("/api/publications", json=payload(category_ids, **extra), headers=admin)
    assert resp.status_code == 422
    assert resp.json() == {"error": code, "message": message}


def test_limits_are_inclusive(client, admin, category_ids):
    pub = create(client, admin, category_ids, publish=True, tagline="x" * 100,
                 tags=["a" * 24, "B", "c", "b"])  # "b" repite "B": quedan 3
    data = client.get(f"/api/publications/{pub}").json()
    assert len(data["tagline"]) == 100 and data["tags"] == ["a" * 24, "B", "c"]


def test_edit_updates_and_clears(client, admin, category_ids):
    pub = create(client, admin, category_ids, publish=True, tagline="Primera", tags=["Uno"])
    resp = client.put(f"/api/publications/{pub}", json=payload(category_ids, publish=True, tagline="Segunda", tags=["Dos", "Tres"]), headers=admin)
    assert resp.status_code == 200, resp.text
    data = client.get(f"/api/publications/{pub}").json()
    assert (data["tagline"], data["tags"]) == ("Segunda", ["Dos", "Tres"])
    resp = client.put(f"/api/publications/{pub}", json=payload(category_ids, publish=True), headers=admin)
    assert resp.status_code == 200
    data = client.get(f"/api/publications/{pub}").json()
    assert (data["tagline"], data["tags"]) == (None, [])


def test_gestor_flow_and_moderation_keep_the_fields(client, gestor, admin, category_ids):
    pub = create(client, gestor, category_ids, cultural_category="PATRIMONIO_MEMORIA", tagline="Del gestor", tags=["Barrio"])
    mine = next(p for p in client.get("/api/publications?mine=1", headers=gestor).json() if p["id"] == pub)
    assert mine["status"] == "DRAFT" and mine["tagline"] == "Del gestor" and mine["tags"] == ["Barrio"]
    assert client.post(f"/api/publications/{pub}/submit", headers=gestor).status_code == 200
    queue = next(p for p in client.get("/api/publications?status=REVIEW", headers=admin).json() if p["id"] == pub)
    assert queue["tagline"] == "Del gestor" and queue["tags"] == ["Barrio"]
    resp = client.patch(f"/api/publications/{pub}/status", json={"status": "PUBLISHED"}, headers=admin)
    assert resp.status_code == 200, resp.text
    public = client.get(f"/api/publications/{pub}").json()
    assert public["status"] == "PUBLISHED" and public["tagline"] == "Del gestor" and public["tags"] == ["Barrio"]


def test_migration_adds_the_columns_and_is_reversible():
    path = ROOT / "backend" / "alembic" / "versions" / "d4f6a8c1e3b5_eslogan_y_etiquetas_de_publicaciones.py"
    spec = importlib.util.spec_from_file_location("migracion_eslogan", path)
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
            conn.execute(text("INSERT INTO publications (title) VALUES ('Antigua')"))
            with Operations.context(MigrationContext.configure(conn)):
                migration.upgrade()
            # No rellena: la existente queda sin eslogan y con lista vacia.
            assert conn.execute(text("SELECT tagline, tags FROM publications")).one() == (None, [])
            length = conn.execute(text(
                "SELECT character_maximum_length FROM information_schema.columns "
                "WHERE table_schema = current_schema() AND table_name = 'publications' AND column_name = 'tagline'")).scalar_one()
            assert length == 100
        with engine.begin() as conn:
            with Operations.context(MigrationContext.configure(conn)):
                migration.downgrade()
            columns = {r[0] for r in conn.execute(text(
                "SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'publications'"))}
            assert columns == {"id", "title"}
    finally:
        engine.dispose()
        with admin_engine.begin() as conn:
            conn.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
        admin_engine.dispose()
