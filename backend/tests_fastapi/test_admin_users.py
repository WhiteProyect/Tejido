"""Pestaña Usuarios del admin: listado, ficha, edicion, estados ACTIVO/INACTIVO/INVITADO y cambios de rol
(ciudadano -> gestor [y lider], sacar de la rama, mover de rama [y lider], hacer / quitar admin).
Schema aislado del conftest; correos con monkeypatch (nunca Resend)."""
import logging
import uuid

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError

from backend.service.errors import AppError
from backend.service.models.tables import BranchJoinRequest, Organization, Publication, Role, User
from backend.service.services import branches as branch_service
from backend.service.services import users as users_service
from backend.tests_fastapi.test_branches import admin, branch_cleanup, citizen, leader, publish_request, sent  # noqa: F401
from backend.tests_fastapi.test_gestor_category import category_ids, new_gestor  # noqa: F401
from backend.tests_fastapi.test_gestores_invites import schema_session
from backend.tests_fastapi.test_parity import auth_header, tokens  # noqa: F401

BRANCH = "GASTRONOMIA_CULTURAL"
OTHER = "ARTESANIAS"


def notices(sent):
    return [to for to, subject, _ in sent["to"] if "líder" in subject.lower()]


def role_of(user_id):
    with schema_session() as db:
        return db.execute(select(Role.name).join(User, User.role_id == Role.id).where(User.id == user_id)).scalar_one()


def org_of(user_id):
    with schema_session() as db:
        org = db.execute(select(Organization).where(Organization.user_id == user_id).order_by(Organization.id)).scalars().first()
        return None if org is None else {"id": org.id, "name": org.name, "branch": org.branch, "is_leader": org.is_leader, "active": org.active}


def statuses(user_ids):
    with schema_session() as db:
        return dict(db.execute(select(Publication.id, Publication.status).where(Publication.id.in_(user_ids))).all())


def gestor_in(client, admin, branch, name):
    headers, created = new_gestor(client, admin, branch, name=name)
    return headers, created["user_id"]


def me(client, headers):
    return client.get("/api/me", headers=headers).json()["user"]


# ─────────────────────────── listado y ficha ───────────────────────────

def test_list_permissions_filters_and_states(client, tokens, admin, sent):
    tag = uuid.uuid4().hex[:6]
    for who in ("gestor", "ciudadano"):
        assert client.get("/api/admin/users", headers=auth_header(tokens, who)).status_code == 403
    assert client.get("/api/admin/users").status_code in (401, 403)
    active, _ = citizen(client, f"Usu {tag} Activa")
    off, _ = citizen(client, f"Usu {tag} Apagada")
    invited = client.post("/api/admin/gestores", headers=admin, json={"name": f"Usu {tag} Invitada", "email": f"inv-{tag}@tejido-test.co",
                                                                      "organization_name": "Colectivo invitado", "branch": OTHER}).json()["user_id"]
    _, accepted_off = gestor_in(client, admin, OTHER, f"Usu {tag} Gestora Apagada")
    assert client.patch(f"/api/admin/users/{off['id']}", json={"active": False}, headers=admin).status_code == 200
    assert client.patch(f"/api/admin/users/{accepted_off}", json={"active": False}, headers=admin).status_code == 200

    page = client.get(f"/api/admin/users?q=usu {tag}", headers=admin).json()
    by_id = {item["id"]: item for item in page["items"]}
    assert page["total"] == 4 and page["page"] == 1 and page["page_size"] == 25
    assert by_id[active["id"]]["status"] == "ACTIVO" and by_id[off["id"]]["status"] == "INACTIVO"
    assert by_id[invited]["status"] == "INVITADO" and by_id[accepted_off]["status"] == "INACTIVO"  # invitado != desactivado
    assert by_id[invited]["role"] == "GESTOR" and by_id[accepted_off]["branch"] == OTHER and by_id[accepted_off]["branch_label"] == "Artesanías"
    assert all(not ({"password_hash", "token", "invite_link"} & set(item)) for item in page["items"])
    assert page["counts"] == {"ADMIN": 0, "GESTOR": 2, "CIUDADANO": 2, "ALL": 4}
    # Filtros.
    q = f"/api/admin/users?q=usu {tag}"
    assert {i["id"] for i in client.get(f"{q}&status=INVITADO", headers=admin).json()["items"]} == {invited}
    assert {i["id"] for i in client.get(f"{q}&status=INACTIVO", headers=admin).json()["items"]} == {off["id"], accepted_off}
    assert {i["id"] for i in client.get(f"{q}&status=ACTIVO", headers=admin).json()["items"]} == {active["id"]}
    assert {i["id"] for i in client.get(f"{q}&role=CIUDADANO", headers=admin).json()["items"]} == {active["id"], off["id"]}
    assert {i["id"] for i in client.get(f"{q}&branch={OTHER}", headers=admin).json()["items"]} == {invited, accepted_off}
    # Paginacion estable (alta mas reciente primero) y validaciones.
    first = client.get(f"{q}&page_size=3&page=1", headers=admin).json()
    second = client.get(f"{q}&page_size=3&page=2", headers=admin).json()
    assert len(first["items"]) == 3 and len(second["items"]) == 1 and first["total"] == second["total"] == 4
    ids = [i["id"] for i in first["items"] + second["items"]]
    assert ids == sorted(ids, reverse=True)
    for bad in ("status=OTRO", "role=JEFE", "branch=NO_EXISTE", "page=0", "page_size=51", "q=a"):
        assert client.get(f"/api/admin/users?{bad}", headers=admin).status_code in (404, 422), bad
    # Comodines escapados e is_self.
    assert client.get(f"/api/admin/users?q={tag}%25", headers=admin).json()["items"] == []
    self_row = client.get("/api/admin/users?q=admin@tejido.co", headers=admin).json()["items"]
    assert [r["is_self"] for r in self_row] == [True]
    # Gestores: el mismo estado (ya no "PENDIENTE" para todo).
    gestores = {g["id"]: g["status"] for g in client.get("/api/admin/gestores", headers=admin).json()}
    assert gestores[invited] == "INVITADO" and gestores[accepted_off] == "INACTIVO"


