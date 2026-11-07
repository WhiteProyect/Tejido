// Clases de Tailwind compartidas por el sitio publico (pantallas con fondo crema).
// Las de la experiencia de artista viven en components/artist/axStyles.js.
//
// Los h1-h3 llevan explicitos los valores que hoy les da la regla global de main.css
// (@layer base), para que el componente no dependa de ella cuando se borre.

// Antetitulo en mayusculas (legado: .eyebrow).
export const EYEBROW = 'text-[#6a7c75] text-[11px] font-extrabold tracking-[.18em] mt-0 mx-0 mb-[18px] uppercase';

// Titulo grande de pantalla (legado: regla global `h1, h2`). Vale para h1 y h2.
export const H1 = 'font-sans tracking-[-.055em] m-0 text-[length:clamp(46px,5.6vw,84px)] leading-[.98]';

// Bloque de pagina (legado: .section) y su alto minimo en pantallas internas (.screen-section).
export const SECTION = 'py-[100px] px-[8vw] max800:py-[70px] max800:px-[6vw]';
export const SCREEN_SECTION = `${SECTION} min-h-[62vh]`;

// Mensaje de estado (cargando, vacio) y su variante de error (legado: .status, .error).
export const STATUS = 'py-[30px] px-0';
export const STATUS_ERROR = `${STATUS} text-[#b3442b]`;

// Etiqueta de tipo de publicacion (legado: .publication-kind).
export const PUB_KIND = 'text-[#df6d43] text-[11px] font-bold tracking-[.1em]';

// Listas de Agenda / Oportunidades / Talento (legado: .screen-list, .screen-list-item).
export const SCREEN_LIST = 'grid gap-4 grid-cols-[repeat(2,minmax(0,1fr))] max800:grid-cols-[1fr]';
export const SCREEN_LIST_ITEM = 'bg-[#fffaf2] border-l-[5px] border-l-[#df6d43] p-[25px]';
export const SCREEN_LIST_TITLE = 'font-sans tracking-[-.055em] text-[25px] leading-[.98] my-2.5 mx-0';
export const SCREEN_LIST_TEXT = 'text-[#53645c] leading-[1.5]';

// Pildora de plazo / cuenta regresiva segun getDateUrgency() (legado: .event-countdown,
// .opportunity-deadline + .normal/.warning/.urgent/.past).
export const URGENCY_PILL = 'inline-flex items-center rounded-[999px] text-[12px] font-bold gap-1.5 mt-2.5 py-1.5 px-3.5';
export const URGENCY = {
  normal: 'bg-[rgba(29,143,163,0.1)] text-[#1d8fa3]',
  warning: 'bg-[rgba(244,185,66,0.15)] text-[#b8860b]',
  urgent: 'bg-[rgba(216,91,54,0.12)] text-[#d85b36] animate-[urgentPulse_1.5s_ease-in-out_infinite]',
  past: 'bg-[rgba(102,116,111,0.1)] text-muted',
};
// Fecha pequena bajo el texto (legado: .event-date, .opportunity-date).
export const SMALL_DATE = 'text-muted block text-[12px] mt-1';

// Boton principal (legado: .primary-button).
export const PRIMARY_BUTTON = 'border-0 rounded-[999px] cursor-pointer font-bold py-[13px] px-[22px] bg-ink text-white inline-block mt-[18px]';

// Insignia redondeada sobre los titulos de seccion (legado: .section-badge / .section-badge-light).
const BADGE_BASE = 'inline-block rounded-[999px] border text-[11px] font-bold tracking-[0.15em] mb-4 py-1.5 px-4 uppercase';
export const BADGE = `${BADGE_BASE} bg-[rgba(29,143,163,0.1)] border-[rgba(29,143,163,0.2)] text-river`;
export const BADGE_LIGHT = `${BADGE_BASE} bg-[rgba(255,255,255,0.2)] border-[rgba(255,255,255,0.3)] text-white`;

// Titulo de seccion del inicio (legado: .section-title sobre un h2).
export const SECTION_TITLE = 'font-sans text-[length:clamp(40px,5vw,64px)] font-extrabold tracking-[-0.05em] leading-none mt-0 mx-0 mb-4';

// Boton "cultural" en pildora (legado: .btn-primary-cultural). La base no lleva fondo ni color:
// cada variante pone los suyos, para que no compitan dos utilidades de la misma propiedad.
export const BTN_CULTURAL_BASE = 'border-0 rounded-[999px] cursor-pointer font-bold py-4 px-8 transition-all duration-300 ease-[ease] no-underline hover:[transform:translateY(-3px)] hover:[box-shadow:0_12px_32px_rgba(45,90,61,0.3)]';

