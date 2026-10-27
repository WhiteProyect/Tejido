"""Municipios del Bajo Cauca que usa TEJIDO (origen del talento contratable).

Sus nombres para el frontend viven en frontend/src/utils/constants.js (MUNICIPALITIES, mismas
claves); hay que mantener las dos listas iguales.
"""

MUNICIPALITY_LABELS = {
    "caucasia": "Caucasia",
    "caceres": "Cáceres",
    "taraza": "Tarazá",
    "nechi": "Nechí",
    "elbagre": "El Bagre",
    "zaragoza": "Zaragoza",
}

MUNICIPALITIES = frozenset(MUNICIPALITY_LABELS)
