"""Bandeja del admin: mensajes de Nosotros (/api/admin/suggestions) y reportes de
publicaciones (/api/admin/reports).

Schema aislado del conftest. Otros tests tambien crean mensajes y reportes, asi que aqui se
comparan deltas y se buscan los ids propios, nunca totales absolutos.
"""
import uuid

import pytest

from backend.service.services.suggestions import split_message
from backend.tests_fastapi.test_gestor_category import body, category_ids  # noqa: F401
from backend.tests_fastapi.test_parity import auth_header, tokens  # noqa: F401

INBOX_GETS = ("/api/admin/suggestions", "/api/admin/reports")


@pytest.fixture
def admin(tokens):
    return auth_header(tokens, "admin")


def new_suggestion(client, message):
    resp = client.post("/api/suggestions", json={"message": message})
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def stats(client, admin):
    return client.get("/api/admin/stats", headers=admin).json()


def find(items, item_id):
    return next((item for item in items if item["id"] == item_id), None)


def published_publication(client, admin, category_ids, title="Para reportar"):
    resp = client.post("/api/publications", json=body(category_ids, f"{title} {uuid.uuid4().hex[:6]}", publish=True), headers=admin)
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def new_report(client, tokens, publication_id, reason="Contenido con datos equivocados"):
    resp = client.post(f"/api/publications/{publication_id}/report", json={"reason": reason},
                       headers=auth_header(tokens, "ciudadano"))
    assert resp.status_code == 201, resp.text


def report_ids_for(client, admin, publication_id, status="ALL"):
    items = client.get(f"/api/admin/reports?status={status}&limit=50", headers=admin).json()["items"]
    return [item["id"] for item in items if item["publication"]["id"] == publication_id]


# ─────────────────────────── permisos ───────────────────────────

@pytest.mark.parametrize("who", [None, "ciudadano", "gestor"])
def test_inbox_is_admin_only(client, tokens, who):
    headers = auth_header(tokens, who) if who else {}
    for url in INBOX_GETS:
        assert client.get(url, headers=headers).status_code == 403
    assert client.patch("/api/admin/suggestions/1", json={"status": "READ"}, headers=headers).status_code == 403
    assert client.patch("/api/admin/reports/1", json={"status": "RESOLVED"}, headers=headers).status_code == 403


# ─────────────────────────── mensajes ───────────────────────────

def test_split_message_reads_the_nosotros_header():
    assert split_message("Nombre: Ana\nContacto: ana@x.co\n\nHola equipo") == ("Ana", "ana@x.co", "Hola equipo")
    assert split_message("Contacto: 300 123 4567\n\nSolo contacto") == (None, "300 123 4567", "Solo contacto")
    assert split_message("Mensaje sin cabecera\nNombre: no es cabecera") == (None, None, "Mensaje sin cabecera\nNombre: no es cabecera")


def test_suggestions_filters_status_and_stats(client, admin):
    before = stats(client, admin)["suggestions"]
    first = new_suggestion(client, "Nombre: Lucia\nContacto: lucia@correo.co\n\nQuiero proponer un taller de bullerengue.")
    second = new_suggestion(client, "Un mensaje anonimo con mas de diez caracteres.")
    assert stats(client, admin)["suggestions"] == before + 2

    page = client.get("/api/admin/suggestions?status=NEW&limit=50", headers=admin).json()
    assert {"items", "total", "pending", "page", "limit"} <= set(page)
    assert page["pending"] == before + 2
    # Mas nuevo primero.
    ids = [item["id"] for item in page["items"]]
    assert ids.index(second) < ids.index(first)
    lucia = find(page["items"], first)
    assert (lucia["name"], lucia["contact"], lucia["text"], lucia["status"]) == (
        "Lucia", "lucia@correo.co", "Quiero proponer un taller de bullerengue.", "NEW")
    assert find(page["items"], second)["name"] is None

    read = client.patch(f"/api/admin/suggestions/{first}", json={"status": "READ"}, headers=admin)
    assert read.status_code == 200 and read.json()["status"] == "READ" and read.json()["reviewed_at"]
    assert client.patch(f"/api/admin/suggestions/{second}", json={"status": "ARCHIVED"}, headers=admin).status_code == 200
    assert stats(client, admin)["suggestions"] == before

    new_ids = [item["id"] for item in client.get("/api/admin/suggestions?status=NEW&limit=50", headers=admin).json()["items"]]
    assert first not in new_ids and second not in new_ids
    every = client.get("/api/admin/suggestions?status=ALL&limit=50", headers=admin).json()["items"]
    assert find(every, first)["status"] == "READ" and find(every, second)["status"] == "ARCHIVED"

    # Volver a NEW lo reabre y limpia la fecha de revision.
    back = client.patch(f"/api/admin/suggestions/{first}", json={"status": "NEW"}, headers=admin).json()
    assert back["status"] == "NEW" and back["reviewed_at"] is None
    assert stats(client, admin)["suggestions"] == before + 1


