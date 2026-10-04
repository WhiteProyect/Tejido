"""
Alta de gestores por un admin (con invitacion por correo), su administracion y la
aceptacion de invitaciones (el usuario define su propia contrasena).

El envio real de correo (backend/service/services/email.py::send_invite_email) se
reemplaza SIEMPRE con monkeypatch: estos tests nunca golpean la API de Resend.

Usa el mismo client/tokens de conftest.py (schema aislado en Neon, sembrado con
backend/service/seed.py). Cada test crea gestores con correos unicos para no chocar
con otros tests de la suite.

Ejecutar con:  py -m pytest backend/tests_fastapi -v
"""
import uuid
from contextlib import contextmanager
from datetime import timedelta

import pytest
from sqlalchemy import select

from backend.service.core.rate_limit import reset_login_rate_limit
from backend.service.db.session import get_db
from backend.service.main import app
from backend.service.models.tables import InviteToken, Organization, User
from backend.service.services import email as email_service
from backend.service.services.auth import now_utc
from backend.tests_fastapi.test_parity import auth_header, hit, tokens  # noqa: F401

GOOD_PASSWORD = "clave-segura-123"


@pytest.fixture(autouse=True)
def _clean_rate_limit_state():
    # Varios tests loguean con contrasenas incorrectas a proposito.
    reset_login_rate_limit()
    yield
    reset_login_rate_limit()


@pytest.fixture
def sent_emails(monkeypatch):
    """Reemplaza el envio de correo y guarda cada llamada."""
    calls = []
    monkeypatch.setattr(email_service, "send_invite_email",
                        lambda to_email, to_name, invite_link: calls.append((to_email, to_name, invite_link)))
    return calls


@contextmanager
def schema_session():
    """Sesion sobre el schema de test (la misma que usa la app via dependency override)."""
    gen = app.dependency_overrides[get_db]()
    db = next(gen)
    try:
        yield db
        db.commit()
    finally:
        gen.close()


def new_gestor_payload(**overrides):
    payload = {
        "name": "Gestora de Prueba",
        "email": f"gestora-{uuid.uuid4().hex[:10]}@tejido-test.co",
        "organization_name": "Colectivo de Prueba",
        "branch": "MUSICA",
        "contact": "3001234567",
    }
    payload.update(overrides)
    return payload


def create_gestor(client, tokens, **overrides):
    payload = new_gestor_payload(**overrides)
    resp = hit(client, "admin", "create_gestor", "POST", "/api/admin/gestores",
               json=payload, headers=auth_header(tokens, "admin"))
    assert resp.status_code == 200, resp.text
    return payload, resp.json()


def token_from_link(link):
    return link.rsplit("/#invitacion/", 1)[1]


def login(client, email, password):
    return client.post("/api/auth/login", json={"email": email, "password": password})


# ───────────────────────── alta de gestores ─────────────────────────

def test_create_gestor_as_admin_sends_invite(client, tokens, sent_emails):
    payload, body = create_gestor(client, tokens, branch="danza")
    assert set(body) == {"user_id", "organization_id", "invite_link", "email_sent"}
    assert body["email_sent"] is True
    assert "/#invitacion/" in body["invite_link"]

    # El correo se "envio" una vez, al gestor, con el mismo link que devuelve la API.
    assert sent_emails == [(payload["email"], payload["name"], body["invite_link"])]

    with schema_session() as db:
        user = db.get(User, body["user_id"])
        assert user.active is False and user.role_id == 2
        org = db.get(Organization, body["organization_id"])
        assert (org.user_id, org.name, org.branch, org.contact) == (
            user.id, payload["organization_name"], "DANZA", payload["contact"])
        invites = db.execute(select(InviteToken).where(InviteToken.user_id == user.id)).scalars().all()
        assert len(invites) == 1 and invites[0].used_at is None
        assert invites[0].expires_at - now_utc() > timedelta(days=6)

    # Aparece en el listado como PENDIENTE, con su organizacion y rama.
    listed = client.get("/api/admin/gestores", headers=auth_header(tokens, "admin")).json()
    row = next(g for g in listed if g["id"] == body["user_id"])
    assert row["status"] == "PENDIENTE"
    assert (row["organization_name"], row["branch"], row["email"]) == (
        payload["organization_name"], "DANZA", payload["email"])

    # La cuenta no puede loguearse todavia (inactiva y sin contrasena conocida).
    assert login(client, payload["email"], GOOD_PASSWORD).status_code == 401


