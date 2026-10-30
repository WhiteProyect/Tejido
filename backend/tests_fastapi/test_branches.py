"""Lider por rama, solicitudes de ingreso y moderacion por rama (services/branches.py).

Schema aislado del conftest. Los correos se reemplazan con monkeypatch (nunca Resend). Cada test
usa su propia rama y la deja sin lider al terminar; se evitan DANZA, MUSICA y EMPRENDIMIENTO_CULTURAL,
que otros tests esperan con un contenido concreto.
"""
import uuid

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError

from backend.service.models.tables import Organization, Publication, User
from backend.service.services import email as email_service
from backend.tests_fastapi.test_gestor_category import body, category_ids, new_gestor  # noqa: F401
from backend.tests_fastapi.test_gestores_invites import GOOD_PASSWORD, schema_session
from backend.tests_fastapi.test_parity import auth_header, tokens  # noqa: F401
from backend.tests_fastapi.test_signup import mark_verified, signup_payload


@pytest.fixture
def admin(tokens):
    return auth_header(tokens, "admin")


@pytest.fixture
def sent(monkeypatch):
    calls = {"team": [], "to": []}
    monkeypatch.setattr(email_service, "send_invite_email", lambda *a, **k: None)
    monkeypatch.setattr(email_service, "send_team_notification",
                        lambda subject, text, html=None, reply_to=None: calls["team"].append(subject))
    monkeypatch.setattr(email_service, "send_gestor_notification",
                        lambda to_email, subject, text, html=None: calls["to"].append((to_email, subject, text)))
    return calls


@pytest.fixture
def branch_cleanup(admin, client):
    used = []
    yield used
    for branch in used:
        client.delete(f"/api/admin/branches/{branch}/leader", headers=admin)


def citizen(client, name="Ciudadana", verified=True):
    """Ciudadano recien registrado. verified: su correo queda verificado (como tras abrir el enlace),
    para las acciones que lo exigen (guardar, pedir participar)."""
    email = f"rama-{uuid.uuid4().hex[:10]}@tejido-test.co"
    resp = client.post("/api/auth/signup", json=signup_payload(name, email))
    assert resp.status_code == 200, resp.text
    user = resp.json()["user"]
    if verified:
        mark_verified(user["id"])
        user = {**user, "email_verified": True}
    return user, {"Authorization": f"Bearer {resp.json()['token']}"}


def gestor(client, admin, branch, name):
    headers, created = new_gestor(client, admin, branch, name=name)
    with schema_session() as db:
        email = db.get(User, created["user_id"]).email
    return headers, created["user_id"], email


def leader(client, admin, branch, name="Lider"):
    headers, user_id, email = gestor(client, admin, branch, name)
    resp = client.put(f"/api/admin/branches/{branch}/leader", json={"gestor_id": user_id}, headers=admin)
    assert resp.status_code == 200, resp.text
    return headers, user_id, email


def join(client, admin, leader_headers, branch, name="Participante"):
    """Ciudadano que pide entrar y es aprobado: queda como participante de la rama."""
    user, headers = citizen(client, name)
    req = client.post("/api/branch-requests", json={"branch": branch, "message": "Quiero participar"}, headers=headers)
    assert req.status_code == 201, req.text
    approved = client.post(f"/api/branches/{branch}/requests/{req.json()['id']}/approve", headers=leader_headers or admin)
    assert approved.status_code == 200, approved.text
    return headers, user["id"], user["email"]


def publish_request(client, headers, category_ids, title, **extra):
    resp = client.post("/api/publications", json=body(category_ids, title, **extra), headers=headers)
    assert resp.status_code == 201, resp.text
    pub = resp.json()["id"]
    assert client.post(f"/api/publications/{pub}/submit", headers=headers).status_code == 200
    return pub


# ─────────────────────────── lider ───────────────────────────

