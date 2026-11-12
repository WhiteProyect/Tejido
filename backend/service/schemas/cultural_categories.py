"""Utilidad de las ramas de cultura (las "categorias" del publico). La lista ya no vive en codigo: esta en
la tabla cultural_branches (services/cultural_branches.py). Aqui queda solo el slug de una clave.
"""


def category_slug(key: str) -> str:
    """MUSICA -> musica, CINE_AUDIOVISUAL -> cine-audiovisual."""
    return key.lower().replace("_", "-")
