/**
 * axStyles.js — clases Tailwind compartidas del perfil de artista (.ax-*).
 * Sustituyen a .ax-btn / .ax-loading / .ax-error de artist.css.
 *
 * Los selectores de etiqueta de main.css (a { color }, button { font: inherit }, h1-h3 ...)
 * ganan a las utilidades: por eso "!" en color, tamaño y peso de fuente de los botones.
 */

// Botón base (.ax-btn). Sin utilidad de borde aquí: border-0 (primary) y border (ghost) se
// pisarian entre si; cada variante declara el suyo.
export const AX_BTN =
  'inline-flex items-center gap-2 rounded-ax-sm px-7 py-3.5 text-[14px]! font-bold! tracking-[0.02em] cursor-pointer transition-all duration-300 ease-in-out';

// .ax-btn--primary
export const AX_BTN_PRIMARY =
  'border-0 bg-ax-accent text-[#0a0a0a]! hover:-translate-y-0.5 hover:bg-[#e0b84e] hover:shadow-[0_8px_30px_rgba(212,168,67,0.3)]';

// .ax-btn--ghost
export const AX_BTN_GHOST =
  'border border-ax-border bg-transparent text-ax-text! hover:border-ax-accent-border hover:text-ax-accent!';

// Titulo de seccion (.ax-section-title). h2 global fija font-size, letter-spacing y margin -> "!".
// ArtistInfo ya lo usa; ArtistMedia (Parte 3) lo adoptara y entonces se borra la regla legada .ax-section-title
// de artist.css (hasta entonces la regla queda, pero ningun elemento migrado lleva la clase).
export const AX_SECTION_TITLE =
  'mb-8! text-[length:clamp(28px,4vw,42px)]! font-extrabold tracking-[-0.03em]! text-ax-text max768:text-[length:clamp(24px,6vw,36px)]!';

// Contenedor de carga / error de pantalla completa (.ax-loading, .ax-error)
export const AX_STATE =
  'flex min-h-[80vh] flex-col items-center justify-center gap-4 bg-ax-bg p-10 text-ax-text';
