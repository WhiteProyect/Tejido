"""Avisos de cierre de las oportunidades guardadas (services/opportunity_reminders.py).

    py -m backend.service.scripts.send_opportunity_reminders            # dry-run: solo lista lo pendiente
    py -m backend.service.scripts.send_opportunity_reminders --send     # envia y registra cada aviso

Pensado para correr una vez al dia (por ejemplo a las 8:00 de Bogota) cuando haya despliegue; hoy no lo
programa nada. Imprime ids, nunca correos. --fecha AAAA-MM-DD simula otro "hoy" (pruebas).
"""
import argparse
import sys
from datetime import date

from backend.service.db.session import SessionLocal
from backend.service.services.opportunity_reminders import send_reminders


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Avisos de cierre de las oportunidades guardadas por ciudadanos.")
    parser.add_argument("--send", action="store_true", help="enviar los correos (sin esto, solo lista lo pendiente)")
    parser.add_argument("--fecha", type=date.fromisoformat, help="dia de Bogota a usar como hoy (AAAA-MM-DD)")
    args = parser.parse_args(argv)
    db = SessionLocal()
    try:
        result = send_reminders(db, today=args.fecha, send=args.send)
    finally:
        db.close()
    mode = "ENVIO" if args.send else "DRY-RUN (no envia nada; usa --send para enviar)"
    print(f"{mode} · hoy (Bogota): {result['today']} · avisos pendientes: {len(result['due'])}")
    for item in result["due"]:
        print(f"  publicacion {item['publication_id']} · usuario {item['user_id']} · cierra en {item['days_before']} dia(s)")
    if args.send:
        print(f"enviados: {result['sent']} · fallidos: {result['failed']}")
    return 1 if result["failed"] else 0


if __name__ == "__main__":
    sys.exit(main())
