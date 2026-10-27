"""Talento contratable (services/talent.py, api/routes/talent.py).

Schema aislado del conftest; los correos se reemplazan con monkeypatch (nunca Resend). Actores del
modulo: lider de TEATRO, participante de TEATRO, lider de CINE_AUDIOVISUAL, ciudadano y admin.
Al terminar, ambas ramas quedan sin lider. Cada test marca sus nombres con un token propio para
no depender de lo que crean los demas.
"""
import uuid
from datetime import datetime, timedelta

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from backend.service.schemas.talent import today_co
from backend.service.services import email as email_service
from backend.tests_fastapi.test_branches import citizen, join, leader, sent  # noqa: F401
from backend.tests_fastapi.test_gestores_invites import schema_session
from backend.tests_fastapi.test_parity import auth_header, tokens  # noqa: F401
from backend.tests_fastapi.test_uploads import configured  # noqa: F401

BRANCH = "TEATRO"
OTHER = "CINE_AUDIOVISUAL"
PUBLIC_CARD_KEYS = {"id", "slug", "name", "category", "category_label", "origin", "origin_label", "tagline", "cover_url",
                    "verified", "act_number", "tags", "price_from", "next_available", "favorite"}
LEAKS = ("created_by", "moderation_note", "representative_user_id", "status", "email", "user_id", "deleted")


class People:
    pass


@pytest.fixture(scope="module")
def people(client, tokens):
    p = People()
    p.admin = auth_header(tokens, "admin")
    p.admin_id = client.get("/api/me", headers=p.admin).json()["user"]["id"]
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(email_service, "send_invite_email", lambda *a, **k: None)
        mp.setattr(email_service, "send_team_notification", lambda *a, **k: None)
        mp.setattr(email_service, "send_gestor_notification", lambda *a, **k: None)
        p.leader, p.leader_id, p.leader_email = leader(client, p.admin, BRANCH, name="Lider Teatro")
        p.participant, p.participant_id, _ = join(client, p.admin, p.leader, BRANCH, name="Participante Teatro")
        p.other, p.other_id, _ = leader(client, p.admin, OTHER, name="Lider Cine")
        user, p.citizen = citizen(client, "Ciudadana Talento")
        p.citizen_id = user["id"]
    yield p
    for branch in (BRANCH, OTHER):
        client.delete(f"/api/admin/branches/{branch}/leader", headers=p.admin)


def tok():
    return uuid.uuid4().hex[:8]


def create(client, headers, name, expect=201, **extra):
    resp = client.post("/api/talent", json={"name": name, "origin": "caucasia", **extra}, headers=headers)
    assert resp.status_code == expect, resp.text
    return resp.json()


def ready(client, headers, talent_id):
    """Deja el perfil listo para enviar a revision (frase, portada y un servicio)."""
    assert client.patch(f"/api/talent/{talent_id}", json={"tagline": "Teatro para toda ocasión", "cover_url": "https://img.co/p.jpg"},
                        headers=headers).status_code == 200
    assert client.put(f"/api/talent/{talent_id}/services", json={"items": [{"title": "Función", "price": 400000}]},
                      headers=headers).status_code == 200


def status_of(client, people, talent_id):
    return client.get(f"/api/talent/manage/{talent_id}", headers=people.admin).json()["status"]


# ─────────────────────────── permisos ───────────────────────────

def test_permission_matrix(client, people, configured):
    name = f"Matriz {tok()}"
    body = {"name": name, "origin": "caucasia"}
    assert client.post("/api/talent", json=body).status_code == 401
    assert client.post("/api/talent", json=body, headers=people.citizen).status_code == 403
    assert client.post("/api/talent", json=body, headers=people.participant).status_code == 403
    # El lider crea en su rama (sin categoria se usa la suya); otra rama, 403.
    mine = create(client, people.leader, name)
    assert create(client, people.leader, name, expect=403, category=OTHER)["error"] == "FORBIDDEN"
    theirs = create(client, people.other, name)
    by_admin = create(client, people.admin, name, category="MUSICA")
    assert create(client, people.admin, name, expect=400)["message"] == "La categoría es requerida"

    detail = client.get(f"/api/talent/manage/{mine['id']}", headers=people.admin).json()
    assert detail["category"] == BRANCH and detail["status"] == "DRAFT"
    assert client.get(f"/api/talent/manage/{theirs['id']}", headers=people.admin).json()["category"] == OTHER

    # Listado de gestion: el lider solo ve su rama; el admin todo.
    assert client.get("/api/talent/manage").status_code == 401
    for outsider in (people.citizen, people.participant):
        assert client.get("/api/talent/manage", headers=outsider).status_code == 403
    leader_ids = {t["id"] for t in client.get("/api/talent/manage", params={"q": name}, headers=people.leader).json()["items"]}
    assert leader_ids == {mine["id"]}
    admin_ids = {t["id"] for t in client.get("/api/talent/manage", params={"q": name}, headers=people.admin).json()["items"]}
    assert admin_ids == {mine["id"], theirs["id"], by_admin["id"]}
    row = next(t for t in client.get("/api/talent/manage", params={"q": name}, headers=people.admin).json()["items"] if t["id"] == mine["id"])
    assert {"status", "moderation_note", "verified", "created_at"} <= set(row)

    # Lider de otra rama, participante y ciudadano no tocan el perfil de TEATRO.
    tid = mine["id"]
    for outsider in (people.other, people.participant, people.citizen):
        assert client.get(f"/api/talent/manage/{tid}", headers=outsider).status_code == 403
        assert client.patch(f"/api/talent/{tid}", json={"tagline": "x"}, headers=outsider).status_code == 403
        assert client.put(f"/api/talent/{tid}/services", json={"items": []}, headers=outsider).status_code == 403
        assert client.put(f"/api/talent/{tid}/availability", json={"from": str(today_co()), "to": str(today_co()), "days": []},
                          headers=outsider).status_code == 403
        assert client.post(f"/api/talent/{tid}/submit", headers=outsider).status_code == 403
        assert client.delete(f"/api/talent/{tid}", headers=outsider).status_code == 403
    assert client.patch(f"/api/talent/{tid}", json={"tagline": "x"}).status_code == 401
    # El admin no envia a revision (publica directo); solo el admin modera.
    assert client.post(f"/api/talent/{by_admin['id']}/submit", headers=people.admin).status_code == 403
    ready(client, people.leader, tid)
    assert client.post(f"/api/talent/{tid}/submit", headers=people.leader).status_code == 200
    for who in (people.leader, people.other, people.participant, people.citizen):
        assert client.patch(f"/api/talent/{tid}/status", json={"status": "PUBLISHED"}, headers=who).status_code == 403
    assert client.patch(f"/api/talent/{tid}/status", json={"status": "PUBLISHED"}).status_code == 401

    # Subida de fotos de talento: admin y lider; participante y ciudadano no.
    sign = lambda h: client.post("/api/uploads/sign", json={"scope": "talent"}, headers=h)  # noqa: E731
    for who in (people.admin, people.leader):
        resp = sign(who)
        assert resp.status_code == 200 and resp.json()["folder"] == "tejido/talento"
    for who in (people.participant, people.citizen):
        assert sign(who).status_code == 403
    for t in (tid, theirs["id"], by_admin["id"]):
        client.delete(f"/api/talent/{t}", headers=people.admin)


