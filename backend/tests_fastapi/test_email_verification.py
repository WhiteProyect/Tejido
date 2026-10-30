"""Verificacion de correo, "olvide mi contrasena" y el bloqueo de acciones sin verificar.

Schema aislado del conftest; ningun correo sale (services/email se reemplaza con monkeypatch y
de los correos capturados se leen los enlaces, como haria la persona). La migracion se prueba
aparte, en un schema temporal propio.
"""
import importlib.util
import re
import uuid
from datetime import timedelta
from pathlib import Path

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, text

from backend.service.core.config import settings
from backend.service.core.rate_limit import reset_login_rate_limit
from backend.service.models.tables import EmailToken, User
from backend.service.services import email as email_service
from backend.service.services.auth import now_utc
from backend.service.services.email_templates import build_reset_email, build_verify_email
from backend.service.services.email_tokens import hash_token
from backend.tests_fastapi.test_branches import admin, citizen, sent  # noqa: F401
from backend.tests_fastapi.test_gestor_category import new_gestor
from backend.tests_fastapi.test_gestores_invites import schema_session
from backend.tests_fastapi.test_parity import tokens  # noqa: F401
from backend.tests_fastapi.test_signup import GOOD_PASSWORD, signup_payload

LINK = re.compile(r"#(verificar|restablecer)\?token=([\w-]+)")


@pytest.fixture(autouse=True)
def _limits():
    reset_login_rate_limit()
    yield
    reset_login_rate_limit()


@pytest.fixture
def mails(monkeypatch):
    sent_mails = []
    monkeypatch.setattr(email_service, "send_gestor_notification",
                        lambda to_email, subject, text, html=None: sent_mails.append({"to": to_email, "subject": subject, "text": text, "html": html}))
    return sent_mails


def token_from(mail, kind):
    match = LINK.search(mail["text"])
    assert match and match.group(1) == kind, mail["text"]
    return match.group(2)


def register(client, name="Vera Correo"):
    email = f"verif-{uuid.uuid4().hex[:10]}@tejido-test.co"
    resp = client.post("/api/auth/signup", json=signup_payload(name, email))
    assert resp.status_code == 200, resp.text
    return resp.json()["user"], {"Authorization": f"Bearer {resp.json()['token']}"}, email


def me(client, headers):
    return client.get("/api/me", headers=headers).json()["user"]


# ─────────────────────────── verificar ───────────────────────────

def test_verify_ok_reused_and_invalid(client, mails):
    user, headers, _ = register(client)
    token = token_from(mails[-1], "verificar")
    with schema_session() as db:
        row = db.query(EmailToken).filter(EmailToken.user_id == user["id"]).one()
        assert row.token_hash == hash_token(token) and token not in row.token_hash  # solo el hash
    resp = client.post("/api/auth/verify-email", json={"token": token})
    assert resp.status_code == 200 and resp.json()["already_verified"] is False
    assert me(client, headers)["email_verified"] is True
    # Reusar el enlace no falla: el correo ya estaba verificado (idempotente).
    again = client.post("/api/auth/verify-email", json={"token": token})
    assert again.status_code == 200 and again.json()["already_verified"] is True
    for bad in ("no-existe", ""):
        resp = client.post("/api/auth/verify-email", json={"token": bad})
        assert resp.status_code == 400 and resp.json()["error"] == "INVALID_TOKEN"


def test_verify_expired_is_distinguished(client, mails):
    _, headers, _ = register(client)
    token = token_from(mails[-1], "verificar")
    with schema_session() as db:
        db.execute(text("UPDATE email_tokens SET expires_at = :past WHERE token_hash = :hash"),
                   {"past": now_utc() - timedelta(minutes=1), "hash": hash_token(token)})
    resp = client.post("/api/auth/verify-email", json={"token": token})
    assert resp.status_code == 400 and resp.json()["error"] == "TOKEN_EXPIRED" and "venció" in resp.json()["message"]
    assert me(client, headers)["email_verified"] is False
    # Un token de restablecer no sirve para verificar.
    assert client.post("/api/auth/verify-email", json={"token": "x" * 43}).json()["error"] == "INVALID_TOKEN"


