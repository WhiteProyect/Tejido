"""Plantilla unica de los correos de TEJIDO: HTML para clientes de correo + version en texto plano.

Reglas de correo: maquetacion con tablas, estilos en linea, ancho maximo 600 px, sin imagenes ni
fuentes web ni JavaScript. La marca se arma con texto (TEJIDO / CAUCASIA y los tres puntos).
Todo lo que entra se escapa aqui (html.escape) y se recorta: quien llama pasa texto plano, nunca
HTML. Los enlaces (boton y mailto:) los arma el backend; aqui solo se aceptan http(s) y mailto.
"""
from html import escape

# Paleta de marca (frontend/src/styles/tailwind.css).
INK = "#173f36"
INK_DEEP = "#0c241e"
CREAM = "#f3e4c8"
PAPER = "#fff9ec"
CREAM_WARM = "#faf3e6"
LINE = "#ddd5c7"
MINT = "#75b79b"
GOLD = "#d4a843"
PURPLE = "#8a4f7d"
ORANGE = "#d85b36"
RIVER = "#1d8fa3"
# Texto secundario: #53645c en vez de muted (#66746f) para pasar AA sobre crema.
TEXT_SOFT = "#53645c"
TEXT_BODY = "#2f423b"
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
SERIF = "Georgia, 'Times New Roman', serif"

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
    dots = (
        f'<span style="color:{MINT};">&#9679;</span>&nbsp;'
        f'<span style="color:{CREAM};">&#9675;</span>&nbsp;'
        f'<span style="color:#b98cb0;">&#9679;</span>'
    )
    stripe = "".join(
        f'<td width="25%" height="5" style="height:5px;line-height:5px;font-size:0;background-color:{color};">&nbsp;</td>'
        for color in (MINT, GOLD, PURPLE, ORANGE)
    )
    return (
        f'<tr><td class="px" style="background-color:{INK_DEEP};padding:28px 40px 24px;border-radius:20px 20px 0 0;">'
        f'<div style="font-family:{SANS};font-size:24px;line-height:1;letter-spacing:2px;">{dots}</div>'
        f'<div style="font-family:{SANS};font-size:24px;font-weight:700;letter-spacing:7px;color:{CREAM};margin-top:12px;">TEJIDO</div>'
        f'<div style="font-family:{SANS};font-size:10px;font-weight:700;letter-spacing:4px;color:{HEADER_SUB};margin-top:4px;">CAUCASIA</div>'
        f'</td></tr>'
        f'<tr><td style="padding:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>{stripe}</tr></table></td></tr>'
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
        f'<tr><td bgcolor="{INK}" style="background-color:{INK};border-radius:12px;">'
        f'<a href="{href}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:{SANS};font-size:16px;'
        f'font-weight:700;color:{CREAM};text-decoration:none;border-radius:12px;">{escape(label)}</a>'
        f'</td></tr></table>'
        f'<p style="margin:16px 0 0;font-family:{SANS};font-size:13px;line-height:1.5;color:{TEXT_SOFT};">'
        f'¿No ves el botón? Copia este enlace en tu navegador:<br>'
        f'<a href="{href}" target="_blank" style="color:{INK};text-decoration:underline;word-break:break-all;">{escape(url)}</a></p>'
    )


def _footer(note: str) -> str:
    return (
        f'<tr><td class="px" style="padding:24px 40px 8px;font-family:{SANS};font-size:13px;line-height:1.6;color:{TEXT_SOFT};text-align:center;">'
        f'<strong style="color:{INK};">TEJIDO</strong> · Caucasia, Bajo Cauca'
        f'{f"<br>{escape(note)}" if note else ""}'
        f'</td></tr>'
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
        f'<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:{CREAM_WARM};">'
        f'{escape(clip(preheader, 140))}{"&#8199;&#65279;&#847; " * 30}</div>'
    )
    html = (
        '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
        '<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">'
        f'<title>{escape(clip(title, LIMITS["title"]))}</title>'
        '<style>@media (max-width:480px){.px{padding-left:20px!important;padding-right:20px!important}'
        '.card{padding:28px 20px!important}}</style></head>'
        f'<body style="margin:0;padding:0;background-color:{CREAM_WARM};">'
        f'{preheader_html}'
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:{CREAM_WARM};">'
        '<tr><td align="center" style="padding:24px 12px;">'
        '<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">'
        f'{_header()}'
        f'<tr><td class="card" style="background-color:{PAPER};border:1px solid {LINE};border-top:0;border-radius:0 0 20px 20px;padding:36px 40px;">'
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
