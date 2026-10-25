"""Genera cada correo de TEJIDO con datos de ejemplo y lo guarda como .html, SIN enviar nada.

Incluye un mensaje con HTML y <script> para comprobar que todo sale escapado.

Uso (desde la raiz del proyecto):
    py scripts/preview_correos.py <carpeta_destino>
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.service.services import notifications  # noqa: E402
from backend.service.services.email import build_invite_email  # noqa: E402

MALICIOUS = "Nombre: <b>Pirata</b>\nContacto: hola@correo.co\n\n<script>alert(1)</script><b>x</b>\nSegunda línea del mensaje con <a href='javascript:alert(1)'>enlace</a>."


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)

    samples = {
        "sugerencia": notifications.build_suggestion(
            "TEJ-0012", "Nombre: Lucía Pérez\nContacto: lucia@correo.co\n\nHola, quiero proponer un taller de bullerengue "
            "en la Casa de la Cultura.\nSomos un grupo de 12 personas y ensayamos los sábados.")[:3],
        "sugerencia-telefono": notifications.build_suggestion("TEJ-0013", "Nombre: Ezequiel\nContacto: 300 123 4567\n\nMe gustaría que publicaran la agenda del festival.")[:3],
        "sugerencia-maliciosa": notifications.build_suggestion("TEJ-0014", MALICIOUS)[:3],
        "reporte": notifications.build_report("Festival Río y Sabana 2026", "La fecha del evento está equivocada: es el sábado, no el viernes.", "Sofía"),
        "revision": notifications.build_review("Mercado Hecho en Caucasia", "Eze kiel"),
        "aprobada": notifications.build_moderation("Eze kiel", 7, "Pizza Party", "PUBLISHED", None),
        "rechazada": notifications.build_moderation("Eze kiel", 7, "Pizza Party", "REJECTED", "Falta la fecha y la hora del evento.\nAgrega también el lugar exacto."),
        "rechazada-sin-motivo": notifications.build_moderation("Eze kiel", 7, "Pizza Party", "REJECTED", None),
        "invitacion": ("Activa tu cuenta en TEJIDO", *build_invite_email("Eze kiel", "http://localhost:5173/#invitacion/ejemplo-token")),
    }
    for name, (subject, html, text) in samples.items():
        (out / f"{name}.html").write_text(html, encoding="utf-8")
        (out / f"{name}.txt").write_text(f"Asunto: {subject}\n\n{text}", encoding="utf-8")
        print(out / f"{name}.html")


if __name__ == "__main__":
    main()
