"""Entrega 4: solicitudes de todas las ramas para la Bandeja del admin, join_requests en stats,
slug en participantes y acceso del lider a las imagenes de lo que revisa.

Reutiliza los ayudantes de test_branches.py (schema aislado, correos con monkeypatch).
"""
import pytest

from backend.tests_fastapi.test_branches import (  # noqa: F401
    admin, branch_cleanup, category_ids, citizen, join, leader, publish_request, sent,
)
from backend.tests_fastapi.test_gestor_category import body
from backend.tests_fastapi.test_parity import auth_header, tokens  # noqa: F401

IMG = "https://res.cloudinary.com/demo/image/upload/v1/tejido/publicaciones/foto.jpg"


def stats(client, admin):
    return client.get("/api/admin/stats", headers=admin).json()


def test_admin_branch_requests_and_stats(client, tokens, admin, sent, branch_cleanup):
    with_leader, without_leader = "ARTESANIAS", "CINE_AUDIOVISUAL"
    branch_cleanup.append(with_leader)
    lead_h, _, _ = leader(client, admin, with_leader, "Lider Bandeja")
    before = stats(client, admin)["join_requests"]

    first_user, first = citizen(client, "Primera Solicitante")
    second_user, second = citizen(client, "Segunda Solicitante")
    r1 = client.post("/api/branch-requests", json={"branch": without_leader, "message": "Hago cine"}, headers=first).json()
    r2 = client.post("/api/branch-requests", json={"branch": with_leader, "message": "Tejo"}, headers=second).json()
    assert stats(client, admin)["join_requests"] == before + 2

    pending = client.get("/api/admin/branch-requests", headers=admin)
    assert pending.status_code == 200
    rows = {row["id"]: row for row in pending.json()}
    assert rows[r1["id"]]["branch_label"] == "Cine y audiovisual" and rows[r1["id"]]["branch_has_leader"] is False
    assert rows[r2["id"]]["branch_has_leader"] is True and rows[r2["id"]]["email"] == second_user["email"]
    ids = [row["id"] for row in pending.json()]
    assert ids.index(r1["id"]) < ids.index(r2["id"])  # pendientes: la mas antigua primero
    assert {"id", "user_id", "name", "email", "branch", "message", "status", "decision_note", "decided_by_name",
            "created_at", "decided_at", "branch_label", "branch_has_leader"} == set(pending.json()[0])

    # El admin decide en la rama sin lider; queda quien decidio y baja el contador.
    assert client.post(f"/api/branches/{without_leader}/requests/{r1['id']}/reject", json={"note": "Ahora no"}, headers=admin).status_code == 200
    assert stats(client, admin)["join_requests"] == before + 1
    assert r1["id"] not in {row["id"] for row in client.get("/api/admin/branch-requests?status=PENDING", headers=admin).json()}
    done = next(row for row in client.get("/api/admin/branch-requests?status=ALL", headers=admin).json() if row["id"] == r1["id"])
    assert (done["status"], done["decision_note"], done["decided_by_name"]) == ("REJECTED", "Ahora no", "Valentina Admin")
    assert client.get("/api/admin/branch-requests?status=RARO", headers=admin).status_code == 400

    # Solo ADMIN: el lider, un gestor, un ciudadano y un anonimo no.
    for headers in (lead_h, auth_header(tokens, "gestor"), first, {}):
        assert client.get("/api/admin/branch-requests", headers=headers).status_code == 403


def test_participants_include_slug(client, admin, sent, branch_cleanup):
    branch = "LITERATURA"
    branch_cleanup.append(branch)
    lead_h, lead_id, _ = leader(client, admin, branch, "Lider Slug")
    _, part_id, _ = join(client, admin, lead_h, branch, "Participante Slug")
    people = {p["id"]: p for p in client.get(f"/api/branches/{branch}/participants", headers=lead_h).json()}
    assert people[part_id]["slug"].startswith("participante-slug") and people[lead_id]["slug"]
    assert client.get(f"/api/gestores/{people[part_id]['slug']}").status_code == 200


