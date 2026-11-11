"""Busqueda de usuarios del admin (GET /api/admin/users) y conversion de un ciudadano en gestor lider
(POST /api/admin/branches/{rama}/leader/promote). Schema aislado del conftest; correos con monkeypatch."""
import uuid

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError

from backend.service.models.tables import BranchJoinRequest, Organization, Role, User
from backend.service.services import branches as branch_service
from backend.tests_fastapi.test_branches import admin, branch_cleanup, citizen, leader, sent  # noqa: F401
from backend.tests_fastapi.test_gestor_category import new_gestor
from backend.tests_fastapi.test_gestores_invites import schema_session
from backend.tests_fastapi.test_parity import auth_header, tokens  # noqa: F401

BRANCH = "GASTRONOMIA_CULTURAL"
OTHER = "ARTESANIAS"


def leader_notices(sent):
    """Avisos "te nombraron lider" capturados (sin los correos de verificacion del registro)."""
    return [to for to, subject, _ in sent["to"] if "líder" in subject.lower()]


def promote(client, admin, user_id, branch=BRANCH, **extra):
    return client.post(f"/api/admin/branches/{branch}/leader/promote", json={"user_id": user_id, **extra}, headers=admin)


def role_of(user_id):
    with schema_session() as db:
        return db.execute(select(Role.name).join(User, User.role_id == Role.id).where(User.id == user_id)).scalar_one()


def org_of(user_id):
    with schema_session() as db:
        org = db.execute(select(Organization).where(Organization.user_id == user_id).order_by(Organization.id)).scalars().first()
        return None if org is None else {"id": org.id, "name": org.name, "branch": org.branch, "is_leader": org.is_leader, "active": org.active, "slug": org.slug}


# ─────────────────────────── busqueda ───────────────────────────

def test_search_users_permissions_and_validation(client, tokens, admin):
    # GET /api/admin/users ahora es el listado de la pestaña Usuarios: q es opcional (si viene, >= 2), role
    # admite los 3 roles y el tamaño va en page_size; responde {items, total, page, page_size, counts}.
    for who in ("gestor", "ciudadano"):
        assert client.get("/api/admin/users?q=ciu", headers=auth_header(tokens, who)).status_code == 403
    assert client.get("/api/admin/users?q=ciu").status_code in (401, 403)
    short = client.get("/api/admin/users?q=a", headers=admin)
    assert short.status_code == 422 and "al menos 2" in short.json()["message"]
    assert client.get("/api/admin/users", headers=admin).status_code == 200
    assert client.get("/api/admin/users?q=ciu&role=OTRO", headers=admin).status_code == 422
    assert client.get("/api/admin/users?q=ciu&page_size=0", headers=admin).status_code == 422


def test_search_users_results(client, admin):
    tag = uuid.uuid4().hex[:6]
    found, _ = citizen(client, f"Zorayda {tag} Pérez")
    unverified, _ = citizen(client, f"Zorayda {tag} Sinverificar", verified=False)
    inactive, _ = citizen(client, f"Zorayda {tag} Inactiva")
    literal, _ = citizen(client, f"Zorayda {tag} 100%_real")
    with schema_session() as db:
        db.execute(text("UPDATE users SET active = false WHERE id = :id"), {"id": inactive["id"]})
    base = "/api/admin/users?role=CIUDADANO&status=ACTIVO"
    resp = client.get(f"{base}&q=ZORAYDA {tag}", headers=admin)
    assert resp.status_code == 200, resp.text
    rows = resp.json()["items"]
    ids = [r["id"] for r in rows]
    assert set(ids) == {found["id"], unverified["id"], literal["id"]}  # sin el inactivo; sin distinguir mayusculas
    assert ids == sorted(ids, reverse=True)  # alta mas reciente primero
    assert {"password_hash", "token"}.isdisjoint(rows[0]) and {"id", "name", "email", "municipality", "email_verified", "created_at"} <= set(rows[0])
    assert {r["id"]: r["email_verified"] for r in rows}[unverified["id"]] is False
    # Por correo, y comodines escapados: "%" y "_" son literales.
    by_email = client.get(f"{base}&q={found['email'][:12]}", headers=admin).json()["items"]
    assert found["id"] in [r["id"] for r in by_email]
    assert [r["id"] for r in client.get(f"{base}&q={tag} 100%25_r", headers=admin).json()["items"]] == [literal["id"]]
    assert client.get(f"{base}&q={tag}%25", headers=admin).json()["items"] == []
    # Tamaño de pagina.
    assert len(client.get(f"{base}&q=Zorayda {tag}&page_size=2", headers=admin).json()["items"]) == 2
    # Solo ciudadanos: el admin demo no aparece.
    assert all(r["email"] != "admin@tejido.co" for r in client.get(f"{base}&q=tejido.co", headers=admin).json()["items"])