def test_resend_verification_with_limits(client, mails):
    _, headers, email = register(client)
    first = token_from(mails[-1], "verificar")
    resp = client.post("/api/auth/resend-verification", headers=headers)
    assert resp.status_code == 200 and resp.json()["sent"] is True and mails[-1]["to"] == email
    second = token_from(mails[-1], "verificar")
    # El enlace anterior queda invalido (se borra al crear uno nuevo); el nuevo sirve.
    assert client.post("/api/auth/verify-email", json={"token": first}).json()["error"] == "INVALID_TOKEN"
    blocked = client.post("/api/auth/resend-verification", headers=headers)
    assert blocked.status_code == 429 and "minuto" in blocked.json()["message"]
    assert client.post("/api/auth/resend-verification").status_code == 401
    assert client.post("/api/auth/verify-email", json={"token": second}).status_code == 200
    reset_login_rate_limit()
    count = len(mails)
    done = client.post("/api/auth/resend-verification", headers=headers)
    assert done.status_code == 200 and done.json()["sent"] is False and len(mails) == count  # ya verificado: no envia


def test_resend_hourly_limit(client, mails, monkeypatch):
    from backend.service.core import rate_limit
    _, headers, _ = register(client)
    statuses = []
    for _ in range(6):
        # Salta la ventana de 60 s sin esperar: se limpia solo el contador corto.
        monkeypatch.setattr(rate_limit, "RESEND_VERIFY_SHORT", rate_limit.RateLimitItemPerMinute(100))
        statuses.append(client.post("/api/auth/resend-verification", headers=headers).status_code)
    assert statuses == [200] * 5 + [429]


# ─────────────────────────── olvide mi contrasena / restablecer ───────────────────────────

def test_forgot_password_same_answer_whether_or_not_the_account_exists(client, mails):
    _, _, email = register(client)
    mails.clear()
    exists = client.post("/api/auth/forgot-password", json={"email": email.upper()})
    missing = client.post("/api/auth/forgot-password", json={"email": f"nadie-{uuid.uuid4().hex[:6]}@tejido-test.co"})
    assert exists.status_code == missing.status_code == 200 and exists.json() == missing.json()
    assert len(mails) == 1 and mails[0]["to"] == email and mails[0]["subject"] == "Restablece tu contraseña de TEJIDO"
    # Cuenta inactiva: misma respuesta y ningun correo.
    with schema_session() as db:
        db.execute(text("UPDATE users SET active = false WHERE email = :email"), {"email": email})
    reset_login_rate_limit()
    assert client.post("/api/auth/forgot-password", json={"email": email}).json() == exists.json()
    assert len(mails) == 1
    # Limite por correo (3 por hora).
    reset_login_rate_limit()
    target = f"limite-{uuid.uuid4().hex[:6]}@tejido-test.co"
    codes = [client.post("/api/auth/forgot-password", json={"email": target}).status_code for _ in range(4)]
    assert codes == [200, 200, 200, 429]
    assert client.post("/api/auth/forgot-password", json={"email": "sin-arroba"}).status_code == 400


def test_reset_password_closes_sessions_and_verifies(client, mails):
    user, headers, email = register(client)
    other = client.post("/api/auth/login", json={"email": email, "password": GOOD_PASSWORD})
    other_headers = {"Authorization": f"Bearer {other.json()['token']}"}
    client.post("/api/auth/forgot-password", json={"email": email})
    token = token_from(mails[-1], "restablecer")
    weak = client.post("/api/auth/reset-password", json={"token": token, "password": "corta"})
    assert weak.status_code == 400 and weak.json()["error"] == "WEAK_PASSWORD"  # el token sigue sirviendo
    resp = client.post("/api/auth/reset-password", json={"token": token, "password": "otra-clave-segura"})
    assert resp.status_code == 200 and "token" not in resp.json()  # no abre sesion
    assert client.get("/api/me", headers=headers).json()["user"] is None
    assert client.get("/api/me", headers=other_headers).json()["user"] is None
    assert client.post("/api/auth/login", json={"email": email, "password": GOOD_PASSWORD}).status_code == 401
    login = client.post("/api/auth/login", json={"email": email, "password": "otra-clave-segura"})
    assert login.status_code == 200 and login.json()["user"]["email_verified"] is True  # recibir el correo lo prueba
    reused = client.post("/api/auth/reset-password", json={"token": token, "password": "tercera-clave-segura"})
    assert reused.status_code == 400 and reused.json()["error"] == "TOKEN_USED"
    assert user["id"]


