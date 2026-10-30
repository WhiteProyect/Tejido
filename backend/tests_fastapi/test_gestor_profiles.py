"""Perfil publico de gestores (#gestor/<slug>): slug, lectura publica sin fugas y edicion propia.

Schema aislado del conftest. Correos con monkeypatch. Cada test usa nombres de organizacion
unicos (uuid) para que los slugs no choquen con otros tests.
"""
import uuid

import pytest
from sqlalchemy import select

from backend.service.models.tables import Organization
from backend.service.services import email as email_service
from backend.tests_fastapi.test_gestor_category import body, category_ids  # noqa: F401
from backend.tests_fastapi.test_gestores_invites import GOOD_PASSWORD, schema_session
from backend.tests_fastapi.test_parity import auth_header, tokens  # noqa: F401
from backend.tests_fastapi.test_signup import mark_verified, signup_payload

IMG = "https://res.cloudinary.com/demo/image/upload/v1/tejido/gestores/foto.jpg"


@pytest.fixture
def admin(tokens):
    return auth_header(tokens, "admin")


@pytest.fixture(autouse=True)
def no_email(monkeypatch):
    for name in ("send_invite_email", "send_team_notification", "send_gestor_notification"):
        monkeypatch.setattr(email_service, name, lambda *a, **k: None)


@pytest.fixture
def cleanup(client, admin):
    branches = []
    yield branches
    for branch in branches:
        client.delete(f"/api/admin/branches/{branch}/leader", headers=admin)


def create_gestor(client, admin, org_name, branch="LITERATURA", activate=True, contact="privado 300 000 0000"):
    email = f"perfil-{uuid.uuid4().hex[:10]}@tejido-test.co"
    created = client.post("/api/admin/gestores", headers=admin, json={
        "name": f"Persona {org_name}", "email": email, "organization_name": org_name, "branch": branch, "contact": contact})
    assert created.status_code == 200, created.text
    data = created.json()
    headers = None
    if activate:
        token = data["invite_link"].rsplit("/#invitacion/", 1)[1]
        accepted = client.post("/api/auth/accept-invite", json={"token": token, "password": GOOD_PASSWORD})
        assert accepted.status_code == 200, accepted.text
        headers = {"Authorization": f"Bearer {accepted.json()['token']}"}
    with schema_session() as db:
        slug = db.execute(select(Organization.slug).where(Organization.id == data["organization_id"])).scalar_one()
    return {"headers": headers, "user_id": data["user_id"], "org_id": data["organization_id"], "email": email, "slug": slug}


def unique(prefix="Colectivo"):
    return f"{prefix} {uuid.uuid4().hex[:6]}"


# ─────────────────────────── slug ───────────────────────────

def test_slug_unique_case_insensitive_stable_and_assigned_on_approval(client, admin):
    name = unique("Tambor Ñandú")
    first = create_gestor(client, admin, name)
    second = create_gestor(client, admin, name.upper())
    third = create_gestor(client, admin, name)
    base = first["slug"]
    assert base.startswith("tambor-nandu-") and base == base.lower()
    assert (second["slug"], third["slug"]) == (f"{base}-2", f"{base}-3")

    # Renombrar no cambia el slug.
    assert client.patch("/api/me/profile", json={"name": "Otro nombre"}, headers=first["headers"]).status_code == 200
    assert client.patch("/api/me/organization", json={"name": "Otro mas"}, headers=first["headers"]).status_code == 200
    assert client.get(f"/api/gestores/{base}").json()["name"] == "Otro mas"
    assert client.get(f"/api/gestores/{base.upper()}").status_code == 200

    # Aprobar una solicitud crea la organizacion con slug.
    citizen_name = unique("Ciudadana Slug")
    signup = client.post("/api/auth/signup", json=signup_payload(citizen_name, f"s-{uuid.uuid4().hex[:8]}@tejido-test.co"))
    mark_verified(signup.json()["user"]["id"])
    cit = {"Authorization": f"Bearer {signup.json()['token']}"}
    req = client.post("/api/branch-requests", json={"branch": "LITERATURA"}, headers=cit).json()
    assert client.post(f"/api/branches/LITERATURA/requests/{req['id']}/approve", headers=admin).status_code == 200
    profile = client.get("/api/me/profile", headers=cit).json()
    assert profile["slug"].startswith("ciudadana-slug-") and client.get(f"/api/gestores/{profile['slug']}").status_code == 200


