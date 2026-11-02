"""Rellena el municipio de las publicaciones y artistas que aun no lo tienen.

Lo deduce del texto libre que ya existe (location de la publicacion, city del artista) con las
mismas palabras clave del mapa del inicio (MUNICIPALITY_KEYWORDS en
backend/service/schemas/municipalities.py), sin tildes ni mayusculas. Si no hay coincidencia NO
asume Caucasia: la fila queda vacia y sale aparte en "SIN DEDUCIR" para decidirla a mano. Nunca
pisa un municipio que ya este puesto.

Por defecto es un dry-run de SOLO LECTURA (transaccion READ ONLY: la base rechaza cualquier
escritura). --apply escribe, y ademas exige --yes. Usa la base de DATABASE_URL (.env).

Uso (desde la raiz del proyecto):
    py scripts/backfill_municipality.py                  # dry-run (solo lectura)
    py scripts/backfill_municipality.py --apply --yes    # escribe las filas deducidas
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text  # noqa: E402

from backend.service.schemas.municipalities import MUNICIPALITY_LABELS, deduce_municipality  # noqa: E402

# (tabla, columna con el nombre, columna con el texto libre del que se deduce, estado visible)
SOURCES = (
    ("publications", "title", "location", "CASE WHEN deleted THEN 'BORRADA' ELSE status END"),
    ("artists", "stage_name", "city", "CASE WHEN active THEN 'ACTIVO' ELSE 'ARCHIVADO' END"),
)


def has_municipality_column(db, table: str) -> bool:
    return db.execute(text(
        "SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() "
        "AND table_name = :table AND column_name = 'municipality'"
    ), {"table": table}).first() is not None


def build_plan(db) -> dict:
    """Por tabla: filas sin municipio con el deducido (o None). Solo lee. Sin la columna (migracion
    pendiente) todas cuentan como sin municipio."""
    plan = {}
    for table, name_col, text_col, state in SOURCES:
        with_column = has_municipality_column(db, table)
        current = "municipality" if with_column else "NULL"
        rows = db.execute(text(
            f"SELECT id, {name_col} AS name, {text_col} AS source, {state} AS state, {current} AS municipality "
            f"FROM {table} ORDER BY id"
        )).mappings().all()
        plan[table] = {
            "column": with_column,
            "already": [row for row in rows if row["municipality"]],
            "rows": [{"id": row["id"], "name": row["name"], "source": row["source"], "state": row["state"],
                      "deduced": deduce_municipality(row["source"])}
                     for row in rows if not row["municipality"]],
        }
    return plan


def apply_plan(db, plan) -> dict:
    """Escribe solo las filas deducidas y solo si siguen sin municipio. Devuelve cuantas por tabla."""
    written = {}
    for table, *_ in SOURCES:
        if not plan[table]["column"]:
            raise SystemExit(f"La tabla {table} aun no tiene la columna municipality: aplica antes la migracion.")
        written[table] = 0
        for row in plan[table]["rows"]:
            if row["deduced"]:
                written[table] += db.execute(text(
                    f"UPDATE {table} SET municipality = :slug WHERE id = :id AND municipality IS NULL"
                ), {"slug": row["deduced"], "id": row["id"]}).rowcount
    return written


def _cut(value, width):
    value = "" if value is None else str(value)
    return value if len(value) <= width else value[: width - 3] + "..."


def print_plan(plan, out=None):
    out = out or sys.stdout
    for table, label in (("publications", "PUBLICACIONES"), ("artists", "ARTISTAS")):
        data = plan[table]
        source = "location" if table == "publications" else "city"
        print(f"\n=== {label} ===" + ("" if data["column"] else "  (la columna municipality aun no existe: migracion pendiente)"), file=out)
        print(f"Ya tienen municipio (no se tocan): {len(data['already'])}", file=out)
        deduced = [row for row in data["rows"] if row["deduced"]]
        missing = [row for row in data["rows"] if not row["deduced"]]
        header = f"{'id':>5}  {'titulo / nombre':<36}  {'estado':<10}  {source:<44}"
        print(header + "  municipio deducido", file=out)
        for row in deduced:
            print(f"{row['id']:>5}  {_cut(row['name'], 36):<36}  {row['state']:<10}  {_cut(row['source'], 44):<44}  "
                  f"{row['deduced']} ({MUNICIPALITY_LABELS[row['deduced']]})", file=out)
        if not deduced:
            print("  (ninguna)", file=out)
        print(f"\n--- SIN DEDUCIR ({len(missing)}): quedan vacias, decide tu el municipio ---", file=out)
        if missing:
            print(header, file=out)
        for row in missing:
            print(f"{row['id']:>5}  {_cut(row['name'], 36):<36}  {row['state']:<10}  {_cut(row['source'], 44):<44}", file=out)
        if not missing:
            print("  (ninguna)", file=out)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dry-run", action="store_true", help="solo lee y muestra (por defecto)")
    parser.add_argument("--apply", action="store_true", help="escribe las filas deducidas (exige --yes)")
    parser.add_argument("--yes", action="store_true", help="confirma --apply")
    args = parser.parse_args(argv)
    if args.apply and args.dry_run:
        parser.error("usa --dry-run o --apply, no los dos")
    if args.apply and not args.yes:
        parser.error("--apply escribe en la base: agrega --yes para confirmarlo")

    from backend.service.db.session import SessionLocal
    db = SessionLocal()
    try:
        if not args.apply:
            # Solo lectura de verdad: Postgres rechaza cualquier escritura en esta transaccion.
            db.execute(text("SET TRANSACTION READ ONLY"))
        plan = build_plan(db)
        print_plan(plan)
        if not args.apply:
            db.rollback()
            print("\nDry-run: no se escribio nada. Para aplicar: --apply --yes")
            return plan
        written = apply_plan(db, plan)
        db.commit()
        print(f"\nAplicado: {written['publications']} publicaciones y {written['artists']} artistas.")
        return plan
    finally:
        db.close()


if __name__ == "__main__":
    main()
