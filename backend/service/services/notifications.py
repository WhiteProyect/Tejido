"""Avisos por correo de los eventos de TEJIDO (HTML + texto, via services/email.py).

Corren como BackgroundTasks de FastAPI, despues de que la ruta hizo commit y ya respondio:
reciben datos simples (nunca la sesion de la base) y NUNCA lanzan: un fallo de Resend o una
configuracion ausente se loguea y la accion principal ya quedo guardada.

Cada build_* devuelve (asunto, html, texto) sin enviar nada: scripts/preview_correos.py los usa.
"""
import logging

from backend.service.core.config import settings
from backend.service.services import email as email_service
from backend.service.services.email_templates import clip, render_email
from backend.service.services.suggestions import looks_like_email, split_message

logger = logging.getLogger("tejido.api")

TEAM_NOTE = "Recibes este aviso porque eres parte del equipo de TEJIDO."
GESTOR_NOTE = "Recibes este mensaje porque tienes una cuenta de gestor en TEJIDO."


def _link(fragment: str) -> str:
    return f"{settings.frontend_base_url.rstrip('/')}/#{fragment}"


def _safely(description: str, send, *args, **kwargs) -> None:
    try:
        send(*args, **kwargs)
    except Exception:
        logger.exception("No se pudo enviar el aviso por correo: %s", description)


def build_suggestion(ticket: str, message: str):
    name, contact, text = split_message(message)
    reply_to = contact if looks_like_email(contact) else None
    details = [("Ticket", ticket), ("Nombre", name or "Sin nombre")]
    if contact:
        details.append(("Contacto", contact, f"mailto:{contact}") if reply_to else ("Contacto", contact))
    else:
        details.append(("Contacto", "No dejó contacto"))
    html, body = render_email(
        kicker=f"Nuevo mensaje · {ticket}",
        accent="river",
        title="Alguien le escribió",
        title_accent="a TEJIDO.",
        paragraphs=["Llegó un mensaje nuevo desde el formulario de Nosotros."],
        details=details,
        quote=text,
        closing=["Responde a este correo para escribirle directamente."] if reply_to else [],
        cta_label="Abrir la Bandeja",
        cta_url=_link("admin-dashboard/bandeja"),
        preheader=f"{ticket} · {clip(text, 90)}",
        footer_note=TEAM_NOTE,
    )
    return f"Nuevo mensaje en TEJIDO ({ticket})", html, body, reply_to


def build_report(publication_title: str, reason: str, reporter_name: str | None):
    html, body = render_email(
        kicker="Reporte de publicación",
        accent="orange",
        title="Una publicación",
        title_accent="fue reportada.",
        paragraphs=["Alguien de la comunidad reportó una publicación. Revísala y decide si necesita cambios."],
        details=[("Publicación", publication_title), ("Motivo", reason), ("Reportado por", reporter_name or "Alguien de la comunidad")],
        cta_label="Abrir la Bandeja",
        cta_url=_link("admin-dashboard/bandeja"),
        preheader=f"Motivo: {clip(reason, 100)}",
        footer_note=TEAM_NOTE,
    )
    return f"Reporte de publicación: {clip(publication_title, 80)}", html, body


def build_review(publication_title: str, gestor_name: str):
    html, body = render_email(
        kicker="Publicación en revisión",
        accent="gold",
        title="Hay una publicación",
        title_accent="esperando tu mirada.",
        paragraphs=[f"{clip(gestor_name, 120)} envió una publicación a revisión. Apruébala o devuélvela con un motivo desde el dashboard."],
        details=[("Publicación", publication_title), ("Enviada por", gestor_name)],
        cta_label="Revisar publicaciones",
        cta_url=_link("admin-dashboard/publicaciones"),
        preheader=f"{clip(gestor_name, 60)} envió «{clip(publication_title, 60)}» a revisión.",
        footer_note=TEAM_NOTE,
    )
    return f"Publicación en revisión: {clip(publication_title, 80)}", html, body


def leader_note(branch_label: str) -> str:
    return f"Recibes este aviso porque lideras la rama {branch_label} en TEJIDO."


