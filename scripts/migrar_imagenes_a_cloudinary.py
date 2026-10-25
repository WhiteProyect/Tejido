"""Migra a Cloudinary las imagenes que hoy son archivos de frontend/public y guarda las URLs en la base.

  - Artistas: valores que empiezan por /assets/artistas/ en artists.image, artists.hero_image,
    tracks.cover_image, artist_timeline.imagen_url, artist_media.url (tipo image) y
    artist_connections.imagen_url. Carpeta: tejido/artistas/<slug-del-artista>.
  - Portadas de las 10 categorias culturales: /images/categorias/<slug>.jpg -> fila en
    cultural_category_covers. Carpeta tejido/categorias, public_id = el slug.

Por defecto es un dry-run (solo lectura: no sube ni modifica nada). Con --aplicar sube cada
archivo local UNA vez (firmado con las reglas de backend/service/services/uploads.py) y luego
actualiza todas las filas en una sola transaccion. Si una subida falla, la base no se toca.
Un archivo que no existe en disco se reporta y su fila queda intacta. No borra archivos locales.

Uso (desde la raiz del proyecto):
    py scripts/migrar_imagenes_a_cloudinary.py            # muestra lo que haria
    py scripts/migrar_imagenes_a_cloudinary.py --aplicar  # sube y actualiza
"""
import argparse
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import httpx  # noqa: E402
from sqlalchemy import select, update  # noqa: E402
from sqlalchemy.dialects.postgresql import insert as pg_insert  # noqa: E402

from backend.service.core.config import settings  # noqa: E402
from backend.service.db.session import SessionLocal  # noqa: E402
from backend.service.models.tables import (  # noqa: E402
    Artist, ArtistConnection, ArtistMedia, ArtistTimeline, CulturalCategoryCover, Track,
)
from backend.service.schemas.cultural_categories import CULTURAL_CATEGORY_LABELS, category_slug  # noqa: E402
from backend.service.services import uploads  # noqa: E402
from backend.service.services.auth import now_utc  # noqa: E402

PUBLIC_DIR = ROOT / "frontend" / "public"
ARTIST_PREFIX = "/assets/artistas/"
CLOUDINARY_PREFIX = "https://res.cloudinary.com/"
# (modelo, columna, columna con el id del artista, filtro extra)
ARTIST_COLUMNS = (
    (Artist, "image", "id", None),
    (Artist, "hero_image", "id", None),
    (Track, "cover_image", "artist_id", None),
    (ArtistTimeline, "imagen_url", "artist_id", None),
    (ArtistMedia, "url", "artist_id", ArtistMedia.tipo == "image"),
    (ArtistConnection, "imagen_url", "artist_id", None),
)


@dataclass
class Item:
    source: str            # ruta web (/assets/...) o clave de categoria
    path: Path
    folder: str
    public_id: str | None = None
    rows: list = field(default_factory=list)   # artistas: [(modelo, columna, id)]
    category_key: str | None = None

    @property
    def exists(self) -> bool:
        return self.path.is_file()


class UploadFailed(Exception):
    pass


def build_plan(db, public_dir: Path = PUBLIC_DIR) -> list[Item]:
    items: dict[str, Item] = {}
    slugs = dict(db.execute(select(Artist.id, Artist.slug)).all())
    for model, column, artist_col, extra in ARTIST_COLUMNS:
        col = getattr(model, column)
        query = select(model.id, getattr(model, artist_col), col).where(col.like(f"{ARTIST_PREFIX}%"))
        if extra is not None:
            query = query.where(extra)
        for row_id, artist_id, value in db.execute(query.order_by(model.id)).all():
            item = items.get(value)
            if item is None:
                folder_slug = slugs.get(artist_id) or value[len(ARTIST_PREFIX):].split("/")[0]
                item = items[value] = Item(source=value, path=public_dir / value.lstrip("/"), folder=f"tejido/artistas/{folder_slug}")
            item.rows.append((model, column, row_id))

    done = dict(db.execute(select(CulturalCategoryCover.category_key, CulturalCategoryCover.image_url)).all())
    covers = []
    for key in CULTURAL_CATEGORY_LABELS:
        if str(done.get(key) or "").startswith(CLOUDINARY_PREFIX):
            continue
        slug = category_slug(key)
        covers.append(Item(source=key, path=public_dir / "images" / "categorias" / f"{slug}.jpg",
                           folder="tejido/categorias", public_id=slug, category_key=key))
    return list(items.values()) + covers