def test_detail(client, admin, sent, category_ids):
    headers, gid = gestor_in(client, admin, OTHER, "Ficha Gestora")
    pub = publish_request(client, headers, category_ids, "Ficha en revisión")
    detail = client.get(f"/api/admin/users/{gid}", headers=admin)
    assert detail.status_code == 200, detail.text
    body = detail.json()
    assert body["publications"]["REVIEW"] == 1 and set(body["publications"]) == {"PUBLISHED", "REVIEW", "DRAFT", "REJECTED"}
    assert body["organization"]["branch"] == OTHER and body["organization"]["active"] and body["organization"]["slug"]
    assert body["join_requests"] == []
    assert pub
    user, uheaders = citizen(client, "Ficha Ciudadana")
    client.post("/api/branch-requests", json={"branch": OTHER}, headers=uheaders)
    reqs = client.get(f"/api/admin/users/{user['id']}", headers=admin).json()["join_requests"]
    assert [(r["branch"], r["status"]) for r in reqs] == [(OTHER, "PENDING")]
    assert client.get("/api/admin/users/99999999", headers=admin).status_code == 404


# ─────────────────────────── edicion ───────────────────────────

def test_patch_rules_and_tokens(client, admin, sent, branch_cleanup):
    branch_cleanup.append(BRANCH)
    user, headers = citizen(client, "Editable Uno")
    ok = client.patch(f"/api/admin/users/{user['id']}", json={"name": "  Editable   Nueva ", "municipality": "nechi"}, headers=admin)
    assert ok.status_code == 200 and ok.json()["name"] == "Editable Nueva" and ok.json()["municipality"] == "nechi"
    assert client.patch(f"/api/admin/users/{user['id']}", json={"municipality": "bogota"}, headers=admin).status_code == 422
    assert client.patch(f"/api/admin/users/{user['id']}", json={"name": "   "}, headers=admin).status_code == 422
    assert client.patch(f"/api/admin/users/{user['id']}", json={"municipality": None}, headers=admin).json()["municipality"] is None
    # El correo no se edita: el campo se ignora.
    client.patch(f"/api/admin/users/{user['id']}", json={"email": "otro@x.co"}, headers=admin)
    assert client.get(f"/api/admin/users/{user['id']}", headers=admin).json()["email"] == user["email"]
    # No desactivarse a uno mismo.
    admin_id = me(client, admin)["id"]
    resp = client.patch(f"/api/admin/users/{admin_id}", json={"active": False}, headers=admin)
    assert resp.status_code == 409 and resp.json()["error"] == "SELF_ACTION"
    # Desactivar: el token abierto deja de servir (no solo el login nuevo).
    assert me(client, headers)["id"] == user["id"]
    assert client.patch(f"/api/admin/users/{user['id']}", json={"active": False}, headers=admin).json()["status"] == "INACTIVO"
    assert me(client, headers) is None
    assert client.get("/api/me/saved", headers=headers).status_code in (401, 403)
    assert client.patch(f"/api/admin/users/{user['id']}", json={"active": True}, headers=admin).json()["status"] == "ACTIVO"
    # Desactivar a un lider libera la rama y lo avisa.
    _, lid, _ = leader(client, admin, BRANCH, name="Líder Desactivado")
    off = client.patch(f"/api/admin/users/{lid}", json={"active": False}, headers=admin).json()
    assert off["leadership_cleared"] == BRANCH and org_of(lid)["is_leader"] is False and org_of(lid)["active"] is True
    assert {b["branch"]: b["leader"] for b in client.get("/api/admin/branches", headers=admin).json()}[BRANCH] is None
    # Reactivar a un invitado no salta la invitacion.
    invited = client.post("/api/admin/gestores", headers=admin, json={"name": "Invitada", "email": f"i-{uuid.uuid4().hex[:8]}@tejido-test.co",
                                                                      "organization_name": "Org", "branch": OTHER}).json()["user_id"]
    resp = client.patch(f"/api/admin/users/{invited}", json={"active": True}, headers=admin)
    assert resp.status_code == 409 and resp.json()["error"] == "INVITE_PENDING"


