"""Firma de subidas directas del navegador a Cloudinary.

Algoritmo (https://cloudinary.com/documentation/authentication_signatures): todos los
parametros que se envian a /image/upload salvo file, cloud_name, resource_type y api_key, como
pares name=value ordenados alfabeticamente y unidos con "&"; se le pega el API secret al final,
sin separador, y se calcula SHA-1 en hexadecimal. La firma vale una hora desde `timestamp`.

Lo firmado restringe la subida: el navegador no puede cambiar la carpeta, los formatos ni la
transformacion entrante sin invalidar la firma.
"""
import hashlib
import time

from backend.service.core.config import settings

ALLOWED_FORMATS = "jpg,jpeg,png,webp"
# Transformacion entrante: Cloudinary guarda la imagen ya reducida (lado mayor <= 2400 px, sin
# agrandar las pequenas) y con calidad automatica. f_auto no se permite al subir; va en la entrega.
INCOMING_TRANSFORMATION = "c_limit,w_2400,h_2400,q_auto"
MAX_IMAGE_BYTES = 10 * 1024 * 1024
EXCLUDED_FROM_SIGNATURE = {"file", "cloud_name", "resource_type", "api_key"}


def sign_params(params: dict, api_secret: str) -> str:
    to_sign = "&".join(
        f"{key}={params[key]}" for key in sorted(params) if key not in EXCLUDED_FROM_SIGNATURE and params[key] not in (None, "")
    )
    return hashlib.sha1(f"{to_sign}{api_secret}".encode("utf-8")).hexdigest()


def is_configured() -> bool:
    return bool(settings.cloudinary_cloud_name and settings.cloudinary_api_key and settings.cloudinary_api_secret)


def signed_upload(folder: str, timestamp: int | None = None) -> dict:
    """Todo lo que el navegador necesita para subir a Cloudinary (sin el secret)."""
    params = {
        "allowed_formats": ALLOWED_FORMATS,
        "folder": folder,
        "timestamp": int(time.time()) if timestamp is None else timestamp,
        "transformation": INCOMING_TRANSFORMATION,
    }
    return {
        **params,
        "signature": sign_params(params, settings.cloudinary_api_secret),
        "api_key": settings.cloudinary_api_key,
        "cloud_name": settings.cloudinary_cloud_name,
        "upload_url": f"https://api.cloudinary.com/v1_1/{settings.cloudinary_cloud_name}/image/upload",
        "max_bytes": MAX_IMAGE_BYTES,
    }