def test_reset_password_expired_and_invalid(client, mails):
    _, _, email = register(client)
    client.post("/api/auth/forgot-password", json={"email": email})
    token = token_from(mails[-1], "restablecer")
    with schema_session() as db:
        db.execute(text("UPDATE email_tokens SET expires_at = :past WHERE token_hash = :hash"),
                   {"past": now_utc() - timedelta(seconds=1), "hash": hash_token(token)})
    expired = client.post("/api/auth/reset-password", json={"token": token, "password": "otra-clave-segura"})
    assert expired.status_code == 400 and expired.json()["error"] == "TOKEN_EXPIRED"
    invalid = client.post("/api/auth/reset-password", json={"token": "no-existe", "password": "otra-clave-segura"})
    assert invalid.status_code == 400 and invalid.json()["error"] == "INVALID_TOKEN"
    # Un enlace de verificar no sirve para restablecer.
    verify = token_from(mails[0], "verificar")
    assert client.post("/api/auth/reset-password", json={"token": verify, "password": "otra-clave-segura"}).json()["error"] == "INVALID_TOKEN"


# ─────────────────────────── bloqueo sin verificar ───────────────────────────

def test_unverified_citizen_is_blocked_only_on_writes(client, mails, admin):
    user, headers, _ = register(client, "Sin Verificar")
    pub = client.get("/api/publications").json()[0]["id"]
    blocked = [
        client.post(f"/api/publications/{pub}/favorite", headers=headers),
        client.delete(f"/api/publications/{pub}/favorite", headers=headers),
        client.post(f"/api/publications/{pub}/report", json={"reason": "Fecha equivocada"}, headers=headers),
        client.post("/api/branch-requests", json={"branch": "LITERATURA"}, headers=headers),
        client.post("/api/talent/999999/favorite", headers=headers),
        client.delete("/api/talent/999999/favorite", headers=headers),
    ]
    for resp in blocked:
        assert resp.status_code == 403 and resp.json()["error"] == "EMAIL_NOT_VERIFIED", resp.text
        assert resp.json()["message"] == "Verifica tu correo para usar esta función"
    # Leer, ver y editar el perfil no se bloquean.
    assert client.get("/api/publications", headers=headers).status_code == 200
    assert client.get("/api/me/saved", headers=headers).status_code == 200
    edit = client.patch("/api/me", json={"first_name": "Vera", "last_name": "Nueva", "municipality": "taraza"}, headers=headers)
    assert edit.status_code == 200 and edit.json()["user"]["name"] == "Vera Nueva" and edit.json()["user"]["municipality"] == "taraza"
    # Verificado: las mismas acciones pasan.
    client.post("/api/auth/verify-email", json={"token": token_from(mails[0], "verificar")})
    assert client.post(f"/api/publications/{pub}/favorite", headers=headers).status_code == 200
    assert client.delete(f"/api/publications/{pub}/favorite", headers=headers).status_code == 200
    assert client.post("/api/talent/999999/favorite", headers=headers).status_code == 404  # pasa el bloqueo: no existe
    assert user["email_verified"] is False


