"""Elimina definitivamente las 3 cuentas demo del seed (sus contrasenas de prueba estan en el repo).

Borra, en una sola transaccion, las cuentas de DEMO_EMAILS y lo que cuelga de ellas: sus
publicaciones (con sus eventos, oportunidades, imagenes, favoritos y reportes), su organizacion,
su registro de colaborador, sus reportes, sesiones e invitaciones.

Los artistas NO se tocan: si una cuenta demo es dueña de un artista (Og Mauro), solo se suelta
el vinculo (artists.user_id = NULL). Antes de confirmar se compara una foto del artista y de
todas sus tablas (canciones, galeria, trayectoria, redes, conexiones, metricas): si algo
distinto de user_id cambio, se aborta sin aplicar nada.

Por defecto es un dry-run (solo lectura). Usa la base de DATABASE_URL (.env).

Uso (desde la raiz del proyecto):
    py scripts/eliminar_cuentas_demo.py            # muestra lo que haria
    py scripts/eliminar_cuentas_demo.py --aplicar  # lo aplica
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import delete, func, select, text, update  # noqa: E402

from backend.service.db.session import SessionLocal  # noqa: E402
from backend.service.models.tables import (  # noqa: E402
    Artist, Collaborator, CollaboratorActivity, InviteToken, Organization, Publication, Report,
    RewardRedemption, Role, Session_ as SessionRow, User,
)

DEMO_EMAILS = ("admin@tejido.co", "gestor@tejido.co", "ciudadano@tejido.co")
# Tablas hijas de un artista (todas con artist_id). Se leen con SQL para comparar filas completas.
ARTIST_TABLES = ("tracks", "artist_media", "artist_timeline", "artist_social_links", "artist_connections", "artist_metrics")


class Abortado(Exception):
    pass


def find_accounts(db, emails=DEMO_EMAILS):
    rows = db.execute(
        select(User.id, User.email, User.name, Role.name.label("role"))
        .join(Role, Role.id == User.role_id)
        .where(func.lower(User.email).in_([e.lower() for e in emails]))
        .order_by(User.id)
    ).all()
    accounts = []
    for row in rows:
        uid = row.id
        count = lambda model, col: db.scalar(select(func.count()).select_from(model).where(col == uid))  # noqa: E731
        accounts.append({
            "id": uid, "email": row.email, "name": row.name, "role": row.role,
            "publications": db.scalars(select(Publication.title).where(Publication.author_id == uid).order_by(Publication.id)).all(),
            "organizations": db.scalars(select(Organization.name).where(Organization.user_id == uid)).all(),
            "artists": db.scalars(select(Artist.stage_name).where(Artist.user_id == uid).order_by(Artist.id)).all(),
            "collaborator": count(Collaborator, Collaborator.user_id),
            "reports": count(Report, Report.user_id),
            "sessions": count(SessionRow, SessionRow.user_id),
        })
    return accounts


def artist_snapshot(db, artist_ids):
    snap = {}
    for aid in artist_ids:
        row = dict(db.execute(text("SELECT * FROM artists WHERE id = :id"), {"id": aid}).mappings().one())
        row.pop("user_id")
        snap[aid] = {"artists": row}
        for table in ARTIST_TABLES:
            snap[aid][table] = [tuple(r) for r in db.execute(text(f"SELECT * FROM {table} WHERE artist_id = :id ORDER BY id"), {"id": aid})]
    return snap


def delete_accounts(db, emails=DEMO_EMAILS):
    """Borra las cuentas y lo suyo. No hace commit: lo decide quien llama."""
    ids = [a["id"] for a in find_accounts(db, emails)]
    if not ids:
        return []
    remaining_admins = db.scalar(
        select(func.count()).select_from(User).join(Role, Role.id == User.role_id)
        .where(Role.name == "ADMIN", User.active.is_(True), User.id.not_in(ids))
    )
    if not remaining_admins:
        raise Abortado("No quedaria ningun ADMIN activo.")

    artist_ids = db.scalars(select(Artist.id).where(Artist.user_id.in_(ids))).all()
    before = artist_snapshot(db, artist_ids)
    db.execute(update(Artist).where(Artist.user_id.in_(ids)).values(user_id=None))

    # Eventos, oportunidades, imagenes y favoritos de las publicaciones caen por ON DELETE CASCADE;
    # los reportes no tienen cascada y se borran antes.
    pub_ids = select(Publication.id).where(Publication.author_id.in_(ids)).scalar_subquery()
    db.execute(delete(Report).where((Report.publication_id.in_(pub_ids)) | (Report.user_id.in_(ids))))
    db.execute(delete(Publication).where(Publication.author_id.in_(ids)))

    collab_ids = select(Collaborator.id).where(Collaborator.user_id.in_(ids)).scalar_subquery()
    db.execute(delete(RewardRedemption).where(RewardRedemption.collaborator_id.in_(collab_ids)))
    db.execute(delete(CollaboratorActivity).where(CollaboratorActivity.collaborator_id.in_(collab_ids)))
    db.execute(delete(Collaborator).where(Collaborator.user_id.in_(ids)))
    db.execute(delete(Organization).where(Organization.user_id.in_(ids)))
    db.execute(delete(SessionRow).where(SessionRow.user_id.in_(ids)))
    db.execute(delete(InviteToken).where(InviteToken.user_id.in_(ids)))
    # Favoritos propios caen por cascada; sus mensajes de Nosotros quedan como anonimos (SET NULL).
    db.execute(delete(User).where(User.id.in_(ids)))
    db.flush()

    if artist_snapshot(db, artist_ids) != before:
        raise Abortado("El contenido de un artista cambio durante la operacion.")
    return ids


def print_accounts(accounts):
    for a in accounts:
        print(f"  id {a['id']} {a['name']} <{a['email']}> {a['role']}")
        print(f"     publicaciones ({len(a['publications'])}): {', '.join(a['publications']) or 'ninguna'}")
        print(f"     organizacion: {', '.join(a['organizations']) or 'ninguna'}  |  artistas (solo se suelta el vinculo): {', '.join(a['artists']) or 'ninguno'}")
        print(f"     colaborador: {a['collaborator']}  |  reportes hechos: {a['reports']}  |  sesiones: {a['sessions']}")


def print_remaining(db):
    print("\nCuentas que quedan:")
    for row in db.execute(
        select(User.id, User.name, User.email, Role.name, User.active, Organization.branch)
        .join(Role, Role.id == User.role_id).join(Organization, Organization.user_id == User.id, isouter=True)
        .order_by(User.id)
    ):
        branch = f"  rama={row.branch}" if row[3] == "GESTOR" else ""
        print(f"  id {row.id} {row.name} <{row.email}> {row[3]} active={row.active}{branch}")
    for row in db.execute(select(Artist.id, Artist.stage_name, Artist.user_id, Artist.active).order_by(Artist.id)):
        print(f"  artista {row.id} {row.stage_name} user_id={row.user_id} active={row.active}")


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--aplicar", action="store_true", help="aplica el borrado (sin esto es un dry-run)")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        accounts = find_accounts(db)
        if not accounts:
            print("No hay cuentas demo en esta base: nada que hacer.")
            print_remaining(db)
            return
        print("Cuentas demo a eliminar:")
        print_accounts(accounts)

        try:
            delete_accounts(db)
        except Abortado as exc:
            db.rollback()
            print(f"\nABORTADO, no se cambio nada: {exc}")
            sys.exit(1)
        if not args.aplicar:
            print_remaining(db)
            db.rollback()
            print("\nDry-run: se simulo dentro de una transaccion y se deshizo. Para aplicar:"
                  " py scripts/eliminar_cuentas_demo.py --aplicar")
            return
        db.commit()
        print("\nAplicado.")
        print_remaining(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
