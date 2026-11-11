"""Artistas de TEJIDO y Moneystack: sello, alta por el lider de la rama Musica (siempre TEJIDO y en
revision), aprobacion del admin y visibilidad publica (solo activos y publicados).

Schema aislado del conftest. El lider de MUSICA que crea cada prueba se retira al final (sin liderazgo y
con su organizacion inactiva), asi la rama no cambia para las demas pruebas. Los artistas creados se
archivan al terminar.
"""
import importlib.util
import uuid
from pathlib import Path

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, select, text, update

from backend.service.core.config import settings
from backend.service.models.tables import Artist, Organization
from backend.tests_fastapi.test_branches import citizen, gestor, join, leader, sent  # noqa: F401
from backend.tests_fastapi.test_gestores_invites import schema_session
from backend.tests_fastapi.test_parity import auth_header, tokens  # noqa: F401

ROOT = Path(__file__).resolve().parents[2]
FORBIDDEN = "Solo un administrador o el líder de la rama Música pueden agregar artistas"
PRIVATE = {"status", "review_note", "created_by_user_id"}


@pytest.fixture
def admin(tokens):
    return auth_header(tokens, "admin")


@pytest.fixture
def created(client, admin):
    ids = []
    yield ids
    for artist_id in ids:
        client.delete(f"/api/artists/{artist_id}", headers=admin)


@pytest.fixture
def music(client, admin, sent):  # noqa: F811
    """Lider de MUSICA, un participante de MUSICA y el lider de otra rama (LITERATURA)."""
    lead_h, lead_id, _ = leader(client, admin, "MUSICA", "Lider Musica")
    part_h, part_id, _ = join(client, admin, lead_h, "MUSICA", "Participante Musica")
    other_h, other_id, _ = leader(client, admin, "LITERATURA", "Lider Literatura")
    yield {"lider": lead_h, "lider_id": lead_id, "participante": part_h, "otro_lider": other_h}
    for branch in ("MUSICA", "LITERATURA"):
        client.delete(f"/api/admin/branches/{branch}/leader", headers=admin)
    with schema_session() as db:
        db.execute(update(Organization).where(Organization.user_id.in_((lead_id, part_id, other_id))).values(active=False))


def name():
    return f"Artista {uuid.uuid4().hex[:8]}"


def create(client, headers, created, **extra):
    body = {"stage_name": name(), "municipality": "caucasia", "genre": "Champeta", **extra}
    resp = client.post("/api/artists", json=body, headers=headers)
    assert resp.status_code == 201, resp.text
    created.append(resp.json()["id"])
    return resp.json()


def row(artist_id):
    with schema_session() as db:
        artist = db.get(Artist, artist_id)
        return {key: getattr(artist, key) for key in ("status", "moneystack", "featured", "active", "user_id", "created_by_user_id", "review_note", "slug")}


def public_slugs(client, **params):
    return {artist["slug"] for artist in client.get("/api/artists", params=params).json()}


def public_paths(slug):
    return [f"/api/artists/{slug}", *(f"/api/artists/{slug}/{sub}" for sub in ("media-kit", "music", "timeline", "media", "social", "connections"))]


# ─────────────────────────── alta ───────────────────────────

def test_leader_creates_tejido_artist_in_review(client, music, created):
    data = create(client, music["lider"], created, moneystack=True, featured=True, slug="slug-del-lider", active=False,
                  status="PUBLISHED", user_id=1)
    assert data["status"] == "REVIEW" and data["moneystack"] is False
    saved = row(data["id"])
    assert saved == {"status": "REVIEW", "moneystack": False, "featured": False, "active": True, "user_id": music["lider_id"],
                     "created_by_user_id": music["lider_id"], "review_note": None, "slug": data["slug"]}
    assert data["slug"] != "slug-del-lider"