def build_review_for_leader(publication_title: str, gestor_name: str, leader_name: str, branch_label: str):
    html, body = render_email(
        kicker=f"Publicación en revisión · {branch_label}",
        accent="gold",
        title="Hay una publicación",
        title_accent="esperando tu mirada.",
        paragraphs=[f"Hola, {clip(leader_name, 120)}:",
                    f"{clip(gestor_name, 120)}, de tu rama, envió una publicación a revisión. Apruébala o devuélvela con un motivo desde tu dashboard."],
        details=[("Publicación", publication_title), ("Enviada por", gestor_name)],
        cta_label="Revisar publicaciones",
        cta_url=_link("gestor-dashboard/por-revisar"),
        preheader=f"{clip(gestor_name, 60)} envió «{clip(publication_title, 60)}» a revisión en {branch_label}.",
        footer_note=leader_note(branch_label),
    )
    return f"Publicación en revisión: {clip(publication_title, 80)}", html, body


def build_join_request(applicant_name: str, branch_label: str, message: str | None, leader_name: str | None):
    for_leader = leader_name is not None
    html, body = render_email(
        kicker=f"Solicitud para participar · {branch_label}",
        accent="river",
        title="Alguien quiere tejer",
        title_accent=f"en {branch_label}.",
        paragraphs=[f"Hola, {clip(leader_name, 120)}:" if for_leader else "",
                    f"{clip(applicant_name, 120)} pidió participar como gestor en la rama {branch_label}. Revisa su mensaje y decide si le das la bienvenida."],
        details=[("Persona", applicant_name), ("Rama", branch_label)],
        quote=message or "No dejó un mensaje.",
        cta_label="Revisar la solicitud",
        cta_url=_link("gestor-dashboard/solicitudes" if for_leader else "admin-dashboard/bandeja"),
        preheader=f"{clip(applicant_name, 60)} quiere participar en {branch_label}.",
        footer_note=leader_note(branch_label) if for_leader else TEAM_NOTE,
    )
    return f"Solicitud para participar en {branch_label}", html, body


def build_join_decision(applicant_name: str, branch_label: str, approved: bool, note: str | None):
    greeting = f"Hola, {clip(applicant_name, 120)}:" if applicant_name else "Hola:"
    footer = "Recibes este mensaje porque pediste participar en una rama de TEJIDO."
    if approved:
        html, body = render_email(
            kicker="Solicitud aprobada",
            accent="mint",
            title="Bienvenido a",
            title_accent=f"{branch_label}.",
            paragraphs=[greeting, f"Tu solicitud fue aprobada: ya eres gestor de la rama {branch_label}. Desde tu dashboard puedes crear tus primeras publicaciones."],
            details=[("Rama", branch_label)] + ([("Nota", note)] if note else []),
            cta_label="Ir a mi dashboard",
            cta_url=_link("gestor-dashboard"),
            preheader=f"Ya eres parte de {branch_label} en TEJIDO.",
            footer_note=footer,
        )
        return f"Ya eres parte de {branch_label} en TEJIDO", html, body
    html, body = render_email(
        kicker="Sobre tu solicitud",
        accent="purple",
        title="Gracias por querer",
        title_accent="tejer con nosotros.",
        paragraphs=[greeting, f"Esta vez tu solicitud para participar en {branch_label} no fue aprobada. Puedes seguir explorando TEJIDO y volver a intentarlo más adelante."],
        details=[("Rama", branch_label), ("Nota", note or "No dejaron una nota.")],
        cta_label="Ir a mi perfil",
        cta_url=_link("perfil"),
        preheader=f"Respuesta a tu solicitud para {branch_label}.",
        footer_note=footer,
    )
    return f"Respuesta a tu solicitud para {branch_label}", html, body