def test_admin_only_fields_and_branch_lock(client, people):
    tid = create(client, people.leader, f"Campos {tok()}")["id"]
    for field, value in (("slug", "otro-slug"), ("verified", True), ("act_number", "12"), ("act_date", "2026-01-10"),
                         ("featured", True), ("status", "PUBLISHED"), ("moderation_note", "x"), ("created_by", people.leader_id),
                         ("verified", None), ("publish", True)):
        resp = client.patch(f"/api/talent/{tid}", json={field: value}, headers=people.leader)
        assert resp.status_code == 403 and field in resp.json()["message"], (field, resp.text)
    assert create(client, people.leader, "Con sello", expect=403, verified=True, act_number="1")["error"] == "FORBIDDEN"
    assert client.patch(f"/api/talent/{tid}", json={"category": OTHER}, headers=people.leader).status_code == 403
    assert client.patch(f"/api/talent/{tid}", json={"category": BRANCH}, headers=people.leader).status_code == 200
    # Al admin, el estado no se le cambia por PATCH (va por publish, submit o /status).
    for field in ("status", "moderation_note", "created_by"):
        assert client.patch(f"/api/talent/{tid}", json={field: "PUBLISHED"}, headers=people.admin).status_code == 400
    for field in ("name", "origin", "category"):
        assert client.patch(f"/api/talent/{tid}", json={field: None}, headers=people.admin).status_code == 400
    resp = client.patch(f"/api/talent/{tid}", json={"featured": True, "category": OTHER}, headers=people.admin)
    assert resp.status_code == 200 and resp.json()["featured"] is True and resp.json()["category"] == OTHER
    # Ya es de otra rama: el lider de TEATRO pierde el acceso.
    assert client.get(f"/api/talent/manage/{tid}", headers=people.leader).status_code == 403
    client.delete(f"/api/talent/{tid}", headers=people.admin)


def test_representative_rules(client, people):
    tid = create(client, people.leader, f"Representante {tok()}", representative_user_id=people.leader_id)["id"]
    patch = lambda h, rep: client.patch(f"/api/talent/{tid}", json={"representative_user_id": rep}, headers=h)  # noqa: E731
    assert patch(people.leader, people.participant_id).status_code == 200
    assert patch(people.leader, people.other_id).status_code == 403  # lider de otra rama
    for bad in (people.citizen_id, people.admin_id, 999999):
        assert patch(people.leader, bad).status_code == 400
        assert patch(people.admin, bad).status_code == 400
    assert patch(people.admin, people.other_id).status_code == 200  # el admin: cualquier gestor activo
    resp = patch(people.admin, None)
    assert resp.status_code == 200 and resp.json()["representative"] is None
    assert create(client, people.leader, "Rep ajeno", expect=403, representative_user_id=people.other_id)["error"] == "FORBIDDEN"
    client.delete(f"/api/talent/{tid}", headers=people.admin)


# ─────────────────────────── estados y avisos ───────────────────────────