def test_only_admin_and_music_leader_create(client, tokens, music, created):
    body = {"stage_name": name(), "municipality": "caucasia", "moneystack": False}
    citizen_h = auth_header(tokens, "ciudadano")
    for headers in (music["participante"], music["otro_lider"], auth_header(tokens, "gestor"), citizen_h, None):
        resp = client.post("/api/artists", json=body, headers=headers)
        assert resp.status_code == 403 and resp.json() == {"error": "FORBIDDEN", "message": FORBIDDEN}


def test_admin_chooses_the_sello_and_publishes(client, admin, created):
    moneystack = create(client, admin, created, moneystack=True)
    tejido = create(client, admin, created, moneystack=False)
    assert moneystack["status"] == tejido["status"] == "PUBLISHED"
    assert row(moneystack["id"])["moneystack"] is True and row(tejido["id"])["moneystack"] is False
    assert row(tejido["id"])["created_by_user_id"] is not None
    resp = client.post("/api/artists", json={"stage_name": name(), "municipality": "caucasia"}, headers=admin)
    assert resp.status_code == 422 and resp.json() == {"error": "SELLO_REQUIRED", "message": "Elige el sello del artista: Moneystack o TEJIDO"}
    # El admin puede cambiar el sello despues.
    assert client.put(f"/api/artists/{tejido['id']}", json={"moneystack": True}, headers=admin).status_code == 200
    assert row(tejido["id"])["moneystack"] is True


# ─────────────────────────── visibilidad ───────────────────────────

def test_review_and_rejected_are_hidden_everywhere(client, admin, music, created):
    data = create(client, music["lider"], created, municipality="nechi")
    slug = data["slug"]
    # Ni con su municipio en el filtro, ni en ningun sello.
    assert slug not in public_slugs(client) | public_slugs(client, sello="tejido") | public_slugs(client, municipality="nechi")
    for path in public_paths(slug):
        assert client.get(path).status_code == 404, path
    town = client.get("/api/municipalities/nechi").json()
    assert slug not in {artist["slug"] for artist in town["artists"]}
    carousel = client.get("/api/home/carousel").json()["slides"]
    assert f"artist-{data['id']}" not in {slide["key"] for slide in carousel}
    assert client.get("/api/artists/home").json().get("artist", {}).get("slug") != slug
    # El admin si lo ve (lista en revision y detalle) y el lider en "mis artistas".
    review = client.get("/api/admin/artists?status=REVIEW", headers=admin).json()
    assert data["id"] in {artist["id"] for artist in review}
    item = next(artist for artist in review if artist["id"] == data["id"])
    assert item["moneystack"] is False and item["created_by_name"] == "Lider Musica"
    assert client.get(f"/api/admin/artists/{data['id']}", headers=admin).json()["artist"]["status"] == "REVIEW"
    mine = client.get("/api/artists/mine", headers=music["lider"]).json()
    assert [(artist["id"], artist["status"]) for artist in mine if artist["id"] == data["id"]] == [(data["id"], "REVIEW")]
    assert client.get("/api/admin/artists?status=OTRO", headers=admin).status_code == 422
    # Rechazado: sigue oculto.
    assert client.post(f"/api/artists/{data['id']}/review", json={"action": "reject", "note": "Falta la foto"}, headers=admin).status_code == 200
    for path in public_paths(slug):
        assert client.get(path).status_code == 404, path