def test_gestor_endpoints_require_admin(client, tokens, sent_emails):
    for who in ("gestor", "ciudadano"):
        headers = auth_header(tokens, who)
        assert client.post("/api/admin/gestores", json=new_gestor_payload(), headers=headers).status_code == 403
        assert client.get("/api/admin/gestores", headers=headers).status_code == 403
        assert client.patch("/api/admin/gestores/2", json={"active": False}, headers=headers).status_code == 403
        assert client.post("/api/admin/gestores/2/resend-invite", headers=headers).status_code == 403
    assert client.post("/api/admin/gestores", json=new_gestor_payload()).status_code == 403
    assert client.get("/api/admin/gestores").status_code == 403
    assert sent_emails == []


def test_create_gestor_rejects_invalid_branch(client, tokens, sent_emails):
    resp = client.post("/api/admin/gestores", json=new_gestor_payload(branch="POLITICA"),
                       headers=auth_header(tokens, "admin"))
    assert resp.status_code == 400
    assert resp.json()["error"] == "VALIDATION"
    assert sent_emails == []


def test_create_gestor_rejects_duplicate_email(client, tokens, sent_emails):
    # Correo ya usado por una cuenta demo, sin importar mayusculas.
    resp = client.post("/api/admin/gestores", json=new_gestor_payload(email="GESTOR@tejido.co"),
                       headers=auth_header(tokens, "admin"))
    assert resp.status_code == 409
    assert resp.json()["error"] == "EMAIL_IN_USE"

    # Y el de un gestor recien creado por este mismo flujo.
    payload, _ = create_gestor(client, tokens)
    again = client.post("/api/admin/gestores", json=new_gestor_payload(email=payload["email"]),
                        headers=auth_header(tokens, "admin"))
    assert again.status_code == 409
    assert len(sent_emails) == 1


def test_create_gestor_survives_email_failure(client, tokens, monkeypatch):
    def boom(to_email, to_name, invite_link):
        raise RuntimeError("Resend caido / dominio sin verificar")

    monkeypatch.setattr(email_service, "send_invite_email", boom)
    payload, body = create_gestor(client, tokens)
    # El alta no falla: el usuario queda creado y el admin recibe el link de respaldo.
    assert body["email_sent"] is False
    assert "/#invitacion/" in body["invite_link"]
    with schema_session() as db:
        assert db.get(User, body["user_id"]).email == payload["email"]
    accepted = client.post("/api/auth/accept-invite",
                           json={"token": token_from_link(body["invite_link"]), "password": GOOD_PASSWORD})
    assert accepted.status_code == 200


# ───────────────────────── aceptar invitacion ─────────────────────────

def test_accept_invite_activates_and_allows_login(client, tokens, sent_emails):
    payload, body = create_gestor(client, tokens)
    token = token_from_link(body["invite_link"])

    resp = hit(client, "auth", "accept_invite", "POST", "/api/auth/accept-invite",
               json={"token": token, "password": GOOD_PASSWORD})
    assert resp.status_code == 200
    data = resp.json()
    # Mismo shape que /api/auth/login, y la sesion queda abierta.
    assert set(data) == {"token", "user"}
    assert data["user"] == {"id": body["user_id"], "name": payload["name"],
                            "email": payload["email"], "role": "GESTOR", "avatar_url": None}
    me = client.get("/api/me", headers={"Authorization": f"Bearer {data['token']}"}).json()
    assert me["user"]["id"] == body["user_id"]

    # Desde ahora es un gestor normal: login con la contrasena que eligio.
    logged = login(client, payload["email"], GOOD_PASSWORD)
    assert logged.status_code == 200
    assert logged.json()["user"]["role"] == "GESTOR"

    listed = client.get("/api/admin/gestores", headers=auth_header(tokens, "admin")).json()
    assert next(g for g in listed if g["id"] == body["user_id"])["status"] == "ACTIVO"


