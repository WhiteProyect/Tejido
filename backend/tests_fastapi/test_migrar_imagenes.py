"""Portadas de categorias (GET /api/cultural-categories/covers) y scripts/migrar_imagenes_a_cloudinary.py.

Schema aislado del conftest. Nunca se golpea Cloudinary: la subida se reemplaza por una funcion
falsa (o se intercepta httpx.post). Los archivos viven en un public/ temporal: las rutas del seed
(Og Mauro, DJ Apolo) no existen ahi, asi que el script las reporta y no las toca.
"""
import importlib.util
import uuid
from pathlib import Path

import pytest
from sqlalchemy import delete, select

from backend.service.models.tables import Artist, ArtistMedia, CulturalCategoryCover
from backend.service.services import uploads
from backend.service.services.auth import now_utc
from backend.tests_fastapi.test_gestores_invites import schema_session

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "migrar_imagenes_a_cloudinary.py"
CDN = "https://res.cloudinary.com/demo/image/upload/v1"


@pytest.fixture(scope="module")
def script():
    spec = importlib.util.spec_from_file_location("migrar_imagenes_a_cloudinary", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def no_covers():
    with schema_session() as db:
        db.execute(delete(CulturalCategoryCover))
    yield
    with schema_session() as db:
        db.execute(delete(CulturalCategoryCover))


@pytest.fixture
def public_dir(tmp_path):
    """public/ falso: perfil y galeria de un artista nuevo, y solo 2 portadas de categoria."""
    slug = f"artista-{uuid.uuid4().hex[:6]}"
    folder = tmp_path / "assets" / "artistas" / slug
    folder.mkdir(parents=True)
    for name in ("perfil.jpg", "galeria-1.jpg"):
        (folder / name).write_bytes(b"jpg")
    covers = tmp_path / "images" / "categorias"
    covers.mkdir(parents=True)
    for name in ("musica.jpg", "danza.jpg"):
        (covers / name).write_bytes(b"jpg")
    return tmp_path, slug


@pytest.fixture
def artist(public_dir):
    _, slug = public_dir
    base = f"/assets/artistas/{slug}"
    with schema_session() as db:
        row = Artist(name="Prueba", stage_name=f"Prueba {slug}", slug=slug, image=f"{base}/perfil.jpg",
                     hero_image=f"{base}/perfil.jpg", created_at=now_utc())
        db.add(row)
        db.flush()
        db.add_all([
            ArtistMedia(artist_id=row.id, tipo="image", url=f"{base}/galeria-1.jpg"),
            ArtistMedia(artist_id=row.id, tipo="image", url=f"{base}/no-existe.jpg"),
        ])
        db.flush()
        return row.id, base


def fake_uploader(calls, fail_on=None):
    def upload(path, folder, public_id=None):
        calls.append((path.name, folder, public_id))
        if fail_on and path.name == fail_on:
            raise RuntimeError("Cloudinary caido")
        return f"{CDN}/{folder}/{public_id or path.stem}.jpg"
    return upload


def artist_state(artist_id):
    with schema_session() as db:
        row = db.get(Artist, artist_id)
        media = db.scalars(select(ArtistMedia.url).where(ArtistMedia.artist_id == artist_id).order_by(ArtistMedia.id)).all()
        covers = dict(db.execute(select(CulturalCategoryCover.category_key, CulturalCategoryCover.image_url)).all())
        return row.image, row.hero_image, media, covers


# ─────────────────────────── endpoint ───────────────────────────

def test_covers_endpoint_is_public_and_filters_keys(client, no_covers):
    resp = client.get("/api/cultural-categories/covers")
    assert resp.status_code == 200 and resp.json() == {}
    assert resp.headers["cache-control"] == "public, max-age=300"

    with schema_session() as db:
        db.add_all([
            CulturalCategoryCover(category_key="MUSICA", image_url=f"{CDN}/tejido/categorias/musica.jpg", updated_at=now_utc()),
            CulturalCategoryCover(category_key="RAP", image_url=f"{CDN}/x.jpg", updated_at=now_utc()),
        ])
    assert client.get("/api/cultural-categories/covers").json() == {"MUSICA": f"{CDN}/tejido/categorias/musica.jpg"}


# ─────────────────────────── script ───────────────────────────

def test_dry_run_plan_changes_nothing(client, script, public_dir, artist, no_covers):
    root, slug = public_dir
    artist_id, base = artist
    before = artist_state(artist_id)
    with schema_session() as db:
        plan = script.build_plan(db, root)
    after = artist_state(artist_id)
    assert before == after

    mine = {item.source: item for item in plan if item.source.startswith(base)}
    assert set(mine) == {f"{base}/perfil.jpg", f"{base}/galeria-1.jpg", f"{base}/no-existe.jpg"}
    perfil = mine[f"{base}/perfil.jpg"]
    assert perfil.folder == f"tejido/artistas/{slug}" and perfil.exists
    assert sorted(column for _, column, _ in perfil.rows) == ["hero_image", "image"]
    assert not mine[f"{base}/no-existe.jpg"].exists
    covers = [item for item in plan if item.category_key]
    assert len(covers) == 10 and all(item.folder == "tejido/categorias" for item in covers)
    assert {item.category_key for item in covers if item.exists} == {"MUSICA", "DANZA"}


def test_apply_uploads_each_file_once_and_updates_rows(client, script, public_dir, artist, no_covers):
    root, slug = public_dir
    artist_id, base = artist
    calls = []
    with schema_session() as db:
        script.apply(db, script.build_plan(db, root), upload=fake_uploader(calls))

    # perfil.jpg lo usan image y hero_image: se sube una sola vez.
    assert [c for c in calls if c[0] == "perfil.jpg"] == [("perfil.jpg", f"tejido/artistas/{slug}", None)]
    assert ("musica.jpg", "tejido/categorias", "musica") in calls
    assert all(name != "no-existe.jpg" for name, _, _ in calls)

    image, hero, media, covers = artist_state(artist_id)
    assert image == hero == f"{CDN}/tejido/artistas/{slug}/perfil.jpg"
    assert media == [f"{CDN}/tejido/artistas/{slug}/galeria-1.jpg", f"{base}/no-existe.jpg"]
    assert covers == {"MUSICA": f"{CDN}/tejido/categorias/musica.jpg", "DANZA": f"{CDN}/tejido/categorias/danza.jpg"}

    # Segunda corrida: nada nuevo que subir.
    with schema_session() as db:
        plan = script.build_plan(db, root)
    assert [item for item in plan if item.exists and (item.source.startswith(base) or item.category_key)] == []
    assert any(item.source == f"{base}/no-existe.jpg" for item in plan)


def test_failed_upload_leaves_database_untouched(client, script, public_dir, artist, no_covers):
    root, _ = public_dir
    artist_id, _ = artist
    before = artist_state(artist_id)
    with schema_session() as db:
        with pytest.raises(script.UploadFailed, match="galeria-1.jpg"):
            script.apply(db, script.build_plan(db, root), upload=fake_uploader([], fail_on="galeria-1.jpg"))
        db.rollback()
    assert artist_state(artist_id) == before


def test_upload_file_signs_with_upload_rules(script, monkeypatch, tmp_path):
    from backend.service.core.config import settings

    monkeypatch.setattr(settings, "cloudinary_cloud_name", "demo")
    monkeypatch.setattr(settings, "cloudinary_api_key", "123")
    monkeypatch.setattr(settings, "cloudinary_api_secret", "secreto")
    sent = {}

    class Response:
        status_code = 200
        headers = {"content-type": "application/json"}
        text = ""

        @staticmethod
        def json():
            return {"secure_url": f"{CDN}/tejido/categorias/musica.jpg"}

    def fake_post(url, data, files, timeout):
        sent.update(url=url, data=data)
        return Response()

    monkeypatch.setattr(script.httpx, "post", fake_post)
    image = tmp_path / "musica.jpg"
    image.write_bytes(b"jpg")
    assert script.upload_file(image, "tejido/categorias", "musica") == f"{CDN}/tejido/categorias/musica.jpg"

    data = sent["data"]
    assert sent["url"] == "https://api.cloudinary.com/v1_1/demo/image/upload"
    assert (data["folder"], data["public_id"], data["transformation"], data["allowed_formats"]) == (
        "tejido/categorias", "musica", uploads.INCOMING_TRANSFORMATION, uploads.ALLOWED_FORMATS)
    signed = {k: v for k, v in data.items() if k not in ("api_key", "signature")}
    assert data["signature"] == uploads.sign_params(signed, "secreto") and data["api_key"] == "123"
