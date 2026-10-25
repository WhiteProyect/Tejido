"""Mensajes del formulario de Nosotros (tabla suggestions)."""
import re
from typing import Optional

# El formulario manda nombre y contacto (opcionales) como cabecera del texto:
# "Nombre: X\nContacto: Y\n\n<mensaje>" (frontend/src/screens/NosotrosScreen.jsx).
HEADER_LINE = re.compile(r"^(Nombre|Contacto):[ \t]*(.*)$")
EMAIL = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def split_message(message: str) -> tuple[Optional[str], Optional[str], str]:
    lines = (message or "").split("\n")
    fields = {}
    index = 0
    while index < len(lines):
        match = HEADER_LINE.match(lines[index])
        if not match or match.group(1) in fields:
            break
        fields[match.group(1)] = match.group(2).strip() or None
        index += 1
    if not fields:
        return None, None, message
    return fields.get("Nombre"), fields.get("Contacto"), "\n".join(lines[index:]).strip()


def looks_like_email(value: Optional[str]) -> bool:
    return bool(value and EMAIL.match(value))