# ─────────────────────────── perfil publico ───────────────────────────

def test_public_profile_404s(client, admin):
    assert client.get("/api/gestores/no-existe-este-perfil").status_code == 404
    pending = create_gestor(client, admin, unique(), activate=False)
    assert client.get(f"/api/gestores/{pending['slug']}").status_code == 404

    g = create_gestor(client, admin, unique())
    assert client.get(f"/api/gestores/{g['slug']}").status_code == 200
    assert client.patch(f"/api/admin/gestores/{g['user_id']}", json={"active": False}, headers=admin).status_code == 200
    assert client.get(f"/api/gestores/{g['slug']}").status_code == 404
    client.patch(f"/api/admin/gestores/{g['user_id']}", json={"active": True}, headers=admin)

    # Oculto por el admin: 404, sin enlace en la lista y en el admin se ve el estado.
    assert client.patch(f"/api/admin/gestores/{g['user_id']}", json={"profile_hidden": True}, headers=admin).status_code == 200
    assert client.get(f"/api/gestores/{g['slug']}").status_code == 404
    listed = next(x for x in client.get("/api/gestores?branch=LITERATURA").json() if x["id"] == g["org_id"])
    assert listed["slug"] is None
    row = next(x for x in client.get("/api/admin/gestores", headers=admin).json() if x["id"] == g["user_id"])
    assert row["profile_hidden"] is True and row["slug"] == g["slug"]
    # El gestor no puede cambiarlo.
    client.patch("/api/me/profile", json={"profile_hidden": False, "slug": "otro", "branch": "DANZA", "is_leader": True}, headers=g["headers"])
    me = client.get("/api/me/profile", headers=g["headers"]).json()
    assert (me["profile_hidden"], me["slug"], me["branch"], me["is_leader"]) == (True, g["slug"], "LITERATURA", False)
    client.patch(f"/api/admin/gestores/{g['user_id']}", json={"profile_hidden": False}, headers=admin)
    assert client.get(f"/api/gestores/{g['slug']}").status_code == 200