def test_one_leader_per_branch(client, admin, sent, branch_cleanup):
    branch = "LITERATURA"
    branch_cleanup.append(branch)
    _, first, _ = gestor(client, admin, branch, "Primera")
    _, second, _ = gestor(client, admin, branch, "Segunda")
    _, outsider, _ = gestor(client, admin, "ARTES_VISUALES", "De otra rama")

    put = lambda gid: client.put(f"/api/admin/branches/{branch}/leader", json={"gestor_id": gid}, headers=admin)  # noqa: E731
    assert put(first).json()["changed"] is True
    assert put(first).json()["changed"] is False  # idempotente
    assert put(outsider).status_code == 409
    assert client.put("/api/admin/branches/RAP/leader", json={"gestor_id": first}, headers=admin).status_code == 404

    # La base no admite un segundo lider ni un lider sin rama.
    for statement in (f"UPDATE organizations SET is_leader = true WHERE user_id = {second}",
                      f"UPDATE organizations SET is_leader = true, branch = NULL WHERE user_id = {outsider}"):
        with pytest.raises(IntegrityError):
            with schema_session() as db:
                db.execute(text(statement))
                db.flush()

    # Cambiar de lider deja al anterior como participante.
    assert put(second).json() == {"branch": branch, "leader_id": second, "previous_leader_id": first, "changed": True}
    people = {p["id"]: p["is_leader"] for p in client.get(f"/api/branches/{branch}/participants", headers=admin).json()}
    assert people[first] is False and people[second] is True

    # Crear otro lider en la rama: 409. Cambiar de rama al lider: 409.
    dup = client.post("/api/admin/gestores", headers=admin, json={
        "name": "Otro", "email": f"x-{uuid.uuid4().hex[:8]}@tejido-test.co", "organization_name": "X", "branch": branch, "is_leader": True})
    assert dup.status_code == 409
    assert client.patch(f"/api/admin/gestores/{second}", json={"branch": "TEATRO"}, headers=admin).status_code == 409

    assert client.delete(f"/api/admin/branches/{branch}/leader", headers=admin).status_code == 200
    overview = {b["branch"]: b for b in client.get("/api/admin/branches", headers=admin).json()}
    assert len(overview) == 10 and overview[branch]["leader"] is None and overview[branch]["participants"] >= 2
    assert set(overview[branch]) == {"branch", "label", "leader", "participants", "pending_requests"}


# ─────────────────────────── flujo completo ───────────────────────────