def test_state_machine_and_notices(client, people, sent):
    name = f"Ciclo {tok()}"
    tid = create(client, people.leader, name)["id"]
    slug = client.get(f"/api/talent/manage/{tid}", headers=people.leader).json()["slug"]

    missing = client.post(f"/api/talent/{tid}/submit", headers=people.leader)
    assert missing.status_code == 400
    for part in ("frase de presentación", "foto de portada", "al menos un servicio"):
        assert part in missing.json()["message"]
    ready(client, people.leader, tid)
    assert status_of(client, people, tid) == "DRAFT"

    sent["team"].clear()
    assert client.post(f"/api/talent/{tid}/submit", headers=people.leader).json()["status"] == "REVIEW"
    assert sent["team"] == [f"Talento en revisión: {name}"]
    # En revision el lider sigue editando (sin volver a avisar), pero no reenvia.
    resp = client.patch(f"/api/talent/{tid}", json={"tagline": "Otra"}, headers=people.leader)
    assert resp.status_code == 200 and resp.json()["status"] == "REVIEW"
    assert client.put(f"/api/talent/{tid}/specs", json={"items": []}, headers=people.leader).json()["status"] == "REVIEW"
    assert len(sent["team"]) == 1
    assert client.post(f"/api/talent/{tid}/submit", headers=people.leader).status_code == 409
    assert client.get(f"/api/talent/{slug}").status_code == 404

    moderate = lambda body: client.patch(f"/api/talent/{tid}/status", json=body, headers=people.admin)  # noqa: E731
    assert moderate({"status": "REJECTED", "note": "no"}).status_code == 400
    assert moderate({"status": "DRAFT"}).status_code == 400
    sent["to"].clear()
    assert moderate({"status": "REJECTED", "note": "Falta la portada real"}).json()["status"] == "REJECTED"
    to_email, subject, body = sent["to"][-1]
    assert to_email == people.leader_email and subject.startswith("El talento necesita ajustes") and "Falta la portada real" in body
    assert client.get(f"/api/talent/manage/{tid}", headers=people.leader).json()["moderation_note"] == "Falta la portada real"
    assert moderate({"status": "PUBLISHED"}).status_code == 409  # solo desde REVIEW

    # Editar una rechazada la deja en borrador sin nota; se reenvia y el admin aprueba.
    resp = client.patch(f"/api/talent/{tid}", json={"cover_url": "https://img.co/real.jpg"}, headers=people.leader)
    assert resp.json()["status"] == "DRAFT" and resp.json()["moderation_note"] is None
    assert client.post(f"/api/talent/{tid}/submit", headers=people.leader).status_code == 200
    approved = moderate({"status": "PUBLISHED"}).json()
    assert approved["status"] == "PUBLISHED" and approved["published_at"]
    assert sent["to"][-1][0] == people.leader_email and sent["to"][-1][1].startswith("Talento aprobado")
    assert client.get(f"/api/talent/{slug}").status_code == 200

    # El lider edita algo publicado: vuelve a revision, se oculta y avisa al equipo.
    sent["team"].clear()
    resp = client.put(f"/api/talent/{tid}/specs", json={"items": [{"label": "Duración", "value": "90 minutos"}]}, headers=people.leader)
    assert resp.json()["status"] == "REVIEW" and sent["team"] == [f"Talento en revisión: {name}"]
    assert client.get(f"/api/talent/{slug}").status_code == 404
    again = moderate({"status": "PUBLISHED"}).json()["published_at"]
    assert datetime.fromisoformat(again) == datetime.fromisoformat(approved["published_at"])  # la primera fecha se conserva

    # El admin edita sin cambiar el estado y sin avisos.
    sent["team"].clear()
    sent["to"].clear()
    resp = client.patch(f"/api/talent/{tid}", json={"tagline": "Ajuste del equipo"}, headers=people.admin)
    assert resp.json()["status"] == "PUBLISHED" and not sent["team"] and not sent["to"]
    client.delete(f"/api/talent/{tid}", headers=people.admin)


def test_leader_edits_published_by_sections_with_one_notice(client, people, sent):
    name = f"Secciones {tok()}"
    tid = create(client, people.leader, name)["id"]
    ready(client, people.leader, tid)
    assert client.post(f"/api/talent/{tid}/submit", headers=people.leader).status_code == 200
    assert client.patch(f"/api/talent/{tid}/status", json={"status": "PUBLISHED"}, headers=people.admin).status_code == 200

    # El editor guarda por secciones: la primera lo pasa a REVIEW, las demas siguen en REVIEW.
    sent["team"].clear()
    sections = [
        client.patch(f"/api/talent/{tid}", json={"tagline": "Nueva frase"}, headers=people.leader),
        client.put(f"/api/talent/{tid}/services", json={"items": [{"title": "Función", "price": 450000}]}, headers=people.leader),
        client.put(f"/api/talent/{tid}/specs", json={"items": [{"label": "Duración", "value": "1 hora"}]}, headers=people.leader),
        client.put(f"/api/talent/{tid}/media", json={"items": [{"type": "image", "url": "https://img.co/n.jpg"}]}, headers=people.leader),
        client.put(f"/api/talent/{tid}/milestones", json={"items": [{"year": 2020, "title": "Estreno"}]}, headers=people.leader),
        client.put(f"/api/talent/{tid}/endorsements", json={"items": [{"kind": "RECOGNITION", "title": "Premio"}]}, headers=people.leader),
        client.patch(f"/api/talent/{tid}", json={"description": "Otra descripción"}, headers=people.leader),
    ]
    assert [r.status_code for r in sections] == [200] * len(sections)
    assert status_of(client, people, tid) == "REVIEW"
    assert sent["team"] == [f"Talento en revisión: {name}"]  # un solo aviso
    detail = client.get(f"/api/talent/manage/{tid}", headers=people.leader).json()
    assert detail["tagline"] == "Nueva frase" and detail["description"] == "Otra descripción"
    assert [s["price"] for s in detail["services"]] == [450000] and detail["endorsements"][0]["title"] == "Premio"

    # En REVIEW el lider no publica ni modera; el admin aprueba los cambios.
    assert client.patch(f"/api/talent/{tid}", json={"publish": True}, headers=people.leader).status_code == 403
    assert client.patch(f"/api/talent/{tid}/status", json={"status": "PUBLISHED"}, headers=people.leader).status_code == 403
    assert client.patch(f"/api/talent/{tid}/status", json={"status": "PUBLISHED"}, headers=people.admin).status_code == 200
    assert client.get(f"/api/talent/manage/{tid}", headers=people.admin).json()["tagline"] == "Nueva frase"
    client.delete(f"/api/talent/{tid}", headers=people.admin)


