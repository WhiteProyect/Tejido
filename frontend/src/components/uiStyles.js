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