def test_approve_publishes_in_tejido_but_never_in_the_moneystack_carousel(client, admin, music, created):
    data = create(client, music["lider"], created, municipality="taraza", genre="Vallenato")
    assert client.get("/api/admin/stats", headers=admin).json()["artists_review"] >= 1
    before = client.get("/api/admin/stats", headers=admin).json()["artists_review"]
    resp = client.post(f"/api/artists/{data['id']}/review", json={"action": "approve", "note": "ignorada"}, headers=admin)
    assert resp.status_code == 200 and resp.json()["status"] == "PUBLISHED"
    assert row(data["id"])["review_note"] is None
    assert client.get("/api/admin/stats", headers=admin).json()["artists_review"] == before - 1
    assert data["slug"] in public_slugs(client, sello="tejido") and data["slug"] not in public_slugs(client, sello="moneystack")
    profile = client.get(f"/api/artists/{data['slug']}")
    assert profile.status_code == 200 and profile.json()["artist"]["moneystack"] is False
    assert not PRIVATE & set(profile.json()["artist"])
    town = client.get("/api/municipalities/taraza").json()
    assert {"slug": data["slug"], "moneystack": False} in [{"slug": a["slug"], "moneystack": a["moneystack"]} for a in town["artists"]]
    # Aunque el admin lo destaque, un artista de TEJIDO no entra a las diapositivas de Moneystack.
    assert client.put(f"/api/artists/{data['id']}", json={"featured": True}, headers=admin).status_code == 200
    keys = {slide["key"] for slide in client.get("/api/home/carousel").json()["slides"]}
    assert f"artist-{data['id']}" not in keys
    assert client.get("/api/artists/home").json()["artist"]["moneystack"] is True
    # El lider edita su artista publicado: no vuelve a revision (asi se decidio).
    assert client.put(f"/api/artists/{data['id']}", json={"bio": "Nueva biografía"}, headers=music["lider"]).status_code == 200
    assert row(data["id"])["status"] == "PUBLISHED"


def test_reject_with_note_edit_and_resubmit(client, admin, music, created):
    data = create(client, music["lider"], created)
    artist_id = data["id"]
    # Nadie mas que el admin revisa (tampoco el propio lider).
    assert client.post(f"/api/artists/{artist_id}/review", json={"action": "approve"}, headers=music["lider"]).status_code == 403
    assert client.post(f"/api/artists/{artist_id}/review", json={"action": "borrar"}, headers=admin).status_code == 422
    assert client.post(f"/api/artists/{artist_id}/submit", headers=music["lider"]).status_code == 409  # aun en revision
    resp = client.post(f"/api/artists/{artist_id}/review", json={"action": "reject", "note": "  Falta   una foto de perfil  "}, headers=admin)
    assert resp.status_code == 200 and resp.json()["status"] == "REJECTED"
    assert client.post(f"/api/artists/{artist_id}/review", json={"action": "approve"}, headers=admin).status_code == 409
    mine = next(a for a in client.get("/api/artists/mine", headers=music["lider"]).json() if a["id"] == artist_id)
    assert (mine["status"], mine["review_note"]) == ("REJECTED", "Falta una foto de perfil")
    # El lider corrige (sin poder tocar los campos del admin) y reenvia.
    assert client.put(f"/api/artists/{artist_id}", json={"image": "https://img.test/foto.jpg"}, headers=music["lider"]).status_code == 200
    for field, value in (("moneystack", True), ("featured", True), ("slug", "otro-slug"), ("active", False)):
        assert client.put(f"/api/artists/{artist_id}", json={field: value}, headers=music["lider"]).status_code == 403, field
    assert row(artist_id)["status"] == "REJECTED"
    resp = client.post(f"/api/artists/{artist_id}/submit", headers=music["lider"])
    assert resp.status_code == 200 and row(artist_id)["status"] == "REVIEW" and row(artist_id)["review_note"] is None
    # Otro gestor no reenvia ni edita un artista ajeno.
    assert client.post(f"/api/artists/{artist_id}/submit", headers=music["participante"]).status_code == 403
    assert client.put(f"/api/artists/{artist_id}", json={"bio": "x"}, headers=music["otro_lider"]).status_code == 403


# ─────────────────────────── filtros y lo de siempre ───────────────────────────

