"""Categorias culturales de TEJIDO: una sola lista para la rama del gestor
(Organization.branch) y la categoria de cada publicacion (Publication.cultural_category).

Sus etiquetas y slugs para el frontend viven en frontend/src/utils/constants.js
(CULTURAL_CATEGORIES); hay que mantener las dos listas iguales.
"""

CULTURAL_CATEGORY_LABELS = {
    "MUSICA": "Música",
    "CINE_AUDIOVISUAL": "Cine y audiovisual",
    "DANZA": "Danza",
    "TEATRO": "Teatro",
    "ARTES_VISUALES": "Artes visuales",
    "LITERATURA": "Literatura",
    "ARTESANIAS": "Artesanías",
    "PATRIMONIO_MEMORIA": "Patrimonio y memoria",
    "GASTRONOMIA_CULTURAL": "Gastronomía cultural",
    "EMPRENDIMIENTO_CULTURAL": "Emprendimiento cultural",
}

CULTURAL_CATEGORIES = frozenset(CULTURAL_CATEGORY_LABELS)