def build_leader_appointed(gestor_name: str, branch_label: str):
    html, body = render_email(
        kicker=f"Liderazgo · {branch_label}",
        accent="gold",
        title="Ahora lideras",
        title_accent=f"{branch_label}.",
        paragraphs=[
            f"Hola, {clip(gestor_name, 120)}:" if gestor_name else "Hola:",
            f"El equipo de TEJIDO te nombró líder de la rama {branch_label}. Desde tu dashboard revisarás lo que "
            "publican los participantes de tu rama y decidirás quién se suma a ella.",
            "Lo que tú publiques lo seguirá revisando el equipo de TEJIDO.",
        ],
        details=[("Rama", branch_label)],
        cta_label="Ir a Por revisar",
        cta_url=_link("gestor-dashboard/por-revisar"),
        preheader=f"Te nombraron líder de {branch_label} en TEJIDO.",
        footer_note=GESTOR_NOTE,
    )
    return f"Te nombraron líder de {branch_label}", html, body


def build_moderation(to_name: str, publication_id: int | None, publication_title: str, status: str, note: str | None):
    greeting = f"Hola, {clip(to_name, 120)}:" if to_name else "Hola:"
    if status == "PUBLISHED":
        html, body = render_email(
            kicker="Publicación aprobada",
            accent="mint",
            title="Tu publicación",
            title_accent="ya está en TEJIDO.",
            paragraphs=[greeting, "El equipo revisó tu publicación y ya está visible para toda la comunidad. ¡Gracias por tejer con nosotros!"],
            details=[("Publicación", publication_title)],
            cta_label="Ver mi publicación",
            cta_url=_link(f"publicacion/{publication_id}" if publication_id else "gestor-dashboard"),
            preheader=f"«{clip(publication_title, 80)}» ya se puede ver en TEJIDO.",
            footer_note=GESTOR_NOTE,
        )
        return f"Tu publicación fue aprobada: {clip(publication_title, 80)}", html, body
    html, body = render_email(
        kicker="Necesita ajustes",
        accent="purple",
        title="Tu publicación está",
        title_accent="a un paso.",
        paragraphs=[greeting, "El equipo revisó tu publicación y, antes de publicarla, te sugiere unos ajustes."],
        details=[("Publicación", publication_title),
                 ("Lo que te sugieren", note or "El equipo no dejó un detalle. Si tienes dudas, escríbenos.")],
        closing=["Cuando la ajustes, vuelve a enviarla a revisión desde tu dashboard."],
        cta_label="Ajustar mi publicación",
        cta_url=_link("gestor-dashboard"),
        preheader=f"Un último ajuste para «{clip(publication_title, 70)}».",
        footer_note=GESTOR_NOTE,
    )
    return f"Tu publicación necesita ajustes: {clip(publication_title, 80)}", html, body


def build_talent_review(talent_name: str, leader_name: str, branch_label: str):
    html, body = render_email(
        kicker=f"Talento en revisión · {branch_label}",
        accent="gold",
        title="Hay un talento",
        title_accent="esperando tu mirada.",
        paragraphs=[f"{clip(leader_name, 120)}, líder de {branch_label}, envió un perfil de talento a revisión. Apruébalo o devuélvelo con un motivo desde el dashboard."],
        details=[("Talento", talent_name), ("Rama", branch_label), ("Enviado por", leader_name)],
        cta_label="Revisar talento",
        cta_url=_link("admin-dashboard/talento"),
        preheader=f"{clip(leader_name, 60)} envió «{clip(talent_name, 60)}» a revisión.",
        footer_note=TEAM_NOTE,
    )
    return f"Talento en revisión: {clip(talent_name, 80)}", html, body