def test_admin_publishes_directly_without_notices(client, people, sent):
    direct = create(client, people.admin, f"Directo {tok()}", category="MUSICA", publish=True)
    detail = client.get(f"/api/talent/manage/{direct['id']}", headers=people.admin).json()
    assert detail["status"] == "PUBLISHED" and detail["published_at"]
    later = create(client, people.admin, f"Despues {tok()}", category="MUSICA")
    assert status_of(client, people, later["id"]) == "DRAFT"
    resp = client.patch(f"/api/talent/{later['id']}", json={"publish": True}, headers=people.admin)
    assert resp.json()["status"] == "PUBLISHED" and resp.json()["published_at"]
    # Aprobar algo creado por el admin no le manda correo a nadie.
    with schema_session() as db:
        db.execute(text("UPDATE talent_profiles SET status = 'REVIEW' WHERE id = :id"), {"id": later["id"]})
    sent["to"].clear()
    assert client.patch(f"/api/talent/{later['id']}/status", json={"status": "PUBLISHED"}, headers=people.admin).status_code == 200
    assert not sent["to"]
    for t in (direct["id"], later["id"]):
        client.delete(f"/api/talent/{t}", headers=people.admin)


# ─────────────────────────── listado publico ───────────────────────────

def test_public_list_filters_facets_order_and_pagination(client, people):
    token = tok()
    today = today_co()
    a = create(client, people.admin, f"Zeta {token}", category=BRANCH, featured=True, publish=True, tagline="Comedia")["id"]
    b = create(client, people.admin, f"Yuca {token}", category="MUSICA", origin="caceres", verified=True, act_number="ACTA-7",
               publish=True, tagline=f"Tambora{token} y gaita")["id"]
    c = create(client, people.admin, f"Árbol {token}", category=BRANCH, origin="nechi", publish=True)["id"]
    draft = create(client, people.admin, f"Borrador {token}", category=BRANCH)["id"]
    gone = create(client, people.admin, f"Borrado {token}", category=BRANCH, publish=True)["id"]
    client.delete(f"/api/talent/{gone}", headers=people.admin)

    services = [{"title": "Boda", "tag": "Boda", "price": 500000}, {"title": "Fiesta", "tag": "Fiesta", "price": 300000},
                {"title": "Gira", "tag": "boda"}, {"title": "Show", "tag": "Show", "price": None}, {"title": "Extra", "tag": "Extra"}]
    assert client.put(f"/api/talent/{a}/services", json={"items": services}, headers=people.admin).status_code == 200
    days = [{"day": str(today + timedelta(days=d)), "state": s} for d, s in ((1, "BUSY"), (3, "AVAILABLE"), (10, "AVAILABLE"))]
    assert client.put(f"/api/talent/{a}/availability", json={"from": str(today), "to": str(today + timedelta(days=30)), "days": days},
                      headers=people.admin).status_code == 200
    busy = [{"day": str(today + timedelta(days=2)), "state": "BUSY"}]
    assert client.put(f"/api/talent/{c}/availability", json={"from": str(today), "to": str(today + timedelta(days=5)), "days": busy},
                      headers=people.admin).status_code == 200

    listing = lambda **params: client.get("/api/talent", params={"q": token, **params})  # noqa: E731
    everything = listing().json()
    assert [i["id"] for i in everything["items"]] == [a, b, c]  # destacado, verificado, nombre
    assert everything["total"] == 3
    card = everything["items"][0]
    assert set(card) == PUBLIC_CARD_KEYS
    assert card["tags"] == ["Boda", "Fiesta", "Show"] and card["price_from"] == 300000
    assert card["next_available"] == str(today + timedelta(days=3))
    assert card["category_label"] == "Teatro" and card["origin_label"] == "Caucasia"
    yuca = everything["items"][1]
    assert yuca["verified"] is True and yuca["act_number"] == "ACTA-7" and yuca["origin_label"] == "Cáceres"
    assert yuca["tags"] == [] and yuca["price_from"] is None and yuca["next_available"] is None

    # Las facetas se cuentan con los OTROS filtros.
    teatro = listing(category="teatro").json()
    assert [i["id"] for i in teatro["items"]] == [a, c] and teatro["total"] == 2
    assert teatro["facets"]["categories"][BRANCH] == 2 and teatro["facets"]["categories"]["MUSICA"] == 1
    assert teatro["facets"]["origins"] == {"caucasia": 1, "caceres": 0, "taraza": 0, "nechi": 1, "elbagre": 0, "zaragoza": 0}
    caceres = listing(origin="caceres").json()
    assert [i["id"] for i in caceres["items"]] == [b]
    assert caceres["facets"]["origins"]["caucasia"] == 1 and caceres["facets"]["categories"]["MUSICA"] == 1
    assert caceres["facets"]["categories"][BRANCH] == 0
    assert [i["id"] for i in listing(available=1).json()["items"]] == [a]

    # Busqueda sin tildes ni mayusculas, en nombre y frase.
    assert [i["id"] for i in client.get("/api/talent", params={"q": f"ARBOL {token}"}).json()["items"]] == [c]
    assert [i["id"] for i in client.get("/api/talent", params={"q": f"tambora{token.upper()}"}).json()["items"]] == [b]
    assert client.get("/api/talent", params={"q": f"%{token}"}).json()["total"] == 0  # % es literal

    page = listing(limit=1, offset=1).json()
    assert [i["id"] for i in page["items"]] == [b] and page["total"] == 3
    for bad in ({"limit": 61}, {"limit": 0}, {"offset": -1}, {"category": "RAP"}, {"origin": "medellin"}):
        assert client.get("/api/talent", params=bad).status_code == 400, bad
    assert client.get("/api/talent", params={"limit": 60}).status_code == 200
    for t in (a, b, c, draft):
        client.delete(f"/api/talent/{t}", headers=people.admin)