def test_last_admin_guard(client):
    """El ultimo admin activo no se desactiva ni pierde el rol (por API es inalcanzable: quien actua es un
    admin activo; se prueba el servicio con un solo admin activo y se deshace)."""
    with schema_session() as db:
        try:
            admins = db.execute(select(User).join(Role, Role.id == User.role_id).where(Role.name == "ADMIN", User.active.is_(True))).scalars().all()
            keep = admins[0]
            for other in admins[1:]:
                other.active = False
            db.flush()
            for call in (lambda: users_service.update_user(db, 0, keep.id, {"active": False}), lambda: users_service.revoke_admin(db, 0, keep.id)):
                with pytest.raises(AppError) as error:
                    call()
                assert error.value.code == "LAST_ADMIN"
        finally:
            db.rollback()


# ─────────────────────────── cambios de rol ───────────────────────────

def test_make_gestor_participant_and_leader(client, admin, sent, branch_cleanup):
    branch_cleanup.append(BRANCH)
    user, headers = citizen(client, "Nueva Participante")
    assert client.post("/api/branch-requests", json={"branch": OTHER}, headers=headers).status_code == 201
    resp = client.post(f"/api/admin/users/{user['id']}/make-gestor", json={"branch": BRANCH, "organization_name": "Fogón"}, headers=admin)
    assert resp.status_code == 200, resp.text
    assert role_of(user["id"]) == "GESTOR" and org_of(user["id"]) == {**org_of(user["id"]), "branch": BRANCH, "is_leader": False, "name": "Fogón"}
    with schema_session() as db:
        assert db.execute(select(BranchJoinRequest.status).where(BranchJoinRequest.user_id == user["id"])).scalar_one() == "CANCELLED"
    assert me(client, headers)["role"] == "GESTOR" and me(client, headers)["branch"] == BRANCH and notices(sent) == []
    # Y lider: reutiliza promote_to_leader (aviso incluido).
    other, oheaders = citizen(client, "Nuevo Líder")
    resp = client.post(f"/api/admin/users/{other['id']}/make-gestor", json={"branch": BRANCH, "leader": True}, headers=admin)
    assert resp.status_code == 200 and resp.json()["leader_id"] == other["id"]
    assert me(client, oheaders)["is_leader"] is True and notices(sent) == [other["email"]]
    # Rechazos.
    for target, code in ((other["id"], "ALREADY_GESTOR"), (me(client, admin)["id"], "IS_ADMIN"), (99999999, "USER_NOT_FOUND")):
        resp = client.post(f"/api/admin/users/{target}/make-gestor", json={"branch": BRANCH}, headers=admin)
        assert resp.json()["error"] == code
    assert client.post(f"/api/admin/users/{user['id']}/make-gestor", json={"branch": "NO_EXISTE"}, headers=admin).status_code == 404