def test_accept_invite_rejects_used_token(client, tokens, sent_emails):
    _, body = create_gestor(client, tokens)
    token = token_from_link(body["invite_link"])
    assert client.post("/api/auth/accept-invite", json={"token": token, "password": GOOD_PASSWORD}).status_code == 200

    again = client.post("/api/auth/accept-invite", json={"token": token, "password": "otra-clave-999"})
    assert again.status_code == 400
    assert again.json()["error"] == "INVALID_TOKEN"


def test_accept_invite_rejects_expired_token(client, tokens, sent_emails):
    payload, body = create_gestor(client, tokens)
    token = token_from_link(body["invite_link"])
    with schema_session() as db:
        invite = db.execute(select(InviteToken).where(InviteToken.token == token)).scalar_one()
        invite.expires_at = now_utc() - timedelta(minutes=1)

    resp = client.post("/api/auth/accept-invite", json={"token": token, "password": GOOD_PASSWORD})
    assert resp.status_code == 400
    assert resp.json()["error"] == "INVALID_TOKEN"
    with schema_session() as db:
        assert db.get(User, body["user_id"]).active is False


def test_accept_invite_rejects_unknown_token_and_weak_password(client, tokens, sent_emails):
    unknown = client.post("/api/auth/accept-invite", json={"token": "no-existe", "password": GOOD_PASSWORD})
    assert unknown.status_code == 400 and unknown.json()["error"] == "INVALID_TOKEN"

    _, body = create_gestor(client, tokens)
    token = token_from_link(body["invite_link"])
    weak = client.post("/api/auth/accept-invite", json={"token": token, "password": "corta"})
    assert weak.status_code == 400 and weak.json()["error"] == "WEAK_PASSWORD"
    # La contrasena debil no consume el token.
    ok = client.post("/api/auth/accept-invite", json={"token": token, "password": GOOD_PASSWORD})
    assert ok.status_code == 200


# ───────────────────────── reenviar / editar / desactivar ─────────────────────────

def test_resend_invite_replaces_old_token(client, tokens, sent_emails):
    payload, body = create_gestor(client, tokens)
    old_token = token_from_link(body["invite_link"])

    resent = client.post(f"/api/admin/gestores/{body['user_id']}/resend-invite", headers=auth_header(tokens, "admin"))
    assert resent.status_code == 200
    new_link = resent.json()["invite_link"]
    assert token_from_link(new_link) != old_token
    assert sent_emails[-1] == (payload["email"], payload["name"], new_link)

    # El link viejo ya no sirve; el nuevo si.
    assert client.post("/api/auth/accept-invite", json={"token": old_token, "password": GOOD_PASSWORD}).status_code == 400
    assert client.post("/api/auth/accept-invite",
                       json={"token": token_from_link(new_link), "password": GOOD_PASSWORD}).status_code == 200

    # Con la cuenta ya activa, reenviar no tiene sentido.
    conflict = client.post(f"/api/admin/gestores/{body['user_id']}/resend-invite", headers=auth_header(tokens, "admin"))
    assert conflict.status_code == 409


