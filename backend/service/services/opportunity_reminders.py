"""Avisos de cierre de las oportunidades guardadas (fase 1 de la postulacion).

A cada CIUDADANO que guardo una OPORTUNIDAD publicada se le escribe cuando faltan REMINDER_DAYS dias
para el cierre (3 y 1, por dia de Bogota). Cada envio queda en opportunity_reminders (unico por
usuario, oportunidad y anticipacion), asi una segunda corrida el mismo dia no repite nada.

Solo se escribe a cuentas activas con el correo verificado. No hay preferencias de aviso por usuario:
quitar la oportunidad de Guardadas es lo que corta los avisos (lo dice el pie del correo).

No corre solo: lo lanza el comando `py -m backend.service.scripts.send_opportunity_reminders`
(dry-run por defecto, --send para enviar), que hay que programar una vez al dia al desplegar.
"""
import logging
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import exists, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.service.models.tables import Favorite, OpportunityReminder, Publication, Role, User
from backend.service.services import email as email_service
from backend.service.services.home_carousel import today_bogota
from backend.service.services.notifications import build_opportunity_reminder

logger = logging.getLogger("tejido.api")

REMINDER_DAYS = (3, 1)


def due_reminders(db: Session, today: date) -> list[dict]:
    """Avisos pendientes para hoy: (usuario, oportunidad, dias antes) sin enviar todavia."""
    due = []
    for days in REMINDER_DAYS:
        day_start = datetime.combine(today + timedelta(days=days), time.min)
        already = exists().where(OpportunityReminder.user_id == Favorite.user_id,
                                 OpportunityReminder.publication_id == Favorite.publication_id,
                                 OpportunityReminder.days_before == days)
        rows = db.execute(
            select(Favorite.user_id, User.email, User.name, User.first_name, Publication.id.label("publication_id"),
                   Publication.title, Publication.end_date, Publication.link)
            .join(User, User.id == Favorite.user_id)
            .join(Role, Role.id == User.role_id)
            .join(Publication, Publication.id == Favorite.publication_id)
            .where(Role.name == "CIUDADANO", User.active.is_(True), User.email_verified_at.is_not(None),
                   Publication.kind == "OPORTUNIDAD", Publication.status == "PUBLISHED", Publication.deleted.is_(False),
                   Publication.end_date >= day_start, Publication.end_date < day_start + timedelta(days=1),
                   ~already)
            .order_by(Publication.id, Favorite.user_id)
        ).all()
        due += [{**row._asdict(), "days_before": days} for row in rows]
    return due


def send_reminders(db: Session, today: date | None = None, send: bool = False) -> dict:
    """Con send=False (dry-run) solo lista lo pendiente. Con send=True envia cada aviso y lo registra
    (commit por aviso); un fallo de envio no registra nada (se reintenta en la proxima corrida)."""
    today = today or today_bogota()
    due = due_reminders(db, today)
    result = {"today": today.isoformat(), "due": [{k: item[k] for k in ("user_id", "publication_id", "days_before")} for item in due],
              "sent": 0, "failed": 0}
    if not send:
        return result
    for item in due:
        subject, html, text = build_opportunity_reminder(
            item["first_name"] or item["name"], item["publication_id"], item["title"], item["end_date"], item["days_before"], item["link"])
        try:
            email_service.send_gestor_notification(item["email"], subject, text, html=html)
        except Exception:
            logger.exception("No se pudo enviar el aviso de cierre (publicacion %s, usuario %s)", item["publication_id"], item["user_id"])
            result["failed"] += 1
            continue
        db.add(OpportunityReminder(user_id=item["user_id"], publication_id=item["publication_id"],
                                   days_before=item["days_before"], sent_at=datetime.now(timezone.utc)))
        try:
            db.commit()
        except IntegrityError:  # otra corrida lo registro al mismo tiempo
            db.rollback()
            continue
        result["sent"] += 1
    return result
