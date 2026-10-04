"""
Biografia publica del gestor: GET/PATCH /api/me/organization.

Cada test crea su propio gestor por invitacion (con organizacion) y lo activa, para no tocar
la organizacion sembrada que usan otros tests. El correo se reemplaza con monkeypatch.

Ejecutar con:  py -m pytest backend/tests_fastapi -v
"""
from sqlalchemy import delete

from backend.service.models.tables import Organization
from backend.tests_fastapi.test_gestores_invites import (  # noqa: F401
    GOOD_PASSWORD, create_gestor, schema_session, sent_emails,
)
from backend.tests_fastapi.test_parity import auth_header, hit, tokens  # noqa: F401


def active_gestor(client, tokens, **overrides):
    """Crea y activa un gestor; devuelve (alta, headers de su sesion)."""
    _, created = create_gestor(client, tokens, **overrides)
    token = created["invite_link"].rsplit("/", 1)[-1]
    resp = client.post("/api/auth/accept-invite", json={"token": token, "password": GOOD_PASSWORD})
    assert resp.status_code == 200, resp.text
    return created, {"Authorization": f"Bearer {resp.json()['token']}"}


def test_gestor_reads_and_updates_own_organization(client, tokens, sent_emails):
    created, auth = active_gestor(client, tokens, organization_name="Cine al Barrio", branch="CINE_AUDIOVISUAL")

    resp = hit(client, "auth", "get_my_organization", "GET", "/api/me/organization", headers=auth)
    assert resp.status_code == 200, resp.text
    org = resp.json()
    assert org["id"] == created["organization_id"] and org["name"] == "Cine al Barrio"
    assert org["branch"] == "CINE_AUDIOVISUAL" and org["description"] is None

    resp = hit(client, "auth", "patch_my_organization", "PATCH", "/api/me/organization", headers=auth, json={
        "name": "  Cine al Barrio Caucasia ", "description": "Proyecciones al aire libre en los barrios.",
        "photo_url": "https://cdn.tejido.co/cine.jpg", "contact": "cine@barrio.co",
    })
    assert resp.status_code == 200, resp.text
    assert resp.json() == {
        "id": created["organization_id"], "name": "Cine al Barrio Caucasia",
        "description": "Proyecciones al aire libre en los barrios.", "photo_url": "https://cdn.tejido.co/cine.jpg",
        "contact": "cine@barrio.co", "branch": "CINE_AUDIOVISUAL",
    }
    # La foto nueva sale en el listado publico de su categoria.
    public = client.get("/api/gestores", params={"branch": "CINE_AUDIOVISUAL"}).json()
    assert {"id": created["organization_id"], "name": "Cine al Barrio Caucasia", "branch": "CINE_AUDIOVISUAL",
            "photo_url": "https://cdn.tejido.co/cine.jpg"} in public

    # Solo lo enviado cambia; vacio quita los opcionales.
    resp = client.patch("/api/me/organization", headers=auth, json={"description": "", "photo_url": ""})
    assert resp.json()["description"] is None and resp.json()["photo_url"] is None
    assert resp.json()["contact"] == "cine@barrio.co"


def test_gestor_cannot_change_branch_or_active(client, tokens, sent_emails):
    created, auth = active_gestor(client, tokens, branch="TEATRO")
    resp = client.patch("/api/me/organization", headers=auth,
                        json={"branch": "MUSICA", "active": False, "name": "Teatro Rio"})
    assert resp.status_code == 200
    assert resp.json()["branch"] == "TEATRO" and resp.json()["name"] == "Teatro Rio"
    # Sigue activa: aparece en el listado publico de su rama original.
    assert created["organization_id"] in {g["id"] for g in client.get("/api/gestores", params={"branch": "TEATRO"}).json()}


def test_my_organization_validation(client, tokens, sent_emails):
    _, auth = active_gestor(client, tokens)
    assert client.patch("/api/me/organization", headers=auth, json={"name": "   "}).status_code == 400
    assert client.patch("/api/me/organization", headers=auth, json={"photo_url": "javascript:alert(1)"}).status_code == 400
    assert client.patch("/api/me/organization", headers=auth, json={"description": "x" * 2001}).status_code == 400


def test_my_organization_404_without_organization(client, tokens, sent_emails):
    created, auth = active_gestor(client, tokens)
    with schema_session() as db:
        db.execute(delete(Organization).where(Organization.id == created["organization_id"]))
    resp = client.get("/api/me/organization", headers=auth)
    assert resp.status_code == 404
    assert "pide a un administrador" in resp.json()["message"]
    assert client.patch("/api/me/organization", headers=auth, json={"name": "X"}).status_code == 404


def test_my_organization_requires_gestor(client, tokens):
    for who in ("ciudadano", "admin"):
        assert client.get("/api/me/organization", headers=auth_header(tokens, who)).status_code == 403
        assert client.patch("/api/me/organization", headers=auth_header(tokens, who), json={"name": "X"}).status_code == 403
    assert client.get("/api/me/organization").status_code == 403