def test_public_profile_without_leaks(client, people):
    token = tok()
    today = today_co()
    main = create(client, people.leader, f"Perfil {token}", representative_user_id=people.leader_id)
    tid, slug = main["id"], main["slug"]
    assert client.get(f"/api/talent/{slug}").status_code == 404  # borrador
    ready(client, people.leader, tid)
    lists = {
        "specs": [{"label": "Integrantes", "value": "6"}],
        "media": [{"type": "image", "url": "https://img.co/1.jpg", "title": "Foto"},
                  {"type": "video", "url": "https://youtu.be/abc", "thumbnail_url": "https://img.co/v.jpg"}],
        "milestones": [{"year": 2019, "title": "Primer festival"}],
        "endorsements": [{"kind": "TESTIMONIAL", "title": "Alcaldía", "text": "Muy puntuales", "rating": 5},
                         {"kind": "RECOGNITION", "title": "Premio regional"}],
    }
    for key, items in lists.items():
        assert client.put(f"/api/talent/{tid}/{key}", json={"items": items}, headers=people.leader).status_code == 200
    days = [{"day": str(today + timedelta(days=d)), "state": "AVAILABLE"} for d in (10, 200)]
    assert client.put(f"/api/talent/{tid}/availability", json={"from": str(today), "to": str(today + timedelta(days=300)), "days": days},
                      headers=people.leader).status_code == 200
    assert client.post(f"/api/talent/{tid}/submit", headers=people.leader).status_code == 200
    assert client.patch(f"/api/talent/{tid}/status", json={"status": "PUBLISHED"}, headers=people.admin).status_code == 200
    similar = [create(client, people.admin, f"Similar {token} {n}", category=BRANCH, publish=True)["id"] for n in range(4)]
    other_branch = create(client, people.admin, f"Otra {token}", category="MUSICA", publish=True)["id"]

    resp = client.get(f"/api/talent/{slug.upper()}")
    assert resp.status_code == 200
    profile = resp.json()
    for leak in LEAKS:
        assert leak not in profile, leak
    assert people.leader_email not in resp.text
    assert profile["specs"] == lists["specs"]
    assert [m["type"] for m in profile["media"]] == ["image", "video"]
    assert profile["endorsements"][0]["rating"] == 5 and profile["endorsements"][1]["rating"] is None
    assert profile["milestones"][0]["year"] == 2019 and profile["price_from"] == 400000
    assert profile["availability"] == [{"day": str(today + timedelta(days=10)), "state": "AVAILABLE"}]  # solo 180 dias
    assert profile["next_available"] == str(today + timedelta(days=10))
    with schema_session() as db:
        org_slug = db.execute(text("SELECT slug FROM organizations WHERE user_id = :id"), {"id": people.leader_id}).scalar_one()
    assert profile["representative"] == {"name": "Lider Teatro Colectivo", "slug": org_slug}
    assert len(profile["similar"]) == 3 and tid not in {s["id"] for s in profile["similar"]}
    assert {s["id"] for s in profile["similar"]} <= set(similar) and other_branch not in {s["id"] for s in profile["similar"]}
    assert set(profile["similar"][0]) == PUBLIC_CARD_KEYS

    # Representante con el perfil oculto: no se muestra.
    assert client.patch(f"/api/admin/gestores/{people.leader_id}", json={"profile_hidden": True}, headers=people.admin).status_code == 200
    assert client.get(f"/api/talent/{slug}").json()["representative"] is None
    assert client.patch(f"/api/admin/gestores/{people.leader_id}", json={"profile_hidden": False}, headers=people.admin).status_code == 200

    assert client.get("/api/talent/no-existe-este-talento").status_code == 404
    for t in [tid, other_branch, *similar]:
        client.delete(f"/api/talent/{t}", headers=people.admin)
    assert client.get(f"/api/talent/{slug}").status_code == 404  # borrado


# ─────────────────────────── validaciones ───────────────────────────

def test_list_limits_and_validations(client, people):
    tid = create(client, people.leader, f"Limites {tok()}")["id"]
    put = lambda key, items: client.put(f"/api/talent/{tid}/{key}", json={"items": items}, headers=people.leader)  # noqa: E731
    year = today_co().year
    over = {
        "services": [{"title": f"S{n}"} for n in range(11)],
        "specs": [{"label": f"L{n}", "value": "v"} for n in range(13)],
        "media": [{"type": "image", "url": f"https://img.co/{n}.jpg"} for n in range(17)],
        "milestones": [{"year": 2020, "title": f"H{n}"} for n in range(13)],
        "endorsements": [{"kind": "RECOGNITION", "title": f"R{n}"} for n in range(9)],
    }
    for key, items in over.items():
        assert put(key, items).status_code == 400, key
        assert put(key, items[:-1]).status_code == 200, key
    bad_items = [
        ("services", {"title": "x", "price": -1}), ("services", {"title": "x", "price": 100_000_001}),
        ("services", {"title": "x", "price": "mucho"}), ("services", {"title": "x", "price": 10.5}),
        ("services", {"title": ""}), ("services", {"title": "x", "tag": "t" * 21}),
        ("services", {"title": "x", "description": "d" * 301}), ("services", {"title": "x", "price_note": "n" * 61}),
        ("specs", {"label": "l" * 61, "value": "v"}), ("specs", {"label": "l", "value": "v" * 201}),
        ("media", {"type": "video", "url": "http://youtu.be/x"}), ("media", {"type": "image", "url": "javascript:alert(1)"}),
        ("media", {"type": "audio", "url": "https://x.co/a.mp3"}), ("media", {"type": "image"}),
        ("media", {"type": "image", "url": "https://x.co/a.jpg", "caption": "c" * 151}),
        ("milestones", {"year": 1899, "title": "x"}), ("milestones", {"year": year + 2, "title": "x"}),
        ("milestones", {"year": 2000, "title": "x", "description": "d" * 401}),
        ("endorsements", {"kind": "RECOGNITION", "title": "x", "rating": 4}),
        ("endorsements", {"kind": "TESTIMONIAL", "title": "x", "rating": 6}),
        ("endorsements", {"kind": "RESEÑA", "title": "x"}), ("endorsements", {"kind": "TESTIMONIAL", "title": "x", "text": "t" * 401}),
    ]
    for key, item in bad_items:
        assert put(key, [item]).status_code == 400, (key, item)
    ok = put("services", [{"title": "Uno", "price": 0}, {"title": "Dos", "price": 100_000_000, "price_note": "por noche"}])
    assert [s["title"] for s in ok.json()["items"]] == ["Uno", "Dos"]
    assert put("media", [{"type": "image", "url": "/assets/foto.jpg"}]).status_code == 200
    assert put("milestones", [{"year": year + 1, "title": "Gira"}]).status_code == 200
    # Reemplazar es reemplazar, no agregar.
    assert [s["title"] for s in put("services", [{"title": "Solo"}]).json()["items"]] == ["Solo"]
    detail = client.get(f"/api/talent/manage/{tid}", headers=people.leader).json()
    assert [s["title"] for s in detail["services"]] == ["Solo"]

    for body in ({"name": "n" * 121}, {"tagline": "t" * 201}, {"description": "d" * 2001}, {"origin": "medellin"},
                 {"category": "RAP"}, {"cover_url": "javascript:alert(1)"}):
        assert client.patch(f"/api/talent/{tid}", json=body, headers=people.leader).status_code == 400, body
    assert client.post("/api/talent", json={"origin": "caucasia"}, headers=people.leader).status_code == 400
    assert client.post("/api/talent", json={"name": "Sin origen"}, headers=people.leader).status_code == 400
    client.delete(f"/api/talent/{tid}", headers=people.admin)