def test_require_verified_uses_the_column_not_the_role(client, admin, tokens):
    # Un admin sin email_verified_at (caso que no se da en la practica) tambien queda fuera de lo que
    # exige verificacion: se compara contra la columna, no contra el rol.
    from backend.tests_fastapi.test_parity import auth_header
    citizen_headers = auth_header(tokens, "ciudadano")
    pub = client.get("/api/publications").json()[0]["id"]
    with schema_session() as db:
        db.execute(text("UPDATE users SET email_verified_at = NULL WHERE email = 'ciudadano@tejido.co'"))
    try:
        assert client.post(f"/api/publications/{pub}/favorite", headers=citizen_headers).json()["error"] == "EMAIL_NOT_VERIFIED"
    finally:
        with schema_session() as db:
            db.execute(text("UPDATE users SET email_verified_at = now() WHERE email = 'ciudadano@tejido.co'"))
    assert client.post(f"/api/publications/{pub}/favorite", headers=citizen_headers).status_code == 200
    client.delete(f"/api/publications/{pub}/favorite", headers=citizen_headers)


def test_accept_invite_verifies_the_email(client, admin, sent):
    headers, created = new_gestor(client, admin, "ARTES_VISUALES", name="Invitada Verificada")
    assert client.get("/api/me", headers=headers).json()["user"]["email_verified"] is True
    with schema_session() as db:
        assert db.get(User, created["user_id"]).email_verified_at is not None


def test_patch_me_cannot_touch_email_or_verification(client):
    user, headers, email = register(client, "Clara Campos")
    resp = client.patch("/api/me", json={"email": "otro@tejido-test.co", "email_verified": True, "email_verified_at": "2026-01-01"}, headers=headers)
    assert resp.status_code == 200 and resp.json()["user"]["email"] == email and resp.json()["user"]["email_verified"] is False
    for bad in ({"first_name": "A"}, {"municipality": "medellin"}):
        assert client.patch("/api/me", json=bad, headers=headers).status_code == 400


# ─────────────────────────── correos ───────────────────────────

def test_account_emails_escape_user_text_and_have_the_link():
    evil = "<script>alert(1)</script>"
    for build, link, button in ((build_verify_email, "https://tejido.co/#verificar?token=abc", "Confirmar mi correo"),
                                (build_reset_email, "https://tejido.co/#restablecer?token=abc", "Restablecer mi contraseña")):
        subject, html, plain = build(evil, link)
        assert "TEJIDO" in subject and button in html and f'href="{link}"' in html and link in plain
        assert "<script" not in html and "&lt;script&gt;" in html and "gradient" not in html and "<img" not in html


# ─────────────────────────── migracion ───────────────────────────

def test_migration_marks_existing_accounts_verified_and_is_reversible():
    path = Path(__file__).resolve().parents[1] / "alembic" / "versions" / "b3d9f2a6c8e4_registro_y_verificacion_de_correo.py"
    spec = importlib.util.spec_from_file_location("migracion_verificacion", path)
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
            # La tabla users como estaba antes de esta migracion (lo que toca la migracion).
            conn.execute(text("CREATE TABLE users (id serial PRIMARY KEY, name varchar NOT NULL, created_at timestamptz NOT NULL)"))
            conn.execute(text("INSERT INTO users (name, created_at) VALUES ('Antigua', '2026-09-01T10:00:00+00:00')"))
            with Operations.context(MigrationContext.configure(conn)):
                migration.upgrade()
            row = conn.execute(text("SELECT email_verified_at, created_at, first_name, terms_version FROM users")).one()
            assert row.email_verified_at == row.created_at and row.first_name is None and row.terms_version is None
            assert conn.execute(text("SELECT count(*) FROM email_tokens")).scalar_one() == 0
            with Operations.context(MigrationContext.configure(conn)):
                migration.downgrade()
            columns = {r[0] for r in conn.execute(text(
                "SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'users'"))}
            assert columns == {"id", "name", "created_at"}
            assert conn.execute(text("SELECT to_regclass('email_tokens')")).scalar_one() is None
    finally:
        engine.dispose()
        with admin_engine.begin() as conn:
            conn.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
        admin_engine.dispose()
