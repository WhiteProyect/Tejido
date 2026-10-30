"""Plantilla unica de los correos de TEJIDO: HTML para clientes de correo + version en texto plano.

Reglas de correo: maquetacion con tablas, estilos en linea, ancho maximo 600 px, sin imagenes ni
fuentes web ni JavaScript. La marca se arma con texto (TEJIDO / CAUCASIA y los tres puntos).
Todo lo que entra se escapa aqui (html.escape) y se recorta: quien llama pasa texto plano, nunca
HTML. Los enlaces (boton y mailto:) los arma el backend; aqui solo se aceptan http(s) y mailto.
"""
from html import escape

# Paleta de marca (frontend/src/styles/tailwind.css) y la del diseño de correo de la diseñadora.
INK = "#173f36"
CREAM = "#f3e4c8"
CREAM_WARM = "#faf3e6"
PAGE_BG = "#fdfbf7"
CARD_BG = "#ffffff"
MINT = "#75b79b"
GOLD = "#d4a843"
PURPLE = "#8a4f7d"
ORANGE = "#d85b36"
RIVER = "#1d8fa3"
# Barra de hilos bajo la cabecera (menta, dorado, morado, naranja), tonos del diseño.
THREADS = ("#88c5a4", "#d4a843", "#9b72a6", "#c85a32")
# Texto secundario: #53645c en vez de muted (#66746f) para pasar AA sobre crema.
TEXT_SOFT = "#53645c"
TEXT_BODY = "#4a5c58"
HEADER_SUB = "#b9c8bd"

# Acento por tipo de correo: (franja/borde, texto). El texto es una variante oscura que pasa AA
# sobre el fondo claro de la tarjeta.
ACCENTS = {
    "river": (RIVER, "#146f80"),
    "orange": (ORANGE, "#a8431f"),
    "gold": (GOLD, "#7a5c12"),
    "mint": (MINT, "#2f6b52"),
    "purple": (PURPLE, PURPLE),
}

SANS = "'DM Sans', Arial, Helvetica, sans-serif"
SERIF = "'Playfair Display', Georgia, serif"

LIMITS = {"title": 200, "detail": 500, "quote": 2000, "paragraph": 1200}


def clip(value, limit: int) -> str:
    text = str(value or "").strip()
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def _html_text(value, limit: int) -> str:
    """Texto de usuario listo para HTML: recortado, escapado y con saltos de linea -> <br>."""
    return escape(clip(value, limit)).replace("\r\n", "\n").replace("\n", "<br>")


def _safe_href(href: str | None) -> str | None:
    if href and (href.startswith(("https://", "http://", "mailto:"))):
        return escape(href, quote=True)
    return None


def _header() -> str:
    # El espaciado de letras deja un hueco al final de la palabra: el padding-left igual lo
    # compensa para que TEJIDO / CAUCASIA queden centrados de verdad.
    dots = (
        f'<span style="color:{THREADS[0]};">&#9679;</span>&nbsp;'
        f'<span style="color:{THREADS[1]};">&#9675;</span>&nbsp;'
        f'<span style="color:{THREADS[2]};">&#9679;</span>'
    )
    threads = "".join(
        f'<td width="25%" height="4" bgcolor="{color}" style="height:4px;line-height:0;font-size:0;background-color:{color};">&nbsp;</td>'
        for color in THREADS
    )
    return (
        f'<tr><td class="px" align="center" bgcolor="{INK}" style="background-color:{INK};padding:32px 40px 28px;border-radius:12px 12px 0 0;text-align:center;">'
        f'<div style="font-family:{SANS};font-size:22px;line-height:1;letter-spacing:2px;">{dots}</div>'
        f'<div style="font-family:{SANS};font-size:26px;line-height:1.2;font-weight:700;letter-spacing:7px;padding-left:7px;color:{CREAM};margin-top:14px;">TEJIDO</div>'
        f'<div style="font-family:{SANS};font-size:10px;line-height:1.4;font-weight:700;letter-spacing:4px;padding-left:4px;color:{HEADER_SUB};margin-top:6px;">CAUCASIA</div>'
        f'</td></tr>'
        f'<tr><td style="padding:0;line-height:0;font-size:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>{threads}</tr></table></td></tr>'
    )


