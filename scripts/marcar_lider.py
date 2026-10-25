"""Nombra lider de una rama cultural a un gestor (la misma logica que PUT /api/admin/branches/{rama}/leader).

El gestor debe tener su organizacion en esa rama. Si la rama ya tenia lider, el anterior queda
como participante. Por defecto es un dry-run: lo simula dentro de una transaccion y la deshace.
Usa la base de DATABASE_URL (.env).

Uso (desde la raiz del proyecto):
    py scripts/marcar_lider.py --email <correo del gestor> --rama <CLAVE>            # dry-run
    py scripts/marcar_lider.py --email <correo del gestor> --rama <CLAVE> --aplicar  # lo aplica
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import func, select  # noqa: E402

from backend.service.db.session import SessionLocal  # noqa: E402
from backend.service.errors import AppError  # noqa: E402
from backend.service.models.tables import Organization, User  # noqa: E402
from backend.service.schemas.cultural_categories import CULTURAL_CATEGORY_LABELS  # noqa: E402
from backend.service.services import branches  # noqa: E402


def describe(row) -> str:
    return f"{row.name} <{row.email}> (id {row.id}, organización «{row.organization}»)" if row else "nadie"


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--email", required=True, help="correo del gestor que sera lider")
    parser.add_argument("--rama", required=True, help="clave de la rama, p. ej. GASTRONOMIA_CULTURAL")
    parser.add_argument("--aplicar", action="store_true", help="aplica el cambio (sin esto es un dry-run)")
    args = parser.parse_args()
    branch = args.rama.strip().upper()
    if branch not in CULTURAL_CATEGORY_LABELS:
        print(f"Rama invalida: {args.rama}. Opciones: {', '.join(CULTURAL_CATEGORY_LABELS)}")
        sys.exit(1)

    db = SessionLocal()
    try:
        user = db.execute(select(User).where(func.lower(User.email) == args.email.strip().lower())).scalars().first()
        if user is None:
            print(f"No hay ningun usuario con el correo {args.email}.")
            sys.exit(1)
        org = db.execute(select(Organization).where(Organization.user_id == user.id).order_by(Organization.id)).scalars().first()
        print(f"Rama: {branch} ({CULTURAL_CATEGORY_LABELS[branch]})")
        print(f"Lider actual:  {describe(branches.current_leader_row(db, branch))}")
        print(f"Nuevo lider:   {user.name} <{user.email}> (id {user.id}, organización «{org.name if org else '—'}», rama {org.branch if org else '—'})")
        try:
            result = branches.set_leader(db, branch, user.id)
        except AppError as exc:
            db.rollback()
            print(f"\nNO SE PUEDE: {exc.message}")
            sys.exit(1)
        if not result["changed"]:
            db.rollback()
            print("\nYa es el lider de esa rama: nada que hacer.")
            return
        after = branches.current_leader_row(db, branch)
        if not args.aplicar:
            db.rollback()
            print(f"\nDry-run: quedaria como lider {describe(after)}; se deshizo. Para aplicar, repite con --aplicar.")
            return
        db.commit()
        print(f"\nAplicado. Lider de {CULTURAL_CATEGORY_LABELS[branch]}: {describe(branches.current_leader_row(db, branch))}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
