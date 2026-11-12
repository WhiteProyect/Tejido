"""Pulso personalizable del admin: preferencias (GET/PUT/DELETE /api/admin/preferences/pulso) y las
claves nuevas de GET /api/admin/stats. Schema aislado del conftest."""
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import text

from backend.service.models.tables import AdminPreference
from backend.service.services import admin_pulso
from backend.tests_fastapi.test_branches import admin, citizen, sent  # noqa: F401
from backend.tests_fastapi.test_gestores_invites import schema_session
from backend.tests_fastapi.test_parity import auth_header, tokens  # noqa: F401

URL = "/api/admin/preferences/pulso"
DEFAULT = ["publicadas", "en_revision", "gestores_activos", "usuarios_activos", "reportes", "mensajes", "solicitudes_ingreso",
           "revision_talento_artistas"]


def second_admin(client, admin):
    """Otro admin temporal con sesion: un ciudadano verificado al que el admin demo da el rol."""
    user, headers = citizen(client, f"Admin Dos {uuid.uuid4().hex[:4]}")
    assert client.post(f"/api/admin/users/{user['id']}/make-admin", headers=admin).status_code == 200
    return user, headers


def test_permissions(client, tokens):
    for who in ("gestor", "ciudadano"):
        headers = auth_header(tokens, who)
        assert client.get(URL, headers=headers).status_code == 403
        assert client.put(URL, json={"pulso": ["publicadas"]}, headers=headers).status_code == 403
        assert client.delete(URL, headers=headers).status_code == 403
    assert client.get(URL).status_code in (401, 403)


def test_get_put_delete_and_isolation(client, admin, sent):
    other, other_headers = second_admin(client, admin)
    try:
        client.delete(URL, headers=admin)
        first = client.get(URL, headers=admin).json()
        assert first["pulso"] == DEFAULT and first["is_default"] is True and first["max"] == 12
        assert set(first["catalog"]) == set(admin_pulso.CATALOG) and len(first["catalog"]) == 19
        mine = ["borradores", "publicadas", "eventos_proximos"]
        saved = client.put(URL, json={"pulso": mine}, headers=admin)
        assert saved.status_code == 200 and saved.json() == {**saved.json(), "pulso": mine, "is_default": False}
        assert client.get(URL, headers=admin).json()["pulso"] == mine
        # UPSERT: guardar otra vez reemplaza.
        assert client.put(URL, json={"pulso": ["mensajes"]}, headers=admin).json()["pulso"] == ["mensajes"]
        # Aislamiento: el otro admin sigue con el default y lo suyo no toca al primero.
        assert client.get(URL, headers=other_headers).json()["is_default"] is True
        assert client.put(URL, json={"pulso": ["reportes", "borradores"]}, headers=other_headers).status_code == 200
        assert client.get(URL, headers=admin).json()["pulso"] == ["mensajes"]
        assert client.get(URL, headers=other_headers).json()["pulso"] == ["reportes", "borradores"]
        # DELETE restablece (borra la fila).
        reset = client.delete(URL, headers=admin)
        assert reset.status_code == 200 and reset.json()["is_default"] is True and reset.json()["pulso"] == DEFAULT
        with schema_session() as db:
            assert db.get(AdminPreference, client.get("/api/me", headers=admin).json()["user"]["id"]) is None
    finally:
        client.delete(URL, headers=admin)


def test_put_validation(client, admin):
    cases = {
        "desconocida": ["publicadas", "no_existe"],
        "repetida": ["publicadas", "publicadas"],
        "vacia": [],
        "trece": list(admin_pulso.CATALOG)[:13],
        "no lista": "publicadas",
    }
    for name, value in cases.items():
        resp = client.put(URL, json={"pulso": value}, headers=admin)
        assert resp.status_code == 422, (name, resp.text)
    assert "al menos una" in client.put(URL, json={"pulso": []}, headers=admin).json()["message"]
    assert "máximo 12" in client.put(URL, json={"pulso": list(admin_pulso.CATALOG)[:13]}, headers=admin).json()["message"]
    assert client.put(URL, json={"pulso": list(admin_pulso.CATALOG)[:12]}, headers=admin).status_code == 200
    client.delete(URL, headers=admin)


def test_get_discards_retired_ids(client, admin):
    admin_id = client.get("/api/me", headers=admin).json()["user"]["id"]
    with schema_session() as db:
        db.execute(text("INSERT INTO admin_preferences (user_id, pulso) VALUES (:id, CAST(:p AS jsonb)) "
                        "ON CONFLICT (user_id) DO UPDATE SET pulso = EXCLUDED.pulso"), {"id": admin_id, "p": '["retirada", "mensajes", "mensajes"]'})
    assert client.get(URL, headers=admin).json() == {**client.get(URL, headers=admin).json(), "pulso": ["mensajes"], "is_default": False}
    with schema_session() as db:
        db.execute(text("UPDATE admin_preferences SET pulso = '[\"retirada\"]'::jsonb WHERE user_id = :id"), {"id": admin_id})
    assert client.get(URL, headers=admin).json()["is_default"] is True
    client.delete(URL, headers=admin)


def test_stats_keys(client, admin, sent):
    stats = client.get("/api/admin/stats", headers=admin)
    assert stats.status_code == 200
    body = stats.json()
    keys = {key for key in admin_pulso.CATALOG.values() if key}
    assert keys <= set(body), keys - set(body)
    # Las claves que ya existian conservan su nombre.
    assert {"published", "pending", "users", "gestores_activos", "reports", "suggestions", "join_requests", "talent_review", "artists_review"} <= set(body)
    assert all(isinstance(value, int) and value >= 0 for value in body.values())
    before = body["ciudadanos_nuevos_7d"]
    user, _ = citizen(client, "Recién Llegada")
    assert client.get("/api/admin/stats", headers=admin).json()["ciudadanos_nuevos_7d"] == before + 1
    with schema_session() as db:
        db.execute(text("UPDATE users SET created_at = :old WHERE id = :id"), {"old": datetime.now(timezone.utc) - timedelta(days=8), "id": user["id"]})
    after = client.get("/api/admin/stats", headers=admin).json()
    assert after["ciudadanos_nuevos_7d"] == before
    inactive_before = after["usuarios_inactivos_o_invitados"]
    client.patch(f"/api/admin/users/{user['id']}", json={"active": False}, headers=admin)
    assert client.get("/api/admin/stats", headers=admin).json()["usuarios_inactivos_o_invitados"] == inactive_before + 1
