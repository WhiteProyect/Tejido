"""Validadores de campos reutilizables por los schemas (textos y URLs).

Las URLs que escribe un usuario acaban en un <a href> o un <img src>: solo se aceptan
http(s) y, donde aplica, rutas del propio sitio (/assets/...). Cualquier otro esquema
(javascript:, data:, vbscript:, //otro-dominio...) se rechaza. Vacio = quitarla (None).
"""
import re

MAX_URL_LENGTH = 500

_EXTERNAL_RE = re.compile(r"^https?://[^\s/?#]+[^\s]*$", re.IGNORECASE)
# Ruta del sitio: "/" seguido de algo que no sea otra "/" (//host es un enlace a otro dominio).
_SITE_PATH_RE = re.compile(r"^/(?!/)[^\s]*$")


def _clean_url(v):
    if v is None:
        return None
    v = str(v).strip()
    if not v:
        return None
    if len(v) > MAX_URL_LENGTH:
        raise ValueError(f"La URL no puede superar {MAX_URL_LENGTH} caracteres")
    return v


def url_or_path(v):
    """Imagenes y enlaces internos: https://..., http://... o una ruta del sitio (/assets/...)."""
    v = _clean_url(v)
    if v is not None and not (_EXTERNAL_RE.match(v) or _SITE_PATH_RE.match(v)):
        raise ValueError("Debe ser una URL (https://...) o una ruta del sitio (/assets/...)")
    return v


def external_url(v):
    """Enlaces a otros sitios (redes, plataformas, videos): solo https:// o http://."""
    v = _clean_url(v)
    if v is not None and not _EXTERNAL_RE.match(v):
        raise ValueError("Debe ser un enlace que empiece por https://")
    return v


def optional_text(v, max_length, label):
    """Texto opcional: vacio = quitarlo (None)."""
    if v is None:
        return None
    v = str(v).strip()
    if len(v) > max_length:
        raise ValueError(f"{label} no puede superar {max_length} caracteres")
    return v or None


def required_text(v, max_length, label, min_length=1):
    """Texto obligatorio cuando se envia: no puede quedar vacio ni ser null."""
    v = "" if v is None else str(v).strip()
    if not v:
        raise ValueError(f"{label} es requerido")
    if len(v) < min_length:
        raise ValueError(f"{label} debe tener al menos {min_length} caracteres")
    if len(v) > max_length:
        raise ValueError(f"{label} no puede superar {max_length} caracteres")
    return v
