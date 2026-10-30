"""
Registro publico de ciudadanos (POST /api/auth/signup): nombre y apellido, municipio opcional,
aceptacion de los terminos y correo sin verificar (con el correo de verificacion en segundo plano).

Usa el mismo client de conftest.py (schema aislado en Neon). Cada test registra correos unicos
para no chocar con otros tests de la suite. El limiter de registro vive en memoria
(core/rate_limit.py) y comparte almacenamiento con el de login, asi que se resetea antes y
despues de cada test. Ningun correo sale: services/email se reemplaza con monkeypatch.

Ejecutar con:  py -m pytest backend/tests_fastapi -v
"""
import uuid

import pytest
from sqlalchemy import text

from backend.service.core.rate_limit import reset_login_rate_limit
from backend.service.models.tables import User
from backend.service.schemas.users import TERMS_VERSION
from backend.service.services import email as email_service
from backend.tests_fastapi.test_gestores_invites import schema_session
from backend.tests_fastapi.test_parity import hit

GOOD_PASSWORD = "clave-segura-123"


def signup_payload(name, email, password=GOOD_PASSWORD, **extra):
    """Cuerpo valido del registro a partir de un nombre completo ("Ana Perez")."""
    first, _, last = str(name).strip().partition(" ")
    return {"first_name": first, "last_name": last or "Prueba", "email": email, "password": password,
            "accept_terms": True, **extra}


def mark_verified(user_id):
    with schema_session() as db:
        db.execute(text("UPDATE users SET email_verified_at = now() WHERE id = :id"), {"id": user_id})


@pytest.fixture(autouse=True)
def _clean_rate_limit_state():
    reset_login_rate_limit()
    yield
    reset_login_rate_limit()


@pytest.fixture
def mails(monkeypatch):
    sent = []
    monkeypatch.setattr(email_service, "send_gestor_notification",
                        lambda to_email, subject, text, html=None: sent.append({"to": to_email, "subject": subject, "text": text, "html": html}))
    return sent


def new_email():
    return f"ciudadana-{uuid.uuid4().hex[:10]}@tejido-test.co"


def test_signup_creates_unverified_citizen_and_logs_in(client, mails):
    email = new_email()
    resp = hit(client, "auth", "signup", "POST", "/api/auth/signup",
               json=signup_payload("  Ana   María ", email.upper(), municipality="Caceres", last_name="  Pérez  Gómez "))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    user = body["user"]
    assert user["role"] == "CIUDADANO" and user["email"] == email  # normalizado a minusculas
    assert user["first_name"] == "Ana" and user["last_name"] == "Pérez Gómez" and user["name"] == "Ana Pérez Gómez"
    assert user["municipality"] == "caceres" and user["email_verified"] is False
    assert body["token"]

    # La sesion devuelta ya sirve, igual que la de /api/auth/login, y trae los campos nuevos.
    me = client.get("/api/me", headers={"Authorization": f"Bearer {body['token']}"}).json()["user"]
    assert me["email"] == email and me["email_verified"] is False and me["municipality"] == "caceres"
    with schema_session() as db:
        row = db.get(User, user["id"])
        assert row.terms_accepted_at is not None and row.terms_version == TERMS_VERSION and row.email_verified_at is None

    # El correo de verificacion salio en segundo plano, con el enlace del router por hash.
    assert len(mails) == 1 and mails[0]["to"] == email and mails[0]["subject"] == "Verifica tu correo en TEJIDO"
    assert "#verificar?token=" in mails[0]["text"] and "Hola, Ana:" in mails[0]["text"]

    login = client.post("/api/auth/login", json={"email": email, "password": GOOD_PASSWORD})
    assert login.status_code == 200 and login.json()["user"]["email_verified"] is False


def test_signup_requires_accepting_the_terms(client, mails):
    email = new_email()
    for terms in (False, None):
        body = signup_payload("Sin Terminos", email)
        if terms is None:
            body.pop("accept_terms")
        else:
            body["accept_terms"] = terms
        resp = client.post("/api/auth/signup", json=body)
        assert resp.status_code == 422 and resp.json()["error"] == "TERMS_REQUIRED"
        assert "Términos y Condiciones" in resp.json()["message"]
    assert not mails
    assert client.post("/api/auth/signup", json=signup_payload("Con Terminos", email)).status_code == 200  # no quedo creada


def test_signup_validates_names_and_municipality(client):
    bad = [
        {"first_name": "  "}, {"first_name": "A"}, {"last_name": "B"}, {"first_name": "x" * 61},
        {"municipality": "medellin"}, {"email": "sin-arroba"},
    ]
    for override in bad:
        body = {**signup_payload("Ana Perez", new_email()), **override}
        resp = client.post("/api/auth/signup", json=body)
        assert resp.status_code == 400, override
    ok = client.post("/api/auth/signup", json=signup_payload("Ana Perez", new_email(), municipality=""))
    assert ok.status_code == 200 and ok.json()["user"]["municipality"] is None


def test_signup_rejects_duplicate_email(client):
    email = new_email()
    assert client.post("/api/auth/signup", json=signup_payload("Una Persona", email)).status_code == 200
    again = client.post("/api/auth/signup", json=signup_payload("Otra Persona", email.upper()))
    assert again.status_code == 409 and again.json()["error"] == "EMAIL_TAKEN"
    # Tambien choca con una cuenta sembrada (demo).
    seeded = client.post("/api/auth/signup", json=signup_payload("Demo Demo", "ciudadano@tejido.co"))
    assert seeded.status_code == 409


def test_signup_rejects_short_password(client):
    email = new_email()
    resp = client.post("/api/auth/signup", json=signup_payload("Corta Clave", email, password="corta"))
    assert resp.status_code == 400 and resp.json()["error"] == "WEAK_PASSWORD"
    # No quedo creada: el mismo correo se puede registrar despues con una clave valida.
    assert client.post("/api/auth/signup", json=signup_payload("Corta Clave", email)).status_code == 200


def test_signup_does_not_fail_if_the_email_cannot_be_sent(client, monkeypatch):
    def broken(*args, **kwargs):
        raise RuntimeError("Resend caido")
    monkeypatch.setattr(email_service, "send_gestor_notification", broken)
    resp = client.post("/api/auth/signup", json=signup_payload("Correo Caido", new_email()))
    assert resp.status_code == 200 and resp.json()["token"]


def test_signup_is_rate_limited_per_ip(client):
    for _ in range(5):
        resp = client.post("/api/auth/signup", json=signup_payload("Masiva Prueba", new_email()))
        assert resp.status_code == 200
    blocked = client.post("/api/auth/signup", json=signup_payload("Masiva Prueba", new_email()))
    assert blocked.status_code == 429 and blocked.json()["error"] == "TOO_MANY_ATTEMPTS"
    # El limite de registro no bloquea el login.
    login = client.post("/api/auth/login", json={"email": "ciudadano@tejido.co", "password": "Ciudadano123!"})
    assert login.status_code == 200