// Botones en pildora (estilo del CTA del hero): sin degradado, lift ni sombra. BTN_PILL es lo comun
// (forma, peso, foco, deshabilitado); color y talla los pone cada variante.
const BTN_PILL = 'inline-flex items-center justify-center rounded-full text-center font-bold cursor-pointer no-underline transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-65';
// Tallas. El solido va sin borde; las variantes con borde de 1 px restan 1 px de padding por lado
// para medir exactamente lo mismo que el solido de su talla. En <=480 px la MD recorta su padding
// horizontal para que los textos largos quepan en una linea (la altura no cambia).
const SIZE_LG = 'gap-2 py-3.5 px-8 text-[19px]';
const SIZE_MD = 'gap-2 py-3.5 px-7 text-[16px] max480:px-5';
const SIZE_MD_BORDER = 'gap-2 py-[13px] px-[27px] text-[16px] border border-solid max480:px-[19px]';
const SIZE_SM = 'gap-1.5 py-2.5 px-4 text-[13px]';
const SIZE_SM_BORDER = 'gap-1.5 py-[9px] px-[15px] text-[13px] border border-solid';
// Solido de tinta: en hover la tinta se aclara un 15%.
const BTN_INK_BASE = `${BTN_PILL} border-0 bg-ink text-white hover:bg-[color-mix(in_srgb,var(--ink)_85%,white)]`;
export const BTN_INK_LG = `${BTN_INK_BASE} ${SIZE_LG}`; // hero
export const BTN_INK_MD = `${BTN_INK_BASE} ${SIZE_MD}`; // formularios, CTA de seccion, accion principal de un panel
export const BTN_INK_SM = `${BTN_INK_BASE} ${SIZE_SM}`; // tarjetas y acciones de fila
// Contorno de tinta (secundario junto a un BTN_INK_MD).
export const BTN_INK_OUTLINE_MD = `${BTN_PILL} ${SIZE_MD_BORDER} border-ink bg-transparent text-ink hover:bg-ink hover:text-white`;
// Fantasma, peligro y discreto: acciones de fila, en talla SM.
export const BTN_GHOST = `${BTN_PILL} ${SIZE_SM_BORDER} border-[#d9cfbe] bg-transparent text-ink hover:border-ink`;
export const BTN_DANGER = `${BTN_PILL} ${SIZE_SM_BORDER} border-[rgba(216,91,54,.35)] bg-transparent text-[#a8431f] hover:border-[#a8431f]`;
export const BTN_QUIET_SM = `${BTN_PILL} ${SIZE_SM_BORDER} border-transparent bg-transparent text-muted hover:text-ink`;

// Paneles de las pantallas privadas (perfil, dashboard del gestor): tarjeta crema y su titulo.
export const PANEL = 'min-w-0 rounded-[28px] border border-[#e2d9ca] bg-[#fffaf2] p-8 max600:p-6';
export const PANEL_TITLE = 'm-0 font-sans text-[26px] font-extrabold tracking-[-0.03em] text-ink';
// Campos de formulario de esas pantallas.
export const FORM_LABEL = 'grid gap-1.5 text-[12px] font-bold uppercase tracking-[.12em] text-muted';
export const FORM_INPUT = 'w-full rounded-[12px] font-sans border border-[#d9cfbe] bg-white py-2.5 px-3.5 text-[15px] font-medium normal-case tracking-normal text-ink outline-none focus:border-ink disabled:opacity-60';


// Avisos de dias de un evento (eventNotice de utils/dateUtils.js): colores planos y siempre con texto
// (no solo color). Carrusel del inicio y Agenda. Normal: menta con tinta; urgente: #b8502b con blanco
// (4,9:1); en curso: dorado con tinta.
export const NOTICE_TONES = {
  normal: 'bg-[rgba(136,197,164,0.25)] text-ink',
  urgent: 'bg-[#b8502b] text-white',
  ongoing: 'bg-[#d4a843] text-ink',
};

// Globo de sugerencia de Hilo (sobre su ilustracion), como el de "talento parecido".
export const HILO_BUBBLE = "relative mb-1 max-w-[230px] cursor-pointer rounded-[16px] border border-[#cdbd9e] bg-[#fffdf8] py-2 px-3.5 text-center text-[15px] font-semibold leading-[1.3] text-ink [box-shadow:0_8px_20px_rgba(23,58,49,.12)] after:absolute after:-bottom-[7px] after:left-1/2 after:size-3 after:-translate-x-1/2 after:rotate-45 after:border-r after:border-b after:border-[#cdbd9e] after:bg-[#fffdf8] after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

