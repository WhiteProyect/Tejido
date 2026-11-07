"""Lugares (publicaciones LUGAR con detalle en `places`) y categorias de lugar administrables.

Schema aislado del conftest. Ramas: GASTRONOMIA_CULTURAL (lider principal) y ARTES_VISUALES (lider de otra
rama); cada test deja las ramas sin lider. Los lugares creados se eliminan al final (borrado logico),
asi no quedan publicados para otras pruebas. Los correos se reemplazan con monkeypatch.
"""
import importlib.util
import uuid
from pathlib import Path

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, select, text, update

from backend.service.core.config import settings
from backend.service.models.tables import Place, PlaceCategory, Publication
from backend.service.services.auth import now_utc
from backend.tests_fastapi.test_branches import citizen, gestor, join, leader, sent  # noqa: F401
from backend.tests_fastapi.test_gestor_category import category_ids  # noqa: F401
from backend.tests_fastapi.test_gestores_invites import schema_session
from backend.tests_fastapi.test_parity import auth_header, tokens  # noqa: F401

ROOT = Path(__file__).resolve().parents[2]
BRANCH, OTHER = "GASTRONOMIA_CULTURAL", "ARTES_VISUALES"
CAUCASIA = {"latitude": 7.9847, "longitude": -75.1953}
FORBIDDEN = "Solo el equipo de TEJIDO y los líderes pueden agregar lugares"
EVENT_KEYS = {"key", "type", "id", "title", "summary", "image", "municipality", "municipality_label", "cultural_category",
              "category_label", "location", "start_date", "end_date", "tradition_text", "lat", "lng", "href"}
PLACE_KEYS = EVENT_KEYS | {"place_category", "address", "phone", "whatsapp", "opening_hours", "website"}
PRIVATE = {"author_id", "author", "user_id", "email", "moderation_note", "status", "deleted", "content", "link",
           "latitude", "place_category_id", "publication_id"}


@pytest.fixture
def admin(tokens):
    return auth_header(tokens, "admin")


@pytest.fixture
def cats(client):
    return {item["slug"]: item["id"] for item in client.get("/api/place-categories").json()}


@pytest.fixture
def team(client, admin, sent):  # noqa: F811
    """Lider de BRANCH, lider de OTHER, un participante de BRANCH y un gestor comun (de OTHER)."""
    lead_h, lead_id, _ = leader(client, admin, BRANCH, "Lider Lugares")
    other_h, other_id, _ = leader(client, admin, OTHER, "Lider Otra Rama")
    part_h, _, _ = join(client, admin, lead_h, BRANCH, "Participante Lugares")
    common_h, _, _ = gestor(client, admin, OTHER, "Gestor Comun")
    yield {"lider": lead_h, "lider_id": lead_id, "otro_lider": other_h, "otro_lider_id": other_id,
           "participante": part_h, "gestor": common_h}
    for branch in (BRANCH, OTHER):
        client.delete(f"/api/admin/branches/{branch}/leader", headers=admin)


def place(category_ids, cats, title=None, **extra):
    data = {"kind": "LUGAR", "category_id": category_ids["LUGAR"], "title": title or f"Lugar {uuid.uuid4().hex[:6]}",
            "municipality": "caucasia", "location": "Calle 20 # 5-10, Centro", "place_category_id": cats["restaurantes"],
            **CAUCASIA, **extra}
    return {key: value for key, value in data.items() if value is not ...}