def _details(details, bar: str) -> str:
    rows = []
    for item in details:
        label, value = item[0], item[1]
        href = _safe_href(item[2]) if len(item) > 2 else None
        shown = _html_text(value, LIMITS["detail"])
        if href:
            shown = f'<a href="{href}" style="color:{INK};text-decoration:underline;">{shown}</a>'
        rows.append(
            f'<tr><td style="padding:6px 0;font-family:{SANS};">'
            f'<div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:{TEXT_SOFT};">{escape(label)}</div>'
            f'<div style="font-size:16px;line-height:1.5;color:{INK};margin-top:2px;">{shown}</div>'
            f'</td></tr>'
        )
    return (
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0;">'
        f'<tr><td style="background-color:{CREAM};border-left:4px solid {bar};border-radius:0 12px 12px 0;padding:12px 20px;">'
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">{"".join(rows)}</table>'
        f'</td></tr></table>'
    )


def _quote(quote: str, bar: str) -> str:
    return (
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0 0;">'
        f'<tr><td style="background-color:{CREAM_WARM};border-left:4px solid {bar};border-radius:0 12px 12px 0;padding:16px 20px;'
        f'font-family:{SANS};font-size:16px;line-height:1.6;color:{TEXT_BODY};">{_html_text(quote, LIMITS["quote"])}</td></tr></table>'
    )


def _button(label: str, url: str) -> str:
    href = _safe_href(url) or "#"
    return (
        f'<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;">'
        f'<tr><td bgcolor="{INK}" style="background-color:{INK};border-radius:8px;">'
        f'<a href="{href}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:{SANS};font-size:16px;'
        f'line-height:1.25;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">{escape(label)}</a>'
        f'</td></tr></table>'
        f'<p style="margin:16px 0 0;font-family:{SANS};font-size:13px;line-height:1.5;color:{TEXT_SOFT};">'
        f'¿No ves el botón? Copia este enlace en tu navegador:<br>'
        f'<a href="{href}" target="_blank" style="color:{INK};text-decoration:underline;word-break:break-all;">{escape(url)}</a></p>'
    )


def _footer(note: str) -> str:
    note_html = (f'<div style="margin-top:6px;font-size:12px;line-height:1.5;font-weight:400;color:{TEXT_SOFT};">{escape(note)}</div>'
                 if note else "")
    return (
        f'<tr><td class="px" align="center" bgcolor="{PAGE_BG}" style="background-color:{PAGE_BG};padding:20px 40px 24px;'
        f'border-radius:0 0 12px 12px;font-family:{SANS};text-align:center;">'
        f'<div style="font-size:13px;line-height:1.5;font-weight:700;color:{INK};">TEJIDO · Caucasia, Bajo Cauca</div>'
        f'{note_html}</td></tr>'
    )


