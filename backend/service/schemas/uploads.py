"""Entrada de POST /api/uploads/sign. `ref` solo lo usa el scope "artist" (id del artista; sin ref, el
alta de un artista nuevo, que sube a una carpeta fija)."""
from typing import Literal, Optional

from pydantic import BaseModel, StrictInt

UploadScope = Literal["artist", "publication", "organization", "avatar", "talent", "category_cover"]


class UploadSignInput(BaseModel):
    scope: UploadScope
    ref: Optional[StrictInt] = None