def create(client, headers, category_ids, cats, **extra):
    resp = client.post("/api/publications", json=place(category_ids, cats, **extra), headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def detail(client, pub, headers=None):
    resp = client.get(f"/api/publications/{pub}", headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


def remove(client, admin, *pubs):
    for pub in pubs:
        client.delete(f"/api/publications/{pub}", headers=admin)


def map_points(client, **params):
    resp = client.get("/api/map/points", params=params)
    assert resp.status_code == 200, resp.text
    return {p["key"]: p for p in resp.json()["points"]}


# ─────────────────────────── permisos ───────────────────────────

def test_only_admin_and_leaders_create_places(client, tokens, admin, team, category_ids, cats):
    created = [create(client, admin, category_ids, cats, publish=True), create(client, team["lider"], category_ids, cats)]
    try:
        assert detail(client, created[0])["status"] == "PUBLISHED"
        assert detail(client, created[1], team["lider"])["status"] == "DRAFT"  # el lider no publica
        citizen_h = auth_header(tokens, "ciudadano")
        for headers in (team["gestor"], team["participante"], citizen_h, None):
            resp = client.post("/api/publications", json=place(category_ids, cats), headers=headers)
            assert resp.status_code == 403 and resp.json() == {"error": "FORBIDDEN", "message": FORBIDDEN}
        # Un gestor comun tampoco convierte su publicacion en lugar.
        story = client.post("/api/publications", headers=team["gestor"], json={
            "kind": "HISTORIA", "category_id": category_ids["HISTORIA"], "title": "Historia del gestor comun",
            "summary": "Resumen de la historia.", "content": "Contenido suficiente de la historia.", "municipality": "caucasia"})
        assert story.status_code == 201, story.text
        created.append(story.json()["id"])
        resp = client.put(f"/api/publications/{created[-1]}", json=place(category_ids, cats), headers=team["gestor"])
        assert resp.status_code == 403 and resp.json()["message"] == FORBIDDEN
    finally:
        remove(client, admin, *created)


def test_a_former_leader_cannot_edit_submit_or_delete_places(client, admin, team, category_ids, cats):
    pub = create(client, team["lider"], category_ids, cats)
    try:
        # El admin le quita el liderazgo: queda como participante de la rama.
        assert client.delete(f"/api/admin/branches/{BRANCH}/leader", headers=admin).status_code == 200
        for method, url, body in (("PUT", f"/api/publications/{pub}", place(category_ids, cats)),
                                  ("POST", f"/api/publications/{pub}/submit", None),
                                  ("DELETE", f"/api/publications/{pub}", None)):
            resp = client.request(method, url, json=body, headers=team["lider"])
            assert resp.status_code == 403 and resp.json()["message"] == FORBIDDEN, (method, resp.text)
        assert client.delete(f"/api/publications/{pub}", headers=admin).status_code == 200
    finally:
        remove(client, admin, pub)


# ─────────────────────────── obligatorios y limites ───────────────────────────

@pytest.mark.parametrize("extra, code, message", [
    ({"place_category_id": ...}, "PLACE_CATEGORY_REQUIRED", "Elige la categoría del lugar"),
    ({"place_category_id": ""}, "PLACE_CATEGORY_REQUIRED", "Elige la categoría del lugar"),
    ({"place_category_id": 999999}, "INVALID_PLACE_CATEGORY", "Esa categoría de lugar no existe o está desactivada"),
    ({"place_category_id": "uno"}, "INVALID_PLACE_CATEGORY", "Esa categoría de lugar no existe o está desactivada"),
    ({"place_category_id": True}, "INVALID_PLACE_CATEGORY", "Esa categoría de lugar no existe o está desactivada"),
    ({"location": ...}, "ADDRESS_REQUIRED", "Escribe la dirección o una referencia para llegar"),
    ({"location": "   "}, "ADDRESS_REQUIRED", "Escribe la dirección o una referencia para llegar"),
    ({"location": "x" * 161}, "INVALID_ADDRESS", "La dirección o referencia puede tener hasta 160 caracteres"),
    ({"latitude": ..., "longitude": ...}, "POINT_REQUIRED", "Marca el punto exacto del lugar en el mapa"),
    ({"latitude": 6.25, "longitude": -75.56}, "POINT_OUT_OF_AREA", "El punto debe estar dentro del Bajo Cauca"),
    ({"latitude": "norte", "longitude": -75.1}, "INVALID_POINT", "Las coordenadas del punto deben ser números"),
    ({"municipality": ...}, "MUNICIPALITY_REQUIRED", "Elige el municipio de la publicación"),
    ({"phone": "300-ABC-1234"}, "INVALID_PHONE", "Escribe el teléfono solo con números y los signos + - ( )"),
    ({"phone": "12345"}, "INVALID_PHONE", "Escribe el teléfono solo con números y los signos + - ( )"),
    ({"phone": "1" * 31}, "INVALID_PHONE", "El teléfono puede tener hasta 30 caracteres"),
    ({"whatsapp": "wa.me/300"}, "INVALID_WHATSAPP", "Escribe el WhatsApp solo con números y los signos + - ( )"),
    ({"whatsapp": "300 123"}, "INVALID_WHATSAPP",
     "Escribe el WhatsApp con 10 dígitos (celular de Colombia) o con su indicativo, p. ej. +57 300 123 4567"),
    ({"whatsapp": "+1234567890123456"}, "INVALID_WHATSAPP",
     "Escribe el WhatsApp con 10 dígitos (celular de Colombia) o con su indicativo, p. ej. +57 300 123 4567"),
    ({"website": "www.ejemplo.co"}, "INVALID_WEBSITE", "El sitio web debe ser una dirección que empiece por http:// o https://"),
    ({"website": "javascript:alert(1)"}, "INVALID_WEBSITE", "El sitio web debe ser una dirección que empiece por http:// o https://"),
    ({"website": "https://ejemplo.co/" + "a" * 190}, "INVALID_WEBSITE", "El sitio web puede tener hasta 200 caracteres"),
    ({"opening_hours": "L" * 201}, "INVALID_OPENING_HOURS", "El horario puede tener hasta 200 caracteres"),
])
def test_place_required_fields_and_limits(client, admin, category_ids, cats, extra, code, message):
    resp = client.post("/api/publications", json=place(category_ids, cats, **extra), headers=admin)
    assert resp.status_code == 422 and resp.json() == {"error": code, "message": message}


def test_title_is_still_required_and_texts_are_optional(client, admin, category_ids, cats):
    resp = client.post("/api/publications", json=place(category_ids, cats, title="Bar"), headers=admin)
    assert resp.status_code == 400 and resp.json()["message"] == "El título debe tener entre 5 y 180 caracteres"
    resp = client.post("/api/publications", json=place(category_ids, cats, summary="r" * 501), headers=admin)
    assert resp.status_code == 400 and resp.json()["message"] == "El resumen puede tener hasta 500 caracteres"
    pub = create(client, admin, category_ids, cats, location="  Frente al <b>parque</b>  principal ")
    try:
        data = detail(client, pub, admin)
        assert (data["summary"], data["content"]) == ("", "")
        assert data["location"] == data["address"] == "Frente al parque principal"
        assert (data["latitude"], data["longitude"]) == (7.9847, -75.1953)
    finally:
        remove(client, admin, pub)
    # Los demas tipos siguen exigiendo resumen y contenido, y "Caucasia" como lugar por defecto.
    resp = client.post("/api/publications", headers=admin, json={
        "kind": "HISTORIA", "category_id": category_ids["HISTORIA"], "title": "Historia sin resumen", "municipality": "caucasia",
        "content": "Contenido suficiente de la historia."})
    assert resp.status_code == 400 and resp.json()["message"] == "El resumen debe tener entre 10 y 500 caracteres"


@pytest.mark.parametrize("raw, stored", [
    ("300 123 4567", "573001234567"),            # celular sin indicativo: Colombia
    ("(604) 839-1234", "576048391234"),          # fijo de 10 digitos sin indicativo
    ("+57 300 123 4567", "573001234567"),
    ("57 300 123 4567", "573001234567"),
    ("0057 300 123 4567", "573001234567"),
    ("+1 (305) 555-0100", "13055550100"),         # otro pais con su indicativo
    ("  ", None),
])
def test_whatsapp_is_normalized_to_digits_with_country_code(client, admin, category_ids, cats, raw, stored):
    pub = create(client, admin, category_ids, cats, whatsapp=raw, phone=" (604)   839-1234 ")
    try:
        data = detail(client, pub, admin)
        assert data["whatsapp"] == stored
        assert data["phone"] == "(604) 839-1234"
    finally:
        remove(client, admin, pub)


def test_place_fields_survive_edits_upsert(client, admin, category_ids, cats):
    full = {"phone": "604 839 1234", "whatsapp": "3001234567", "opening_hours": "Lunes a sábado, 8 a. m. a 6 p. m.",
            "website": "https://ejemplo.co/lugar", "place_category_id": cats["hoteles"]}
    pub = create(client, admin, category_ids, cats, publish=True, **full)
    try:
        with schema_session() as db:
            row_id = db.execute(select(Place.id).where(Place.publication_id == pub)).scalar_one()
        # Editar sin mandar los opcionales los conserva (y la fila es la misma).
        body = place(category_ids, cats, title="Hotel renombrado", place_category_id=cats["hoteles"])
        assert client.put(f"/api/publications/{pub}", json=body, headers=admin).status_code == 200
        data = detail(client, pub)
        assert data["title"] == "Hotel renombrado" and data["status"] == "PUBLISHED"
        assert (data["phone"], data["whatsapp"], data["website"]) == ("604 839 1234", "573001234567", "https://ejemplo.co/lugar")
        assert data["opening_hours"] == "Lunes a sábado, 8 a. m. a 6 p. m."
        assert data["place_category"] == {"id": cats["hoteles"], "slug": "hoteles", "label": "Hoteles", "icon": "bed",
                                          "color": "morado", "active": True}
        # Mandarlos vacios los borra; cambiar la categoria la cambia.
        body.update(phone="", website=None, place_category_id=cats["miradores"])
        assert client.put(f"/api/publications/{pub}", json=body, headers=admin).status_code == 200
        data = detail(client, pub)
        assert (data["phone"], data["website"], data["whatsapp"]) == (None, None, "573001234567")
        assert data["place_category"]["slug"] == "miradores"
        with schema_session() as db:
            assert db.execute(select(Place.id).where(Place.publication_id == pub)).scalar_one() == row_id
        # Cambiar de tipo quita el detalle y el punto.
        story = {"kind": "HISTORIA", "category_id": category_ids["HISTORIA"], "title": "Ya no es un lugar",
                 "summary": "Resumen de la historia.", "content": "Contenido suficiente de la historia.", "municipality": "caucasia"}
        assert client.put(f"/api/publications/{pub}", json=story, headers=admin).status_code == 200
        data = detail(client, pub)
        assert "place_category" not in data and "whatsapp" not in data and data["latitude"] is None
        with schema_session() as db:
            assert db.execute(select(Place.id).where(Place.publication_id == pub)).first() is None
    finally:
        remove(client, admin, pub)


def test_other_kinds_ignore_place_fields(client, admin, category_ids, cats):
    resp = client.post("/api/publications", headers=admin, json={
        "kind": "HISTORIA", "category_id": category_ids["HISTORIA"], "title": "Historia con campos de lugar",
        "summary": "Resumen de la historia.", "content": "Contenido suficiente de la historia.", "municipality": "caucasia",
        "place_category_id": cats["parques"], "whatsapp": "no es un numero", "website": "ftp://x"})
    assert resp.status_code == 201, resp.text
    pub = resp.json()["id"]
    try:
        data = detail(client, pub, admin)
        assert not {"place_category", "whatsapp", "website", "address"} & set(data)
        with schema_session() as db:
            assert db.execute(select(Place.id).where(Place.publication_id == pub)).first() is None
    finally:
        remove(client, admin, pub)


# ─────────────────────────── categoria cultural ───────────────────────────

def test_cultural_category_is_optional_in_places(client, admin, team, category_ids, cats):
    created = []
    try:
        created.append(create(client, admin, category_ids, cats, cultural_category="MUSICA"))
        assert detail(client, created[-1], admin)["cultural_category"] == "MUSICA"
        created.append(create(client, admin, category_ids, cats))
        assert detail(client, created[-1], admin)["cultural_category"] is None
        # Lider: ninguna (no se le asigna su rama) o la suya; otra, 403.
        created.append(create(client, team["lider"], category_ids, cats))
        assert detail(client, created[-1], team["lider"])["cultural_category"] is None
        created.append(create(client, team["lider"], category_ids, cats, cultural_category=BRANCH))
        assert detail(client, created[-1], team["lider"])["cultural_category"] == BRANCH
        resp = client.post("/api/publications", json=place(category_ids, cats, cultural_category=OTHER), headers=team["lider"])
        assert resp.status_code == 403
        assert resp.json()["message"] == "En un lugar solo puedes elegir tu rama (Gastronomía cultural) o dejarlo sin categoría cultural"
        resp = client.put(f"/api/publications/{created[-1]}", json=place(category_ids, cats, cultural_category=OTHER),
                          headers=team["lider"])
        assert resp.status_code == 403
        # Los demas tipos del lider conservan la regla de siempre: vacia = su rama.
        resp = client.post("/api/publications", headers=team["lider"], json={
            "kind": "HISTORIA", "category_id": category_ids["HISTORIA"], "title": "Historia del lider",
            "summary": "Resumen de la historia.", "content": "Contenido suficiente de la historia.", "municipality": "caucasia"})
        created.append(resp.json()["id"])
        assert detail(client, created[-1], team["lider"])["cultural_category"] == BRANCH
    finally:
        remove(client, admin, *created)


# ─────────────────────────── moderacion ───────────────────────────

def test_leader_places_are_approved_only_by_admin(client, admin, team, sent, category_ids, cats):  # noqa: F811
    pub = create(client, team["lider"], category_ids, cats, cultural_category=BRANCH)
    other = create(client, team["otro_lider"], category_ids, cats, cultural_category=OTHER)
    try:
        before = {key: len(value) for key, value in sent.items()}
        for item, headers in ((pub, team["lider"]), (other, team["otro_lider"])):
            assert client.post(f"/api/publications/{item}/submit", headers=headers).status_code == 200
        # El aviso va al equipo, nunca a un lider.
        assert len(sent["team"]) == before["team"] + 2 and len(sent["to"]) == before["to"]
        # Ningun lider lo aprueba: ni el propio ni el de otra rama (ni uno nuevo de la misma rama).
        for item, headers in ((pub, team["lider"]), (pub, team["otro_lider"]), (other, team["lider"]), (other, team["otro_lider"])):
            resp = client.patch(f"/api/publications/{item}/status", json={"status": "PUBLISHED"}, headers=headers)
            assert resp.status_code == 403, resp.text
        for branch, headers in ((BRANCH, team["lider"]), (OTHER, team["otro_lider"])):
            queue = client.get(f"/api/branches/{branch}/review-queue", headers=headers).json()
            assert not {pub, other} & {row["id"] for row in queue}
        assert client.get(f"/api/publications/{other}", headers=team["lider"]).status_code == 403
        # El admin si lo ve en su cola y lo aprueba.
        review = {p["id"] for p in client.get("/api/publications?status=REVIEW", headers=admin).json()}
        assert {pub, other} <= review
        for item in (pub, other):
            assert client.patch(f"/api/publications/{item}/status", json={"status": "PUBLISHED"}, headers=admin).status_code == 200
        # Cada edicion del lider sobre un lugar publicado lo devuelve a revision.
        resp = client.put(f"/api/publications/{pub}", json=place(category_ids, cats, cultural_category=BRANCH, title="Lugar editado"),
                          headers=team["lider"])
        assert resp.status_code == 200
        assert detail(client, pub, team["lider"])["status"] == "REVIEW"
        assert f"lugar-{pub}" not in map_points(client)
        resp = client.patch(f"/api/publications/{pub}/status", json={"status": "REJECTED", "note": "Falta la foto"}, headers=admin)
        assert resp.status_code == 200
    finally:
        remove(client, admin, pub, other)


def test_a_new_leader_does_not_moderate_the_previous_leaders_place(client, admin, team, category_ids, cats):
    pub = create(client, team["lider"], category_ids, cats, cultural_category=BRANCH)
    try:
        assert client.post(f"/api/publications/{pub}/submit", headers=team["lider"]).status_code == 200
        new_h, new_id, _ = gestor(client, admin, BRANCH, "Nuevo Lider")
        assert client.put(f"/api/admin/branches/{BRANCH}/leader", json={"gestor_id": new_id}, headers=admin).status_code == 200
        # El lider anterior ahora es participante de la rama, pero su lugar sigue siendo del admin.
        assert pub not in {row["id"] for row in client.get(f"/api/branches/{BRANCH}/review-queue", headers=new_h).json()}
        assert client.patch(f"/api/publications/{pub}/status", json={"status": "PUBLISHED"}, headers=new_h).status_code == 403
        assert client.get(f"/api/publications/{pub}", headers=new_h).status_code == 403
        assert client.patch(f"/api/publications/{pub}/status", json={"status": "PUBLISHED"}, headers=admin).status_code == 200
    finally:
        remove(client, admin, pub)


# ─────────────────────────── categorias de lugar ───────────────────────────

def test_public_place_categories(client):
    data = client.get("/api/place-categories").json()
    assert [item["slug"] for item in data][:7] == ["restaurantes", "hoteles", "miradores", "parques", "canchas-libres",
                                                    "puestos-gastronomicos", "sitios-culturales"]
    assert all(set(item) == {"id", "slug", "label", "icon", "color"} for item in data)
    assert data[0] == {"id": data[0]["id"], "slug": "restaurantes", "label": "Restaurantes", "icon": "utensils", "color": "ocre"}


def test_place_categories_admin_only(client, tokens, admin, team):
    citizen_h = auth_header(tokens, "ciudadano")
    for headers in (team["lider"], team["gestor"], citizen_h, None):
        assert client.get("/api/admin/place-categories", headers=headers).status_code == 403
        assert client.post("/api/admin/place-categories", json={"label": "Nueva"}, headers=headers).status_code == 403
        assert client.patch("/api/admin/place-categories/1", json={"active": False}, headers=headers).status_code == 403
        assert client.post("/api/admin/place-categories/1/move", json={"direction": "up"}, headers=headers).status_code == 403
        assert client.delete("/api/admin/place-categories/1", headers=headers).status_code == 403


def test_place_categories_crud(client, admin, category_ids, cats):
    base = "/api/admin/place-categories"
    created = client.post(base, json={"label": "  Cafés y <i>heladerías</i> ", "icon": "coffee", "color": "rio"}, headers=admin)
    assert created.status_code == 201, created.text
    cafe = created.json()
    assert cafe == {"id": cafe["id"], "slug": "cafes-y-heladerias", "label": "Cafés y heladerías", "icon": "coffee", "color": "rio"}
    plain = client.post(base, json={"label": "Balnearios"}, headers=admin).json()
    assert plain["icon"] == "pin" and plain["color"] in ("ocre", "menta", "morado", "amarillo", "crema", "rio", "bosque")
    pub = None
    try:
        for body, code in (({"label": "cafes y heladerias"}, 409), ({"label": "Restaurantes"}, 409), ({"label": "x"}, 422),
                           ({"label": "Tiendas", "icon": "rocket"}, 422), ({"label": "Tiendas", "color": "rojo"}, 422)):
            assert client.post(base, json=body, headers=admin).status_code == code, body
        # Renombrar no cambia el slug; icono y color se cambian aparte.
        assert client.patch(f"{base}/{cafe['id']}", json={"label": "Cafeterías", "icon": "utensils", "color": "bosque"},
                            headers=admin).status_code == 200
        assert client.patch(f"{base}/{cafe['id']}", json={"label": "Hoteles"}, headers=admin).status_code == 409
        assert client.patch(f"{base}/{cafe['id']}", json={}, headers=admin).status_code == 422
        assert client.patch(f"{base}/{cafe['id']}", json={"icon": "rocket"}, headers=admin).status_code == 422
        assert client.patch(f"{base}/999999", json={"active": False}, headers=admin).status_code == 404
        listed = {item["id"]: item for item in client.get(base, headers=admin).json()}
        assert listed[cafe["id"]] | {"sort_order": 0} == {"id": cafe["id"], "slug": "cafes-y-heladerias", "label": "Cafeterías",
                                                         "icon": "utensils", "color": "bosque", "active": True, "uses": 0, "sort_order": 0}
        # Orden: sube un puesto y queda antes de la anterior.
        order = [item["id"] for item in client.get(base, headers=admin).json()]
        assert client.post(f"{base}/{cafe['id']}/move", json={"direction": "down"}, headers=admin).status_code == 200
        assert [item["id"] for item in client.get(base, headers=admin).json()] == order[:-2] + [plain["id"], cafe["id"]]
        assert client.post(f"{base}/{cafe['id']}/move", json={"direction": "up"}, headers=admin).status_code == 200
        assert [item["id"] for item in client.get(base, headers=admin).json()] == order
        assert client.post(f"{base}/{cafe['id']}/move", json={"direction": "left"}, headers=admin).status_code == 422
        # En uso: cuenta el lugar y no se borra (409); desactivada deja de ofrecerse pero el lugar la conserva.
        pub = create(client, admin, category_ids, cats, publish=True, place_category_id=cafe["id"])
        assert {item["id"]: item for item in client.get(base, headers=admin).json()}[cafe["id"]]["uses"] == 1
        resp = client.delete(f"{base}/{cafe['id']}", headers=admin)
        assert resp.status_code == 409 and resp.json() == {
            "error": "PLACE_CATEGORY_IN_USE", "message": "No se puede borrar: 1 lugar la usa. Desactívala para que deje de ofrecerse."}
        assert client.patch(f"{base}/{cafe['id']}", json={"active": False}, headers=admin).status_code == 200
        assert cafe["id"] not in {item["id"] for item in client.get("/api/place-categories").json()}
        resp = client.post("/api/publications", json=place(category_ids, cats, place_category_id=cafe["id"]), headers=admin)
        assert resp.status_code == 422 and resp.json()["error"] == "INVALID_PLACE_CATEGORY"
        assert detail(client, pub)["place_category"]["active"] is False
        assert map_points(client)[f"lugar-{pub}"]["place_category"]["slug"] == "cafes-y-heladerias"
        # Editar ese lugar conservando su categoria desactivada se permite.
        body = place(category_ids, cats, place_category_id=cafe["id"], title="Cafe editado")
        assert client.put(f"/api/publications/{pub}", json=body, headers=admin).status_code == 200
        # Una sin uso se borra.
        assert client.delete(f"{base}/{plain['id']}", headers=admin).status_code == 200
        plain = None
    finally:
        if pub:
            remove(client, admin, pub)
        client.patch(f"{base}/{cafe['id']}", json={"active": False}, headers=admin)
        if plain:
            client.delete(f"{base}/{plain['id']}", headers=admin)


# ─────────────────────────── mapa ───────────────────────────

def test_map_points_include_places(client, admin, category_ids, cats):
    tag = uuid.uuid4().hex[:6]
    with_cat = create(client, admin, category_ids, cats, publish=True, title=f"Asadero del río {tag}", cultural_category="GASTRONOMIA_CULTURAL",
                      summary="Pescado del Cauca frente al malecón.", whatsapp="3001234567", phone="604 839 1234",
                      opening_hours="Todos los días", website="https://ejemplo.co", municipality="zaragoza",
                      latitude=7.4889, longitude=-74.8667, place_category_id=cats["restaurantes"])
    no_cat = create(client, admin, category_ids, cats, publish=True, title=f"Mirador sin categoría {tag}", place_category_id=cats["miradores"])
    draft = create(client, admin, category_ids, cats, title=f"Borrador {tag}")
    deleted = create(client, admin, category_ids, cats, publish=True, title=f"Borrado {tag}")
    no_point = create(client, admin, category_ids, cats, publish=True, title=f"Sin punto {tag}")
    remove(client, admin, deleted)
    with schema_session() as db:
        db.execute(update(Publication).where(Publication.id == no_point).values(latitude=None, longitude=None))
        # Un lugar antiguo: publicado, con punto, sin fila de detalle (sin categoria de lugar).
        legacy = Publication(author_id=1, category_id=category_ids["LUGAR"], kind="LUGAR", title=f"Lugar antiguo {tag}",
                             summary="Antiguo.", content="Contenido del lugar antiguo.", location="Parque principal",
                             municipality="caucasia", status="PUBLISHED", latitude=7.98, longitude=-75.19,
                             created_at=now_utc(), updated_at=now_utc())
        db.add(legacy)
        db.flush()
        legacy_id = legacy.id
    try:
        points = map_points(client)
        assert {f"lugar-{with_cat}", f"lugar-{no_cat}", f"lugar-{legacy_id}"} <= set(points)
        assert not {f"lugar-{draft}", f"lugar-{deleted}", f"lugar-{no_point}"} & set(points)
        point = points[f"lugar-{with_cat}"]
        assert set(point) == PLACE_KEYS and not PRIVATE & set(point)
        assert point == {
            "key": f"lugar-{with_cat}", "type": "LUGAR", "id": with_cat, "title": f"Asadero del río {tag}",
            "summary": "Pescado del Cauca frente al malecón.", "image": point["image"], "municipality": "zaragoza",
            "municipality_label": "Zaragoza", "cultural_category": "gastronomia-cultural", "category_label": "Gastronomía cultural",
            "location": "Calle 20 # 5-10, Centro", "address": "Calle 20 # 5-10, Centro", "start_date": None, "end_date": None,
            "tradition_text": None, "lat": 7.4889, "lng": -74.8667, "href": f"#publicacion/{with_cat}",
            "place_category": {"slug": "restaurantes", "label": "Restaurantes", "icon": "utensils", "color": "ocre"},
            "phone": "604 839 1234", "whatsapp": "573001234567", "opening_hours": "Todos los días", "website": "https://ejemplo.co"}
        assert point["image"]  # sin foto: la portada de su categoria cultural
        bare = points[f"lugar-{no_cat}"]
        assert bare["image"] is None and bare["cultural_category"] is None and bare["summary"] is None
        assert bare["place_category"]["icon"] == "binoculars" and bare["whatsapp"] is None
        assert points[f"lugar-{legacy_id}"]["place_category"] is None
        assert set(map_points(client, municipality="zaragoza")) & {f"lugar-{with_cat}", f"lugar-{no_cat}"} == {f"lugar-{with_cat}"}
        # Los lugares no caducan: van despues de los eventos, por titulo.
        keys = list(map_points(client))
        assert all(k.startswith("evento-") for k in keys[:sum(k.startswith("evento-") for k in keys)])
    finally:
        remove(client, admin, with_cat, no_cat, draft, no_point, legacy_id)


def test_map_points_limit_places(client, admin, category_ids, cats, monkeypatch):
    from backend.service.services import map_points as map_service
    pubs = [create(client, admin, category_ids, cats, publish=True, title=f"Tope {i} {uuid.uuid4().hex[:4]}") for i in range(3)]
    try:
        monkeypatch.setattr(map_service, "PLACES_LIMIT", 2)
        assert sum(k.startswith("lugar-") for k in map_points(client)) == 2
    finally:
        remove(client, admin, *pubs)


# ─────────────────────────── el resto del sitio ───────────────────────────

def test_places_without_cultural_category_work_everywhere(client, tokens, admin, category_ids, cats):
    tag = uuid.uuid4().hex[:8]
    bare = create(client, admin, category_ids, cats, publish=True, title=f"Cancha libre {tag}", municipality="nechi",
                  place_category_id=cats["canchas-libres"])
    with_cat = create(client, admin, category_ids, cats, publish=True, title=f"Casa de la memoria {tag}", municipality="nechi",
                      cultural_category="PATRIMONIO_MEMORIA", place_category_id=cats["sitios-culturales"])
    try:
        listed = {p["id"]: p for p in client.get("/api/publications").json()}
        assert listed[bare]["place_category"]["slug"] == "canchas-libres" and listed[bare]["cultural_category"] is None
        assert listed[bare]["address"] == "Calle 20 # 5-10, Centro"
        # Explorar (por categoria): solo el que tiene categoria cultural.
        explore = {p["id"] for p in client.get("/api/publications?cultural_category=PATRIMONIO_MEMORIA").json()}
        assert with_cat in explore and bare not in explore
        # Busqueda, municipio y detalle.
        assert {p["id"] for p in client.get(f"/api/publications?search={tag}").json()} == {bare, with_cat}
        town = client.get("/api/municipalities/nechi")
        assert town.status_code == 200 and {bare, with_cat} <= {p["id"] for p in town.json()["publications"]}
        assert detail(client, bare)["place_category"]["label"] == "Canchas libres"
        # Guardadas del ciudadano.
        user, citizen_h = citizen(client, "Ciudadana Lugares")
        assert client.post(f"/api/publications/{bare}/favorite", headers=citizen_h).status_code == 200
        saved = client.get("/api/me/saved", headers=citizen_h).json()
        items = saved["publications"] if isinstance(saved, dict) else saved
        item = next(p for p in items if p["id"] == bare)
        assert item["place_category"]["icon"] == "ball" and item["whatsapp"] is None
        # Carrusel sin cambios: un lugar sin categoria cultural nunca entra.
        slides = client.get("/api/home/carousel").json()
        slides = slides.get("slides", slides) if isinstance(slides, dict) else slides
        assert f"publication-{bare}" not in {slide.get("key") or slide.get("id") for slide in slides}
        # Reportar un dato incorrecto (flujo existente, con sesion verificada).
        assert client.post(f"/api/publications/{bare}/report", json={"reason": "El horario cambió"}).status_code == 401
        assert client.post(f"/api/publications/{bare}/report", json={"reason": "El horario cambió"},
                           headers=citizen_h).status_code == 201
    finally:
        remove(client, admin, bare, with_cat)


# ─────────────────────────── migracion ───────────────────────────

def test_places_migration_up_and_down():
    path = ROOT / "backend" / "alembic" / "versions" / "c7e2a4f6b8d1_lugares_y_categorias_de_lugar.py"
    spec = importlib.util.spec_from_file_location("migracion_lugares", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    assert migration.down_revision == "b8e1f3a5c7d9"
    from backend.service.schemas.places import INITIAL_PLACE_CATEGORIES, PLACE_COLORS, PLACE_ICONS
    assert migration.INITIAL == INITIAL_PLACE_CATEGORIES and migration.ICONS == PLACE_ICONS and migration.COLORS == PLACE_COLORS
    direct_url = settings.database_url.replace("-pooler.", ".")
    schema = f"test_mig_{uuid.uuid4().hex[:10]}"
    admin_engine = create_engine(direct_url)
    with admin_engine.begin() as conn:
        conn.execute(text(f'CREATE SCHEMA "{schema}"'))
    engine = create_engine(direct_url, connect_args={"options": f"-csearch_path={schema}"})

    def tables(conn):
        return {r[0] for r in conn.execute(text(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema()"))}
    try:
        with engine.begin() as conn:
            conn.execute(text("CREATE TABLE publications (id serial PRIMARY KEY, title varchar NOT NULL)"))
            conn.execute(text("INSERT INTO publications (title) VALUES ('Lugar antiguo'), ('Lugar nuevo')"))
            with Operations.context(MigrationContext.configure(conn)):
                migration.upgrade()
            rows = conn.execute(text("SELECT slug, label, icon, color, sort_order, active FROM place_categories ORDER BY sort_order")).all()
            assert [tuple(r) for r in rows] == [(s, l, i, c, n, True) for n, (s, l, i, c) in enumerate(INITIAL_PLACE_CATEGORIES)]
            assert conn.execute(text("SELECT count(*) FROM places")).scalar_one() == 0  # sin relleno
            conn.execute(text("INSERT INTO places (publication_id, place_category_id, whatsapp) "
                              "SELECT 2, id, '573001234567' FROM place_categories WHERE slug = 'parques'"))
            conn.execute(text("INSERT INTO places (publication_id) VALUES (1)"))  # antiguo: sin categoria
        for bad in ("INSERT INTO place_categories (slug, label, icon, color) VALUES ('x', 'X', 'rocket', 'ocre')",
                    "INSERT INTO place_categories (slug, label, icon, color) VALUES ('x', 'X', 'pin', 'rojo')",
                    "INSERT INTO place_categories (slug, label, icon, color) VALUES ('parques', 'Otra', 'pin', 'ocre')",
                    "INSERT INTO places (publication_id) VALUES (2)",
                    "DELETE FROM place_categories WHERE slug = 'parques'"):
            with pytest.raises(Exception):
                with engine.begin() as conn:
                    conn.execute(text(bad))
        with engine.begin() as conn:
            conn.execute(text("DELETE FROM publications WHERE id = 2"))  # CASCADE
            assert conn.execute(text("SELECT count(*) FROM places")).scalar_one() == 1
            with Operations.context(MigrationContext.configure(conn)):
                migration.downgrade()
            assert tables(conn) == {"publications"}
    finally:
        engine.dispose()
        with admin_engine.begin() as conn:
            conn.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
        admin_engine.dispose()