def test_full_public_profile_without_leaks(client, admin, category_ids, cleanup):
    branch = "ARTES_VISUALES"
    cleanup.append(branch)
    lead = create_gestor(client, admin, unique("Lider Perfil"), branch=branch)
    part = create_gestor(client, admin, unique("Participante Perfil"), branch=branch)
    assert client.put(f"/api/admin/branches/{branch}/leader", json={"gestor_id": lead["user_id"]}, headers=admin).status_code == 200
    h = lead["headers"]

    patch = client.patch("/api/me/profile", headers=h, json={
        "description": "Linea uno\nLinea dos", "tagline": "Arte en la calle", "cover_url": IMG, "photo_url": IMG,
        "founded_year": 2015, "municipality": "Caucasia", "has_venue": True, "address": "Calle 20 #10-30",
        "opening_hours": "Lunes a viernes", "map_url": "https://maps.google.com/?q=caucasia",
        "whatsapp": "+57 300-123 4567", "public_email": "Hola@Colectivo.co", "website": "https://colectivo.co",
        "show_whatsapp": True, "show_public_email": False, "show_website": True,
        "seeking_text": "Buscamos muralistas", "achievements": "Premio 2024\n\nAlianza con la Casa de la Cultura\n",
    })
    assert patch.status_code == 200, patch.text
    assert patch.json()["whatsapp"] == "+573001234567" and patch.json()["public_email"] == "hola@colectivo.co"
    assert client.put("/api/me/profile/social-links", headers=h, json={"links": [
        {"platform": "instagram", "url": "https://instagram.com/colectivo"},
        {"platform": "otro", "url": "https://bandcamp.com/colectivo", "label": "Bandcamp"}]}).status_code == 200
    hl = client.post("/api/me/profile/highlights", headers=h, json={
        "title": "Muralismo", "when_text": "Cada diciembre", "description": "Pintamos la ciudad",
        "images": [{"url": IMG, "alt_text": "Mural", "caption": "Barrio Centro"}]})
    assert hl.status_code == 201 and hl.json()["images"][0]["alt_text"] == "Mural"
    assert client.put("/api/me/profile/gallery", headers=h, json={"images": [{"url": IMG, "alt_text": "Taller"}]}).status_code == 200

    published = client.post("/api/publications", json=body(category_ids, "Publicada del lider"), headers=h).json()["id"]
    client.post(f"/api/publications/{published}/submit", headers=h)
    client.patch(f"/api/publications/{published}/status", json={"status": "PUBLISHED", "note": ""}, headers=admin)
    draft = client.post("/api/publications", json=body(category_ids, "Borrador del lider"), headers=h).json()["id"]

    resp = client.get(f"/api/gestores/{lead['slug']}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_leader"] is True and data["branch_label"] == "Artes visuales" and data["gestor_name"].startswith("Persona")
    assert data["years_active"] >= 11 and data["description"] == "Linea uno\nLinea dos"
    assert data["contact"] == {"whatsapp": "+573001234567", "public_email": None, "website": "https://colectivo.co"}
    assert (data["address"], data["map_url"]) == ("Calle 20 #10-30", "https://maps.google.com/?q=caucasia")
    assert data["achievements"] == ["Premio 2024", "Alianza con la Casa de la Cultura"]
    assert data["seeking_text"] == "Buscamos muralistas"
    assert [l["platform"] for l in data["social_links"]] == ["instagram", "otro"] and data["social_links"][1]["label"] == "Bandcamp"
    assert data["highlights"][0]["title"] == "Muralismo" and len(data["gallery"]) == 1
    assert [p["id"] for p in data["publications"]] == [published] and draft not in [p["id"] for p in data["publications"]]
    # Otros tests tambien dejan participantes en esta rama: se busca al propio, sin conteo exacto.
    member = next(m for m in data["team"] if m["slug"] == part["slug"])
    assert member == {"name": client.get(f"/api/gestores/{part['slug']}").json()["name"], "photo_url": None, "slug": part["slug"]}
    assert data["team_count"] >= len(data["team"]) >= 1 and lead["slug"] not in {m["slug"] for m in data["team"]}
    # No fuga: ni correo del usuario, ni contact privado, ni user_id, ni el correo publico oculto.
    for leaked in (lead["email"], "privado 300 000 0000", "hola@colectivo.co"):
        assert leaked not in resp.text
    assert not {"user_id", "contact_private", "email", "profile_hidden", "show_whatsapp"} & set(data)

    # Sin sede: no salen direccion ni horario.
    client.patch("/api/me/profile", json={"has_venue": False}, headers=h)
    assert "address" not in client.get(f"/api/gestores/{lead['slug']}").json()

    # Participante: ve a su lider y no tiene "buscamos".
    client.patch("/api/me/profile", json={"seeking_text": "No deberia guardarse"}, headers=part["headers"])
    part_data = client.get(f"/api/gestores/{part['slug']}").json()
    assert part_data["leader"]["slug"] == lead["slug"] and part_data["seeking_text"] is None and "team" not in part_data
    assert client.get("/api/me/profile", headers=part["headers"]).json()["seeking_text"] is None

    # Detalle de la publicacion enlaza al perfil.
    detail = client.get(f"/api/publications/{published}").json()
    assert detail["author_slug"] == lead["slug"] and detail["author_organization"]["name"] == data["name"]


# ─────────────────────────── escritura ───────────────────────────

