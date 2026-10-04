"""
Autoedicion del perfil (PATCH /api/me) y avatar_url en las respuestas de sesion.

Cada test registra ciudadanos nuevos (POST /api/auth/signup) para no tocar las cuentas
demo que comparten los demas tests. El limiter de registro vive en memoria y se resetea
antes y despues de cada test.

Ejecutar con:  py -m pytest backend/tests_fastapi -v
"""
import uuid

import pytest

from backend.service.core.rate_limit import reset_login_rate_limit
from backend.tests_fastapi.test_gestores_invites import GOOD_PASSWORD, create_gestor, sent_emails  # noqa: F401
from backend.tests_fastapi.test_parity import hit, tokens  # noqa: F401

USER_KEYS = {"id", "name", "email", "role", "avatar_url"}


@pytest.fixture(autouse=True)
def _clean_rate_limit_state():
    reset_login_rate_limit()
    yield
    reset_login_rate_limit()


def signup(client, name="Ciudadana Perfil"):
    email = f"perfil-{uuid.uuid4().hex[:10]}@tejido-test.co"
    resp = client.post("/api/auth/signup", json={"name": name, "email": email, "password": GOOD_PASSWORD})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    return body["user"], {"Authorization": f"Bearer {body['token']}"}


def test_patch_me_updates_name_and_avatar(client):
    user, auth = signup(client)

    resp = hit(client, "auth", "patch_me", "PATCH", "/api/me", json={"name": "  Ana María  "}, headers=auth)
    assert resp.status_code == 200, resp.text
    assert set(resp.json()["user"]) == USER_KEYS
    assert resp.json()["user"]["name"] == "Ana María"

    resp = client.patch("/api/me", json={"avatar_url": "https://cdn.tejido.co/ana.jpg"}, headers=auth)
    assert resp.status_code == 200
    me = client.get("/api/me", headers=auth).json()["user"]
    assert me == {**user, "name": "Ana María", "avatar_url": "https://cdn.tejido.co/ana.jpg"}

    # Mandar solo un campo no borra el otro; vacio quita la foto.
    assert client.patch("/api/me", json={"name": "Ana"}, headers=auth).json()["user"]["avatar_url"] == "https://cdn.tejido.co/ana.jpg"
    assert client.patch("/api/me", json={"avatar_url": ""}, headers=auth).json()["user"]["avatar_url"] is None
    assert client.get("/api/me", headers=auth).json()["user"]["avatar_url"] is None


def test_patch_me_rejects_empty_name_and_bad_avatar(client):
    _, auth = signup(client, name="Nombre Original")
    empty = client.patch("/api/me", json={"name": "   "}, headers=auth)
    assert empty.status_code == 400
    assert client.patch("/api/me", json={"avatar_url": "javascript:alert(1)"}, headers=auth).status_code == 400
    assert client.get("/api/me", headers=auth).json()["user"]["name"] == "Nombre Original"


def test_patch_me_requires_session(client):
    assert client.patch("/api/me", json={"name": "Nadie"}).status_code == 401


def test_patch_me_only_touches_own_account(client):
    me, auth = signup(client, name="Yo Mismo")
    other, other_auth = signup(client, name="Otra Persona")

    resp = client.patch("/api/me", headers=auth, json={
        "id": other["id"], "user_id": other["id"], "role": "ADMIN", "email": other["email"], "name": "Cambiado",
    })
    assert resp.status_code == 200
    mine = client.get("/api/me", headers=auth).json()["user"]
    assert mine["id"] == me["id"] and mine["role"] == "CIUDADANO" and mine["email"] == me["email"]
    assert mine["name"] == "Cambiado"
    assert client.get("/api/me", headers=other_auth).json()["user"]["name"] == "Otra Persona"


def test_session_responses_include_avatar_url(client, tokens, sent_emails):
    user, auth = signup(client)
    assert "avatar_url" in user  # signup
    client.patch("/api/me", json={"avatar_url": "/images/avatar.jpg"}, headers=auth)

    login = client.post("/api/auth/login", json={"email": user["email"], "password": GOOD_PASSWORD})
    assert login.json()["user"]["avatar_url"] == "/images/avatar.jpg"  # login
    assert set(client.get("/api/me", headers=auth).json()["user"]) == USER_KEYS  # GET /me

    _, created = create_gestor(client, tokens)
    token = created["invite_link"].rsplit("/", 1)[-1]
    accepted = client.post("/api/auth/accept-invite", json={"token": token, "password": GOOD_PASSWORD})
    assert set(accepted.json()["user"]) == USER_KEYS  # accept-invite
