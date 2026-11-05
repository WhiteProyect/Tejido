"""Respuestas publicas que el navegador guarda pero revalida en cada carga (carrusel, agenda).

Con la misma ETag responde 304 sin cuerpo; si algo cambio (una publicacion nueva, un artista
destacado, lo que vencio hoy) la siguiente carga ya lo trae, sin esperar a que caduque nada.
"""
import hashlib
import json

from fastapi import Request, Response
from fastapi.encoders import jsonable_encoder

CACHE_CONTROL = "public, no-cache"


def revalidated_json(request: Request, payload) -> Response:
    body = json.dumps(jsonable_encoder(payload), ensure_ascii=False, separators=(",", ":"))
    etag = f'"{hashlib.sha256(body.encode()).hexdigest()[:32]}"'
    headers = {"Cache-Control": CACHE_CONTROL, "ETag": etag}
    if etag in request.headers.get("if-none-match", ""):
        return Response(status_code=304, headers=headers)
    return Response(content=body, media_type="application/json", headers=headers)
