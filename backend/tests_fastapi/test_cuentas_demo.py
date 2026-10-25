"""Retiro de las cuentas demo: scripts/eliminar_cuentas_demo.py, cuentas desactivadas y la guarda
del seed en produccion.

Schema aislado del conftest. Las cuentas demo las comparten los demas tests, asi que el borrado se
prueba con cuentas nuevas (la funcion del script recibe la lista de correos). El guard de "ningun
ADMIN activo" se prueba con admin@tejido.co: en el schema de test los admins 4-6 estan inactivos,
asi que el demo 1 es el unico y la operacion debe abortar sin cambios.
"""
import importlib.util
import uuid
from pathlib import Path

import pytest
from sqlalchemy import func, select, text

from backend.service.core.rate_limit import reset_login_rate_limit
from backend.service.models.tables import Artist, Organization, Publication, Report, Session_ as SessionRow, User
from backend.tests_fastapi.test_gestor_category import body, category_ids, no_email  # noqa: F401
from backend.tests_fastapi.test_gestores_invites import schema_session
from backend.tests_fastapi.test_parity import auth_header, tokens  # noqa: F401

PASSWORD = "clave-segura-123"
SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "eliminar_cuentas_demo.py"


@pytest.fixture(scope="module")
def script():
    spec = importlib.util.spec_from_file_location("eliminar_cuentas_demo", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture(autouse=True)
def _clean_rate_limit_state():
    reset_login_rate_limit()
    yield
    reset_login_rate_limit()


def gestor_with_published(client, tokens, category_ids):
    admin = auth_header(tokens, "admin")
    email = f"demo-{uuid.uuid4().hex[:10]}@tejido-test.co"
    created = client.post("/api/admin/gestores", headers=admin, json={
        "name": "Gestora Demo", "email": email, "organization_name": "Colectivo Demo", "branch": "TEATRO"})
    assert created.status_code == 200, created.text
    invite = created.json()["invite_link"].rsplit("/#invitacion/", 1)[1]
    accepted = client.post("/api/auth/accept-invite", json={"token": invite, "password": PASSWORD})
    assert accepted.status_code == 200, accepted.text
    headers = {"Authorization": f"Bearer {accepted.json()['token']}"}

    resp = client.post("/api/publications", json=body(category_ids, "Publicada por la cuenta demo"), headers=headers)
    assert resp.status_code == 201, resp.text
    pub = resp.json()["id"]
    assert client.post(f"/api/publications/{pub}/submit", headers=headers).status_code == 200
    approved = client.patch(f"/api/publications/{pub}/status", json={"status": "PUBLISHED", "note": ""}, headers=admin)
    assert approved.status_code == 200, approved.text
    return email, created.json()["user_id"], headers, pub


def test_delete_removes_accounts_and_publications_but_keeps_artist(client, tokens, category_ids, no_email, script):
    admin = auth_header(tokens, "admin")
    email, gestor_id, headers, pub = gestor_with_published(client, tokens, category_ids)
    artist = client.post("/api/artists", json={"stage_name": f"Artista {uuid.uuid4().hex[:6]}", "user_id": gestor_id,
                                               "bio": "Bio que no debe cambiar"}, headers=admin)
    assert artist.status_code == 201, artist.text
    artist_id = artist.json()["id"]
    assert client.post(f"/api/artists/{artist_id}/tracks", json={"title": "Cancion intacta"}, headers=admin).status_code == 201

    # Otra cuenta (que no se borra) guarda y reporta la publicacion demo.
    ciudadano = auth_header(tokens, "ciudadano")
    assert client.post(f"/api/publications/{pub}/favorite", headers=ciudadano).status_code in (200, 201)
    assert client.post(f"/api/publications/{pub}/report", json={"reason": "Reporte sobre la demo"}, headers=ciudadano).status_code == 201

    with schema_session() as db:
        [account] = script.find_accounts(db, [email])
        assert account["publications"] == ["Publicada por la cuenta demo"] and account["organizations"] == ["Colectivo Demo"]
        before = script.artist_snapshot(db, [artist_id])
        assert script.delete_accounts(db, [email]) == [gestor_id]

    with schema_session() as db:
        assert db.get(User, gestor_id) is None
        assert db.get(Publication, pub) is None
        assert db.scalar(select(func.count()).select_from(Report).where(Report.publication_id == pub)) == 0
        assert db.scalar(select(func.count()).select_from(Organization).where(Organization.user_id == gestor_id)) == 0
        assert db.scalar(select(func.count()).select_from(SessionRow).where(SessionRow.user_id == gestor_id)) == 0
        assert db.get(Artist, artist_id).user_id is None
        assert script.artist_snapshot(db, [artist_id]) == before
        # Repetir no falla: ya no hay nada que borrar.
        assert script.delete_accounts(db, [email]) == []

    assert client.post("/api/auth/login", json={"email": email, "password": PASSWORD}).status_code == 401
    assert client.get("/api/me", headers=headers).json()["user"] is None
    assert client.get(f"/api/publications/{pub}").status_code == 404
    # El resto de la plataforma sigue igual para quien guardo o reporto.
    assert client.get("/api/me", headers=ciudadano).json()["user"]["role"] == "CIUDADANO"


def test_delete_aborts_if_no_admin_would_remain(client, tokens, script):
    with schema_session() as db:
        assert db.scalars(select(User.id).where(User.role_id == 1, User.active.is_(True))).all() == [1]
        with pytest.raises(script.Abortado):
            script.delete_accounts(db, ["admin@tejido.co"])
        db.rollback()
    assert client.get("/api/me", headers=auth_header(tokens, "admin")).json()["user"]["id"] == 1


def test_script_targets_only_demo_accounts(script):
    assert script.DEMO_EMAILS == ("admin@tejido.co", "gestor@tejido.co", "ciudadano@tejido.co")


def test_inactive_account_is_locked_out_even_if_session_survives(client, tokens, category_ids, no_email):
    email, user_id, headers, pub = gestor_with_published(client, tokens, category_ids)
    with schema_session() as db:
        db.execute(text("UPDATE users SET active = FALSE WHERE id = :id"), {"id": user_id})
        assert db.scalar(select(SessionRow.token).where(SessionRow.user_id == user_id)) is not None
    assert client.post("/api/auth/login", json={"email": email, "password": PASSWORD}).status_code == 401
    assert client.get("/api/me", headers=headers).json()["user"] is None
    assert client.patch("/api/me", json={"name": "Otra"}, headers=headers).status_code == 401
    # Lo que ya publico sigue a la vista.
    assert pub in {p["id"] for p in client.get("/api/publications").json()}


def test_seed_refuses_production(monkeypatch):
    from backend.service.core.config import settings
    from backend.service.seed import seed_database

    monkeypatch.setattr(settings, "environment", "production")
    with pytest.raises(RuntimeError, match="production"):
        seed_database(None)
