"""Portadas de las categorias culturales: quien puede cambiarlas (PUT/DELETE
/api/cultural-categories/{clave}/cover) y la firma de subida del scope "category_cover".

Schema aislado del conftest. Cada test deja la tabla de portadas y los lideres como estaban.
"""
import pytest
from sqlalchemy import delete

from backend.service.core.config import settings
from backend.service.models.tables import CulturalCategoryCover
from backend.tests_fastapi.test_branches import admin, branch_cleanup, citizen, gestor, leader, sent  # noqa: F401
from backend.tests_fastapi.test_gestor_category import category_ids  # noqa: F401
from backend.tests_fastapi.test_gestores_invites import schema_session
from backend.tests_fastapi.test_parity import tokens  # noqa: F401
from backend.tests_fastapi.test_uploads import configured  # noqa: F401

BRANCH = "LITERATURA"


def cover_url(name="portada"):
    return f"https://res.cloudinary.com/{settings.cloudinary_cloud_name}/image/upload/v1/tejido/categorias/{name}.jpg"


@pytest.fixture(autouse=True)
def clean_covers():
    yield
    with schema_session() as db:
        db.execute(delete(CulturalCategoryCover))


@pytest.fixture(autouse=True)
def cloud_name(monkeypatch):
    # El validador exige el cloud name de la cuenta; en los tests se fija uno conocido.
    monkeypatch.setattr(settings, "cloudinary_cloud_name", "tejido-test")


def put(client, key, headers, url=None):
    return client.put(f"/api/cultural-categories/{key}/cover", json={"image_url": url or cover_url()}, headers=headers)


def test_admin_changes_any_cover_and_get_reflects_it(client, admin):
    for key in ("MUSICA", "DANZA"):
        resp = put(client, key, admin, cover_url(key.lower()))
        assert resp.status_code == 200 and resp.json()[key] == cover_url(key.lower())
        assert resp.headers["cache-control"] == "no-store"
    covers = client.get("/api/cultural-categories/covers")
    assert covers.json() == {"MUSICA": cover_url("musica"), "DANZA": cover_url("danza")}
    assert covers.headers["cache-control"] == "public, max-age=300"  # el publico conserva su cache
    # Volver a guardar actualiza la misma fila (upsert).
    assert put(client, "musica", admin, cover_url("otra")).json()["MUSICA"] == cover_url("otra")


def test_leader_only_his_branch(client, admin, sent, branch_cleanup):
    branch_cleanup.append(BRANCH)
    lead_h, _, _ = leader(client, admin, BRANCH, name="Lider Literatura")
    assert put(client, BRANCH, lead_h).status_code == 200
    assert put(client, "MUSICA", lead_h).status_code == 403
    assert client.delete("/api/cultural-categories/MUSICA/cover", headers=lead_h).status_code == 403
    assert client.delete(f"/api/cultural-categories/{BRANCH}/cover", headers=lead_h).status_code == 200


def test_others_cannot_change_covers(client, admin, sent):
    gestor_h, _, _ = gestor(client, admin, "ARTES_VISUALES", "No lider")
    _, citizen_h = citizen(client, "Ciudadana portadas")
    for headers in (gestor_h, citizen_h):
        assert put(client, "ARTES_VISUALES", headers).status_code == 403
        assert client.delete("/api/cultural-categories/ARTES_VISUALES/cover", headers=headers).status_code == 403
    assert put(client, "MUSICA", {}).status_code == 401
    assert client.delete("/api/cultural-categories/MUSICA/cover").status_code == 401
    assert client.get("/api/cultural-categories/covers").json() == {}


def test_invalid_key_and_urls(client, admin):
    assert put(client, "RAP", admin).status_code == 404
    assert client.delete("/api/cultural-categories/RAP/cover", headers=admin).status_code == 404
    bad = [
        "http://res.cloudinary.com/tejido-test/image/upload/v1/tejido/categorias/x.jpg",   # sin https
        "https://res.cloudinary.com/otra-cuenta/image/upload/v1/tejido/categorias/x.jpg",  # otra cuenta
        "https://res.cloudinary.com/tejido-test/image/upload/v1/tejido/talento/x.jpg",     # otra carpeta
        "https://example.com/tejido/categorias/x.jpg", "/images/categorias/musica.jpg", "javascript:alert(1)", "",
    ]
    for url in bad:
        resp = client.put("/api/cultural-categories/MUSICA/cover", json={"image_url": url}, headers=admin)
        assert resp.status_code == 400, url
    assert client.get("/api/cultural-categories/covers").json() == {}


def test_delete_is_idempotent(client, admin):
    assert put(client, "TEATRO", admin).status_code == 200
    for _ in range(2):
        resp = client.delete("/api/cultural-categories/teatro/cover", headers=admin)
        assert resp.status_code == 200 and "TEATRO" not in resp.json()
    assert client.get("/api/cultural-categories/covers").json() == {}


def test_upload_scope_category_cover(client, admin, sent, branch_cleanup, configured):
    branch_cleanup.append(BRANCH)
    lead_h, _, _ = leader(client, admin, BRANCH, name="Lider Firma")
    gestor_h, _, _ = gestor(client, admin, "ARTES_VISUALES", "Gestor Firma")
    _, citizen_h = citizen(client, "Ciudadano firma")
    sign = lambda h: client.post("/api/uploads/sign", json={"scope": "category_cover"}, headers=h)  # noqa: E731
    for headers in (admin, lead_h):
        resp = sign(headers)
        assert resp.status_code == 200 and resp.json()["folder"] == "tejido/categorias"
    assert sign(gestor_h).status_code == 403
    assert sign(citizen_h).status_code == 403
    assert client.post("/api/uploads/sign", json={"scope": "category_cover"}).status_code == 401
    # La carpeta la decide el servidor: un folder del cliente se ignora.
    resp = client.post("/api/uploads/sign", json={"scope": "category_cover", "folder": "tejido/otra"}, headers=admin)
    assert resp.json()["folder"] == "tejido/categorias"