def test_availability_replaces_only_the_range(client, people):
    tid = create(client, people.leader, f"Agenda {tok()}")["id"]
    t = today_co()
    d = lambda n: str(t + timedelta(days=n))  # noqa: E731
    put = lambda start, end, days: client.put(f"/api/talent/{tid}/availability", headers=people.leader,  # noqa: E731
                                               json={"from": start, "to": end, "days": days})
    first = put(d(1), d(10), [{"day": d(1), "state": "AVAILABLE"}, {"day": d(5), "state": "BUSY"}, {"day": d(6), "state": "BUSY"}])
    assert first.status_code == 200 and len(first.json()["days"]) == 3
    second = put(d(5), d(6), [{"day": d(6), "state": "available"}])
    assert second.json()["days"] == [{"day": d(6), "state": "AVAILABLE"}]
    stored = client.get(f"/api/talent/manage/{tid}", headers=people.leader).json()["availability"]
    assert stored == [{"day": d(1), "state": "AVAILABLE"}, {"day": d(6), "state": "AVAILABLE"}]
    assert put(d(0), d(366), []).status_code == 200  # toda la ventana
    for start, end, days in (
        (d(-1), d(3), []), (d(1), d(367), []), (d(5), d(2), []),
        (d(1), d(3), [{"day": d(4), "state": "BUSY"}]),
        (d(1), d(3), [{"day": d(2), "state": "BUSY"}, {"day": d(2), "state": "AVAILABLE"}]),
        (d(1), d(3), [{"day": d(2), "state": "MAYBE"}]),
    ):
        assert put(start, end, days).status_code == 400, (start, end, days)

    # La agenda no cambia el estado: un perfil publicado sigue publicado.
    ready(client, people.leader, tid)
    assert client.post(f"/api/talent/{tid}/submit", headers=people.leader).status_code == 200
    assert put(d(1), d(2), [{"day": d(2), "state": "BUSY"}]).status_code == 200  # tambien en revision
    assert client.patch(f"/api/talent/{tid}/status", json={"status": "PUBLISHED"}, headers=people.admin).status_code == 200
    assert put(d(1), d(2), [{"day": d(1), "state": "AVAILABLE"}]).status_code == 200
    assert status_of(client, people, tid) == "PUBLISHED"
    client.delete(f"/api/talent/{tid}", headers=people.admin)


# ─────────────────────────── slug, sello y borrado ───────────────────────────

def test_slug_rules(client, people):
    token = tok()
    first = create(client, people.admin, f"Los Juglares {token}", category=BRANCH)
    assert first["slug"] == f"los-juglares-{token}"
    second = create(client, people.admin, f"Los  Juglares {token}!", category=BRANCH)
    assert second["slug"] == f"los-juglares-{token}-2"
    renamed = client.patch(f"/api/talent/{first['id']}", json={"name": "Otro nombre"}, headers=people.admin).json()
    assert renamed["slug"] == first["slug"]  # estable al renombrar
    numeric = create(client, people.admin, "2024", category=BRANCH)
    assert numeric["slug"].startswith("talento-2024")
    reserved = create(client, people.admin, "Manage", category=BRANCH)
    assert reserved["slug"] != "manage" and reserved["slug"].startswith("manage-")
    symbols = create(client, people.admin, "¡¡!!", category=BRANCH)
    assert symbols["slug"].startswith("talento")

    patch = lambda slug: client.patch(f"/api/talent/{first['id']}", json={"slug": slug}, headers=people.admin)  # noqa: E731
    for bad in ("123", "manage", "Mi Slug", "con_guion_bajo", "a" * 81):
        assert patch(bad).status_code == 400, bad
    assert patch(second["slug"].upper()).status_code == 409
    new_slug = f"juglares-{token}"
    assert patch(new_slug).json()["slug"] == new_slug
    # El slug de un perfil borrado sigue ocupado (los enlaces viejos no apuntan a otro).
    client.delete(f"/api/talent/{second['id']}", headers=people.admin)
    assert patch(second["slug"]).status_code == 409
    for t in (first, numeric, reserved, symbols):
        client.delete(f"/api/talent/{t['id']}", headers=people.admin)


