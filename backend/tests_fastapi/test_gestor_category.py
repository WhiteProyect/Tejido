"""Gestores por categoria (Fase 1): el gestor publica solo en su rama, editar una publicada la
devuelve a revision, el admin conserva el estado al editar y GET /api/me/category.

Schema aislado del conftest. El gestor demo (user 2) tiene rama PATRIMONIO_MEMORIA solo en el
schema de test (conftest.py). Los gestores extra se crean con client directo (no hit()) para no
alterar el reporte de linea base, y el envio de correo se reemplaza (sin red).
"""
import uuid

import pytest
from sqlalchemy import text

from backend.tests_fastapi.test_parity import auth_header, tokens  # noqa: F401

BRANCH = "PATRIMONIO_MEMORIA"
OTHER_KEYS = {"id", "title", "kind", "status", "author", "start_date", "image"}


@pytest.fixture
def no_email(monkeypatch):
    from backend.service.services import email as email_service

    monkeypatch.setattr(email_service, "send_invite_email", lambda *args, **kwargs: None)


@pytest.fixture
def category_ids(client):
    return {c["type"]: c["id"] for c in client.get("/api/categories").json()}


@pytest.fixture
def admin(tokens):
    return auth_header(tokens, "admin")


@pytest.fixture
def gestor(tokens):
    return auth_header(tokens, "gestor")


def new_gestor(client, admin, branch, name="Gestora"):
    """Gestor activo con sesion: alta por el admin + aceptar la invitacion."""
    payload = {"name": name, "email": f"cat-{uuid.uuid4().hex[:10]}@tejido-test.co",
               "organization_name": f"{name} Colectivo", "branch": branch}
    created = client.post("/api/admin/gestores", json=payload, headers=admin)
    assert created.status_code == 200, created.text
    token = created.json()["invite_link"].rsplit("/#invitacion/", 1)[1]
    accepted = client.post("/api/auth/accept-invite", json={"token": token, "password": "clave-segura-123"})
    assert accepted.status_code == 200, accepted.text
    return {"Authorization": f"Bearer {accepted.json()['token']}"}, created.json()


def body(category_ids, title, **extra):
    return {
        "kind": "HISTORIA", "category_id": category_ids["HISTORIA"], "title": title,
        "summary": "Resumen de prueba para la categoria del gestor.",
        "content": "Contenido de prueba con longitud suficiente para la categoria del gestor.",
        **extra,
    }