def test_remove_from_branch(client, admin, sent, category_ids, branch_cleanup):
    branch_cleanup.append(BRANCH)
    headers, gid = gestor_in(client, admin, BRANCH, "Sale de la rama")
    pub = publish_request(client, headers, category_ids, "Revisión que vuelve a borrador")
    resp = client.post(f"/api/admin/users/{gid}/remove-from-branch", headers=admin)
    assert resp.status_code == 200 and role_of(gid) == "CIUDADANO" and org_of(gid)["active"] is False
    assert statuses([pub])[pub] == "DRAFT" and me(client, headers)["role"] == "CIUDADANO"
    _, lid, _ = leader(client, admin, BRANCH, name="Líder no sale")
    resp = client.post(f"/api/admin/users/{lid}/remove-from-branch", headers=admin)
    assert resp.status_code == 409 and resp.json()["error"] == "IS_LEADER"
    citizen_user, _ = citizen(client, "No es gestor")
    assert client.post(f"/api/admin/users/{citizen_user['id']}/remove-from-branch", headers=admin).json()["error"] == "NOT_GESTOR"


def test_move_and_lead(client, admin, sent, category_ids, branch_cleanup):
    branch_cleanup.extend([BRANCH, OTHER])
    headers, gid = gestor_in(client, admin, OTHER, "Gestora Viajera")
    review = publish_request(client, headers, category_ids, "En revisión al mudarse")
    published = publish_request(client, headers, category_ids, "Publicada antes de mudarse")
    with schema_session() as db:
        db.execute(text("UPDATE publications SET status = 'PUBLISHED' WHERE id = :id"), {"id": published})
    _, old_id, _ = leader(client, admin, BRANCH, name="Líder Anterior")
    resp = client.post(f"/api/admin/users/{gid}/move", json={"branch": BRANCH, "lead": True}, headers=admin)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["moved"] is True and body["drafted"] == 1 and body["leader_id"] == gid and body["previous_leader_id"] == old_id
    assert org_of(gid)["branch"] == BRANCH and org_of(gid)["is_leader"] and org_of(gid)["active"]
    assert statuses([review, published]) == {review: "DRAFT", published: "PUBLISHED"}
    assert org_of(old_id)["is_leader"] is False and org_of(old_id)["branch"] == BRANCH
    assert notices(sent)[-1] == me(client, headers)["email"] and me(client, headers)["is_leader"] is True
    # Un lider de otra rama no se mueve.
    resp = client.post(f"/api/admin/users/{gid}/move", json={"branch": OTHER}, headers=admin)
    assert resp.status_code == 409 and resp.json()["error"] == "IS_LEADER"
    # Mover sin liderazgo y misma rama.
    _, mover = gestor_in(client, admin, OTHER, "Solo Mudanza")
    resp = client.post(f"/api/admin/users/{mover}/move", json={"branch": BRANCH}, headers=admin)
    assert resp.status_code == 200 and resp.json()["moved"] and org_of(mover)["branch"] == BRANCH and not org_of(mover)["is_leader"]
    assert client.post(f"/api/admin/users/{mover}/move", json={"branch": BRANCH}, headers=admin).json()["error"] == "SAME_BRANCH"
    plain, _ = citizen(client, "No gestora")
    assert client.post(f"/api/admin/users/{plain['id']}/move", json={"branch": BRANCH}, headers=admin).json()["error"] == "NOT_GESTOR"


