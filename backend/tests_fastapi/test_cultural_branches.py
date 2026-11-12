"""Ramas de cultura administrables (tabla cultural_branches, services/cultural_branches.py).

Schema aislado del conftest. Las ramas nuevas de cada test se borran al final (antes se sueltan sus
referencias); las ramas base que se desactivan vuelven a quedar activas. Correos con monkeypatch.
"""
import uuid

import pytest
from sqlalchemy import delete, select, update

from backend.service.core.config import settings
from backend.service.models.tables import BranchJoinRequest, CulturalBranch, Organization, Publication
from backend.service.services import cultural_branches
from backend.tests_fastapi.test_branches import admin, branch_cleanup, citizen, gestor, leader, sent  # noqa: F401
from backend.tests_fastapi.test_gestor_category import body, category_ids  # noqa: F401
from backend.tests_fastapi.test_gestores_invites import schema_session
from backend.tests_fastapi.test_parity import auth_header, tokens  # noqa: F401

API = "/api/admin/cultural-branches"
BASE_KEYS = [key for key, _ in cultural_branches.BASE_BRANCHES]
# Rama base que se desactiva para probar las validaciones (otros tests no la esperan con contenido fijo).
SPARE = "ARTESANIAS"


@pytest.fixture
def created(admin, client):
    """Claves de ramas nuevas: al terminar se sueltan sus referencias y se borran."""
    keys = []
    yield keys
    with schema_session() as db:
        for key in keys:
            db.execute(update(Publication).where(Publication.cultural_category == key).values(cultural_category=None))
            db.execute(update(Organization).where(Organization.branch == key).values(branch=None, is_leader=False))
            db.execute(delete(BranchJoinRequest).where(BranchJoinRequest.branch == key))
            db.execute(delete(CulturalBranch).where(CulturalBranch.key == key))
        # El orden vuelve a ser compacto.
        for position, branch in enumerate(db.scalars(select(CulturalBranch).order_by(CulturalBranch.position, CulturalBranch.key))):
            branch.position = position


@pytest.fixture
def spare(admin, client):
    yield SPARE
    with schema_session() as db:
        db.execute(update(CulturalBranch).where(CulturalBranch.key == SPARE).values(active=True))


@pytest.fixture(autouse=True)
def cloud_name(monkeypatch):
    monkeypatch.setattr(settings, "cloudinary_cloud_name", "tejido-test")


def label():
    return f"Rama prueba {uuid.uuid4().hex[:6]}"


def new_branch(client, admin, created, name=None, **extra):
    resp = client.post(API, json={"label": name or label(), **extra}, headers=admin)
    assert resp.status_code == 201, resp.text
    created.append(resp.json()["key"])
    return resp.json()


def admin_row(client, admin, key):
    return next(b for b in client.get(API, headers=admin).json() if b["key"] == key)


def patch(client, admin, key, **fields):
    return client.patch(f"{API}/{key}", json=fields, headers=admin)


def public_keys(client):
    return [b["key"] for b in client.get("/api/cultural-branches").json()]


# ─────────────────────────── siembra y lectura ───────────────────────────

def test_seed_has_the_ten_base_branches(client, admin):
    rows = client.get(API, headers=admin).json()
    base = [r for r in rows if r["key"] in BASE_KEYS]
    assert [r["key"] for r in base] == BASE_KEYS
    assert {r["key"] for r in base if r["protected"]} == {"MUSICA"}
    music = next(r for r in base if r["key"] == "MUSICA")
    assert (music["label"], music["slug"], music["active"]) == ("Música", "musica", True)
    assert next(r for r in base if r["key"] == "CINE_AUDIOVISUAL")["slug"] == "cine-audiovisual"
    assert set(music["counts"]) == {"gestores", "gestores_activos", "publicaciones", "talento", "solicitudes", "solicitudes_pendientes"}
    assert music["can_delete"] is False and music["can_deactivate"] is False and "base" in music["delete_reason"]