def upload_file(path: Path, folder: str, public_id: str | None = None) -> str:
    """Subida firmada (mismas reglas que services/uploads.py). Devuelve el secure_url."""
    if not uploads.is_configured():
        raise UploadFailed("Faltan las claves CLOUDINARY_* en .env")
    params = {
        "allowed_formats": uploads.ALLOWED_FORMATS,
        "folder": folder,
        "public_id": public_id,
        "timestamp": int(time.time()),
        "transformation": uploads.INCOMING_TRANSFORMATION,
    }
    params = {key: value for key, value in params.items() if value is not None}
    data = {**params, "api_key": settings.cloudinary_api_key,
            "signature": uploads.sign_params(params, settings.cloudinary_api_secret)}
    with path.open("rb") as handle:
        resp = httpx.post(f"https://api.cloudinary.com/v1_1/{settings.cloudinary_cloud_name}/image/upload",
                          data=data, files={"file": (path.name, handle)}, timeout=120)
    body = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
    if resp.status_code != 200 or not body.get("secure_url"):
        raise UploadFailed(f"HTTP {resp.status_code}: {body.get('error', {}).get('message') or resp.text[:200]}")
    return body["secure_url"]


def apply(db, plan: list[Item], upload=upload_file) -> dict[str, str]:
    """Sube todo y despues actualiza la base (sin commit: lo decide quien llama).
    Si una subida falla, lanza UploadFailed antes de tocar ninguna fila."""
    urls = {}
    for item in plan:
        if not item.exists:
            continue
        try:
            urls[item.source] = upload(item.path, item.folder, item.public_id)
        except Exception as exc:
            raise UploadFailed(f"{item.source} ({item.path}): {exc}") from exc

    for item in plan:
        url = urls.get(item.source)
        if url is None:
            continue
        for model, column, row_id in item.rows:
            db.execute(update(model).where(model.id == row_id).values({column: url}))
        if item.category_key:
            stmt = pg_insert(CulturalCategoryCover).values(category_key=item.category_key, image_url=url, updated_at=now_utc())
            db.execute(stmt.on_conflict_do_update(index_elements=["category_key"],
                                                  set_={"image_url": url, "updated_at": now_utc()}))
    db.flush()
    return urls


def describe(item: Item) -> str:
    where = (f"portada {item.category_key}" if item.category_key
             else ", ".join(f"{model.__tablename__}.{column}#{row_id}" for model, column, row_id in item.rows))
    disk = f"{item.path.stat().st_size / 1024:.0f} KB" if item.exists else "NO EXISTE EN DISCO (se omite)"
    target = f"{item.folder}/{item.public_id}" if item.public_id else item.folder
    return f"  {item.source}\n     archivo: {item.path.relative_to(ROOT) if item.path.is_relative_to(ROOT) else item.path} [{disk}]\n     destino: {target}  |  filas: {where}"


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--aplicar", action="store_true", help="sube a Cloudinary y actualiza la base (sin esto es un dry-run)")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        plan = build_plan(db)
        if not plan:
            print("Nada que migrar: no quedan rutas locales de artistas ni portadas sin Cloudinary.")
            return
        print(f"Imagenes a migrar ({len(plan)}):")
        for item in plan:
            print(describe(item))
        missing = [item for item in plan if not item.exists]
        if missing:
            print(f"\nNo existen en disco ({len(missing)}): sus filas quedan intactas.")
        if not args.aplicar:
            print("\nDry-run: no se subio ni modifico nada. Para aplicar: py scripts/migrar_imagenes_a_cloudinary.py --aplicar")
            return

        try:
            urls = apply(db, plan)
        except UploadFailed as exc:
            db.rollback()
            print(f"\nABORTADO, la base no se modifico. Fallo la subida de {exc}")
            print("Las subidas anteriores a ese fallo quedaron en Cloudinary; volver a correr el script las sube de nuevo.")
            sys.exit(1)
        db.commit()
        print(f"\nAplicado: {len(urls)} archivos subidos.")
        for source, url in urls.items():
            print(f"  {source} -> {url}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