def build_talent_decision(to_name: str, talent_name: str, status: str, note: str | None):
    greeting = f"Hola, {clip(to_name, 120)}:" if to_name else "Hola:"
    if status == "PUBLISHED":
        html, body = render_email(
            kicker="Talento aprobado",
            accent="mint",
            title="El perfil de talento",
            title_accent="ya está en TEJIDO.",
            paragraphs=[greeting, "El equipo revisó el perfil de talento y ya está visible para quienes buscan contratar."],
            details=[("Talento", talent_name)],
            cta_label="Ver mis talentos",
            cta_url=_link("gestor-dashboard/talento"),
            preheader=f"«{clip(talent_name, 80)}» ya se puede ver en TEJIDO.",
            footer_note=GESTOR_NOTE,
        )
        return f"Talento aprobado: {clip(talent_name, 80)}", html, body
    html, body = render_email(
        kicker="Necesita ajustes",
        accent="purple",
        title="El perfil de talento está",
        title_accent="a un paso.",
        paragraphs=[greeting, "El equipo revisó el perfil de talento y, antes de publicarlo, te sugiere unos ajustes."],
        details=[("Talento", talent_name),
                 ("Lo que te sugieren", note or "El equipo no dejó un detalle. Si tienes dudas, escríbenos.")],
        closing=["Cuando lo ajustes, vuelve a enviarlo a revisión desde tu dashboard."],
        cta_label="Ajustar el talento",
        cta_url=_link("gestor-dashboard/talento"),
        preheader=f"Un último ajuste para «{clip(talent_name, 70)}».",
        footer_note=GESTOR_NOTE,
    )
    return f"El talento necesita ajustes: {clip(talent_name, 80)}", html, body


def notify_suggestion(ticket: str, message: str) -> None:
    subject, html, text, reply_to = build_suggestion(ticket, message)
    _safely(f"sugerencia {ticket}", email_service.send_team_notification, subject, text, html=html, reply_to=reply_to)


def notify_report(publication_title: str, reason: str, reporter_name: str | None) -> None:
    subject, html, text = build_report(publication_title, reason, reporter_name)
    _safely(f"reporte de '{publication_title}'", email_service.send_team_notification, subject, text, html=html)


def notify_review(publication_title: str, gestor_name: str, leader: dict | None = None) -> None:
    """leader: {"email", "name", "branch_label"} si le toca al lider de la rama; None = al equipo."""
    if leader:
        subject, html, text = build_review_for_leader(publication_title, gestor_name, leader["name"], leader["branch_label"])
        _safely(f"revision de '{publication_title}' (lider)", email_service.send_gestor_notification,
                leader["email"], subject, text, html=html)
        return
    subject, html, text = build_review(publication_title, gestor_name)
    _safely(f"revision de '{publication_title}'", email_service.send_team_notification, subject, text, html=html)


def notify_leader_appointed(to_email: str, gestor_name: str, branch_label: str) -> None:
    subject, html, text = build_leader_appointed(gestor_name, branch_label)
    _safely(f"lider nombrado {gestor_name}", email_service.send_gestor_notification, to_email, subject, text, html=html)


def notify_join_request(applicant_name: str, branch_label: str, message: str | None, leader: dict | None) -> None:
    """leader: {"email", "name"} si la rama tiene lider; None = al equipo."""
    subject, html, text = build_join_request(applicant_name, branch_label, message, leader["name"] if leader else None)
    if leader:
        _safely(f"solicitud de {applicant_name}", email_service.send_gestor_notification, leader["email"], subject, text, html=html)
    else:
        _safely(f"solicitud de {applicant_name}", email_service.send_team_notification, subject, text, html=html)


def notify_join_decision(to_email: str, applicant_name: str, branch_label: str, approved: bool, note: str | None) -> None:
    subject, html, text = build_join_decision(applicant_name, branch_label, approved, note)
    _safely(f"decision de solicitud de {applicant_name}", email_service.send_gestor_notification, to_email, subject, text, html=html)


def notify_moderation(to_email: str, to_name: str, publication_id: int | None, publication_title: str,
                      status: str, note: str | None) -> None:
    subject, html, text = build_moderation(to_name, publication_id, publication_title, status, note)
    _safely(f"moderacion de '{publication_title}'", email_service.send_gestor_notification, to_email, subject, text, html=html)


def notify_talent_review(talent_name: str, leader_name: str, branch_label: str) -> None:
    subject, html, text = build_talent_review(talent_name, leader_name, branch_label)
    _safely(f"revision del talento '{talent_name}'", email_service.send_team_notification, subject, text, html=html)


def notify_talent_decision(to_email: str, to_name: str, talent_name: str, status: str, note: str | None) -> None:
    subject, html, text = build_talent_decision(to_name, talent_name, status, note)
    _safely(f"decision del talento '{talent_name}'", email_service.send_gestor_notification, to_email, subject, text, html=html)