# ─────────────────────────── conversion ───────────────────────────

def test_promote_citizen_to_leader(client, admin, sent, branch_cleanup):
    branch_cleanup.append(BRANCH)
    user, headers = citizen(client, "Marta Ciudadana")
    assert client.get("/api/me", headers=headers).json()["user"]["role"] == "CIUDADANO"
    resp = promote(client, admin, user["id"], organization_name="  Fogón del Río  ")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["converted"] is True and body["changed"] is True and body["user_id"] == user["id"] and body["leader_id"] == user["id"]
    assert body["branch"] == BRANCH and body["previous_leader_id"] is None
    assert role_of(user["id"]) == "GESTOR"
    org = org_of(user["id"])
    assert org["id"] == body["organization_id"] and org["name"] == "Fogón del Río" and org["branch"] == BRANCH and org["is_leader"] and org["active"] and org["slug"]
    # Sesion abierta: /api/me ya trae el nuevo rol, la rama y el liderazgo (sin volver a entrar).
    me = client.get("/api/me", headers=headers).json()["user"]
    assert me["role"] == "GESTOR" and me["branch"] == BRANCH and me["is_leader"] is True
    # Aviso al nombrado agendado (BackgroundTasks, correo simulado).
    assert leader_notices(sent) == [user["email"]]
    overview = {b["branch"]: b for b in client.get("/api/admin/branches", headers=admin).json()}
    assert overview[BRANCH]["leader"]["name"] == "Marta Ciudadana"


def test_promote_default_org_name_and_previous_leader(client, admin, sent, branch_cleanup):
    branch_cleanup.append(BRANCH)
    _, old_id, _ = leader(client, admin, BRANCH, name="Líder Anterior")
    user, _ = citizen(client, "Nuevo Líder")
    resp = promote(client, admin, user["id"])
    assert resp.status_code == 200, resp.text
    assert resp.json()["previous_leader_id"] == old_id
    assert org_of(user["id"])["name"] == "Nuevo Líder"
    old = org_of(old_id)
    assert old["branch"] == BRANCH and old["is_leader"] is False and old["active"]  # queda como participante
    assert role_of(old_id) == "GESTOR"


def test_promote_reuses_inactive_organization(client, admin, sent, branch_cleanup):
    branch_cleanup.append(BRANCH)
    user, _ = citizen(client, "Exgestora")
    with schema_session() as db:
        db.add(Organization(user_id=user["id"], name="Taller viejo", branch=OTHER, is_leader=False, active=False, slug=f"taller-viejo-{uuid.uuid4().hex[:6]}"))
    old = org_of(user["id"])
    resp = promote(client, admin, user["id"], organization_name="Ignorado")
    assert resp.status_code == 200, resp.text
    org = org_of(user["id"])
    assert org["id"] == old["id"] == resp.json()["organization_id"]
    assert org["active"] and org["branch"] == BRANCH and org["is_leader"] and org["name"] == "Taller viejo"
    with schema_session() as db:
        assert db.execute(select(Organization.id).where(Organization.user_id == user["id"])).all().__len__() == 1


def test_promote_settles_join_requests(client, admin, sent, branch_cleanup):
    branch_cleanup.append(BRANCH)
    same, same_headers = citizen(client, "Pide Esta Rama")
    assert client.post("/api/branch-requests", json={"branch": BRANCH}, headers=same_headers).status_code == 201
    other, other_headers = citizen(client, "Pide Otra Rama")
    assert client.post("/api/branch-requests", json={"branch": OTHER}, headers=other_headers).status_code == 201
    admin_id = client.get("/api/me", headers=admin).json()["user"]["id"]

    assert promote(client, admin, same["id"]).status_code == 200
    with schema_session() as db:
        req = db.execute(select(BranchJoinRequest).where(BranchJoinRequest.user_id == same["id"])).scalars().one()
        assert (req.status, req.decided_by, req.decided_at is not None) == ("APPROVED", admin_id, True)
    client.delete(f"/api/admin/branches/{BRANCH}/leader", headers=admin)

    assert promote(client, admin, other["id"]).status_code == 200
    with schema_session() as db:
        req = db.execute(select(BranchJoinRequest).where(BranchJoinRequest.user_id == other["id"])).scalars().one()
        assert (req.status, req.decision_note, req.decided_at is not None) == ("CANCELLED", "Pasó a ser líder de otra rama", True)


