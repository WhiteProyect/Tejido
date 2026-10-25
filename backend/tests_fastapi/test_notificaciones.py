"""Avisos por correo (services/notifications.py) y limite de frecuencia del formulario de Nosotros.

Schema aislado del conftest. Las funciones de services/email.py se reemplazan con monkeypatch
(nunca se golpea Resend). Los avisos corren como BackgroundTasks: el TestClient los ejecuta
antes de devolver la respuesta, asi que al volver la llamada ya estan registrados.
"""
import pytest
from fastapi.testclient import TestClient

from backend.service.core.config import settings
from backend.service.models.tables import Publication, Suggestion
from backend.service.services import email as email_service
from backend.tests_fastapi.test_gestor_category import body, category_ids  # noqa: F401
from backend.tests_fastapi.test_gestores_invites import schema_session
from backend.tests_fastapi.test_parity import auth_header, tokens  # noqa: F401

BANDEJA = f"{settings.frontend_base_url.rstrip('/')}/#admin-dashboard/bandeja"


@pytest.fixture
def sent(monkeypatch):
    calls = {"team": [], "gestor": []}
    monkeypatch.setattr(email_service, "send_team_notification",
                        lambda subject, text, html=None, reply_to=None: calls["team"].append((subject, text, html, reply_to)))
    monkeypatch.setattr(email_service, "send_gestor_notification",
                        lambda to_email, subject, text, html=None: calls["gestor"].append((to_email, subject, text, html)))
    return calls


@pytest.fixture
def resend_down(monkeypatch):
    def fail(*args, **kwargs):
        raise RuntimeError("Resend caido")
    monkeypatch.setattr(email_service, "send_team_notification", fail)
    monkeypatch.setattr(email_service, "send_gestor_notification", fail)


def suggest(client, message):
    resp = client.post("/api/suggestions", json={"message": message})
    assert resp.status_code == 201, resp.text
    return resp.json()


def gestor_publication(client, tokens, category_ids, title, publish=False):
    """Publicacion del gestor demo (Mateo Gestor), opcionalmente aprobada por el admin."""
    gestor = auth_header(tokens, "gestor")
    pub = client.post("/api/publications", json=body(category_ids, title), headers=gestor).json()["id"]
    if publish:
        client.post(f"/api/publications/{pub}/submit", headers=gestor)
        client.patch(f"/api/publications/{pub}/status", json={"status": "PUBLISHED", "note": ""}, headers=auth_header(tokens, "admin"))
    return pub


# ─────────────────────────── eventos ───────────────────────────

def test_suggestion_notifies_team_with_ticket_and_reply_to(client, sent):
    data = suggest(client, "Nombre: Lucia\nContacto: lucia@correo.co\n\nQuiero proponer un taller de bullerengue.")
    [(subject, text, html, reply_to)] = sent["team"]
    assert data["ticket"] in subject and data["ticket"] in text and data["ticket"] in html
    assert "Quiero proponer un taller de bullerengue." in text and "Contacto: lucia@correo.co" in text
    assert "Llegó un mensaje nuevo" in text and 'href="mailto:lucia@correo.co"' in html
    assert BANDEJA in text and f'href="{BANDEJA}"' in html
    assert reply_to == "lucia@correo.co"

    suggest(client, "Nombre: Ezequiel\nContacto: 300 123 4567\n\nUn mensaje con telefono.")
    assert sent["team"][1][3] is None and "mailto:" not in sent["team"][1][2]


def test_report_notifies_team(client, tokens, category_ids, sent):
    pub = gestor_publication(client, tokens, category_ids, "Publicacion reportada", publish=True)
    sent["team"].clear()
    resp = client.post(f"/api/publications/{pub}/report", json={"reason": "Fecha equivocada del evento"},
                       headers=auth_header(tokens, "ciudadano"))
    assert resp.status_code == 201
    [(subject, text, html, reply_to)] = sent["team"]
    assert subject.startswith("Reporte de publicación") and "Publicacion reportada" in subject
    assert "Fecha equivocada del evento" in text and "Sofia Ciudadana" in text and BANDEJA in text
    assert "Fecha equivocada del evento" in html and "fue reportada." in html
    assert reply_to is None


def test_review_notifies_team_on_submit_and_on_editing_a_published(client, tokens, category_ids, sent):
    gestor = auth_header(tokens, "gestor")
    pub = gestor_publication(client, tokens, category_ids, "Para revisar")
    assert sent["team"] == []
    assert client.post(f"/api/publications/{pub}/submit", headers=gestor).status_code == 200
    [(subject, text, html, _)] = sent["team"]
    assert "Para revisar" in subject and "Mateo Gestor" in text and "/#admin-dashboard/publicaciones" in text
    assert "envió una publicación a revisión" in text and "Revisar publicaciones" in html

    client.patch(f"/api/publications/{pub}/status", json={"status": "PUBLISHED", "note": ""}, headers=auth_header(tokens, "admin"))
    sent["team"].clear()
    # Editar una publicada la devuelve a revision: avisa.
    assert client.put(f"/api/publications/{pub}", json=body(category_ids, "Para revisar editada"), headers=gestor).status_code == 200
    [(subject, _, _, _)] = sent["team"]
    assert "Para revisar editada" in subject

    # Un borrador editado sigue en borrador y el admin conserva el estado: sin aviso.
    draft = gestor_publication(client, tokens, category_ids, "Borrador")
    sent["team"].clear()
    client.put(f"/api/publications/{draft}", json=body(category_ids, "Borrador editado"), headers=gestor)
    client.put(f"/api/publications/{pub}", json=body(category_ids, "Editada por admin"), headers=auth_header(tokens, "admin"))
    assert sent["team"] == []


