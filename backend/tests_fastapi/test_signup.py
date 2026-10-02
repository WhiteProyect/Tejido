"""
Registro publico de ciudadanos (POST /api/auth/signup).

Usa el mismo client de conftest.py (schema aislado en Neon). Cada test registra
correos unicos para no chocar con otros tests de la suite. El limiter de registro
vive en memoria (core/rate_limit.py) y comparte almacenamiento con el de login,
asi que se resetea antes y despues de cada test.

Ejecutar con:  py -m pytest backend/tests_fastapi -v
"""
import uuid

import pytest

from backend.service.core.rate_limit import reset_login_rate_limit
from backend.tests_fastapi.test_parity import hit

GOOD_PASSWORD = "clave-segura-123"


@pytest.fixture(autouse=True)
def _clean_rate_limit_state():
    reset_login_rate_limit()
    yield
    reset_login_rate_limit()


def new_email():
    return f"ciudadana-{uuid.uuid4().hex[:10]}@tejido-test.co"


def test_signup_creates_active_citizen_and_logs_in(client):
    email = new_email()
    resp = hit(client, "auth", "signup", "POST", "/api/auth/signup",
               json={"name": "Ciudadana Nueva", "email": email.upper(), "password": GOOD_PASSWORD})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["user"]["role"] == "CIUDADANO"
    assert body["user"]["email"] == email  # normalizado a minusculas
    assert body["token"]

    # La sesion devuelta ya sirve, igual que la de /api/auth/login.
    me = client.get("/api/me", headers={"Authorization": f"Bearer {body['token']}"})
    assert me.json()["user"]["email"] == email

    # Y la cuenta queda activa: se puede loguear normalmente.
    login = client.post("/api/auth/login", json={"email": email, "password": GOOD_PASSWORD})
    assert login.status_code == 200
    assert login.json()["user"]["role"] == "CIUDADANO"


def test_signup_rejects_duplicate_email(client):
    email = new_email()
    first = client.post("/api/auth/signup", json={"name": "Una", "email": email, "password": GOOD_PASSWORD})
    assert first.status_code == 200

    again = client.post("/api/auth/signup",
                        json={"name": "Otra", "email": email.upper(), "password": GOOD_PASSWORD})
    assert again.status_code == 409
    assert again.json()["error"] == "EMAIL_TAKEN"

    # Tambien choca con una cuenta sembrada (demo).
    seeded = client.post("/api/auth/signup",
                         json={"name": "Demo", "email": "ciudadano@tejido.co", "password": GOOD_PASSWORD})
    assert seeded.status_code == 409


def test_signup_rejects_short_password(client):
    email = new_email()
    resp = client.post("/api/auth/signup", json={"name": "Corta", "email": email, "password": "corta"})
    assert resp.status_code == 400
    assert resp.json()["error"] == "WEAK_PASSWORD"

    # No quedo creada: el mismo correo se puede registrar despues con una clave valida.
    ok = client.post("/api/auth/signup", json={"name": "Corta", "email": email, "password": GOOD_PASSWORD})
    assert ok.status_code == 200


def test_signup_rejects_missing_name_and_bad_email(client):
    no_name = client.post("/api/auth/signup", json={"name": "  ", "email": new_email(), "password": GOOD_PASSWORD})
    assert no_name.status_code == 400
    bad_email = client.post("/api/auth/signup", json={"name": "X", "email": "sin-arroba", "password": GOOD_PASSWORD})
    assert bad_email.status_code == 400


def test_signup_is_rate_limited_per_ip(client):
    for _ in range(5):
        resp = client.post("/api/auth/signup", json={"name": "Masiva", "email": new_email(), "password": GOOD_PASSWORD})
        assert resp.status_code == 200
    blocked = client.post("/api/auth/signup", json={"name": "Masiva", "email": new_email(), "password": GOOD_PASSWORD})
    assert blocked.status_code == 429
    assert blocked.json()["error"] == "TOO_MANY_ATTEMPTS"

    # El limite de registro no bloquea el login.
    login = client.post("/api/auth/login", json={"email": "ciudadano@tejido.co", "password": "Ciudadano123!"})
    assert login.status_code == 200