def test_leader_reads_images_only_of_what_he_reviews(client, tokens, admin, sent, category_ids, branch_cleanup):
    branch, other = "ARTESANIAS", "LITERATURA"
    branch_cleanup.extend([branch, other])
    lead_h, _, _ = leader(client, admin, branch, "Lider Imagenes")
    other_h, _, _ = leader(client, admin, other, "Otro Lider Imagenes")
    part_h, _, _ = join(client, admin, lead_h, branch, "Autora Imagenes")

    def with_image(headers, title, submit=True, **extra):
        pub = client.post("/api/publications", json=body(category_ids, title, **extra), headers=headers).json()["id"]
        assert client.post(f"/api/publications/{pub}/images", json={"url": IMG, "alt_text": "Foto"}, headers=headers).status_code == 201
        if submit:
            assert client.post(f"/api/publications/{pub}/submit", headers=headers).status_code == 200
        return pub

    review = with_image(part_h, "En revision con foto")
    images = client.get(f"/api/publications/{review}/images", headers=lead_h)
    assert images.status_code == 200 and images.json()[0]["url"] == IMG
    assert client.get(f"/api/publications/{review}/images", headers=other_h).status_code == 403
    assert client.get(f"/api/publications/{review}/images").status_code == 403

    draft = with_image(part_h, "Borrador con foto", submit=False)
    assert client.get(f"/api/publications/{draft}/images", headers=lead_h).status_code == 403
    rejected = with_image(part_h, "Rechazada con foto")
    client.patch(f"/api/publications/{rejected}/status", json={"status": "REJECTED", "note": "Falta fecha"}, headers=lead_h)
    assert client.get(f"/api/publications/{rejected}/images", headers=lead_h).status_code == 403
    admin_pub = with_image(admin, "Del admin en la rama", cultural_category=branch)
    assert client.get(f"/api/publications/{admin_pub}/images", headers=lead_h).status_code == 403
    # El autor y el admin siguen viendo las suyas.
    assert client.get(f"/api/publications/{draft}/images", headers=part_h).status_code == 200
    assert client.get(f"/api/publications/{draft}/images", headers=admin).status_code == 200


def test_leader_appointed_notice(client, admin, sent, branch_cleanup):
    """Aviso "Te nombraron lider": al nombrado, una sola vez; nada si la accion falla."""
    import uuid

    from backend.tests_fastapi.test_branches import gestor

    branch, other = "TEATRO", "ARTES_VISUALES"
    branch_cleanup.extend([branch, other])
    _, first_id, first_email = gestor(client, admin, branch, "Primero Teatro")
    _, second_id, second_email = gestor(client, admin, branch, "Segundo Teatro")
    _, outsider_id, _ = gestor(client, admin, other, "De otra rama")
    sent["to"].clear()

    put = lambda gid, b=branch: client.put(f"/api/admin/branches/{b}/leader", json={"gestor_id": gid}, headers=admin)  # noqa: E731
    assert put(first_id).status_code == 200
    [(to, subject, text)] = sent["to"]
    assert to == first_email and subject == "Te nombraron líder de Teatro"
    assert "/#gestor-dashboard/por-revisar" in text and "Primero Teatro" in text

    assert put(first_id).json()["changed"] is False  # reconfirmar: sin aviso
    assert put(outsider_id).status_code == 409       # accion fallida: sin aviso
    assert len(sent["to"]) == 1

    assert put(second_id).status_code == 200          # cambio de lider: aviso al nuevo
    assert [m[0] for m in sent["to"]] == [first_email, second_email]

    # Crear un gestor ya como lider: invitacion + aviso. Si la rama ya tiene lider: 409 y nada.
    client.delete(f"/api/admin/branches/{branch}/leader", headers=admin)
    sent["to"].clear()
    email = f"lider-{uuid.uuid4().hex[:8]}@tejido-test.co"
    created = client.post("/api/admin/gestores", headers=admin, json={
        "name": "Lider Nuevo", "email": email, "organization_name": "Teatro Nuevo", "branch": branch, "is_leader": True})
    assert created.status_code == 200 and [m[0] for m in sent["to"]] == [email]
    dup = client.post("/api/admin/gestores", headers=admin, json={
        "name": "Otro", "email": f"x-{uuid.uuid4().hex[:8]}@tejido-test.co", "organization_name": "X", "branch": branch, "is_leader": True})
    assert dup.status_code == 409 and len(sent["to"]) == 1
