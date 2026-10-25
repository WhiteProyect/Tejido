"""Envio de correo transaccional con Resend (HTML + texto plano, services/email_templates.py).

Funciones de modulo (no llamadas inline en los endpoints) para que los tests las
reemplacen con monkeypatch y nunca golpeen la API real. Quien las llama decide que
hacer si fallan: el alta de gestores atrapa el error y devuelve el link igual, y los
avisos (services/notifications.py) lo loguean sin tocar la accion principal.
"""
import logging

import resend

from backend.service.core.config import settings
from backend.service.services.email_templates import render_email

logger = logging.getLogger("tejido.api")

SIGNATURE = "\n\n-- TEJIDO"


class EmailNotConfigured(RuntimeError):
    pass


def _send(to: list[str], subject: str, text: str, html: str | None = None, reply_to: str | None = None) -> None:
    if not settings.resend_api_key:
        raise EmailNotConfigured("RESEND_API_KEY no esta configurada")
    resend.api_key = settings.resend_api_key
    params = {"from": settings.email_from, "to": to, "subject": subject, "text": text + SIGNATURE}
    if html:
        params["html"] = html
    if reply_to:
        params["reply_to"] = reply_to
    resend.Emails.send(params)


def build_invite_email(to_name: str, invite_link: str) -> tuple[str, str]:
    greeting = f"Hola, {to_name}:" if to_name else "Hola:"
    return render_email(
        kicker="Invitación",
        accent="gold",
        title="Tu territorio",
        title_accent="te espera.",
        paragraphs=[
            greeting,
            "Te invitaron a TEJIDO, la plataforma cultural de Caucasia y el Bajo Cauca.",
            "Para activar tu cuenta, abre el enlace y define tu contraseña. Es personal y vence en unos días.",
        ],
        cta_label="Activar mi cuenta",
        cta_url=invite_link,
        preheader="Activa tu cuenta y empieza a tejer con nosotros.",
        footer_note="Si no esperabas este correo, puedes ignorarlo.",
    )


def send_invite_email(to_email: str, to_name: str, invite_link: str) -> None:
    """Invita a activar la cuenta en TEJIDO. Lanza excepcion si el envio falla."""
    html, text = build_invite_email(to_name, invite_link)
    _send([to_email], "Activa tu cuenta en TEJIDO", text, html=html)


def send_team_notification(subject: str, text: str, html: str | None = None, reply_to: str | None = None) -> None:
    """Aviso al equipo (SUPPORT_EMAIL). Sin direcciones configuradas se omite con una advertencia."""
    recipients = settings.support_recipients
    if not recipients:
        logger.warning("SUPPORT_EMAIL vacia: se omite el aviso al equipo (%s)", subject)
        return
    _send(recipients, subject, text, html=html, reply_to=reply_to)


def send_gestor_notification(to_email: str, subject: str, text: str, html: str | None = None) -> None:
    _send([to_email], subject, text, html=html)