def test_moderation_notifies_gestor_author(client, tokens, category_ids, sent):
    gestor, admin = auth_header(tokens, "gestor"), auth_header(tokens, "admin")
    approved = gestor_publication(client, tokens, category_ids, "Sera aprobada")
    rejected = gestor_publication(client, tokens, category_ids, "Sera rechazada")
    for pub in (approved, rejected):
        client.post(f"/api/publications/{pub}/submit", headers=gestor)
    client.patch(f"/api/publications/{approved}/status", json={"status": "PUBLISHED", "note": ""}, headers=admin)
    client.patch(f"/api/publications/{rejected}/status", json={"status": "REJECTED", "note": "Falta la fecha del evento"}, headers=admin)

    [ok, ko] = sent["gestor"]
    assert ok[0] == "gestor@tejido.co" and "aprobada" in ok[1] and "Sera aprobada" in ok[1]
    assert "Hola, Mateo Gestor:" in ok[2] and f"/#publicacion/{approved}" in ok[2] and "Lo que te sugieren" not in ok[2]
    assert "Ver mi publicación" in ok[3]
    assert "ajustes" in ko[1] and "Falta la fecha del evento" in ko[2] and "Falta la fecha del evento" in ko[3]
    assert "/#gestor-dashboard" in ko[2]


def test_moderation_of_admin_publication_sends_nothing(client, tokens, category_ids, sent):
    admin = auth_header(tokens, "admin")
    pub = client.post("/api/publications", json=body(category_ids, "Del admin"), headers=admin).json()["id"]
    client.post(f"/api/publications/{pub}/submit", headers=admin)
    assert client.patch(f"/api/publications/{pub}/status", json={"status": "PUBLISHED", "note": ""}, headers=admin).status_code == 200
    assert sent["gestor"] == []


# ─────────────────────────── fallos ───────────────────────────

def test_resend_down_never_breaks_the_action(client, tokens, category_ids, resend_down):
    data = suggest(client, "Mensaje que se guarda aunque Resend este caido.")
    with schema_session() as db:
        assert db.get(Suggestion, data["id"]).status == "NEW"

    gestor, admin = auth_header(tokens, "gestor"), auth_header(tokens, "admin")
    pub = gestor_publication(client, tokens, category_ids, "Moderada sin correo")
    assert client.post(f"/api/publications/{pub}/submit", headers=gestor).status_code == 200
    assert client.patch(f"/api/publications/{pub}/status", json={"status": "REJECTED", "note": "Motivo largo"}, headers=admin).status_code == 200
    with schema_session() as db:
        row = db.get(Publication, pub)
        assert (row.status, row.moderation_note) == ("REJECTED", "Motivo largo")
    assert client.post(f"/api/publications/{gestor_publication(client, tokens, category_ids, 'Reportable', publish=True)}/report",
                       json={"reason": "Reporte sin correo"}, headers=auth_header(tokens, "ciudadano")).status_code == 201


def test_team_notification_without_support_email_is_skipped(monkeypatch):
    calls = []
    monkeypatch.setattr(email_service.resend.Emails, "send", lambda params: calls.append(params))
    monkeypatch.setattr(settings, "resend_api_key", "re_test")

    monkeypatch.setattr(settings, "support_email", "  ")
    email_service.send_team_notification("Asunto", "Texto")
    assert calls == []

    monkeypatch.setattr(settings, "support_email", "uno@correo.co, dos@correo.co")
    email_service.send_team_notification("Asunto", "Texto", reply_to="lucia@correo.co")
    [params] = calls
    assert params["to"] == ["uno@correo.co", "dos@correo.co"] and params["reply_to"] == "lucia@correo.co"
    assert params["text"].endswith("-- TEJIDO") and params["from"] == settings.email_from


def test_email_from_default_uses_the_verified_domain():
    assert type(settings).model_fields["email_from"].default == "TEJIDO <notificaciones@tejido.com.co>"


# ─────────────────────────── limite de frecuencia ───────────────────────────

def test_fourth_suggestion_from_same_ip_is_rate_limited(client, sent):
    for i in range(3):
        suggest(client, f"Mensaje numero {i} desde la misma IP.")
    blocked = client.post("/api/suggestions", json={"message": "Cuarto mensaje seguido desde la misma IP."})
    assert blocked.status_code == 429
    assert blocked.json()["message"] == "Enviaste varios mensajes seguidos. Inténtalo de nuevo en unos minutos."
    assert len(sent["team"]) == 3
    # Los intentos invalidos tambien cuentan.
    assert client.post("/api/suggestions", json={"message": "corto"}).status_code == 429

    other_ip = TestClient(client.app, client=("10.0.0.2", 50000))
    assert other_ip.post("/api/suggestions", json={"message": "Otra IP no esta bloqueada."}).status_code == 201