def test_public_filters(client, admin, created):
    tag = uuid.uuid4().hex[:6]
    tejido = create(client, admin, created, moneystack=False, stage_name=f"Rio Sonoro {tag}", genre="Bullerengue", municipality="zaragoza")
    sello = create(client, admin, created, moneystack=True, stage_name=f"Sello Sonoro {tag}", genre="bullerengue", municipality="caucasia")
    assert tejido["slug"] in public_slugs(client, sello="tejido") and sello["slug"] not in public_slugs(client, sello="tejido")
    assert sello["slug"] in public_slugs(client, sello=" MoneyStack ")
    assert {tejido["slug"], sello["slug"]} <= public_slugs(client, genre="BULLERENGUE")
    assert public_slugs(client, q=f"sonoro {tag}") == {tejido["slug"], sello["slug"]}
    assert public_slugs(client, q=tag, municipality="zaragoza") == {tejido["slug"]}
    assert public_slugs(client, q=tag, sello="tejido", genre="bullerengue") == {tejido["slug"]}
    resp = client.get("/api/artists?sello=otro")
    assert resp.status_code == 422 and resp.json() == {"error": "INVALID_SELLO", "message": "El sello debe ser tejido o moneystack"}


def test_existing_artists_stay_visible_and_public_output_has_no_moderation_data(client):
    everyone = client.get("/api/artists").json()
    assert everyone and all(not PRIVATE & set(artist) for artist in everyone)
    with schema_session() as db:
        seeded = db.execute(select(Artist.slug).where(Artist.active.is_(True), Artist.moneystack.is_(True), Artist.status == "PUBLISHED")).scalars().all()
    assert set(seeded) <= {artist["slug"] for artist in everyone}
    assert set(seeded) <= public_slugs(client, sello="moneystack")
    for slug in seeded:
        assert client.get(f"/api/artists/{slug}").status_code == 200


# ─────────────────────────── migracion ───────────────────────────

def test_migration_up_down_up():
    path = ROOT / "backend" / "alembic" / "versions" / "d9a3b5c7e1f4_revision_y_creador_de_artistas.py"
    spec = importlib.util.spec_from_file_location("migracion_artistas", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    assert migration.down_revision == "c7e2a4f6b8d1"
    direct_url = settings.database_url.replace("-pooler.", ".")
    schema = f"test_mig_{uuid.uuid4().hex[:10]}"
    admin_engine = create_engine(direct_url)
    with admin_engine.begin() as conn:
        conn.execute(text(f'CREATE SCHEMA "{schema}"'))
    engine = create_engine(direct_url, connect_args={"options": f"-csearch_path={schema}"})

    def columns(conn):
        return {r[0] for r in conn.execute(text(
            "SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'artists'"))}
    try:
        with engine.begin() as conn:
            conn.execute(text("CREATE TABLE users (id serial PRIMARY KEY)"))
            conn.execute(text("CREATE TABLE artists (id serial PRIMARY KEY, stage_name varchar NOT NULL, moneystack boolean NOT NULL DEFAULT true)"))
            conn.execute(text("INSERT INTO users DEFAULT VALUES"))
            conn.execute(text("INSERT INTO artists (stage_name) VALUES ('Antiguo')"))
            for step in (migration.upgrade, migration.downgrade, migration.upgrade):
                with Operations.context(MigrationContext.configure(conn)):
                    step()
            assert {"status", "review_note", "created_by_user_id"} <= columns(conn)
            assert conn.execute(text("SELECT status, review_note, created_by_user_id, moneystack FROM artists")).one() == ("PUBLISHED", None, None, True)
            conn.execute(text("UPDATE artists SET created_by_user_id = 1, status = 'REVIEW'"))
            conn.execute(text("DELETE FROM users WHERE id = 1"))  # ON DELETE SET NULL
            assert conn.execute(text("SELECT created_by_user_id FROM artists")).scalar_one() is None
        with pytest.raises(Exception):
            with engine.begin() as conn:
                conn.execute(text("UPDATE artists SET status = 'BORRADOR'"))
        with engine.begin() as conn:
            with Operations.context(MigrationContext.configure(conn)):
                migration.downgrade()
            assert columns(conn) == {"id", "stage_name", "moneystack"}
    finally:
        engine.dispose()
        with admin_engine.begin() as conn:
            conn.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
        admin_engine.dispose()
