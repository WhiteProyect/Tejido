"""Entrada de POST /api/uploads/sign. `ref` solo lo usa el scope "artist" (id del artista)."""
from typing import Literal, Optional

from pydantic import BaseModel, StrictInt

UploadScope = Literal["artist", "publication", "organization", "avatar"]


class UploadSignInput(BaseModel):
    scope: UploadScope
    ref: Optional[StrictInt] = None