def test_full_flow_request_approve_publish_moderate(client, admin, sent, category_ids, branch_cleanup):
    branch = "ARTESANIAS"
    branch_cleanup.append(branch)
    lead_h, lead_id, lead_email = leader(client, admin, branch, name="Zeta Lider")

    user, cit = citizen(client, "Ana Participante")
    req = client.post("/api/branch-requests", json={"branch": "artesanias", "message": "Tejo mochilas"}, headers=cit)
    assert req.status_code == 201 and req.json()["status"] == "PENDING" and req.json()["branch"] == branch
    assert sent["to"][-1][0] == lead_email and "Tejo mochilas" in sent["to"][-1][2]  # aviso al lider
    assert client.post("/api/branch-requests", json={"branch": branch}, headers=cit).status_code == 409  # una a la vez
    assert client.get("/api/me/branch-request", headers=cit).json()["status"] == "PENDING"

    pending = client.get(f"/api/branches/{branch}/requests", headers=lead_h).json()
    mine = next(r for r in pending if r["user_id"] == user["id"])
    assert mine["email"] == user["email"] and mine["message"] == "Tejo mochilas"
    assert client.post(f"/api/branches/{branch}/requests/{mine['id']}/approve", headers=lead_h).status_code == 200
    assert sent["to"][-1][0] == user["email"] and "Ya eres parte" in sent["to"][-1][1]

    me = client.get("/api/me", headers=cit).json()["user"]
    assert (me["role"], me["branch"], me["is_leader"]) == ("GESTOR", branch, False)
    with schema_session() as db:
        org = db.execute(select(Organization).where(Organization.user_id == user["id"])).scalars().one()
        assert (org.name, org.branch, org.is_leader, org.active) == ("Ana Participante", branch, False, True)

    # El participante envia a revision: le llega SOLO al lider.
    sent["team"].clear()
    pub = publish_request(client, cit, category_ids, "Mochilas del Bajo Cauca")
    assert sent["team"] == [] and sent["to"][-1][0] == lead_email and "Mochilas del Bajo Cauca" in sent["to"][-1][1]
    assert any(p["id"] == pub for p in client.get(f"/api/branches/{branch}/review-queue", headers=lead_h).json())
    assert client.get(f"/api/publications/{pub}", headers=lead_h).status_code == 200
    assert client.patch(f"/api/publications/{pub}/status", json={"status": "PUBLISHED", "note": ""}, headers=lead_h).status_code == 200
    assert sent["to"][-1][0] == user["email"] and "aprobada" in sent["to"][-1][1]

    # Lo del lider lo revisa el admin: el aviso va al equipo y el lider no se aprueba solo.
    own = publish_request(client, lead_h, category_ids, "Del lider")
    assert sent["team"][-1].endswith("Del lider")
    assert client.patch(f"/api/publications/{own}/status", json={"status": "PUBLISHED", "note": ""}, headers=lead_h).status_code == 403
    assert all(p["id"] != own for p in client.get(f"/api/branches/{branch}/review-queue", headers=lead_h).json())
    assert any(p["id"] == own for p in client.get(f"/api/branches/{branch}/review-queue", headers=admin).json())
    assert client.patch(f"/api/publications/{own}/status", json={"status": "PUBLISHED", "note": ""}, headers=admin).status_code == 200

    people = client.get(f"/api/branches/{branch}/participants", headers=lead_h).json()
    assert [p["id"] for p in people][:1] == [lead_id]  # el lider primero
    ana = next(p for p in people if p["id"] == user["id"])
    assert ana["published"] == 1 and ana["in_review"] == 0 and ana["joined_at"] and ana["organization"] == "Ana Participante"

    # /api/gestores publico: is_leader y el lider primero.
    public = client.get(f"/api/gestores?branch={branch}").json()
    assert public[0]["is_leader"] is True and all("email" not in g and "contact" not in g for g in public)
    assert client.get("/api/me", headers=lead_h).json()["user"]["is_leader"] is True
    assert client.get("/api/me", headers=admin).json()["user"]["branch"] is None


# ─────────────────────────── permisos ───────────────────────────