def test_verified_requires_act_number(client, people):
    tid = create(client, people.admin, f"Sello {tok()}", category=BRANCH)["id"]
    patch = lambda body: client.patch(f"/api/talent/{tid}", json=body, headers=people.admin)  # noqa: E731
    assert patch({"verified": True}).status_code == 400
    assert create(client, people.admin, "Sin acta", expect=400, category=BRANCH, verified=True)["error"] == "VALIDATION"
    resp = patch({"verified": True, "act_number": "ACTA-2026-04", "act_date": "2026-03-01"})
    assert resp.status_code == 200 and resp.json()["verified"] is True and resp.json()["act_date"] == "2026-03-01"
    assert patch({"act_number": None}).status_code == 400
    assert patch({"act_number": "a" * 31}).status_code == 400
    assert patch({"verified": False, "act_number": None}).status_code == 200
    # La base tambien lo impide.
    with pytest.raises(IntegrityError):
        with schema_session() as db:
            db.execute(text("UPDATE talent_profiles SET verified = true, act_number = NULL WHERE id = :id"), {"id": tid})
            db.flush()
    client.delete(f"/api/talent/{tid}", headers=people.admin)


def test_soft_delete(client, people):
    token = tok()
    mine = create(client, people.leader, f"Borrar {token}")
    theirs = create(client, people.other, f"Borrar {token}")
    assert client.delete(f"/api/talent/{theirs['id']}", headers=people.leader).status_code == 403
    assert client.delete(f"/api/talent/{mine['id']}", headers=people.leader).status_code == 200
    assert client.get(f"/api/talent/manage/{mine['id']}", headers=people.leader).status_code == 404
    assert client.delete(f"/api/talent/{mine['id']}", headers=people.leader).status_code == 404
    assert client.patch(f"/api/talent/{mine['id']}", json={"tagline": "x"}, headers=people.admin).status_code == 404
    assert client.delete(f"/api/talent/{theirs['id']}", headers=people.admin).status_code == 200
    assert client.get("/api/talent/manage", params={"q": token}, headers=people.admin).json()["items"] == []
    with schema_session() as db:
        rows = db.execute(text("SELECT deleted FROM talent_profiles WHERE id IN (:a, :b)"), {"a": mine["id"], "b": theirs["id"]}).all()
    assert [r.deleted for r in rows] == [True, True]  # borrado suave: las filas siguen


# ─────────────────────────── lugares ───────────────────────────

def test_venues_limits_permissions_and_state(client, people, sent):
    tid = create(client, people.leader, f"Lugares {tok()}")["id"]
    put = lambda items, h=people.leader: client.put(f"/api/talent/{tid}/venues", json={"items": items}, headers=h)  # noqa: E731
    assert put([{"name": f"Lugar {n}"} for n in range(11)]).status_code == 400
    for bad in ({"name": ""}, {"name": "n" * 101}, {"name": "Plaza", "municipality": "medellin"}):
        assert put([bad]).status_code == 400, bad
    for outsider in (people.other, people.participant, people.citizen):
        assert put([{"name": "Plaza"}], outsider).status_code == 403
    assert put([{"name": "Plaza"}], None).status_code == 401
    items = [{"name": "Parque principal", "municipality": "Caucasia"}, {"name": "Coliseo", "municipality": ""}]
    resp = put(items)
    assert resp.status_code == 200 and resp.json()["items"] == [
        {"name": "Parque principal", "municipality": "caucasia"}, {"name": "Coliseo", "municipality": None}]
    assert put([{"name": f"Lugar {n}"} for n in range(10)]).status_code == 200
    assert put(items).status_code == 200
    assert client.get(f"/api/talent/manage/{tid}", headers=people.leader).json()["venues"][0]["name"] == "Parque principal"

    # Mismas reglas de estado: el lider que edita algo publicado lo devuelve a revision (un aviso).
    ready(client, people.leader, tid)
    assert client.post(f"/api/talent/{tid}/submit", headers=people.leader).status_code == 200
    assert client.patch(f"/api/talent/{tid}/status", json={"status": "PUBLISHED"}, headers=people.admin).status_code == 200
    slug = client.get(f"/api/talent/manage/{tid}", headers=people.admin).json()["slug"]
    assert [v["name"] for v in client.get(f"/api/talent/{slug}").json()["venues"]] == ["Parque principal", "Coliseo"]
    sent["team"].clear()
    assert put([{"name": "Casa de la Cultura", "municipality": "caucasia"}]).json()["status"] == "REVIEW"
    assert put([{"name": "Casa de la Cultura"}]).json()["status"] == "REVIEW"  # en revision sigue editando
    assert len(sent["team"]) == 1
    assert put([], people.admin).json()["status"] == "REVIEW"  # el admin no cambia el estado
    client.delete(f"/api/talent/{tid}", headers=people.admin)


# ─────────────────────────── guardar ───────────────────────────

def test_talent_favorites_only_for_citizens(client, people):
    token = tok()
    tid = create(client, people.admin, f"Guardable {token}", category=BRANCH, publish=True)["id"]
    slug = client.get(f"/api/talent/manage/{tid}", headers=people.admin).json()["slug"]
    draft = create(client, people.admin, f"Borrador {token}", category=BRANCH)["id"]
    gone = create(client, people.admin, f"Borrado {token}", category=BRANCH, publish=True)["id"]
    client.delete(f"/api/talent/{gone}", headers=people.admin)
    _, fan = citizen(client, "Fan del talento")

    fav = lambda method, t, h: client.request(method, f"/api/talent/{t}/favorite", headers=h)  # noqa: E731
    assert fav("POST", tid, None).status_code == 401
    assert fav("DELETE", tid, None).status_code == 401
    for who in (people.admin, people.leader, people.participant):
        assert fav("POST", tid, who).status_code == 403
        assert fav("DELETE", tid, who).status_code == 403
    for hidden in (draft, gone, 999999):
        assert fav("POST", hidden, fan).status_code == 404
    assert fav("POST", tid, fan).json() == {"favorite": True}
    assert fav("POST", tid, fan).status_code == 200  # idempotente
    with schema_session() as db:
        rows = db.execute(text("SELECT count(*) FROM talent_favorites WHERE talent_id = :id"), {"id": tid}).scalar_one()
    assert rows == 1

    flag = lambda h: client.get("/api/talent", params={"q": token}, headers=h or {}).json()["items"][0]["favorite"]  # noqa: E731
    assert flag(fan) is True and flag(people.citizen) is False and flag(None) is False and flag(people.admin) is False
    assert client.get(f"/api/talent/{slug}", headers=fan).json()["favorite"] is True
    assert client.get(f"/api/talent/{slug}").json()["favorite"] is False

    assert fav("DELETE", tid, fan).json() == {"favorite": False}
    assert fav("DELETE", tid, fan).status_code == 200  # idempotente
    assert client.get(f"/api/talent/{slug}", headers=fan).json()["favorite"] is False
    for t in (tid, draft):
        client.delete(f"/api/talent/{t}", headers=people.admin)