def test_public_endpoint_lists_only_active_with_etag(client, admin, spare):
    resp = client.get("/api/cultural-branches")
    assert resp.status_code == 200 and resp.headers["cache-control"] == "public, no-cache" and resp.headers.get("etag")
    first = resp.json()[0]
    assert set(first) == {"key", "label", "slug", "image_url"}
    assert SPARE in public_keys(client)
    assert client.get("/api/cultural-branches", headers={"If-None-Match": resp.headers["etag"]}).status_code == 304
    assert patch(client, admin, SPARE, active=False).status_code == 200
    assert SPARE not in public_keys(client)
    assert admin_row(client, admin, SPARE)["active"] is False  # el admin la sigue viendo


def test_only_admin_manages_branches(client, tokens, admin, created):
    key = new_branch(client, admin, created)["key"]
    for who in ("gestor", "ciudadano"):
        h = auth_header(tokens, who)
        assert client.get(API, headers=h).status_code == 403
        assert client.post(API, json={"label": label()}, headers=h).status_code == 403
        assert client.patch(f"{API}/{key}", json={"label": label()}, headers=h).status_code == 403
        assert client.post(f"{API}/{key}/move", json={"direction": "up"}, headers=h).status_code == 403
        assert client.delete(f"{API}/{key}", headers=h).status_code == 403
    assert client.get(API).status_code in (401, 403)
    assert client.post(API, json={"label": label()}).status_code in (401, 403)


# ─────────────────────────── crear, renombrar, mover ───────────────────────────

def test_create_generates_key_and_goes_last(client, admin, created):
    tag = uuid.uuid4().hex[:4]
    branch = new_branch(client, admin, created, name=f"Música  y Danza {tag}")
    assert branch["key"] == f"MUSICA_Y_DANZA_{tag.upper()}" and branch["slug"] == f"musica-y-danza-{tag}"
    assert branch["label"] == f"Música y Danza {tag}"  # espacios compactados
    assert (branch["active"], branch["protected"], branch["can_delete"]) == (True, False, True)
    rows = client.get(API, headers=admin).json()
    assert rows[-1]["key"] == branch["key"] and branch["key"] in public_keys(client)


def test_create_collisions_and_validation(client, admin, created):
    name = label()
    new_branch(client, admin, created, name=name)
    for clash in (name.upper(), f"  {name}  ", "musica", "MÚSICA", "Musica"):
        resp = client.post(API, json={"label": clash}, headers=admin)
        assert resp.status_code == 409 and resp.json()["error"] == "BRANCH_EXISTS", clash
    for bad in ("", "a", "123 números", "x" * 61):
        assert client.post(API, json={"label": bad}, headers=admin).status_code == 422, bad
    bad_image = client.post(API, json={"label": label(), "image_url": "https://example.com/x.jpg"}, headers=admin)
    assert bad_image.status_code in (400, 422)
    image = "https://res.cloudinary.com/tejido-test/image/upload/v1/tejido/categorias/nueva.jpg"
    assert new_branch(client, admin, created, image_url=image)["image_url"] == image


def test_rename_keeps_key_and_slug(client, admin, created):
    branch = new_branch(client, admin, created)
    other = new_branch(client, admin, created)
    renamed = patch(client, admin, branch["key"], label="Otro nombre " + uuid.uuid4().hex[:4])
    assert renamed.status_code == 200
    assert (renamed.json()["key"], renamed.json()["slug"]) == (branch["key"], branch["slug"])
    assert renamed.json()["label"].startswith("Otro nombre")
    clash = patch(client, admin, branch["key"], label=other["label"].lower())
    assert clash.status_code == 409 and clash.json()["error"] == "BRANCH_EXISTS"
    # Su propio nombre con otras mayusculas no choca.
    assert patch(client, admin, branch["key"], label=renamed.json()["label"].upper()).status_code == 200
    assert patch(client, admin, "NO_EXISTE", label="Algo").status_code == 404


