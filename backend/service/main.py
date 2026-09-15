import logging
import mimetypes
import time
from contextlib import asynccontextmanager
from pathlib import Path

import anyio
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import text

from backend.service.api.routes import admin, artists, auth, collaborators, misc, publications
from backend.service.core.config import settings
from backend.service.core.logging_config import configure_logging
from backend.service.db.session import engine
from backend.service.errors import AppError

configure_logging(settings.log_level)
logger = logging.getLogger("tejido.api")

IS_PRODUCTION = settings.environment == "production"


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("Conexion a la base de datos verificada (%s)", settings.environment)
    except Exception:
        logger.exception("No se pudo conectar a la base de datos al arrancar")
        raise
    yield


app = FastAPI(
    title="TEJIDO API",
    lifespan=lifespan,
    # En produccion no se expone el schema/documentacion interactiva.
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
    openapi_url=None if IS_PRODUCTION else "/openapi.json",
)

app.include_router(auth.router)
app.include_router(misc.router)
app.include_router(admin.router)
app.include_router(publications.router)
app.include_router(collaborators.router)
app.include_router(artists.router)


# ───────────────────────── middleware: tamano de body, timeout y logging ─────────────────────────

@app.middleware("http")
async def guard_and_log(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length is not None:
        try:
            if int(content_length) > settings.max_body_bytes:
                return JSONResponse(
                    {"error": "TOO_LARGE", "message": "La solicitud supera el tamaño permitido"},
                    status_code=413,
                )
        except ValueError:
            pass

    # Las excepciones de la ruta NO se atrapan aca a proposito: se dejan
    # propagar para que las maneje @app.exception_handler(Exception) de mas
    # abajo (ahi se loguea el traceback una sola vez, no duplicado).
    start = time.perf_counter()
    is_api = request.url.path.startswith("/api/")
    with anyio.move_on_after(settings.request_timeout_seconds) as scope:
        response = await call_next(request)
    if scope.cancelled_caught:
        duration_ms = (time.perf_counter() - start) * 1000
        logger.error("%s %s -> TIMEOUT (%.0fms)", request.method, request.url.path, duration_ms)
        return JSONResponse(
            {"error": "TIMEOUT", "message": "La solicitud tardo demasiado en responder"},
            status_code=504,
        )

    duration_ms = (time.perf_counter() - start) * 1000
    if is_api or response.status_code >= 400:
        level = logging.ERROR if response.status_code >= 500 else (
            logging.WARNING if response.status_code >= 400 else logging.INFO
        )
        logger.log(
            level, "%s %s -> %s (%.0fms)",
            request.method, request.url.path, response.status_code, duration_ms,
        )
    return response


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    return JSONResponse({"error": exc.code, "message": exc.message}, status_code=exc.status_code)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    message = "Datos inválidos"
    if errors:
        raw = errors[0].get("msg", message)
        message = raw[len("Value error, "):] if raw.startswith("Value error, ") else raw
    return JSONResponse({"error": "VALIDATION", "message": message}, status_code=400)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # Ultima red de seguridad: cualquier excepcion no capturada por el
    # middleware de arriba (ej. una que ocurre fuera del flujo normal de
    # request/response) queda logueada con traceback completo y responde un
    # 500 JSON limpio, nunca una traza cruda ni una conexion cortada.
    logger.exception("%s %s -> excepcion no manejada", request.method, request.url.path)
    return JSONResponse({"error": "INTERNAL_ERROR", "message": "Ocurrio un error inesperado"}, status_code=500)


# ───────────────────────── estático (frontend/dist), igual que backend/app.py::serve_static ─────────────────────────

PUBLIC_DIR = settings.public_dir.resolve()


@app.get("/{full_path:path}")
def serve_static(full_path: str):
    path = "/" + full_path
    if path.startswith("/api/"):
        # Ningun router de /api/* matcheo antes de llegar aca -> 404 JSON real,
        # no el HTML del SPA (a diferencia de una ruta de frontend desconocida).
        raise AppError(404, "NOT_FOUND", "Ruta no encontrada")
    target = PUBLIC_DIR / ("index.html" if path == "/" else full_path)
    try:
        target = target.resolve()
        target.relative_to(PUBLIC_DIR)
    except Exception:
        raise AppError(403, "FORBIDDEN", "Ruta no permitida")

    if not target.exists() or target.is_dir():
        if Path(path).suffix:
            raise AppError(404, "NOT_FOUND", "Archivo no encontrado")
        target = PUBLIC_DIR / "index.html"

    mime = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
    if mime.startswith("text/") or mime == "application/javascript":
        mime += "; charset=utf-8"
    return FileResponse(target, media_type=mime, headers={"Cache-Control": "no-store"})
