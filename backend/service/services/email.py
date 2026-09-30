"""Envio de correo transaccional con Resend.

Funciones de modulo (no llamadas inline en los endpoints) para que los tests las
reemplacen con monkeypatch y nunca golpeen la API real. Quien las llama decide que
hacer si fallan: el alta de gestores atrapa el error y devuelve el link igual.
"""
import resend

from backend.service.core.config import settings


class EmailNotConfigured(RuntimeError):
    pass


def send_invite_email(to_email: str, to_name: str, invite_link: str) -> None:
    """Invita a activar la cuenta en TEJIDO. Lanza excepcion si el envio falla."""
    if not settings.resend_api_key:
        raise EmailNotConfigured("RESEND_API_KEY no esta configurada")
    resend.api_key = settings.resend_api_key
    greeting = f"Hola, {to_name}:" if to_name else "Hola:"
    text = (
        f"{greeting}\n\n"
        "Te invitaron a TEJIDO, la plataforma cultural de Caucasia y el Bajo Cauca.\n\n"
        "Para activar tu cuenta, abre este enlace y define tu contraseña:\n"
        f"{invite_link}\n\n"
        "El enlace es personal y vence en unos dias. Si no esperabas este correo, puedes ignorarlo.\n\n"
        "-- TEJIDO"
    )
    resend.Emails.send({
        "from": settings.email_from,
        "to": [to_email],
        "subject": "Activa tu cuenta en TEJIDO",
        "text": text,
    })
