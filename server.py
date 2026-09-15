#!/usr/bin/env python3
"""Punto de arranque del backend TEJIDO (FastAPI + PostgreSQL)."""
import uvicorn

from backend.service.core.config import settings
from backend.service.core.logging_config import configure_logging


def main():
    configure_logging(settings.log_level)
    # log_config=None: ya configuramos logging arriba: si dejamos que uvicorn
    # aplique su propio dictConfig por defecto, pisaria el nuestro.
    uvicorn.run(
        "backend.service.main:app",
        host=settings.host,
        port=settings.port,
        reload=False,
        log_config=None,
    )


if __name__ == "__main__":
    main()