// ───────── Territorio: Agenda, Oportunidades, su detalle y el calendario (rediseño del diseñador) ─────────
// Una sola fuente de colores y variantes. Sin degradados: bloques solidos y lineas #ddd5c7. Cada par de
// texto/fondo esta medido (>= 4,5:1); cambiar un color aqui lo cambia en tarjetas, detalle y panel.
export const TERRITORY = {
  ink: '#173f36', paper: '#fff9ec', cream: '#f3e4c8', line: '#ddd5c7', ochre: '#b8502b', mint: '#75b79b',
  purple: '#8a4f7d', yellow: '#f4b942', gold: '#d4a843', alert: '#d85b36', white: '#ffffff',
  // Ocre para texto pequeño sobre crema/papel: #b8502b sobre #f3e4c8 da 3,97:1; este da 4,77:1 (5,70 sobre papel).
  ochreText: '#a44727',
  muted: '#4d5a55', mutedText: '#3f514a', mutedSoft: '#53645c',
};
const T = TERRITORY;

// Paleta cerrada de los tipos de oportunidad (backend: services/opportunity_types.py::PALETTE).
export const TYPE_COLORS = {
  ocre: { label: 'Ocre', bg: T.ochre, text: T.paper },
  menta: { label: 'Menta', bg: T.mint, text: T.ink },
  morado: { label: 'Morado', bg: T.purple, text: T.paper },
  amarillo: { label: 'Amarillo', bg: T.yellow, text: T.ink },
  crema: { label: 'Crema', bg: T.cream, text: T.ink, border: T.ink },
};
export const TYPE_COLOR_KEYS = Object.keys(TYPE_COLORS);
export const typeColors = (color) => TYPE_COLORS[color] || TYPE_COLORS.crema;

// Paleta cerrada de las categorias de lugar: la de los tipos mas rio y bosque (backend:
// schemas/places.py::PLACE_COLORS). Rio es el tono oscuro (#146f80): el #1d8fa3 no llega a 4,5:1 con crema.
export const PLACE_COLORS = {
  ...TYPE_COLORS,
  rio: { label: 'Río', bg: '#146f80', text: T.paper },
  bosque: { label: 'Bosque', bg: '#2d5a3d', text: T.paper },
};
export const PLACE_COLOR_KEYS = Object.keys(PLACE_COLORS);
export const placeColors = (color) => PLACE_COLORS[color] || PLACE_COLORS.crema;

// Pildoras (texto >= 14 px, peso 600+).
export const PILL_COLORS = {
  municipality: { bg: T.ink, text: T.paper },
  municipalityMuted: { bg: T.muted, text: T.paper },
  category: { bg: T.cream, text: T.ink },
  tradition: { bg: T.purple, text: T.paper },
  past: { bg: T.cream, text: T.ink },
  closed: { bg: T.line, text: T.ink },
  typeMuted: { bg: T.paper, text: T.muted, border: T.line },
};
// Avisos de dias (dateUtils: kind). Sobre una banda del mismo color, el aviso pasa a tinta con crema.
export const NOTICE_COLORS = {
  days: { bg: T.yellow, text: T.ink },
  today: { bg: T.ochre, text: T.paper },
  ongoing: { bg: T.mint, text: T.ink },
  open: { bg: T.cream, text: T.ink },
  onBand: { bg: T.ink, text: T.paper },
};
// Bandas de las tarjetas (debajo de la foto) y barras de bloque.
export const BANDS = { upcoming: T.ink, tradition: T.purple, muted: T.line };

export const PILL_BASE = 'inline-flex max-w-full items-center gap-1.5 rounded-full border py-1 px-3 text-[14px] font-semibold leading-[1.25] [overflow-wrap:anywhere]';

// Estilo de una pildora sobre una banda: si su fondo es el mismo de la banda, lleva un borde de su
// color de texto para que se vea su forma.
export function pillStyle(colors, band) {
  const same = band && colors.bg.toLowerCase() === band.toLowerCase();
  return { backgroundColor: colors.bg, color: colors.text, borderColor: same ? colors.text : (colors.border || colors.bg) };
}

// Estilo de un aviso de dias sobre una banda: si coincide con ella, tinta con texto crema.
export function noticeStyle(kind, band) {
  const colors = NOTICE_COLORS[kind] || NOTICE_COLORS.days;
  const same = band && colors.bg.toLowerCase() === band.toLowerCase();
  return pillStyle(same ? NOTICE_COLORS.onBand : colors, band);
}