def test_suggestions_rejects_bad_values_and_paginates(client, admin):
    sid = new_suggestion(client, "Mensaje para probar estados invalidos.")
    for bad in ("DONE", "", "read"):
        assert client.patch(f"/api/admin/suggestions/{sid}", json={"status": bad}, headers=admin).status_code == 400
    assert client.patch("/api/admin/suggestions/999999999", json={"status": "READ"}, headers=admin).status_code == 404
    assert client.get("/api/admin/suggestions?status=OTRO", headers=admin).status_code == 400
    assert client.get("/api/admin/suggestions?limit=500", headers=admin).status_code == 400

    new_suggestion(client, "Otro mensaje para tener al menos dos.")
    one = client.get("/api/admin/suggestions?limit=1&page=1", headers=admin).json()
    two = client.get("/api/admin/suggestions?limit=1&page=2", headers=admin).json()
    assert len(one["items"]) == 1 and len(two["items"]) == 1 and one["total"] >= 2
    assert one["items"][0]["id"] != two["items"][0]["id"]


# ─────────────────────────── reportes ───────────────────────────

def test_reports_list_resolve_dismiss_and_stats(client, tokens, admin, category_ids):
    pub = published_publication(client, admin, category_ids)
    before = stats(client, admin)["reports"]
    new_report(client, tokens, pub, "Primer motivo del reporte")
    new_report(client, tokens, pub, "Segundo motivo del reporte")
    assert stats(client, admin)["reports"] == before + 2

    page = client.get("/api/admin/reports?status=OPEN&limit=50", headers=admin).json()
    assert page["pending"] == before + 2
    mine = [item for item in page["items"] if item["publication"]["id"] == pub]
    assert [item["reason"] for item in mine] == ["Segundo motivo del reporte", "Primer motivo del reporte"]
    item = mine[0]
    assert item["status"] == "OPEN" and item["reporter_name"] == "Sofia Ciudadana"
    assert {"id", "title", "status", "kind", "deleted"} == set(item["publication"])
    assert item["publication"]["status"] == "PUBLISHED" and item["publication"]["deleted"] is False

    second, first = (m["id"] for m in mine)
    resolved = client.patch(f"/api/admin/reports/{second}", json={"status": "RESOLVED", "note": "  Se corrigio la fecha  "}, headers=admin)
    assert resolved.status_code == 200
    assert resolved.json()["resolution_note"] == "Se corrigio la fecha" and resolved.json()["resolved_at"]
    assert client.patch(f"/api/admin/reports/{first}", json={"status": "DISMISSED"}, headers=admin).status_code == 200
    assert stats(client, admin)["reports"] == before
    # No se despublica nada automaticamente.
    assert client.get(f"/api/publications/{pub}").status_code == 200

    assert report_ids_for(client, admin, pub, "OPEN") == []
    assert report_ids_for(client, admin, pub, "RESOLVED") == [second]
    assert report_ids_for(client, admin, pub, "DISMISSED") == [first]

    reopened = client.patch(f"/api/admin/reports/{second}", json={"status": "OPEN"}, headers=admin).json()
    assert reopened["resolution_note"] is None and reopened["resolved_at"] is None
    assert stats(client, admin)["reports"] == before + 1


def test_reports_rejects_bad_values(client, tokens, admin, category_ids):
    pub = published_publication(client, admin, category_ids)
    new_report(client, tokens, pub)
    [rid] = report_ids_for(client, admin, pub)
    for bad in ({"status": "CLOSED"}, {"status": ""}, {"status": "RESOLVED", "note": "x" * 501}):
        assert client.patch(f"/api/admin/reports/{rid}", json=bad, headers=admin).status_code == 400
    assert client.patch(f"/api/admin/reports/{rid}", json={"status": "RESOLVED", "note": "x" * 500}, headers=admin).status_code == 200
    assert client.patch("/api/admin/reports/999999999", json={"status": "RESOLVED"}, headers=admin).status_code == 404
    assert client.get("/api/admin/reports?status=NEW", headers=admin).status_code == 400


def test_report_on_deleted_publication_still_lists(client, tokens, admin, category_ids):
    pub = published_publication(client, admin, category_ids, title="Se borrara")
    new_report(client, tokens, pub)
    assert client.delete(f"/api/publications/{pub}", headers=admin).status_code == 200

    resp = client.get("/api/admin/reports?status=OPEN&limit=50", headers=admin)
    assert resp.status_code == 200
    [item] = [i for i in resp.json()["items"] if i["publication"]["id"] == pub]
    assert item["publication"]["deleted"] is True and item["publication"]["title"].startswith("Se borrara")
    assert client.patch(f"/api/admin/reports/{item['id']}", json={"status": "RESOLVED"}, headers=admin).status_code == 200
