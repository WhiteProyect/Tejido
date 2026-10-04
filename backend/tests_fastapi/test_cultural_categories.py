"""
Categorias culturales: filtro de publicaciones por cultural_category, el listado publico
GET /api/gestores y la foto de organizacion (photo_url) en PATCH /api/admin/gestores/{id}.

Usa el mismo client/tokens de conftest.py (schema aislado en Neon, sembrado con
backend/service/seed.py, que etiqueta las 6 publicaciones de ejemplo). El envio de correo
de las invitaciones se reemplaza con monkeypatch (fixture sent_emails).

Ejecutar con:  py -m pytest backend/tests_fastapi -v
"""
import pytest

from backend.tests_fastapi.test_gestores_invites import GOOD_PASSWORD, create_gestor, sent_emails  # noqa: F401
from backend.tests_fastapi.test_parity import auth_header, hit, tokens  # noqa: F401

PUBLIC_GESTOR_KEYS = {"id", "name", "branch", "photo_url"}


@pytest.fixture(scope="module")
def category_ids(client):
    return {c["type"]: c["id"] for c in client.get("/api/categories").json()}


def activate(client, invite_link):
    token = invite_link.rsplit("/", 1)[-1]
    resp = client.post("/api/auth/accept-invite", json={"token": token, "password": GOOD_PASSWORD})
    assert resp.status_code == 200, resp.text


def public_gestores(client, **params):
    resp = client.get("/api/gestores", params=params)  # sin Authorization: es publico
    assert resp.status_code == 200, resp.text
    return resp.json()


# --- Publicaciones -----------------------------------------------------------

def test_seeded_publications_are_tagged_and_filterable(client):
    resp = hit(client, "publications", "list_by_cultural_category", "GET",
               "/api/publications?cultural_category=EMPRENDIMIENTO_CULTURAL")
    assert resp.status_code == 200
    titles = {p["title"] for p in resp.json()}
    assert titles == {"Convocatoria Semillas Creativas", "Mercado Hecho en Caucasia"}
    assert all(p["cultural_category"] == "EMPRENDIMIENTO_CULTURAL" for p in resp.json())

    musica = client.get("/api/publications?cultural_category=MUSICA").json()
    assert [p["title"] for p in musica] == ["Festival Rio y Sabana 2026"]

    # Sin filtro siguen saliendo todas; con una categoria sin publicaciones, ninguna.
    assert len(client.get("/api/publications").json()) >= 6
    assert client.get("/api/publications?cultural_category=DANZA").json() == []


def test_publication_cultural_category_is_validated_and_saved(client, tokens, category_ids):
    base = {
        "kind": "HISTORIA", "category_id": category_ids["HISTORIA"],
        "title": "Historia de danza para categorias", "summary": "Resumen de prueba de categorias culturales.",
        "content": "Contenido de prueba para verificar la categoria cultural de una publicacion.",
        "publish": True,
    }
    bad = client.post("/api/publications", json={**base, "cultural_category": "RAP"}, headers=auth_header(tokens, "admin"))
    assert bad.status_code == 400

    created = client.post("/api/publications", json={**base, "cultural_category": "danza"}, headers=auth_header(tokens, "admin"))
    assert created.status_code == 201, created.text
    pub_id = created.json()["id"]
    detail = client.get(f"/api/publications/{pub_id}").json()
    assert detail["cultural_category"] == "DANZA"  # normalizada a mayusculas
    assert pub_id in {p["id"] for p in client.get("/api/publications?cultural_category=DANZA").json()}

    # Sin categoria tambien es valido (el campo es opcional).
    plain = client.post("/api/publications", json={**base, "title": "Historia sin categoria cultural"},
                        headers=auth_header(tokens, "admin"))
    assert plain.status_code == 201
    assert client.get(f"/api/publications/{plain.json()['id']}").json()["cultural_category"] is None


# --- Gestores publicos -------------------------------------------------------

def test_public_gestores_lists_active_only_without_private_data(client, tokens, sent_emails):
    payload, created = create_gestor(client, tokens, branch="TEATRO", organization_name="Teatro del Rio")
    # Pendiente (no acepto la invitacion): todavia no es publico.
    assert created["organization_id"] not in {g["id"] for g in public_gestores(client, branch="TEATRO")}

    activate(client, created["invite_link"])
    resp = hit(client, "gestores", "list_public", "GET", "/api/gestores?branch=TEATRO")
    gestores = resp.json()
    mine = next(g for g in gestores if g["id"] == created["organization_id"])
    assert mine == {"id": created["organization_id"], "name": "Teatro del Rio", "branch": "TEATRO", "photo_url": None}
    for g in gestores:
        assert set(g) == PUBLIC_GESTOR_KEYS
        assert g["branch"] == "TEATRO"
    body = resp.text
    assert payload["email"] not in body and payload["contact"] not in body

    # Otra rama no lo incluye; sin filtro si.
    assert created["organization_id"] not in {g["id"] for g in public_gestores(client, branch="DANZA")}
    assert created["organization_id"] in {g["id"] for g in public_gestores(client)}

    # Un admin lo desactiva: sale del listado publico.
    client.patch(f"/api/admin/gestores/{created['user_id']}", json={"active": False}, headers=auth_header(tokens, "admin"))
    assert created["organization_id"] not in {g["id"] for g in public_gestores(client, branch="TEATRO")}


# --- Foto de organizacion ----------------------------------------------------

def test_patch_gestor_accepts_photo_url(client, tokens, sent_emails):
    _, created = create_gestor(client, tokens, branch="DANZA")
    activate(client, created["invite_link"])
    url = f"/api/admin/gestores/{created['user_id']}"
    admin = auth_header(tokens, "admin")

    resp = hit(client, "admin", "patch_gestor_photo", "PATCH", url,
               json={"photo_url": "/images/gestores/danza.jpg"}, headers=admin)
    assert resp.status_code == 200, resp.text
    listed = next(g for g in client.get("/api/admin/gestores", headers=admin).json() if g["id"] == created["user_id"])
    assert listed["photo_url"] == "/images/gestores/danza.jpg"
    public = next(g for g in public_gestores(client, branch="DANZA") if g["id"] == created["organization_id"])
    assert public["photo_url"] == "/images/gestores/danza.jpg"

    assert client.patch(url, json={"photo_url": "javascript:alert(1)"}, headers=admin).status_code == 400
    assert client.patch(url, json={"photo_url": "https://cdn.tejido.co/f.jpg"}, headers=admin).status_code == 200

    # Vacio la quita.
    assert client.patch(url, json={"photo_url": ""}, headers=admin).status_code == 200
    public = next(g for g in public_gestores(client, branch="DANZA") if g["id"] == created["organization_id"])
    assert public["photo_url"] is None

    # Solo ADMIN.
    assert client.patch(url, json={"photo_url": "/x.jpg"}, headers=auth_header(tokens, "gestor")).status_code == 403
