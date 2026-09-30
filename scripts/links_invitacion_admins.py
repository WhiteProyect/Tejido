"""Imprime los links de invitacion de los 3 admins reales (ids 4-6 del seed).

SOLO LECTURA: no crea, borra ni envia nada. Usa la base de DATABASE_URL (.env) y
FRONTEND_BASE_URL para armar {FRONTEND_BASE_URL}/#invitacion/<token>.

Uso (desde la raiz del proyecto, despues de correr el seed contra esa base):
    py scripts/links_invitacion_admins.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select  # noqa: E402

from backend.service.db.session import SessionLocal  # noqa: E402
from backend.service.models.tables import InviteToken, User  # noqa: E402
from backend.service.services.auth import now_utc  # noqa: E402
from backend.service.services.invites import invite_link  # noqa: E402

ADMIN_IDS = (4, 5, 6)


def main():
    db = SessionLocal()
    try:
        users = db.execute(select(User).where(User.id.in_(ADMIN_IDS)).order_by(User.id)).scalars().all()
        if not users:
            print("No hay usuarios 4-6 en esta base: corre primero el seed.")
            return
        for user in users:
            if user.active:
                print(f"{user.id} {user.name} <{user.email}>: ya activo su cuenta (no necesita link).")
                continue
            invite = db.execute(
                select(InviteToken)
                .where(InviteToken.user_id == user.id, InviteToken.used_at.is_(None), InviteToken.expires_at > now_utc())
                .order_by(InviteToken.created_at.desc())
            ).scalars().first()
            if invite is None:
                print(f"{user.id} {user.name} <{user.email}>: sin invitacion vigente (vuelve a correr el seed).")
            else:
                print(f"{user.id} {user.name} <{user.email}> (vence {invite.expires_at:%Y-%m-%d}):\n    {invite_link(invite.token)}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