def test_move_up_and_down(client, admin, created):
    a = new_branch(client, admin, created)["key"]
    b = new_branch(client, admin, created)["key"]
    order = lambda: [r["key"] for r in client.get(API, headers=admin).json()]  # noqa: E731
    assert order()[-2:] == [a, b]
    resp = client.post(f"{API}/{b}/move", json={"direction": "up"}, headers=admin)
    assert resp.status_code == 200 and [r["key"] for r in resp.json()][-2:] == [b, a]
    assert client.post(f"{API}/{b}/move", json={"direction": "down"}, headers=admin).status_code == 200
    assert order()[-2:] == [a, b]
    # En los extremos no pasa nada.
    assert client.post(f"{API}/{b}/move", json={"direction": "down"}, headers=admin).status_code == 200
    assert order()[-1] == b
    first = order()[0]
    assert client.post(f"{API}/{first}/move", json={"direction": "up"}, headers=admin).status_code == 200
    assert order()[0] == first
    positions = [r["position"] for r in client.get(API, headers=admin).json()]
    assert positions == list(range(len(positions)))
    assert client.post(f"{API}/{a}/move", json={"direction": "left"}, headers=admin).status_code == 400
    assert client.post(f"{API}/NO_EXISTE/move", json={"direction": "up"}, headers=admin).status_code == 404


# ─────────────────────────── desactivar y borrar ───────────────────────────

def test_music_is_protected(client, admin):
    resp = patch(client, admin, "MUSICA", active=False)
    assert resp.status_code == 409 and resp.json()["error"] == "PROTECTED_BRANCH"
    resp = client.delete(f"{API}/MUSICA", headers=admin)
    assert resp.status_code == 409 and resp.json()["error"] == "PROTECTED_BRANCH"
    assert "MUSICA" in public_keys(client)
    # Renombrarla o cambiar su imagen si se puede.
    assert patch(client, admin, "MUSICA", label="Música").status_code == 200


def test_deactivate_blocked_by_pending_requests(client, admin, sent, created):
    key = new_branch(client, admin, created)["key"]
    _, cit = citizen(client, "Ciudadana rama nueva")
    req = client.post("/api/branch-requests", json={"branch": key, "message": "Quiero participar"}, headers=cit)
    assert req.status_code == 201, req.text
    row = admin_row(client, admin, key)
    assert row["counts"]["solicitudes_pendientes"] == 1 and row["can_deactivate"] is False and "pendiente" in row["deactivate_reason"]
    resp = patch(client, admin, key, active=False)
    assert resp.status_code == 409 and resp.json()["error"] == "PENDING_REQUESTS"
    # Resuelta la solicitud, ya se puede.
    with schema_session() as db:
        db.execute(update(BranchJoinRequest).where(BranchJoinRequest.branch == key).values(status="REJECTED"))
    resp = patch(client, admin, key, active=False)
    assert resp.status_code == 200 and resp.json()["active"] is False and key not in public_keys(client)
    assert patch(client, admin, key, active=True).json()["active"] is True and key in public_keys(client)


def test_delete_only_without_references(client, admin, category_ids, created):
    unused = new_branch(client, admin, created)["key"]
    assert client.delete(f"{API}/{unused}", headers=admin).json() == {"ok": True}
    assert unused not in [r["key"] for r in client.get(API, headers=admin).json()]
    assert client.delete(f"{API}/{unused}", headers=admin).status_code == 404

    used = new_branch(client, admin, created)["key"]
    pub = client.post("/api/publications", json=body(category_ids, "Con rama nueva", cultural_category=used), headers=admin)
    assert pub.status_code == 201, pub.text
    row = admin_row(client, admin, used)
    assert row["counts"]["publicaciones"] == 1 and row["can_delete"] is False and "1 publicación" in row["delete_reason"]
    resp = client.delete(f"{API}/{used}", headers=admin)
    assert resp.status_code == 409 and resp.json()["error"] == "BRANCH_IN_USE" and "desactívala" in resp.json()["message"]


# ─────────────────────────── validacion de escrituras ───────────────────────────