def test_permissions(client, tokens, admin, sent, category_ids, branch_cleanup):
    branch, other = "ARTESANIAS", "LITERATURA"
    branch_cleanup.extend([branch, other])
    lead_h, lead_id, _ = leader(client, admin, branch, "Lider A")
    other_h, other_id, _ = leader(client, admin, other, "Lider B")
    part_h, part_id, _ = join(client, admin, lead_h, branch, "Parti")
    user, cit = citizen(client, "Solicitante")
    req = client.post("/api/branch-requests", json={"branch": branch}, headers=cit).json()

    # Participante, ciudadano y anonimo no gestionan ramas.
    for headers in (part_h, cit, {}, auth_header(tokens, "gestor")):
        assert client.get(f"/api/branches/{branch}/requests", headers=headers).status_code == 403
        assert client.post(f"/api/branches/{branch}/requests/{req['id']}/approve", headers=headers).status_code == 403
        assert client.get(f"/api/branches/{branch}/review-queue", headers=headers).status_code == 403
    # Un lider no gestiona otra rama.
    assert client.get(f"/api/branches/{other}/participants", headers=lead_h).status_code == 403
    assert client.post(f"/api/branches/{other}/requests/{req['id']}/approve", headers=other_h).status_code == 404  # no es de su rama

    # Moderacion: participante no modera; el lider no modera lo de otro lider ni lo del admin.
    part_pub = publish_request(client, part_h, category_ids, "Del participante")
    assert client.patch(f"/api/publications/{part_pub}/status", json={"status": "PUBLISHED", "note": ""}, headers=part_h).status_code == 403
    assert client.patch(f"/api/publications/{part_pub}/status", json={"status": "PUBLISHED", "note": ""}, headers=other_h).status_code == 403
    other_pub = publish_request(client, other_h, category_ids, "Del otro lider")
    assert client.patch(f"/api/publications/{other_pub}/status", json={"status": "PUBLISHED", "note": ""}, headers=lead_h).status_code == 403
    admin_pub = publish_request(client, admin, category_ids, "Del admin en la rama", cultural_category=branch)
    assert client.patch(f"/api/publications/{admin_pub}/status", json={"status": "PUBLISHED", "note": ""}, headers=lead_h).status_code == 403
    assert client.get(f"/api/publications/{admin_pub}", headers=lead_h).status_code == 403
    assert client.get(f"/api/publications/{part_pub}", headers=other_h).status_code == 403
    # Un borrador del participante no lo ve el lider.
    draft = client.post("/api/publications", json=body(category_ids, "Borrador"), headers=part_h).json()["id"]
    assert client.get(f"/api/publications/{draft}", headers=lead_h).status_code == 403

    # Sacar: el lider no se saca a si mismo; nadie saca a un lider ni a un admin por aqui.
    assert client.delete(f"/api/branches/{branch}/participants/{lead_id}", headers=lead_h).status_code == 403
    assert client.delete(f"/api/branches/{branch}/participants/{lead_id}", headers=admin).status_code == 403
    assert client.delete(f"/api/branches/{branch}/participants/1", headers=lead_h).status_code == 404
    assert client.delete(f"/api/branches/{other}/participants/{other_id}", headers=lead_h).status_code == 403

    # El admin puede todo en cualquier rama.
    assert client.post(f"/api/branches/{branch}/requests/{req['id']}/reject", json={"note": "Ahora no"}, headers=admin).status_code == 200
    assert client.patch(f"/api/publications/{other_pub}/status", json={"status": "PUBLISHED", "note": ""}, headers=admin).status_code == 200
    assert client.patch(f"/api/publications/{part_pub}/status", json={"status": "REJECTED", "note": "Falta fecha"}, headers=admin).status_code == 200
    # Los admins de la plataforma no pasan por el lider (rol, no rama).
    assert client.get("/api/admin/branches", headers=lead_h).status_code == 403
    assert client.put(f"/api/admin/branches/{branch}/leader", json={"gestor_id": part_id}, headers=lead_h).status_code == 403


# ─────────────────────────── solicitudes ───────────────────────────