def test_promote_rejections(client, tokens, admin, sent, branch_cleanup):
    branch_cleanup.append(BRANCH)
    _, created = new_gestor(client, admin, OTHER, name="Gestora Otra Rama")
    resp = promote(client, admin, created["user_id"])
    assert resp.status_code == 409 and resp.json()["error"] == "ALREADY_GESTOR" and "Nombrar líder" in resp.json()["message"]
    admin_id = client.get("/api/me", headers=admin).json()["user"]["id"]
    resp = promote(client, admin, admin_id)
    assert resp.status_code == 409 and resp.json()["error"] == "IS_ADMIN"
    unverified, _ = citizen(client, "Sin Verificar", verified=False)
    resp = promote(client, admin, unverified["id"])
    assert resp.status_code == 409 and resp.json()["error"] == "EMAIL_NOT_VERIFIED"
    inactive, _ = citizen(client, "Inactiva")
    with schema_session() as db:
        db.execute(text("UPDATE users SET active = false WHERE id = :id"), {"id": inactive["id"]})
    resp = promote(client, admin, inactive["id"])
    assert resp.status_code == 409 and resp.json()["error"] == "INACTIVE_USER"
    assert promote(client, admin, 99999999).status_code == 404
    ok, _ = citizen(client, "Rama Mala")
    assert promote(client, admin, ok["id"], branch="NO_EXISTE").status_code == 404
    for who in ("gestor", "ciudadano"):
        assert promote(client, auth_header(tokens, who), ok["id"]).status_code == 403
    assert client.post(f"/api/admin/branches/{BRANCH}/leader/promote", json={"user_id": ok["id"]}).status_code in (401, 403)
    # Nada cambio en los rechazados ni hubo avisos.
    for uid in (unverified["id"], inactive["id"], ok["id"]):
        assert role_of(uid) == "CIUDADANO" and org_of(uid) is None
    assert leader_notices(sent) == []


def test_promote_race_rolls_back(client, admin, sent, monkeypatch, branch_cleanup):
    branch_cleanup.append(BRANCH)
    user, _ = citizen(client, "Carrera")

    def racing(db, branch, gestor_id):
        raise IntegrityError("INSERT", {}, Exception("uq_organizations_branch_leader"))

    monkeypatch.setattr(branch_service, "set_leader", racing)
    resp = promote(client, admin, user["id"])
    assert resp.status_code == 409 and resp.json()["error"] == "LEADER_EXISTS"
    assert resp.json()["message"] == "Esa rama ya tiene líder: quítale el liderazgo antes de nombrar otro"
    assert role_of(user["id"]) == "CIUDADANO" and org_of(user["id"]) is None
    assert leader_notices(sent) == []


def test_promote_race_real_index(client, admin, sent, monkeypatch, branch_cleanup):
    """Carrera con el indice real: otro lider aparece entre quitar la marca y ponerla."""
    branch_cleanup.append(BRANCH)
    _, rival_id, _ = leader(client, admin, BRANCH, name="Rival")
    user, _ = citizen(client, "Carrera Real")
    original = branch_service.set_leader

    def racing(db, branch, gestor_id):
        result = original(db, branch, gestor_id)
        rival = db.execute(select(Organization).where(Organization.user_id == rival_id)).scalars().first()
        rival.is_leader = True
        db.flush()  # el indice unico parcial salta aqui
        return result

    monkeypatch.setattr(branch_service, "set_leader", racing)
    resp = promote(client, admin, user["id"])
    assert resp.status_code == 409 and resp.json()["error"] == "LEADER_EXISTS"
    assert role_of(user["id"]) == "CIUDADANO" and org_of(user["id"]) is None
    assert org_of(rival_id)["is_leader"] is True
