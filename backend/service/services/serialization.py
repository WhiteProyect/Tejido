"""Portado de backend/services/serialization.py: mismo parche de mojibake."""
from sqlalchemy import inspect


def fix_text(value):
    if not isinstance(value, str):
        return value
    for _ in range(2):
        if not any(mark in value for mark in ("Ã", "Â", "â")):
            break
        try:
            repaired = value.encode("latin1").decode("utf8")
            if repaired == value:
                break
            value = repaired
        except (UnicodeEncodeError, UnicodeDecodeError):
            break
    return value


def model_to_dict(obj):
    """Convierte una instancia de modelo ORM a dict, usando el nombre real de
    columna (no el nombre del atributo Python -- difieren solo para
    ArtistMetric.metadata_, que se serializa como "metadata")."""
    if obj is None:
        return None
    mapper = inspect(obj).mapper
    return {prop.columns[0].name: fix_text(getattr(obj, prop.key)) for prop in mapper.column_attrs}


def models_to_dicts(objs):
    return [model_to_dict(o) for o in objs]


def row_to_dict(row):
    if row is None:
        return None
    return {key: fix_text(value) for key, value in dict(row._mapping).items()}


def rows_to_dicts(rows):
    return [row_to_dict(r) for r in rows]
