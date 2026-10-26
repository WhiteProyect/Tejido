"""Plantillas de correo (services/email_templates.py) y su envio con HTML + texto.

Nunca se golpea Resend: resend.Emails.send se reemplaza por una funcion que guarda los parametros.
"""
import pytest

from backend.service.core.config import settings
from backend.service.services import email as email_service
from backend.service.services import notifications
from backend.service.services.email_templates import render_email

BASE = settings.frontend_base_url.rstrip("/")
EVIL = "<script>alert(1)</script><b>x</b>"

# (nombre, (asunto, html, texto, ...), url esperada del boton, titulo esperado en el HTML)
CASES = [
    ("sugerencia", notifications.build_suggestion("TEJ-0001", "Nombre: Ana\nContacto: ana@correo.co\n\nHola equipo"),
     f"{BASE}/#admin-dashboard/bandeja", "Alguien le escribió"),
    ("reporte", notifications.build_report("Festival", "Fecha equivocada", "Sofía"),
     f"{BASE}/#admin-dashboard/bandeja", "fue reportada."),
    ("revision", notifications.build_review("Mercado", "Eze kiel"),
     f"{BASE}/#admin-dashboard/publicaciones", "esperando tu mirada."),
    ("aprobada", notifications.build_moderation("Eze", 7, "Pizza Party", "PUBLISHED", None),
     f"{BASE}/#publicacion/7", "ya está en TEJIDO."),
    ("rechazada", notifications.build_moderation("Eze", 7, "Pizza Party", "REJECTED", "Falta la fecha"),
     f"{BASE}/#gestor-dashboard", "a un paso."),
    ("rechazada-sin-motivo", notifications.build_moderation("Eze", 7, "Pizza Party", "REJECTED", None),
     f"{BASE}/#gestor-dashboard", "a un paso."),
    ("invitacion", ("Activa tu cuenta en TEJIDO", *email_service.build_invite_email("Eze", f"{BASE}/#invitacion/abc")),
     f"{BASE}/#invitacion/abc", "te espera."),
    ("revision-lider", notifications.build_review_for_leader("Mochilas", "Ana", "Eze", "Artesanías"),
     f"{BASE}/#gestor-dashboard/por-revisar", "esperando tu mirada."),
    ("solicitud-lider", notifications.build_join_request("Ana", "Artesanías", "Tejo mochilas", "Eze"),
     f"{BASE}/#gestor-dashboard/solicitudes", "Alguien quiere tejer"),
    ("solicitud-equipo", notifications.build_join_request("Ana", "Artesanías", None, None),
     f"{BASE}/#admin-dashboard/bandeja", "Alguien quiere tejer"),
    ("solicitud-aprobada", notifications.build_join_decision("Ana", "Artesanías", True, None),
     f"{BASE}/#gestor-dashboard", "Bienvenido a"),
    ("lider-nombrado", notifications.build_leader_appointed("Eze", "Gastronomía cultural"),
     f"{BASE}/#gestor-dashboard/por-revisar", "Ahora lideras"),
    ("solicitud-rechazada", notifications.build_join_decision("Ana", "Artesanías", False, "Escríbenos en un mes"),
     f"{BASE}/#perfil", "tejer con nosotros."),
]


@pytest.fixture
def resend_calls(monkeypatch):
    calls = []
    monkeypatch.setattr(email_service.resend.Emails, "send", lambda params: calls.append(params))
    monkeypatch.setattr(settings, "resend_api_key", "re_test")
    monkeypatch.setattr(settings, "support_email", "equipo@correo.co")
    return calls


@pytest.mark.parametrize("name,built,url,title", CASES, ids=[c[0] for c in CASES])
def test_every_email_renders_html_and_text(name, built, url, title):
    subject, html, text = built[:3]
    assert subject and html and text
    assert '<html lang="es">' in html and '<meta charset="utf-8">' in html and 'content="light"' in html
    assert title in html and f'href="{url}"' in html and url in text
    assert "<script" not in html and "<img" not in html
    assert 'style="display:none;max-height:0' in html  # preheader
    assert "max-width:600px" in html and 'role="presentation"' in html


def test_preheaders_are_different_per_email():
    # Un preheader por tipo de correo (las dos variantes de "rechazada" son el mismo tipo).
    kinds = [case for case in CASES if case[0] not in ("rechazada-sin-motivo", "solicitud-equipo")]
    preheaders = {built[1].split("mso-hide:all")[1].split("</div>")[0] for _, built, _, _ in kinds}
    assert len(preheaders) == len(kinds)


def test_user_text_is_escaped_in_html_and_intact_in_text():
    html, text = render_email(kicker="Prueba", accent="river", title=EVIL, paragraphs=[EVIL],
                              details=[("Dato", EVIL)], quote=f"{EVIL}\nsegunda linea")
    assert "<script" not in html and "<b>x</b>" not in html
    assert "&lt;script&gt;alert(1)&lt;/script&gt;&lt;b&gt;x&lt;/b&gt;" in html
    assert "segunda linea" in html and "<br>segunda linea" in html
    assert EVIL in text


def test_suggestion_contact_and_long_fields():
    _, html, text, reply_to = notifications.build_suggestion("TEJ-0002", f"Nombre: {EVIL}\nContacto: {EVIL}\n\n" + "a" * 5000)
    assert reply_to is None and "mailto:" not in html  # un contacto que no es correo no es enlace
    assert "<script" not in html and "…" in html and "…" in text  # el mensaje largo se recorta


def test_links_only_accept_backend_schemes():
    html, _ = render_email(kicker="k", accent="gold", title="t", details=[("x", "y", "javascript:alert(1)")],
                           cta_label="Ir", cta_url="javascript:alert(1)")
    assert 'href="javascript' not in html and 'href="#"' in html


def test_send_passes_html_text_and_reply_to(resend_calls):
    subject, html, text, reply_to = notifications.build_suggestion("TEJ-0003", "Nombre: Ana\nContacto: ana@correo.co\n\nHola")
    email_service.send_team_notification(subject, text, html=html, reply_to=reply_to)
    email_service.send_gestor_notification("gestor@correo.co", "Asunto", "Texto", html="<p>hola</p>")
    email_service.send_invite_email("nuevo@correo.co", "Nuevo", f"{BASE}/#invitacion/xyz")
    team, gestor, invite = resend_calls
    assert team["to"] == ["equipo@correo.co"] and team["html"] == html and team["reply_to"] == "ana@correo.co"
    assert team["text"].endswith("-- TEJIDO") and team["text"].startswith(text)
    assert gestor["to"] == ["gestor@correo.co"] and gestor["html"] == "<p>hola</p>" and "reply_to" not in gestor
    assert invite["subject"] == "Activa tu cuenta en TEJIDO" and "Activar mi cuenta" in invite["html"]
    assert f"{BASE}/#invitacion/xyz" in invite["text"] and "Hola, Nuevo:" in invite["text"]


def test_notify_moderation_sends_html_to_gestor(resend_calls):
    notifications.notify_moderation("gestor@correo.co", "Mateo", 9, "Mi evento", "REJECTED", "Falta el lugar")
    [params] = resend_calls
    assert params["to"] == ["gestor@correo.co"] and "Falta el lugar" in params["html"] and "Falta el lugar" in params["text"]
    assert "necesita ajustes" in params["subject"]