def test_write_limits_validation_and_ownership(client, tokens, admin):
    a = create_gestor(client, admin, unique())
    b = create_gestor(client, admin, unique())
    h = a["headers"]

    for bad in ({"map_url": "http://maps.google.com"}, {"website": "javascript:alert(1)"}, {"cover_url": "data:image/png;base64,xx"},
                {"whatsapp": "llamame"}, {"whatsapp": "+" + "1" * 25}, {"founded_year": 1800}, {"founded_year": 3000},
                {"public_email": "no-es-correo"}, {"tagline": "x" * 141}, {"achievements": "x" * 801}):
        assert client.patch("/api/me/profile", json=bad, headers=h).status_code == 400, bad

    links = [{"platform": "instagram", "url": f"https://instagram.com/{i}"} for i in range(9)]
    assert client.put("/api/me/profile/social-links", json={"links": links}, headers=h).status_code == 400
    assert client.put("/api/me/profile/social-links", json={"links": [{"platform": "myspace", "url": "https://x.co"}]}, headers=h).status_code == 400
    assert client.put("/api/me/profile/social-links", json={"links": [{"platform": "x", "url": "http://x.com/a"}]}, headers=h).status_code == 400
    img = {"url": IMG}
    assert client.put("/api/me/profile/gallery", json={"images": [img] * 13}, headers=h).status_code == 400
    assert client.put("/api/me/profile/gallery", json={"images": [img] * 12}, headers=h).status_code == 200
    assert client.post("/api/me/profile/highlights", json={"title": "Con fotos", "images": [img] * 5}, headers=h).status_code == 400
    assert client.post("/api/me/profile/highlights", json={"description": "sin titulo"}, headers=h).status_code == 400
    ids = [client.post("/api/me/profile/highlights", json={"title": f"H{i}", "images": [img] * 4}, headers=h).json()["id"] for i in range(8)]
    assert client.post("/api/me/profile/highlights", json={"title": "Novena"}, headers=h).status_code == 409

    # Editar y borrar: solo lo propio.
    edited = client.patch(f"/api/me/profile/highlights/{ids[0]}", json={"title": "Editada", "images": [img]}, headers=h)
    assert edited.status_code == 200 and edited.json()["title"] == "Editada" and len(edited.json()["images"]) == 1
    assert client.patch(f"/api/me/profile/highlights/{ids[0]}", json={"title": "Ajena"}, headers=b["headers"]).status_code == 404
    assert client.delete(f"/api/me/profile/highlights/{ids[1]}", headers=b["headers"]).status_code == 404
    assert client.delete(f"/api/me/profile/highlights/{ids[1]}", headers=h).status_code == 200
    assert len(client.get("/api/me/profile", headers=h).json()["highlights"]) == 7
    assert client.get("/api/me/profile", headers=b["headers"]).json()["highlights"] == []

    # Ciudadano, anonimo y admin no tienen perfil de gestor.
    for headers in (auth_header(tokens, "ciudadano"), {}, admin):
        assert client.get("/api/me/profile", headers=headers).status_code == 403
        assert client.patch("/api/me/profile", json={"tagline": "x"}, headers=headers).status_code == 403


def test_compatibility_of_existing_endpoints(client, admin):
    g = create_gestor(client, admin, unique())
    org = client.get("/api/me/organization", headers=g["headers"]).json()
    assert set(org) == {"id", "name", "description", "photo_url", "contact", "branch"}
    listed = next(x for x in client.get("/api/gestores?branch=LITERATURA").json() if x["id"] == g["org_id"])
    assert set(listed) == {"id", "name", "branch", "photo_url", "is_leader", "slug"} and listed["slug"] == g["slug"]


# ─────────────────────────── vista previa (editor) ───────────────────────────

def test_preview_matches_public_and_works_while_hidden(client, tokens, admin):
    g = create_gestor(client, admin, unique("Vista previa"))
    other = create_gestor(client, admin, unique("Otro gestor"))
    h = g["headers"]
    client.patch("/api/me/profile", headers=h, json={
        "tagline": "Lema", "has_venue": False, "address": "Calle oculta 1",
        "whatsapp": "3001234567", "show_whatsapp": False, "website": "https://sitio.co", "show_website": True,
    })

    preview = client.get("/api/me/profile/preview", headers=h)
    assert preview.status_code == 200
    data = preview.json()
    assert data.pop("profile_hidden") is False
    assert data == client.get(f"/api/gestores/{g['slug']}").json()  # mismo payload que el publico
    assert data["contact"] == {"whatsapp": None, "public_email": None, "website": "https://sitio.co"}
    assert "address" not in data  # sin sede no sale la direccion
    for leaked in (g["email"], "privado 300 000 0000", "3001234567"):
        assert leaked not in preview.text

    # Oculto por el admin: el publico da 404 y la vista previa sigue, avisandolo.
    client.patch(f"/api/admin/gestores/{g['user_id']}", json={"profile_hidden": True}, headers=admin)
    assert client.get(f"/api/gestores/{g['slug']}").status_code == 404
    hidden = client.get("/api/me/profile/preview", headers=h).json()
    assert hidden["profile_hidden"] is True and hidden["slug"] == g["slug"] and hidden["tagline"] == "Lema"

    # Cada gestor ve solo la suya; ciudadano, admin y anonimo no tienen.
    assert client.get("/api/me/profile/preview", headers=other["headers"]).json()["slug"] == other["slug"]
    for headers in (auth_header(tokens, "ciudadano"), admin, {}):
        assert client.get("/api/me/profile/preview", headers=headers).status_code == 403
