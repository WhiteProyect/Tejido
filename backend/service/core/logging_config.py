"""
Logging con el modulo estandar `logging` -- reemplaza el `print()` casero de
`Handler.log_message` del backend legado (backend/app.py, ya retirado).

`configure_logging()` es idempotente: se llama tanto en server.py (antes de
`uvicorn.run(..., log_config=None)`, para que uvicorn no pise esta config con
la suya por defecto) como al importar backend/service/main.py (para que
tambien quede bien configurado corriendo via `uvicorn backend.service.main:app`
directo, o bajo TestClient en los tests).
"""
import logging.config

_CONFIGURED = False


def configure_logging(log_level: str = "INFO"):
    global _CONFIGURED
    if _CONFIGURED:
        return
    _CONFIGURED = True

    logging.config.dictConfig({
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {
                "format": "%(asctime)s %(levelname)-8s %(name)s: %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S",
            },
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "formatter": "default",
            },
        },
        "root": {
            "handlers": ["console"],
            "level": log_level,
        },
        "loggers": {
            "uvicorn": {"handlers": ["console"], "level": log_level, "propagate": False},
            "uvicorn.error": {"handlers": ["console"], "level": log_level, "propagate": False},
            "uvicorn.access": {"handlers": ["console"], "level": log_level, "propagate": False},
            # Los logs de SQLAlchemy en INFO son extremadamente verbosos
            # (imprimen cada SQL ejecutado); solo interesan como WARNING+.
            "sqlalchemy.engine": {"handlers": ["console"], "level": "WARNING", "propagate": False},
        },
    })
