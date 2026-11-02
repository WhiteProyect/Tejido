"""Municipios del Bajo Cauca que usa TEJIDO (origen del talento contratable y municipio de cada
publicacion y artista).

Sus nombres para el frontend viven en frontend/src/utils/constants.js (MUNICIPALITIES, mismas
claves); hay que mantener las dos listas iguales.
"""
import unicodedata

MUNICIPALITY_LABELS = {
    "caucasia": "Caucasia",
    "caceres": "Cáceres",
    "taraza": "Tarazá",
    "nechi": "Nechí",
    "elbagre": "El Bagre",
    "zaragoza": "Zaragoza",
}

MUNICIPALITIES = frozenset(MUNICIPALITY_LABELS)

# Palabras clave para deducir el municipio de un texto libre (location de una publicacion, city de
# un artista). Mismo contenido y mismo orden que MUNICIPALITY_LOCATION_MAP en
# frontend/src/utils/constants.js: gana el primer municipio con alguna coincidencia.
MUNICIPALITY_KEYWORDS = {
    "caucasia": ("caucasia", "malecón", "parque de las banderas", "parques de caucasia", "pando"),
    "caceres": ("cáceres", "caceres"),
    "taraza": ("tarazá", "taraza"),
    "nechi": ("nechí", "nechi"),
    "elbagre": ("el bagre", "bagre"),
    "zaragoza": ("zaragoza",),
}


def normalize_text(value) -> str:
    """Minusculas y sin tildes (como normalizeText del frontend)."""
    text = unicodedata.normalize("NFD", str(value or "").lower())
    return "".join(char for char in text if unicodedata.category(char) != "Mn")


def municipality_slug(value) -> str | None:
    """El slug si es uno de los 6 (sin importar mayusculas ni espacios); None si falta o no vale."""
    slug = str(value or "").strip().lower()
    return slug if slug in MUNICIPALITIES else None


def deduce_municipality(text) -> str | None:
    """Municipio que nombra un texto libre, o None si no nombra ninguno (nunca asume Caucasia)."""
    haystack = normalize_text(text)
    if not haystack.strip():
        return None
    for slug, keywords in MUNICIPALITY_KEYWORDS.items():
        if any(normalize_text(keyword) in haystack for keyword in keywords):
            return slug
    return None