def create(client, headers, category_ids, title, **extra):
    resp = client.post("/api/publications", json=body(category_ids, title, **extra), headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def detail(client, pub_id, headers):
    return client.get(f"/api/publications/{pub_id}", headers=headers).json()


def public_ids(client):
    return {p["id"] for p in client.get("/api/publications").json()}


def clear_branch(client, user_id):
    from backend.service.db.session import get_db
    from backend.service.main import app

    gen = app.dependency_overrides[get_db]()
    db = next(gen)
    db.execute(text("UPDATE organizations SET branch = NULL WHERE user_id = :uid"), {"uid": user_id})
    db.commit()
    gen.close()


# ───────────────────────── regla de categoria ─────────────────────────

def test_gestor_publishes_only_in_own_branch(client, admin, gestor, category_ids, no_email):
    auto = create(client, gestor, category_ids, "Categoria asignada sola")
    assert detail(client, auto, gestor)["cultural_category"] == BRANCH
    explicit = create(client, gestor, category_ids, "Categoria explicita propia", cultural_category="patrimonio_memoria")
    assert detail(client, explicit, gestor)["cultural_category"] == BRANCH

    other = client.post("/api/publications", json=body(category_ids, "En otra categoria", cultural_category="DANZA"), headers=gestor)
    assert other.status_code == 403
    assert other.json()["message"] == "Solo puedes publicar en tu categoría: Patrimonio y memoria"
    # Editar hacia otra categoria tampoco; dejarla vacia la vuelve a su rama.
    assert client.put(f"/api/publications/{auto}", json=body(category_ids, "Editada a otra", cultural_category="DANZA"), headers=gestor).status_code == 403
    assert client.put(f"/api/publications/{auto}", json=body(category_ids, "Editada sin categoria"), headers=gestor).status_code == 200
    assert detail(client, auto, gestor)["cultural_category"] == BRANCH

    # El admin no tiene restriccion: cualquier categoria o ninguna.
    free = create(client, admin, category_ids, "Del admin en danza", cultural_category="DANZA")
    assert detail(client, free, admin)["cultural_category"] == "DANZA"
    assert detail(client, create(client, admin, category_ids, "Del admin sin categoria"), admin)["cultural_category"] is None

    # Gestor sin rama: 409 al crear (y al editar).
    headers, created = new_gestor(client, admin, "TEATRO", name="Sin Rama")
    own = create(client, headers, category_ids, "Antes de quitarle la rama")
    clear_branch(client, created["user_id"])
    resp = client.post("/api/publications", json=body(category_ids, "Sin rama asignada"), headers=headers)
    assert resp.status_code == 409 and "Todavía no tienes una categoría asignada" in resp.json()["message"]
    assert client.put(f"/api/publications/{own}", json=body(category_ids, "Editar sin rama"), headers=headers).status_code == 409


# ───────────────────────── semantica de edicion ─────────────────────────

def test_edit_semantics_by_role_and_status(client, admin, gestor, category_ids, no_email):
    pub = create(client, gestor, category_ids, "Ciclo de edicion")
    put = lambda headers, title, **extra: client.put(f"/api/publications/{pub}", json=body(category_ids, title, **extra), headers=headers)
    status = lambda: detail(client, pub, admin)["status"]

    assert put(gestor, "Borrador editado").status_code == 200 and status() == "DRAFT"
    client.post(f"/api/publications/{pub}/submit", headers=gestor)
    assert status() == "REVIEW"
    assert put(gestor, "Editada en revision").status_code == 409

    # Admin: conserva REVIEW al editar; rechaza con nota; el gestor edita la rechazada -> DRAFT sin nota.
    assert put(admin, "El admin corrige en revision").status_code == 200 and status() == "REVIEW"
    client.patch(f"/api/publications/{pub}/status", json={"status": "REJECTED", "note": "Falta la fecha"}, headers=admin)
    assert put(admin, "El admin corrige la rechazada").status_code == 200
    assert status() == "REJECTED" and detail(client, pub, admin)["moderation_note"] == "Falta la fecha"
    assert put(gestor, "Rechazada corregida").status_code == 200
    after = detail(client, pub, gestor)
    assert after["status"] == "DRAFT" and after["moderation_note"] is None

    # Publicada: el gestor la edita -> REVIEW y desaparece del listado publico.
    client.post(f"/api/publications/{pub}/submit", headers=gestor)
    client.patch(f"/api/publications/{pub}/status", json={"status": "PUBLISHED", "note": ""}, headers=admin)
    assert pub in public_ids(client)
    assert put(gestor, "Publicada editada por su autor").status_code == 200
    assert status() == "REVIEW"
    assert pub not in public_ids(client)
    assert client.get(f"/api/publications/{pub}").status_code == 403

    # Admin con publish: queda publicada en la misma operacion; sin publish conserva el estado.
    assert put(admin, "Aprobada al editar", publish=True).status_code == 200
    assert status() == "PUBLISHED" and pub in public_ids(client)
    assert put(admin, "Editada sin despublicar").status_code == 200 and status() == "PUBLISHED"
    # publish lo ignora un gestor.
    assert put(gestor, "Gestor pide publicar", publish=True).status_code == 200 and status() == "REVIEW"

    # Gestor que no es autor: 403.
    other, _ = new_gestor(client, admin, BRANCH, name="Colega Ajena")
    assert put(other, "Editada por otra gestora").status_code == 403


# ───────────────────────── GET /api/me/category ─────────────────────────

def test_me_category(client, tokens, admin, gestor, category_ids, no_email):
    colleague, colleague_info = new_gestor(client, admin, BRANCH, name="Colega Patrimonio")
    outsider, _ = new_gestor(client, admin, "LITERATURA", name="Gestora Literatura")

    draft = create(client, colleague, category_ids, "Borrador de la colega")
    review = create(client, colleague, category_ids, "En revision de la colega")
    client.post(f"/api/publications/{review}/submit", headers=colleague)
    rejected = create(client, colleague, category_ids, "Rechazada de la colega")
    client.post(f"/api/publications/{rejected}/submit", headers=colleague)
    client.patch(f"/api/publications/{rejected}/status", json={"status": "REJECTED", "note": "Motivo largo"}, headers=admin)
    by_admin = create(client, admin, category_ids, "Del admin en patrimonio", cultural_category=BRANCH, publish=True)
    elsewhere = create(client, outsider, category_ids, "De otra categoria")
    mine = create(client, gestor, category_ids, "Propia en patrimonio")

    resp = client.get("/api/me/category", headers=gestor)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["branch"] == BRANCH and data["label"] == "Patrimonio y memoria"
    assert set(data["organization"]) == {"name", "photo_url"}

    own = client.get("/api/publications?mine=1", headers=gestor).json()
    expected = {s: sum(1 for p in own if p["status"] == s) for s in ("DRAFT", "REVIEW", "REJECTED", "PUBLISHED")}
    assert data["counts"] == expected

    others = {p["id"]: p for p in data["others"]}
    assert review in others and by_admin in others
    assert draft not in others and rejected not in others and elsewhere not in others and mine not in others
    assert all(set(p) == OTHER_KEYS and p["status"] in ("PUBLISHED", "REVIEW") for p in data["others"])
    assert others[review]["author"] == "Colega Patrimonio"

    colleagues = data["colleagues"]
    assert colleague_info["organization_id"] in {c["id"] for c in colleagues}
    assert all(set(c) == {"id", "name", "photo_url"} for c in colleagues)
    assert "Gestora Literatura Colectivo" not in {c["name"] for c in colleagues}
    assert "Colectivo Rio Vivo" not in {c["name"] for c in colleagues}  # no se lista a si mismo

    for headers in ({}, admin, auth_header(tokens, "ciudadano")):
        assert client.get("/api/me/category", headers=headers).status_code == 403

    # Sin rama: no es error; listas vacias y sus conteos propios.
    clear_branch(client, colleague_info["user_id"])
    empty = client.get("/api/me/category", headers=colleague).json()
    assert empty["branch"] is None and empty["label"] is None
    assert empty["colleagues"] == [] and empty["others"] == []
    assert empty["counts"] == {"DRAFT": 1, "REVIEW": 1, "REJECTED": 1, "PUBLISHED": 0}