def test_move_race_rolls_back(client, admin, sent, monkeypatch, branch_cleanup):
    branch_cleanup.append(BRANCH)
    _, gid = gestor_in(client, admin, OTHER, "Carrera Mudanza")

    def racing(db, branch, gestor_id):
        raise IntegrityError("UPDATE", {}, Exception("uq_organizations_branch_leader"))

    monkeypatch.setattr(branch_service, "set_leader", racing)
    resp = client.post(f"/api/admin/users/{gid}/move", json={"branch": BRANCH, "lead": True}, headers=admin)
    assert resp.status_code == 409 and resp.json()["error"] == "LEADER_EXISTS"
    assert org_of(gid)["branch"] == OTHER and role_of(gid) == "GESTOR" and notices(sent) == []


def test_admin_grant_and_revoke(client, admin, sent, category_ids, caplog, branch_cleanup):
    branch_cleanup.append(BRANCH)
    caplog.set_level(logging.INFO, logger="tejido.admin")
    user, headers = citizen(client, "Futura Admin")
    resp = client.post(f"/api/admin/users/{user['id']}/make-admin", headers=admin)
    assert resp.status_code == 200 and role_of(user["id"]) == "ADMIN" and me(client, headers)["role"] == "ADMIN"
    admin_id = me(client, admin)["id"]
    assert any(f"action=grant actor_id={admin_id} target_id={user['id']} from=CIUDADANO to=ADMIN" in r.getMessage() for r in caplog.records)
    assert all(user["email"] not in r.getMessage() for r in caplog.records)
    # Gestor participante: organizacion inactiva y revision -> borrador.
    gheaders, gid = gestor_in(client, admin, OTHER, "Gestora Admin")
    pub = publish_request(client, gheaders, category_ids, "Revisión antes de ser admin")
    assert client.post(f"/api/admin/users/{gid}/make-admin", headers=admin).json()["drafted"] == 1
    assert org_of(gid)["active"] is False and statuses([pub])[pub] == "DRAFT"
    # Rechazos: lider, ya admin, inactivo.
    _, lid, _ = leader(client, admin, BRANCH, name="Líder no admin")
    assert client.post(f"/api/admin/users/{lid}/make-admin", headers=admin).json()["error"] == "IS_LEADER"
    assert client.post(f"/api/admin/users/{user['id']}/make-admin", headers=admin).json()["error"] == "ALREADY_ADMIN"
    off, _ = citizen(client, "Apagada")
    client.patch(f"/api/admin/users/{off['id']}", json={"active": False}, headers=admin)
    assert client.post(f"/api/admin/users/{off['id']}/make-admin", headers=admin).json()["error"] == "INACTIVE_USER"
    # Quitar el rol: no a uno mismo; a otro si (y queda en el registro).
    resp = client.post(f"/api/admin/users/{admin_id}/revoke-admin", headers=admin)
    assert resp.status_code == 409 and resp.json()["error"] == "SELF_ACTION"
    resp = client.post(f"/api/admin/users/{user['id']}/revoke-admin", headers=admin)
    assert resp.status_code == 200 and role_of(user["id"]) == "CIUDADANO" and me(client, headers)["role"] == "CIUDADANO"
    assert any(f"action=revoke actor_id={admin_id} target_id={user['id']} from=ADMIN to=CIUDADANO" in r.getMessage() for r in caplog.records)
    assert client.post(f"/api/admin/users/{lid}/revoke-admin", headers=admin).json()["error"] == "NOT_ADMIN"
    # Un admin no administra a otros por estas rutas si no es admin.
    assert client.post(f"/api/admin/users/{lid}/make-admin", headers=headers).status_code in (401, 403)


def test_leader_from_participants_still_works(client, admin, sent, branch_cleanup):
    """Nombrar lider a un participante (PUT) y quitarlo (DELETE): las rutas existentes, sin cambios."""
    branch_cleanup.append(BRANCH)
    _, gid = gestor_in(client, admin, BRANCH, "Participante Ascendida")
    assert client.put(f"/api/admin/branches/{BRANCH}/leader", json={"gestor_id": gid}, headers=admin).status_code == 200
    assert org_of(gid)["is_leader"] is True
    assert client.delete(f"/api/admin/branches/{BRANCH}/leader", headers=admin).status_code == 200
    assert org_of(gid)["is_leader"] is False
    item = [i for i in client.get(f"/api/admin/users?branch={BRANCH}&q=Participante Ascendida", headers=admin).json()["items"]]
    assert item and item[0]["is_leader"] is False and item[0]["branch"] == BRANCH
