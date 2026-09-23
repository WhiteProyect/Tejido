/**
 * TIMELINESECTION.JSX — El hilo del tiempo (landing)
 *
 * Cronologia horizontal de las publicaciones con fecha, en escritorio y en movil.
 * El elemento memorable es la linea: un rio/camino organico y segmentado que fluye
 * despacio de dorado a menta y a rio (mismo lenguaje de movimiento que el rio de la
 * linea de tiempo del perfil de artista, pero horizontal y continuo).
 *
 * - La pista se desplaza en horizontal (snap en movil, flechas si hay desborde,
 *   flechas del teclado con la region enfocada).
 * - El trazo vive en art.css (.tl-river-*): con prefers-reduced-motion queda completo
 *   y quieto. Los nodos y sus iconos (Icon.jsx) no se animan.
 */

import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { formatDateShort } from '../utils/dateUtils.js';
import { KIND_LABELS } from '../utils/constants.js';
import { BADGE_LIGHT, SECTION_TITLE } from './uiStyles.js';

const KIND_ICON = { EVENTO: 'calendar', HISTORIA: 'book', TALENTO: 'mic', OPORTUNIDAD: 'sprout', INICIATIVA: 'people' };

// Tramo del recorrido segun la posicion del hito: dorado -> menta -> rio (igual que el trazo).
const TONES = [
  { text: 'text-gold', node: 'border-[rgba(212,168,67,.55)] shadow-[0_0_0_6px_rgba(212,168,67,.08)] group-hover:shadow-[0_0_0_10px_rgba(212,168,67,.14)]' },
  { text: 'text-mint', node: 'border-[rgba(117,183,155,.55)] shadow-[0_0_0_6px_rgba(117,183,155,.08)] group-hover:shadow-[0_0_0_10px_rgba(117,183,155,.14)]' },
  { text: 'text-river', node: 'border-[rgba(29,143,163,.6)] shadow-[0_0_0_6px_rgba(29,143,163,.1)] group-hover:shadow-[0_0_0_10px_rgba(29,143,163,.16)]' },
];

// Banda del rio: alto en px (= alto del viewBox, asi la y del svg coincide con la de los nodos).
const BAND = 140;
// Altura de cada nodo en la banda: un vaiven irregular, no una onda regular.
const NODE_Y = [88, 44, 98, 56, 82, 40];
const EDGE_Y = 70;

// Curva horizontal que pasa por el centro de cada columna (100 unidades por hito).
// El svg usa preserveAspectRatio="none" + vector-effect, asi que el ancho real de la
// columna (320 px o 78vw) solo estira la curva sin deformar el trazo.
function buildRiverPath(count) {
  let d = `M 0 ${EDGE_Y}`;
  let px = 0;
  let py = EDGE_Y;
  const points = Array.from({ length: count }, (_, i) => [i * 100 + 50, NODE_Y[i % NODE_Y.length]]);
  points.push([count * 100, EDGE_Y]);
  points.forEach(([x, y]) => {
    const mx = (px + x) / 2;
    d += ` C ${mx} ${py}, ${mx} ${y}, ${x} ${y}`;
    px = x;
    py = y;
  });
  return d;
}

function sortByDate(publications) {
  return [...publications]
    .filter((pub) => pub.start_date)
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
}

function toneFor(index, count) {
  if (count < 2) return TONES[0];
  return TONES[Math.round((index / (count - 1)) * (TONES.length - 1))];
}

const NAV_BTN = 'inline-flex size-11 cursor-pointer items-center justify-center rounded-full border border-[rgba(243,228,200,.25)] bg-transparent p-0 text-cream transition-colors duration-200 hover:border-gold hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:cursor-default disabled:opacity-35 disabled:hover:border-[rgba(243,228,200,.25)] disabled:hover:text-cream';