def test_publication_branch_must_exist_and_be_active(client, admin, category_ids, spare):
    resp = client.post("/api/publications", json=body(category_ids, "Rama falsa", cultural_category="RAP"), headers=admin)
    assert resp.status_code == 422 and resp.json()["error"] == "INVALID_BRANCH"
    existing = client.post("/api/publications", json=body(category_ids, "Antes de desactivar", cultural_category=SPARE), headers=admin)
    assert existing.status_code == 201, existing.text
    assert patch(client, admin, SPARE, active=False).status_code == 200
    resp = client.post("/api/publications", json=body(category_ids, "Rama apagada", cultural_category=SPARE), headers=admin)
    assert resp.status_code == 422 and resp.json()["error"] == "INACTIVE_BRANCH"
    # Lo existente se edita sin cambiar de rama; moverlo a otra inactiva no.
    pub_id = existing.json()["id"]
    edit = client.put(f"/api/publications/{pub_id}", json=body(category_ids, "Editada", cultural_category=SPARE), headers=admin)
    assert edit.status_code == 200, edit.text
    moved = client.put(f"/api/publications/{pub_id}", json=body(category_ids, "Editada", cultural_category="DANZA"), headers=admin)
    assert moved.status_code == 200
    back = client.put(f"/api/publications/{pub_id}", json=body(category_ids, "Editada", cultural_category=SPARE), headers=admin)
    assert back.status_code == 422 and back.json()["error"] == "INACTIVE_BRANCH"


def test_gestor_of_inactive_branch_keeps_access_but_cannot_create(client, admin, category_ids, sent, spare):
    gestor_h, _, _ = gestor(client, admin, SPARE, "Gestora artesanias")
    draft = client.post("/api/publications", json=body(category_ids, "Borrador previo"), headers=gestor_h)
    assert draft.status_code == 201, draft.text
    assert patch(client, admin, SPARE, active=False).status_code == 200
    me = client.get("/api/me", headers=gestor_h).json()["user"]
    assert me["branch"] == SPARE and me["branch_active"] is False
    assert client.get("/api/me/category", headers=gestor_h).json()["branch_active"] is False
    resp = client.post("/api/publications", json=body(category_ids, "Nueva en rama apagada"), headers=gestor_h)
    assert resp.status_code == 422 and resp.json()["error"] == "INACTIVE_BRANCH"
    edit = client.put(f"/api/publications/{draft.json()['id']}", json=body(category_ids, "Borrador editado"), headers=gestor_h)
    assert edit.status_code == 200, edit.text
    # Alta de gestores y solicitudes de ingreso: solo ramas activas.
    payload = {"name": "Otro", "email": f"x-{uuid.uuid4().hex[:8]}@tejido-test.co", "organization_name": "Otro colectivo", "branch": SPARE}
    resp = client.post("/api/admin/gestores", json=payload, headers=admin)
    assert resp.status_code == 422 and resp.json()["error"] == "INACTIVE_BRANCH"
    _, cit = citizen(client, "Ciudadana apagada")
    resp = client.post("/api/branch-requests", json={"branch": SPARE, "message": "Hola"}, headers=cit)
    assert resp.status_code == 422 and resp.json()["error"] == "INACTIVE_BRANCH"


def test_talent_category_must_be_active(client, admin, spare):
    resp = client.post("/api/talent", json={"name": "Talento rama falsa", "origin": "caucasia", "category": "RAP"}, headers=admin)
    assert resp.status_code == 422 and resp.json()["error"] == "INVALID_BRANCH"
    ok = client.post("/api/talent", json={"name": f"Talento {uuid.uuid4().hex[:6]}", "origin": "caucasia", "category": SPARE}, headers=admin)
    assert ok.status_code == 201, ok.text
    assert patch(client, admin, SPARE, active=False).status_code == 200
    resp = client.post("/api/talent", json={"name": "Talento apagado", "origin": "caucasia", "category": SPARE}, headers=admin)
    assert resp.status_code == 422 and resp.json()["error"] == "INACTIVE_BRANCH"
    assert client.patch(f"/api/talent/{ok.json()['id']}", json={"tagline": "Sigue en su rama"}, headers=admin).status_code == 200


def test_public_filters_accept_only_active_branches(client, admin, spare):
    assert client.get("/api/agenda?category=artesanias").status_code == 200
    assert client.get("/api/opportunities?category=artesanias").status_code == 200
    assert client.get("/api/talent?category=ARTESANIAS").status_code == 200
    assert patch(client, admin, SPARE, active=False).status_code == 200
    for url in ("/api/agenda?category=artesanias", "/api/opportunities?category=artesanias", "/api/agenda?category=rap"):
        assert client.get(url).status_code == 422, url
    assert client.get("/api/talent?category=ARTESANIAS").status_code in (400, 422)
    facets = client.get("/api/talent").json().get("facets", {}).get("categories", {})
    assert SPARE not in facets