def test_requests_reject_cancel_and_rate_limit(client, tokens, admin, sent, branch_cleanup):
    branch = "CINE_AUDIOVISUAL"
    # Sin lider: el aviso va al equipo y el admin decide.
    user, cit = citizen(client, "Sin lider")
    req = client.post("/api/branch-requests", json={"branch": branch, "message": "<b>hola</b>"}, headers=cit)
    assert req.status_code == 201 and sent["team"][-1] == "Solicitud para participar en Cine y audiovisual"
    assert client.post(f"/api/branches/{branch}/requests/{req.json()['id']}/reject", json={"note": "x" * 301}, headers=admin).status_code == 400
    rejected = client.post(f"/api/branches/{branch}/requests/{req.json()['id']}/reject", json={"note": "Escríbenos en un mes"}, headers=admin)
    assert rejected.json() == {"id": req.json()["id"], "status": "REJECTED", "decision_note": "Escríbenos en un mes"}
    assert sent["to"][-1][0] == user["email"] and "Escríbenos en un mes" in sent["to"][-1][2]
    assert client.post(f"/api/branches/{branch}/requests/{req.json()['id']}/approve", headers=admin).status_code == 409
    assert client.get("/api/me/branch-request", headers=cit).json()["status"] == "REJECTED"

    # Rama invalida, mensaje largo, gestor que pide entrar, anonimo.
    assert client.post("/api/branch-requests", json={"branch": "RAP"}, headers=cit).status_code == 404
    assert client.post("/api/branch-requests", json={"branch": branch, "message": "x" * 501}, headers=cit).status_code == 400
    assert client.post("/api/branch-requests", json={"branch": branch}, headers=auth_header(tokens, "gestor")).status_code == 409
    assert client.post("/api/branch-requests", json={"branch": branch}).status_code == 401

    # Cancelar, y el limite de frecuencia: 5 intentos por hora por usuario. Ya cuentan 2 (la
    # primera solicitud y la de rama invalida; el mensaje largo lo frena la validacion antes).
    assert client.post("/api/branch-requests", json={"branch": branch}, headers=cit).status_code == 201  # 3
    assert client.delete("/api/me/branch-request", headers=cit).status_code == 200
    assert client.get("/api/me/branch-request", headers=cit).json()["status"] == "CANCELLED"
    assert client.delete("/api/me/branch-request", headers=cit).status_code == 404
    for _ in range(2):  # 4 y 5
        assert client.post("/api/branch-requests", json={"branch": branch}, headers=cit).status_code == 201
        client.delete("/api/me/branch-request", headers=cit)
    assert client.post("/api/branch-requests", json={"branch": branch}, headers=cit).status_code == 429

    # Sin lider, el admin aprueba y el participante envia a revision al equipo.
    _, other_cit = citizen(client, "Aprobado por admin")
    other = client.post("/api/branch-requests", json={"branch": branch}, headers=other_cit).json()
    assert client.post(f"/api/branches/{branch}/requests/{other['id']}/approve", headers=admin).status_code == 200
    assert client.get("/api/me", headers=other_cit).json()["user"]["branch"] == branch


def test_remove_participant(client, admin, sent, category_ids, branch_cleanup):
    branch = "ARTES_VISUALES"
    branch_cleanup.append(branch)
    lead_h, _, _ = leader(client, admin, branch, "Lider AV")
    part_h, part_id, _ = join(client, admin, lead_h, branch, "Saliente")

    published = publish_request(client, part_h, category_ids, "Publicada antes de salir")
    assert client.patch(f"/api/publications/{published}/status", json={"status": "PUBLISHED", "note": ""}, headers=lead_h).status_code == 200
    review = publish_request(client, part_h, category_ids, "En revision al salir")
    draft = client.post("/api/publications", json=body(category_ids, "Borrador al salir"), headers=part_h).json()["id"]
    sent["team"].clear()

    assert client.delete(f"/api/branches/{branch}/participants/{part_id}", headers=lead_h).status_code == 200
    assert client.get("/api/me", headers=part_h).json()["user"]["role"] == "CIUDADANO"
    with schema_session() as db:
        assert db.execute(select(Organization.active).where(Organization.user_id == part_id)).scalar_one() is False
        statuses = {p.id: p.status for p in db.execute(select(Publication).where(Publication.id.in_((published, review, draft)))).scalars()}
    assert statuses == {published: "PUBLISHED", review: "DRAFT", draft: "DRAFT"}
    assert client.get(f"/api/publications/{published}").status_code == 200
    assert client.delete(f"/api/branches/{branch}/participants/{part_id}", headers=lead_h).status_code == 404
    assert part_id not in {p["id"] for p in client.get(f"/api/branches/{branch}/participants", headers=lead_h).json()}

    # Puede volver a pedir entrar; al aprobarse se reactiva su organizacion.
    req = client.post("/api/branch-requests", json={"branch": branch}, headers=part_h)
    assert req.status_code == 201
    assert client.post(f"/api/branches/{branch}/requests/{req.json()['id']}/approve", headers=lead_h).status_code == 200
    with schema_session() as db:
        orgs = db.execute(select(Organization.active, Organization.branch).where(Organization.user_id == part_id)).all()
    assert [tuple(o) for o in orgs] == [(True, branch)]