def test_patch_gestor_edits_organization_and_toggles_active(client, tokens, sent_emails):
    payload, body = create_gestor(client, tokens)
    gid = body["user_id"]
    admin = auth_header(tokens, "admin")
    client.post("/api/auth/accept-invite",
                json={"token": token_from_link(body["invite_link"]), "password": GOOD_PASSWORD})

    edited = client.patch(f"/api/admin/gestores/{gid}", headers=admin,
                          json={"organization_name": "Nuevo Nombre", "branch": "teatro", "contact": ""})
    assert edited.status_code == 200
    with schema_session() as db:
        org = db.get(Organization, body["organization_id"])
        assert (org.name, org.branch, org.contact) == ("Nuevo Nombre", "TEATRO", None)

    bad = client.patch(f"/api/admin/gestores/{gid}", headers=admin, json={"branch": "NO_EXISTE"})
    assert bad.status_code == 400

    # Desactivar corta el login; reactivar lo devuelve.
    off = client.patch(f"/api/admin/gestores/{gid}", headers=admin, json={"active": False})
    assert off.status_code == 200 and off.json()["status"] == "PENDIENTE"
    assert login(client, payload["email"], GOOD_PASSWORD).status_code == 401
    on = client.patch(f"/api/admin/gestores/{gid}", headers=admin, json={"active": True})
    assert on.json()["status"] == "ACTIVO"
    assert login(client, payload["email"], GOOD_PASSWORD).status_code == 200

    # Solo aplica a gestores: el admin demo (id 1) no se puede editar por aqui.
    assert client.patch("/api/admin/gestores/1", headers=admin, json={"active": False}).status_code == 404


# ───────────────────────── seed: admins reales ─────────────────────────

def test_seed_creates_real_admins_with_invites_and_no_emails(client, tokens, monkeypatch):
    from backend.service.seed import seed_database

    calls = []
    monkeypatch.setattr(email_service, "send_invite_email", lambda *a, **k: calls.append(a))

    with schema_session() as db:
        admins = {u.id: u for u in db.execute(select(User).where(User.id.in_((4, 5, 6)))).scalars()}
        assert {i: (u.name, u.email, u.role_id, u.active) for i, u in admins.items()} == {
            4: ("Camilo", "bryan.giraldo.0906@gmail.com", 1, False),
            5: ("Santi", "moneystack999@gmail.com", 1, False),
            6: ("Daniel", "danielopg1008@gmail.com", 1, False),
        }
        before = {i.user_id: i.token for i in db.execute(
            select(InviteToken).where(InviteToken.user_id.in_((4, 5, 6)))).scalars()}
        assert set(before) == {4, 5, 6}
        for invite in db.execute(select(InviteToken).where(InviteToken.user_id.in_((4, 5, 6)))).scalars():
            assert invite.expires_at - now_utc() > timedelta(days=29)

        # Re-ejecutar el seed no manda correos ni reemplaza los links ya generados.
        seed_database(db)
        after = {i.user_id: i.token for i in db.execute(
            select(InviteToken).where(InviteToken.user_id.in_((4, 5, 6)))).scalars()}
        assert after == before
    assert calls == []

    # Los demo 1-3 siguen intactos y sin invitacion.
    with schema_session() as db:
        assert [u.email for u in db.execute(select(User).where(User.id.in_((1, 2, 3))).order_by(User.id)).scalars()] == [
            "admin@tejido.co", "gestor@tejido.co", "ciudadano@tejido.co"]


def test_stats_counts_active_gestores(client, tokens, sent_emails):
    """gestores_activos en /api/admin/stats: solo GESTOR con cuenta activa."""
    admin = auth_header(tokens, "admin")

    def count():
        resp = client.get("/api/admin/stats", headers=admin)
        assert resp.status_code == 200
        return resp.json()["gestores_activos"]

    before = count()
    assert before >= 1  # el gestor demo del seed
    _, created = create_gestor(client, tokens)
    assert count() == before  # pendiente: no cuenta
    token = token_from_link(created["invite_link"])
    assert client.post("/api/auth/accept-invite", json={"token": token, "password": GOOD_PASSWORD}).status_code == 200
    assert count() == before + 1
    client.patch(f"/api/admin/gestores/{created['user_id']}", json={"active": False}, headers=admin)
    assert count() == before
