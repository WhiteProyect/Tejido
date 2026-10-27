import { useEffect, useState } from 'react';

// Clases compartidas del perfil de talento (#talento/<slug>).
export const CARD = 'min-w-0 rounded-[12px] border border-[#e3d6bf] bg-[#fffaf0] p-6 [box-shadow:0_6px_18px_rgba(12,36,30,.07)] max600:p-5';
// Antetitulo de cada bloque ("QUÉ OFRECE", "PORTAFOLIO"...): es el h2 de la seccion.
export const SECTION_LABEL = 'm-0 font-sans text-[16px] font-extrabold uppercase leading-normal tracking-[.06em] text-ink';
// Antetitulo pequeño (CATEGORIA · MUNICIPIO).
export const META = 'm-0 text-[13px] font-bold uppercase tracking-[.08em] text-[#3f514a]';
export const MUTED = 'text-[#53645c]';

// Mismo corte que el resto del sitio para "movil" (max768).
const MOBILE_QUERY = '(max-width: 768px)';

export function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    const handle = () => setMobile(media.matches);
    media.addEventListener('change', handle);
    return () => media.removeEventListener('change', handle);
  }, []);
  return mobile;
}
