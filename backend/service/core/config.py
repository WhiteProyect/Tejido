from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Sin default: si falta en .env/entorno, pydantic-settings falla al
    # arrancar con un error claro en vez de conectar en silencio a algo
    # inesperado. Fase 2: siempre PostgreSQL (ver backend/service/models,
    # que ya usa tipos especificos de Postgres como JSONB).
    database_url: str

    # Mismo host:puerto que el backend legado (ya retirado) para no requerir
    # ningun cambio en frontend/vite.config.js, que ya proxea /api, /images
    # y /assets a 127.0.0.1:8765.
    host: str = "127.0.0.1"
    port: int = 8765

    public_dir: Path = ROOT / "frontend" / "dist"

    # "production" endurece un par de cosas (ver main.py): oculta
    # /docs, /redoc y /openapi.json, y baja el detalle de los logs.
    environment: Literal["development", "production"] = "development"
    log_level: str = "INFO"

    # Limite de tamano de body por request -- mismo valor que
    # MAX_BODY_BYTES del backend legado (backend/app.py, ya retirado).
    max_body_bytes: int = 1_000_000
    # Tiempo maximo por request antes de responder 504 (protege contra un
    # query colgado o un problema de red con Neon bloqueando un worker).
    request_timeout_seconds: float = 30.0


settings = Settings()