def test_publication_favorites_only_for_citizens(client, people):
    pub = client.get("/api/publications").json()[0]["id"]
    fav = lambda method, h: client.request(method, f"/api/publications/{pub}/favorite", headers=h)  # noqa: E731
    assert fav("POST", None).status_code == 401
    for who in (people.admin, people.leader, people.participant):
        assert fav("POST", who).status_code == 403
        assert fav("DELETE", who).status_code == 403
    _, fan = citizen(client, "Fan de publicaciones")
    assert fav("POST", fan).json() == {"favorite": True}
    assert next(p for p in client.get("/api/publications", headers=fan).json() if p["id"] == pub)["favorite"] is True
    assert fav("DELETE", fan).json() == {"favorite": False}


def test_my_saved(client, people):
    token = tok()
    _, fan = citizen(client, "Coleccionista")
    t1 = create(client, people.admin, f"Primero {token}", category=BRANCH, publish=True)["id"]
    t2 = create(client, people.admin, f"Segundo {token}", category="MUSICA", publish=True)["id"]
    pubs = [p["id"] for p in client.get("/api/publications").json()[:2]]
    for kind, target in (("talent", t1), ("publications", pubs[0]), ("talent", t2), ("publications", pubs[1])):
        assert client.post(f"/api/{kind}/{target}/favorite", headers=fan).status_code == 200

    saved = client.get("/api/me/saved", headers=fan).json()
    assert [t["id"] for t in saved["talent"]] == [t2, t1]  # el guardado mas reciente primero
    assert [p["id"] for p in saved["publications"]] == [pubs[1], pubs[0]]
    assert set(saved["talent"][0]) == PUBLIC_CARD_KEYS | {"saved_at"} and saved["talent"][0]["favorite"] is True
    listed = next(p for p in client.get("/api/publications", headers=fan).json() if p["id"] == pubs[0])
    assert set(saved["publications"][0]) == set(listed) | {"saved_at"}
    assert all(p["favorite"] is True for p in saved["publications"])
    assert saved["talent"][0]["saved_at"] > saved["talent"][1]["saved_at"]

    # Lo despublicado o borrado desaparece sin error.
    client.delete(f"/api/talent/{t1}", headers=people.admin)
    with schema_session() as db:
        db.execute(text("UPDATE publications SET status = 'REVIEW' WHERE id = :id"), {"id": pubs[0]})
    try:
        saved = client.get("/api/me/saved", headers=fan).json()
        assert [t["id"] for t in saved["talent"]] == [t2] and [p["id"] for p in saved["publications"]] == [pubs[1]]
    finally:
        with schema_session() as db:
            db.execute(text("UPDATE publications SET status = 'PUBLISHED' WHERE id = :id"), {"id": pubs[0]})

    assert client.get("/api/me/saved").status_code == 401
    for who in (people.admin, people.leader, people.participant):
        assert client.get("/api/me/saved", headers=who).status_code == 403
    _, empty = citizen(client, "Sin guardados")
    assert client.get("/api/me/saved", headers=empty).json() == {"publications": [], "talent": []}
    client.delete(f"/api/talent/{t2}", headers=people.admin)


def test_similar_prefers_same_origin(client, people):
    token = tok()
    main = create(client, people.admin, f"Origen {token}", category=BRANCH, origin="nechi", publish=True)
    # Sin el municipio, el orden publico pondria primero al destacado de Caucasia.
    far = create(client, people.admin, f"Lejos {token}", category=BRANCH, origin="caucasia", featured=True, publish=True)["id"]
    near = create(client, people.admin, f"Cerca {token}", category=BRANCH, origin="nechi", publish=True)["id"]
    similar = [s["id"] for s in client.get(f"/api/talent/{main['slug']}").json()["similar"]]
    assert similar.index(near) < similar.index(far)
    for t in (main["id"], far, near):
        client.delete(f"/api/talent/{t}", headers=people.admin)


def test_admin_stats_counts_talent_in_review(client, people):
    count = lambda: client.get("/api/admin/stats", headers=people.admin).json()["talent_review"]  # noqa: E731
    before = count()
    tid = create(client, people.leader, f"Pulso {tok()}")["id"]
    ready(client, people.leader, tid)
    assert count() == before  # un borrador no cuenta
    assert client.post(f"/api/talent/{tid}/submit", headers=people.leader).status_code == 200
    assert count() == before + 1
    assert client.patch(f"/api/talent/{tid}/status", json={"status": "PUBLISHED"}, headers=people.admin).status_code == 200
    assert count() == before
    assert client.patch(f"/api/talent/{tid}", json={"tagline": "Cambio"}, headers=people.leader).json()["status"] == "REVIEW"
    assert count() == before + 1
    client.delete(f"/api/talent/{tid}", headers=people.admin)
    assert count() == before  # lo archivado no cuenta
