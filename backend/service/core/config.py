from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    # Ruta absoluta (no ".env" relativo): asi carga bien sin importar desde
    # que directorio se arranque el proceso -- scripts/INICIAR_TEJIDO.ps1
    # lanza el backend con cwd en backend/, no en la raiz del proyecto, y un
    # ".env" relativo ahi nunca lo encontraba (pydantic_settings fallaba con
    # "database_url: Field required" y nodemon quedaba en crash-loop).
    model_config = SettingsConfigDict(env_file=ROOT / ".env", env_file_encoding="utf-8", extra="ignore")

    # Sin default: si falta en .env/entorno, pydantic-settings falla al
    # arrancar con un error claro en vez de conectar en silencio a algo
    # inesperado. Fase 2: siempre PostgreSQL (ver backend/service/models,
    # que ya usa tipos especificos de Postgres como JSONB).
    database_url: str

    # Vite (frontend/vite.config.js) proxea /api a este host:puerto; /images y /assets
    # los sirve Vite desde frontend/public/ en desarrollo.
    host: str = "127.0.0.1"
    port: int = 8765

    public_dir: Path = ROOT / "frontend" / "dist"

    # "production" endurece un par de cosas (ver main.py): oculta
    # /docs, /redoc y /openapi.json, y baja el detalle de los logs.
    environment: Literal["development", "production"] = "development"
    log_level: str = "INFO"

    # Limite de tamano de body por request.
    max_body_bytes: int = 1_000_000
    # Tiempo maximo por request antes de responder 504 (protege contra un
    # query colgado o un problema de red con Neon bloqueando un worker).
    request_timeout_seconds: float = 30.0


settings = Settings()