export default function TimelineSection({ publications = [] }) {
  const scrollRef = useRef(null);
  // Si la pista esta al inicio / al final (las flechas solo aparecen si hay desborde).
  const [edges, setEdges] = useState({ start: true, end: true });

  const sorted = sortByDate(publications);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const update = () => setEdges({
      start: el.scrollLeft <= 4,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
    });
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [sorted.length]);

  function step(direction) {
    const el = scrollRef.current;
    if (!el) return;
    const width = el.querySelector('li')?.offsetWidth || 320;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: direction * width, behavior: reduce ? 'auto' : 'smooth' });
  }

  if (sorted.length === 0) return null;

  const riverPath = buildRiverPath(sorted.length);
  const overflows = !(edges.start && edges.end);

  return (
    <section className="relative mx-[4vw] overflow-hidden rounded-[40px] bg-ink-deep py-[100px] px-[8vw] text-cream max800:py-[70px] max800:px-[6vw]">
      <div className="mb-14 text-center max800:mb-10">
        <span className={BADGE_LIGHT}>Cronología</span>
        <h2 className={SECTION_TITLE}>El hilo del tiempo</h2>
        <p className="mt-2 mb-0 text-[16px] leading-[1.5] text-[rgba(243,228,200,.7)]">
          Las historias, eventos y oportunidades del Bajo Cauca en orden cronológico.
        </p>
      </div>

      <div
        ref={scrollRef}
        className="-mx-[8vw] snap-x snap-mandatory overflow-x-auto px-[8vw] pb-6 [scrollbar-color:rgba(243,228,200,.22)_transparent] [scrollbar-width:thin] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold max800:-mx-[6vw] max800:px-[6vw]"
        role="region"
        aria-label="Cronología. Desplázate en horizontal para recorrerla."
        tabIndex={0}
      >
        <div className="relative mx-auto w-max">
          <svg className="pointer-events-none absolute top-0 left-0 w-full" style={{ height: BAND }} viewBox={`0 0 ${sorted.length * 100} ${BAND}`} preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="tl-river-gradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" style={{ stopColor: 'var(--gold)', stopOpacity: 0 }} />
                <stop offset="7%" style={{ stopColor: 'var(--gold)' }} />
                <stop offset="50%" style={{ stopColor: 'var(--mint)' }} />
                <stop offset="93%" style={{ stopColor: 'var(--river)' }} />
                <stop offset="100%" style={{ stopColor: 'var(--river)', stopOpacity: 0 }} />
              </linearGradient>
            </defs>
            <path d={riverPath} className="tl-river-bed" />
            <path d={riverPath} className="tl-river-flow" />
          </svg>

          <ol className="relative m-0 flex list-none p-0">
            {sorted.map((pub, index) => {
              const tone = toneFor(index, sorted.length);
              const y = NODE_Y[index % NODE_Y.length];
              const [day, month, year] = formatDateShort(pub.start_date).split(' ');
              return (
                <li key={pub.id} className="group relative w-[320px] shrink-0 snap-center px-6 max600:w-[78vw] max600:px-4">
                  <div className="relative" style={{ height: BAND }} aria-hidden="true">
                    {/* Hilo que baja del nodo al texto */}
                    <span className="absolute left-1/2 -bottom-3 border-0 border-l border-dashed border-l-[rgba(243,228,200,.18)]" style={{ top: y + 22 }} />
                    <span className={`absolute left-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[1.5px] bg-ink-deep transition-[box-shadow] duration-300 ease-[ease] ${tone.text} ${tone.node}`} style={{ top: y }}>
                      <Icon name={KIND_ICON[pub.kind] || 'circle'} className="size-5" />
                    </span>
                  </div>

                  <div className="mt-5 text-center">
                    <time dateTime={pub.start_date} className="block">
                      <span className={`block font-display text-[40px] font-bold italic leading-none ${tone.text}`}>{year}</span>
                      <span className="mt-2 block text-[11px] font-bold uppercase tracking-[.16em] text-[rgba(243,228,200,.6)]">
                        {day} {month} · {KIND_LABELS[pub.kind] || pub.kind}
                      </span>
                    </time>
                    <h3 className="mt-3 mb-2 font-sans text-[20px] font-bold leading-[1.2] tracking-[-.02em] text-cream">{pub.title}</h3>
                    <p className="m-0 line-clamp-3 text-[14px] leading-[1.55] text-[rgba(243,228,200,.72)]">{pub.summary}</p>
                    <p className="mt-3 mb-0 inline-flex items-center gap-1.5 text-[12px] text-[rgba(243,228,200,.55)]">
                      <Icon name="pin" className="size-3.5" />
                      {pub.location || 'Caucasia'}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      {overflows && (
        <div className="mt-6 flex justify-center gap-3">
          <button className={NAV_BTN} type="button" onClick={() => step(-1)} disabled={edges.start} aria-label="Hito anterior">
            <Icon name="arrow-left" className="size-5" />
          </button>
          <button className={NAV_BTN} type="button" onClick={() => step(1)} disabled={edges.end} aria-label="Hito siguiente">
            <Icon name="arrow-right" className="size-5" />
          </button>
        </div>
      )}
    </section>
  );
}
