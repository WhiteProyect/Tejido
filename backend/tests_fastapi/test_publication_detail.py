"""Detalle de una publicacion (GET /api/publications/{id}) para la pagina #publicacion/<id>:
evento u oportunidad, organizacion publica del autor y galeria (images), con los permisos de siempre.

Schema aislado del conftest. El gestor demo (user 2) tiene la organizacion sembrada y rama
PATRIMONIO_MEMORIA solo en el schema de test (conftest.py).
"""
import pytest

from backend.tests_fastapi.test_gestor_category import category_ids  # noqa: F401
from backend.tests_fastapi.test_parity import auth_header, tokens  # noqa: F401

PRIVATE_KEYS = {"email", "contact", "password_hash", "author_email"}


@pytest.fixture
def admin(tokens):
    return auth_header(tokens, "admin")


@pytest.fixture
def gestor(tokens):
    return auth_header(tokens, "gestor")


def create(client, headers, category_ids, kind, title, **extra):
    payload = {
        "kind": kind, "category_id": category_ids[kind], "title": title,
        "summary": "Resumen para la pagina de la publicacion.",
        "content": "Primer parrafo del contenido.\n\nSegundo parrafo del contenido.",
        "location": "Malecon de Caucasia", **extra,
    }
    resp = client.post("/api/publications", json=payload, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def assert_no_private_fields(data):
    assert not PRIVATE_KEYS & set(data)
    if data["author_organization"] is not None:
        assert set(data["author_organization"]) == {"name", "branch", "photo_url"}


def test_published_event_with_gallery_is_public(client, admin, category_ids):
    pub = create(client, admin, category_ids, "EVENTO", "Festival con galeria", publish=True,
                 start_date="2026-11-07T15:00", end_date="2026-11-08T22:00", link="https://example.com/festival")
    for position, url in enumerate(("https://res.cloudinary.com/demo/image/upload/v1/a.jpg",
                                    "https://res.cloudinary.com/demo/image/upload/v1/b.jpg")):
        resp = client.post(f"/api/publications/{pub}/images", json={"url": url, "alt_text": f"Foto {position}"}, headers=admin)
        assert resp.status_code == 201, resp.text

    resp = client.get(f"/api/publications/{pub}")
    assert resp.status_code == 200
    data = resp.json()
    # Lo que ya devolvia sigue igual.
    assert {"id", "title", "summary", "content", "kind", "status", "category", "color", "author", "favorite"} <= set(data)
    assert data["venue"] == "Malecon de Caucasia" and data["capacity"] is None
    assert data["organization_name"] is None and data["deadline"] is None
    assert [(i["alt_text"], i["position"]) for i in data["images"]] == [("Foto 0", 0), ("Foto 1", 1)]
    # El otro camino (endpoint de imagenes) devuelve lo mismo.
    assert client.get(f"/api/publications/{pub}/images").json() == data["images"]
    assert_no_private_fields(data)


def test_published_opportunity_and_plain_history(client, admin, category_ids):
    opp = create(client, admin, category_ids, "OPORTUNIDAD", "Convocatoria abierta", publish=True, end_date="2026-12-15T23:59")
    data = client.get(f"/api/publications/{opp}").json()
    assert data["deadline"].startswith("2026-12-15") and data["venue"] is None
    assert data["images"] == []

    history = create(client, admin, category_ids, "HISTORIA", "Historia sin extras", publish=True)
    data = client.get(f"/api/publications/{history}").json()
    assert (data["venue"], data["capacity"], data["organization_name"], data["deadline"]) == (None, None, None, None)
    assert data["images"] == [] and data["author_organization"] is None  # el admin demo no tiene organizacion


def test_author_organization_is_public_only(client, gestor, admin, category_ids):
    pub = create(client, gestor, category_ids, "HISTORIA", "Del gestor con organizacion")
    data = client.get(f"/api/publications/{pub}", headers=gestor).json()
    assert data["author"] == "Mateo Gestor"
    assert data["author_organization"] == {"name": "Colectivo Rio Vivo", "branch": "PATRIMONIO_MEMORIA", "photo_url": None}
    assert_no_private_fields(data)


def test_permissions_draft_review_and_deleted(client, tokens, gestor, admin, category_ids):
    pub = create(client, gestor, category_ids, "HISTORIA", "Borrador privado")
    assert client.get(f"/api/publications/{pub}").status_code == 403
    assert client.get(f"/api/publications/{pub}", headers=auth_header(tokens, "ciudadano")).status_code == 403
    assert client.get(f"/api/publications/{pub}", headers=gestor).json()["status"] == "DRAFT"

    assert client.post(f"/api/publications/{pub}/submit", headers=gestor).status_code == 200
    assert client.get(f"/api/publications/{pub}", headers=gestor).json()["status"] == "REVIEW"
    assert client.get(f"/api/publications/{pub}", headers=admin).json()["status"] == "REVIEW"
    assert client.get(f"/api/publications/{pub}").status_code == 403

    assert client.delete(f"/api/publications/{pub}", headers=admin).status_code == 200
    assert client.get(f"/api/publications/{pub}", headers=admin).status_code == 404
    assert client.get("/api/publications/999999999").status_code == 404
