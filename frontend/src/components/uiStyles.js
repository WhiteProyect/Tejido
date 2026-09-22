// Clases de Tailwind compartidas por el sitio publico (pantallas con fondo crema).
// Las de la experiencia de artista viven en components/artist/axStyles.js.
//
// Los h1-h3 llevan explicitos los valores que hoy les da la regla global de main.css
// (@layer base), para que el componente no dependa de ella cuando se borre.

// Antetitulo en mayusculas (legado: .eyebrow).
export const EYEBROW = 'text-[#6a7c75] text-[11px] font-extrabold tracking-[.18em] mt-0 mx-0 mb-[18px] uppercase';

// Titulo grande de pantalla (legado: regla global h1, h2).
export const H1 = 'font-sans tracking-[-.055em] m-0 text-[length:clamp(46px,5.6vw,84px)] leading-[.98]';