def render_email(*, kicker: str, accent: str, title: str, title_accent: str = "", paragraphs=(),
                 details=(), quote: str = "", cta_label: str = "", cta_url: str = "", preheader: str = "",
                 footer_note: str = "", closing=()) -> tuple[str, str]:
    """Devuelve (html, text). details: [(etiqueta, valor) | (etiqueta, valor, href)].
    closing: parrafos despues del bloque de datos/cita (antes del boton)."""
    bar, ink_accent = ACCENTS.get(accent, ACCENTS["river"])
    title_html = escape(clip(title, LIMITS["title"]))
    if title_accent:
        title_html += (f' <em style="font-family:{SERIF};font-style:italic;font-weight:700;color:{ink_accent};">'
                       f'{escape(clip(title_accent, LIMITS["title"]))}</em>')

    def paragraph_html(text, top):
        return (f'<p style="margin:{top}px 0 0;font-family:{SANS};font-size:16px;line-height:1.6;color:{TEXT_BODY};">'
                f'{_html_text(text, LIMITS["paragraph"])}</p>')

    body = [
        f'<div style="font-family:{SANS};font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:{ink_accent};">{escape(kicker)}</div>',
        f'<h1 style="margin:12px 0 0;font-family:{SANS};font-size:28px;line-height:1.2;font-weight:700;color:{INK};">{title_html}</h1>',
        *(paragraph_html(text, 16) for text in paragraphs if text),
    ]
    if details:
        body.append(_details(details, bar))
    if quote:
        body.append(_quote(quote, bar))
    body.extend(paragraph_html(text, 20) for text in closing if text)
    if cta_label and cta_url:
        body.append(_button(cta_label, cta_url))

    preheader_html = (
        f'<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:{PAGE_BG};">'
        f'{escape(clip(preheader, 140))}{"&#8199;&#65279;&#847; " * 30}</div>'
    )
    html = (
        '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
        '<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">'
        f'<title>{escape(clip(title, LIMITS["title"]))}</title>'
        '<style>@media (max-width:480px){.px{padding-left:20px!important;padding-right:20px!important}'
        '.card{padding:28px 20px!important}}</style></head>'
        f'<body style="margin:0;padding:0;background-color:{PAGE_BG};">'
        f'{preheader_html}'
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="{PAGE_BG}" style="background-color:{PAGE_BG};">'
        '<tr><td align="center" style="padding:24px 12px;">'
        '<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->'
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="{CARD_BG}" '
        f'style="max-width:600px;background-color:{CARD_BG};border-radius:12px;border-collapse:separate;">'
        f'{_header()}'
        f'<tr><td class="card" bgcolor="{CARD_BG}" style="background-color:{CARD_BG};padding:36px 40px;">'
        f'{"".join(body)}</td></tr>'
        f'{_footer(footer_note)}'
        '</table>'
        '<!--[if mso]></td></tr></table><![endif]-->'
        '</td></tr></table></body></html>'
    )

    text_parts = [kicker.upper(), clip(f"{title} {title_accent}".strip(), LIMITS["title"] * 2)]
    text_parts += [clip(t, LIMITS["paragraph"]) for t in paragraphs if t]
    if details:
        text_parts.append("\n".join(f"{item[0]}: {clip(item[1], LIMITS['detail'])}" for item in details))
    if quote:
        text_parts.append(clip(quote, LIMITS["quote"]))
    text_parts += [clip(t, LIMITS["paragraph"]) for t in closing if t]
    if cta_label and cta_url:
        text_parts.append(f"{cta_label}: {cta_url}")
    if footer_note:
        text_parts.append(footer_note)
    return html, "\n\n".join(text_parts)


# ─────────────────────────── cuenta: verificar correo y restablecer contrasena ───────────────────────────
# Mismo diseño de marca que los avisos (render_email: sin imagenes ni degradados, boton y texto
# alterno). El nombre del usuario se escapa en render_email. Devuelven (asunto, html, texto).
ACCOUNT_NOTE = "Recibes este correo porque alguien usó esta dirección en TEJIDO."


def build_verify_email(first_name: str | None, link: str):
    first = (first_name or "").split()
    greeting = f"Hola, {clip(first[0], 60)}:" if first else "Hola:"
    html, text = render_email(
        kicker="Validación de cuenta",
        accent="river",
        title="Un nuevo hilo se suma a",
        title_accent="TEJIDO.",
        paragraphs=[greeting,
                    "Nos emociona que quieras ser parte de la cultura y el talento de Caucasia. Para empezar a explorar y guardar tus lugares favoritos, confirma tu dirección."],
        closing=["El enlace vence en 48 horas. Si no fuiste tú, ignora este correo: sin confirmarlo no se puede guardar ni participar con esta cuenta."],
        cta_label="Confirmar mi correo",
        cta_url=link,
        preheader="Confirma tu correo para guardar y participar en TEJIDO.",
        footer_note=ACCOUNT_NOTE,
    )
    return "Verifica tu correo en TEJIDO", html, text


def build_reset_email(name: str, link: str):
    greeting = f"Hola, {clip(name, 120)}:" if name else "Hola:"
    html, text = render_email(
        kicker="Restablecer contraseña",
        accent="gold",
        title="Crea una contraseña",
        title_accent="nueva.",
        paragraphs=[greeting, "Pediste restablecer la contraseña de tu cuenta de TEJIDO. Abre el enlace y elige una nueva."],
        closing=["El enlace vence en 1 hora y sirve una sola vez. Si no lo pediste, ignora este correo: tu contraseña no cambia."],
        cta_label="Restablecer mi contraseña",
        cta_url=link,
        preheader="El enlace para crear tu contraseña nueva vence en 1 hora.",
        footer_note=ACCOUNT_NOTE,
    )
    return "Restablece tu contraseña de TEJIDO", html, text
