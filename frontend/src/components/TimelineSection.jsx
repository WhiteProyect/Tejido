/**
 * TIMELINESECTION.JSX — Timeline del Territorio
 *
 * Muestra las publicaciones de TEJIDO en una línea de tiempo horizontal
 * que representa la cronología del Bajo Cauca.
 *
 * Características:
 * - Scroll horizontal con publicaciones ordenadas por fecha
 * - Línea visual que conecta los eventos
 * - Colores por tipo de publicación
 * - Hover para ver detalles
 * - Animación de entrada al hacer scroll
 *
 * Parte de la FASE 7 del plan de magia.
 */

import { useRef, useEffect, useState } from 'react';
import { formatDateShort } from '../utils/dateUtils.js';
import { KIND_COLORS, KIND_ICONS } from '../utils/constants.js';
import { BADGE, SECTION_TITLE } from './uiStyles.js';

/**
 * Agrupa y ordena publicaciones por fecha.
 * Solo incluye publicaciones con start_date.
 */
function sortByDate(publications) {
  return [...publications]
    .filter((pub) => pub.start_date)
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
}

export default function TimelineSection({ publications = [] }) {
  /** Ref del contenedor de scroll horizontal */
  const scrollRef = useRef(null);
  /** Si la sección es visible (para animación de entrada) */
  const [isVisible, setIsVisible] = useState(false);

  // Ordenar publicaciones por fecha
  const sorted = sortByDate(publications);

  // Observer para detectar cuando la sección entra en viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    if (scrollRef.current) {
      observer.observe(scrollRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // No mostrar si no hay publicaciones con fecha
  if (sorted.length === 0) return null;

  return (
    <section className={`max-w-full overflow-hidden ${isVisible ? 'visible' : ''}`}>
      {/* Encabezado */}
      <div className="text-center mb-10">
        <span className={BADGE}>Cronología</span>
        <h2 className={SECTION_TITLE}>El hilo del tiempo</h2>
        <p className="text-muted text-[16px] leading-[1.5] mt-2">
          Las historias, eventos y oportunidades del Bajo Cauca en orden cronológico.
        </p>
      </div>

      {/* Línea de tiempo con scroll horizontal */}
      <div className="overflow-x-auto overflow-y-visible pt-10 px-0 pb-[60px] [scrollbar-width:thin] relative [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-[rgba(23,58,49,0.05)] [&::-webkit-scrollbar-track]:rounded-[3px] [&::-webkit-scrollbar-thumb]:bg-[rgba(23,58,49,0.15)] [&::-webkit-scrollbar-thumb]:rounded-[3px]" ref={scrollRef}>
        {/* Línea central */}
        <div className="absolute top-1/2 left-0 right-0 h-[3px] bg-[linear-gradient(90deg,transparent,rgba(29,143,163,0.3),rgba(212,168,67,0.3),transparent)] [transform:translateY(-50%)]" />

        {/* Publicaciones en la línea */}
        <div className="flex gap-[60px] py-0 px-10 relative min-w-max max600:gap-10 max600:px-5">
          {sorted.map((pub, index) => (
            <div
              key={pub.id}
              className={`flex items-center min-w-[200px] max-w-[240px] relative opacity-0 animate-[timelineItemIn_0.5s_ease_forwards] max600:min-w-[160px] max600:max-w-[180px] ${index % 2 === 0 ? 'flex-col-reverse' : 'flex-col'}`}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Conector visual */}
              <div
                className="w-0.5 h-[30px] opacity-40 shrink-0"
                style={{ background: KIND_COLORS[pub.kind] || '#1d8fa3' }}
              />

              {/* Punto en la línea */}
              <div
                className="w-3.5 h-3.5 rounded-[50%] border-[3px] border-solid border-paper [box-shadow:0_0_0_2px_currentColor] z-2 shrink-0"
                style={{ background: KIND_COLORS[pub.kind] || '#1d8fa3' }}
              />

              {/* Tarjeta de contenido */}
              <div className="bg-[#fffaf2] border border-[#e2d9ca] rounded-[16px] p-4 text-center transition-[transform,box-shadow] duration-200 ease-[ease] cursor-default hover:[transform:translateY(-4px)] hover:[box-shadow:0_8px_24px_rgba(23,58,49,0.12)] max600:p-3">
                <span className="text-[20px] block mb-1.5">
                  {KIND_ICONS[pub.kind] || '\u2022'}
                </span>
                <span className="text-muted text-[11px] font-bold uppercase tracking-[0.05em]">
                  {formatDateShort(pub.start_date)}
                </span>
                <h3 className="font-sans tracking-[-.055em] text-[15px] leading-[1.3] my-1.5 mx-0 text-ink max600:text-[13px]">{pub.title}</h3>
                <p className="text-muted text-[12px] leading-[1.4] m-0 line-clamp-2">{pub.summary}</p>
                <small className="text-muted text-[10px] block mt-1.5">
                  {pub.location || 'Caucasia'}
                </small>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
