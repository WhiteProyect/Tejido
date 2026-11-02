import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';
import {
  CORREGIMIENTOS, GEO_HEIGHT, GEO_WIDTH, MUNICIPAL_DIVISIONS, MUNICIPALITY_KNOTS, MUNICIPALITY_SHAPES, REGION_OUTLINE, RIVERS,
} from '../../utils/geoMap.js';
import { markMapReturn } from '../../utils/mapReturn.js';
import { MUNICIPALITY_LIST } from '../../utils/municipalities.js';
import MapPreviewCard from './MapPreviewCard.jsx';
import { STRAND_CREAM, STRAND_GOLD, STRAND_HIGHLIGHT, STRAND_TERRACOTTA, STRANDS, strandPath } from './strands.js';

// Mapa tejido del Bajo Cauca (seccion Geografia del inicio). Dos capas con el mismo aspecto:
// - SVG (decorativo, aria-hidden): silueta real (utils/geoMap.js), limites punteados, rios trenzados,
//   hebras de Hilo a cada nudo, corregimientos y el destello del clic;
// - HTML encima, en % del viewBox: Hilo, etiquetas y enlaces de los 6 municipios (texto en px fijos,
//   objetivos de 44 px), dentro de un grupo con nombre.
// Escritorio: Hilo a la izquierda sostiene el nudo maestro. Movil (narrow): Hilo y su frase arriba, el
// nudo maestro en la esquina del mapa y las hebras bajan en abanico.
// Movimiento (sin movimiento reducido): un solo bucle rAF escribe directo en el DOM (sin re-render de
// React): ondulacion de las hebras, flujo de los rios de sur a norte y flotacion de Hilo (con el nudo
// maestro, en el mismo calculo). Se pausa fuera de pantalla y con la pestaña oculta.
// Clic: destello por la hebra (260 ms), zoom al nudo (180 ms) y navega (~450 ms). Tactil: solo el
// destello. Ctrl/Cmd/Shift/clic central: enlace normal. Movimiento reducido: navega de inmediato.
const HILO_SRC = '/images/hilo/hilo-saluda.webp';
const PHRASE = 'Seis municipios, un mismo río. Hilo los está tejiendo.';
const WIDE = { x: -360, y: 0, w: GEO_WIDTH + 360, h: GEO_HEIGHT, origin: { x: -118, y: 300 }, bend: 1 };
const NARROW = { x: 0, y: 0, w: GEO_WIDTH, h: GEO_HEIGHT, origin: { x: 44, y: 44 }, bend: 0.5 };
// Hilo en escritorio (unidades del viewBox): la mano que saluda queda junto al nudo maestro.
const HILO_BOX = { x: -335, y: 228, w: 240, h: 232 };
const SPARK_MS = 260;
const ZOOM_MS = 180;
const NAVIGATE_MS = 450;
const RIVER_DASH = 24;
const COARSE = '(hover: none), (pointer: coarse)';
const FINE_HOVER = '(hover: hover) and (pointer: fine)';
const CANVAS = '#efe9dc';
// Etiquetas legibles sobre hebras y rios: halo del color del lienzo (sin degradados).
const HALO = '[text-shadow:0_0_3px_#efe9dc,0_0_3px_#efe9dc,0_0_2px_#efe9dc]';
const KNOT_LINK = 'group absolute flex rounded-xl text-ink no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4a843] focus-visible:shadow-[0_0_0_6px_#173f36]';
const LINK_LAYOUT = {
  right: 'items-center -translate-x-[22px] -translate-y-[22px] text-left',
  left: 'flex-row-reverse items-center -translate-x-[calc(100%_-_22px)] -translate-y-[22px] text-right',
  below: 'flex-col items-center -translate-x-1/2 -translate-y-[22px] text-center',
};
const LABEL_GAP = { right: 'ml-1 pr-2', left: 'mr-1 pl-2', below: '-mt-2 pb-1.5 px-2' };

const pct = (value, start, size) => `${((value - start) / size) * 100}%`;
// Grosor de los trazos: el del escritorio (~0.8 px por unidad) se mantiene en pantalla cuando el mapa se
// achica, hasta 2.2 veces; los rios, hasta 1.5 (si no, taparian el mapa en movil).
const strokeScale = (unitPx) => Math.min(2.2, Math.max(1, Math.round((0.8 / unitPx) * 10) / 10));

export default function WovenMap({ counts, narrow }) {
  const reduceMotion = useReducedMotion();
  const vb = narrow ? NARROW : WIDE;
  const rootRef = useRef(null);
  const boxRef = useRef(null);
  const hiloRef = useRef(null);
  const masterRef = useRef(null);
  const strandRefs = useRef({});
  const riverRefs = useRef([]);
  const sparkRef = useRef(null);
  const sparkHeadRef = useRef(null);
  const cardRef = useRef(null);
  const hoveredRef = useRef(null);
  const frozenRef = useRef(false);
  const busyRef = useRef(false);
  const unitRef = useRef(1);
  const [k, setK] = useState(1);
  const riverK = Math.min(k, 1.5);
  const riverKRef = useRef(riverK);
  riverKRef.current = riverK;
  const [hovered, setHovered] = useState(null);
  const [preview, setPreview] = useState(null);
  const [cardStyle, setCardStyle] = useState({ visibility: 'hidden' });
  const [active, setActive] = useState(null);
  const [arrived, setArrived] = useState(false);
  const timers = useRef([]);
  const [hoveredPlace, setHoveredPlace] = useState(null);

  // Pixeles por unidad del viewBox (para que la flotacion de Hilo en px mueva igual al nudo maestro).
  useEffect(() => {
    const box = boxRef.current;
    if (!box || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      unitRef.current = box.clientWidth / vb.w || 1;
      setK(strokeScale(unitRef.current));
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, [vb.w]);

  useEffect(() => {
    if (reduceMotion || !rootRef.current) return undefined;
    let raf = 0;
    let running = false;
    let visible = false;
    let last = 0;
    let t = 0;
    const tick = (now) => {
      t += Math.min(now - last, 64) / 1000;
      last = now;
      const float = (-5 * (1 - Math.cos((2 * Math.PI * t) / 3.5))) / 2;
      if (hiloRef.current) hiloRef.current.style.transform = `translateY(${float.toFixed(2)}px)`;
      const lift = narrow ? 0 : float / unitRef.current;
      const origin = { x: vb.origin.x, y: vb.origin.y + lift };
      masterRef.current?.setAttribute('transform', `translate(0 ${lift.toFixed(2)})`);
      if (!frozenRef.current) {
        STRANDS.forEach((strand) => {
          const nodes = strandRefs.current[strand.slug];
          if (!nodes?.base) return;
          let wave = 7 * Math.sin((2 * Math.PI * t) / strand.period + strand.phase);
          if (hoveredRef.current === strand.slug) wave += 2.4 * Math.sin(2 * Math.PI * t * 9);
          const d = strandPath(origin, MUNICIPALITY_KNOTS[strand.slug], strand.bend * vb.bend, wave);
          nodes.base.setAttribute('d', d);
          nodes.cream?.setAttribute('d', d);
        });
      }
      const offset = String(-((t * 26 * riverKRef.current) % (RIVER_DASH * riverKRef.current)));
      riverRefs.current.forEach((node) => { if (node) node.style.strokeDashoffset = offset; });
      raf = requestAnimationFrame(tick);
    };
    const update = () => {
      const run = visible && !document.hidden;
      if (run && !running) {
        running = true;
        raf = requestAnimationFrame((now) => { last = now; tick(now); });
      } else if (!run && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); });
    observer.observe(rootRef.current);
    document.addEventListener('visibilitychange', update);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', update);
      cancelAnimationFrame(raf);
    };
  }, [reduceMotion, narrow, vb]);

  // Tarjeta de vista previa: arriba del nudo si cabe en el contenedor, si no debajo; siempre dentro.
  useLayoutEffect(() => {
    if (!preview || !cardRef.current || !rootRef.current || !boxRef.current) return;
    const root = rootRef.current.getBoundingClientRect();
    const box = boxRef.current.getBoundingClientRect();
    const knot = MUNICIPALITY_KNOTS[preview];
    const x = box.left - root.left + ((knot.x - vb.x) / vb.w) * box.width;
    const y = box.top - root.top + ((knot.y - vb.y) / vb.h) * box.height;
    const { offsetWidth: width, offsetHeight: height } = cardRef.current;
    const gap = 26;
    const above = y - gap - height >= 8;
    const top = above ? y - gap - height : Math.min(y + gap, root.height - height - 8);
    const left = Math.min(Math.max(x - width / 2, 8), root.width - width - 8);
    setCardStyle({ left, top: Math.max(top, 8) });
  }, [preview, vb]);

  const showPreview = (slug) => {
    hoveredRef.current = slug;
    setHovered(slug);
    if (!busyRef.current) {
      setCardStyle({ visibility: 'hidden' });
      setPreview(slug);
    }
  };
  const hidePreview = (slug) => {
    if (hoveredRef.current !== slug) return;
    hoveredRef.current = null;
    setHovered(null);
    setPreview(null);
  };

  const spark = (slug) => {
    const path = sparkRef.current;
    const head = sparkHeadRef.current;
    const strand = strandRefs.current[slug]?.base;
    if (!path || !head || !strand) return;
    path.setAttribute('d', strand.getAttribute('d'));
    path.style.visibility = 'visible';
    head.style.visibility = 'visible';
    const total = path.getTotalLength();
    animate(path, { strokeDashoffset: [1, 0] }, { duration: SPARK_MS / 1000, ease: 'easeIn' });
    animate(0, 1, {
      duration: SPARK_MS / 1000,
      ease: 'easeIn',
      onUpdate: (progress) => {
        const point = path.getPointAtLength(progress * total);
        head.setAttribute('cx', point.x);
        head.setAttribute('cy', point.y);
      },
    });
  };

  const handleClick = (event, slug) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (reduceMotion) {
      markMapReturn();
      return;
    }
    event.preventDefault();
    if (busyRef.current) return;
    busyRef.current = true;
    frozenRef.current = true;
    setPreview(null);
    setActive(slug);
    const go = () => {
      markMapReturn();
      window.location.hash = `municipio/${slug}`;
    };
    const later = (fn, ms) => timers.current.push(window.setTimeout(fn, ms));
    spark(slug);
    if (window.matchMedia(COARSE).matches) {
      later(go, SPARK_MS);
      return;
    }
    later(() => {
      setArrived(true);
      const knot = MUNICIPALITY_KNOTS[slug];
      const box = boxRef.current;
      if (box) {
        box.style.transformOrigin = `${pct(knot.x, vb.x, vb.w)} ${pct(knot.y, vb.y, vb.h)}`;
        animate(box, { scale: 2 }, { duration: ZOOM_MS / 1000, ease: [0.4, 0, 1, 1] });
      }
    }, SPARK_MS);
    later(go, NAVIGATE_MS);
  };

  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  // Si se vuelve al inicio mientras la seccion aun sale (Atras muy rapido), React la reutiliza tal cual:
  // se deshace el destello y el zoom para que el mapa vuelva a responder.
  useEffect(() => {
    const reset = () => {
      if (!busyRef.current || window.location.hash.startsWith('#municipio/')) return;
      busyRef.current = false;
      frozenRef.current = false;
      if (boxRef.current) boxRef.current.style.transform = '';
      if (sparkRef.current) sparkRef.current.style.visibility = 'hidden';
      if (sparkHeadRef.current) sparkHeadRef.current.style.visibility = 'hidden';
      setActive(null);
      setArrived(false);
    };
    window.addEventListener('hashchange', reset);
    return () => window.removeEventListener('hashchange', reset);
  }, []);

  const hoverable = () => window.matchMedia(FINE_HOVER).matches;

  return (
    <div ref={rootRef} className="relative overflow-hidden rounded-3xl border border-[#ddd5c7]" style={{ backgroundColor: CANVAS }}>
      {/* Textura de puntos: patron SVG de circulos planos, detras de todo (tambien de Hilo en movil). */}
      <svg aria-hidden="true" className="absolute inset-0 size-full">
        <defs>
          <pattern id="geo-puntos" width="18" height="18" patternUnits="userSpaceOnUse">
            <circle cx="9" cy="9" r="1.2" fill="#d9cfbb" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#geo-puntos)" />
      </svg>

      {narrow && (
        <div className="relative flex items-center gap-3 px-5 pt-5">
          <img ref={hiloRef} src={HILO_SRC} alt="" width="72" height="70" loading="lazy" decoding="async" className="h-auto w-[72px] shrink-0" />
          <p className="m-0 text-[14px] font-extrabold leading-snug text-ink">{PHRASE}</p>
        </div>
      )}

      <div ref={boxRef} className="relative" style={{ aspectRatio: `${vb.w} / ${vb.h}` }}>
        <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} aria-hidden="true" className="absolute inset-0 size-full" fill="none">
          <g>
            {Object.entries(MUNICIPALITY_SHAPES).map(([slug, d]) => <path key={slug} d={d} fill="#d7ded9" />)}
            <path d={REGION_OUTLINE} stroke="#b9c4bd" strokeWidth={1.6 * k} strokeLinejoin="round" />
            <path d={MUNICIPAL_DIVISIONS} stroke="#b9c4bd" strokeWidth={1.6 * k} strokeDasharray={`${5 * k} ${5 * k}`} strokeLinejoin="round" />
          </g>

          {Object.entries(RIVERS).map(([key, d], index) => (
            <g key={key} strokeLinecap="round" strokeLinejoin="round">
              <path d={d} stroke="#136b7c" strokeWidth={15 * riverK} />
              <path d={d} stroke="#1d8fa3" strokeWidth={9 * riverK} />
              <path
                ref={(node) => { riverRefs.current[index] = node; }}
                d={d}
                stroke="#bfe6ee"
                strokeWidth={2.6 * riverK}
                strokeDasharray={`${14 * riverK} ${10 * riverK}`}
              />
            </g>
          ))}

          <g className="max600:hidden">
            {CORREGIMIENTOS.map((place) => (
              <line
                key={place.name}
                x1={place.x}
                y1={place.y}
                x2={place.label.x}
                y2={place.label.y}
                stroke={hoveredPlace === place.name ? '#173f36' : '#8b9690'}
                strokeWidth={hoveredPlace === place.name ? 1.8 * k : 1 * k}
              />
            ))}
          </g>
          {CORREGIMIENTOS.map((place, index) => (
            <circle
              key={place.name}
              cx={place.x}
              cy={place.y}
              r={(hoveredPlace === place.name ? 7.5 : 6) * k}
              fill={index % 2 ? STRAND_GOLD : STRAND_TERRACOTTA}
              stroke="#173f36"
              strokeWidth={1.2 * k}
            />
          ))}

          {STRANDS.map((strand) => {
            const d = strandPath(vb.origin, MUNICIPALITY_KNOTS[strand.slug], strand.bend * vb.bend);
            const lit = hovered === strand.slug || active === strand.slug;
            const dim = (hovered || active) && !lit;
            return (
              <g key={strand.slug} opacity={dim ? 0.45 : 1} strokeLinecap="round" className="transition-opacity duration-200">
                <path
                  ref={(node) => { (strandRefs.current[strand.slug] ||= {}).base = node; }}
                  d={d}
                  stroke={lit ? STRAND_HIGHLIGHT : strand.color}
                  strokeWidth={(lit ? 6 : 4.6) * k}
                />
                <path
                  ref={(node) => { (strandRefs.current[strand.slug] ||= {}).cream = node; }}
                  d={d}
                  stroke={STRAND_CREAM}
                  strokeWidth={1.7 * k}
                  strokeDasharray={`${3 * k} ${6 * k}`}
                />
              </g>
            );
          })}

          <path ref={sparkRef} pathLength="1" strokeDasharray="1 1" strokeDashoffset="1" stroke={STRAND_HIGHLIGHT} strokeWidth={7 * k} strokeLinecap="round" style={{ visibility: 'hidden' }} />
          <circle ref={sparkHeadRef} r={9 * k} fill="#fff3c4" stroke={STRAND_HIGHLIGHT} strokeWidth={3 * k} style={{ visibility: 'hidden' }} />

          <g ref={masterRef}>
            <circle cx={vb.origin.x} cy={vb.origin.y} r={11 * k} fill={STRAND_GOLD} stroke="#173f36" strokeWidth={2.5 * k} />
            <circle cx={vb.origin.x} cy={vb.origin.y} r={4 * k} fill="#173f36" />
          </g>
        </svg>

        {!narrow && (
          <div
            className="pointer-events-none absolute"
            style={{ left: pct(HILO_BOX.x, vb.x, vb.w), top: pct(HILO_BOX.y, vb.y, vb.h), width: `${(HILO_BOX.w / vb.w) * 100}%` }}
          >
            <img ref={hiloRef} src={HILO_SRC} alt="" width="240" height="232" loading="lazy" decoding="async" className="block h-auto w-full" />
            <p className="mx-auto mt-3 mb-0 max-w-[200px] text-center text-[15px] font-extrabold leading-snug text-ink">{PHRASE}</p>
          </div>
        )}

        <div role="group" aria-label="Mapa del Bajo Cauca con los seis municipios" className="absolute inset-0">
          {CORREGIMIENTOS.map((place) => (
            <span
              key={place.name}
              className={`absolute -translate-y-1/2 whitespace-nowrap px-1 text-[12px] font-semibold leading-none max600:hidden ${HALO} ${place.label.align === 'left' ? '-translate-x-full' : ''} ${hoveredPlace === place.name ? 'text-ink' : 'text-[#4d5a55]'}`}
              style={{ left: pct(place.label.x, vb.x, vb.w), top: pct(place.label.y, vb.y, vb.h) }}
              onPointerEnter={() => setHoveredPlace(place.name)}
              onPointerLeave={() => setHoveredPlace(null)}
            >
              {place.name}
            </span>
          ))}

          {MUNICIPALITY_LIST.map((municipality) => {
            const knot = MUNICIPALITY_KNOTS[municipality.slug];
            const capital = municipality.slug === 'caucasia';
            const scale = active === municipality.slug && arrived ? 'scale-[1.35]' : 'group-hover:scale-[1.12] group-focus-visible:scale-[1.12]';
            return (
              <a
                key={municipality.slug}
                href={`#municipio/${municipality.slug}`}
                aria-label={`${municipality.name}, ${municipality.tagline}. Abrir pantalla del municipio`}
                className={`${KNOT_LINK} ${LINK_LAYOUT[knot.label]}`}
                style={{ left: pct(knot.x, vb.x, vb.w), top: pct(knot.y, vb.y, vb.h) }}
                onClick={(event) => handleClick(event, municipality.slug)}
                onPointerEnter={(event) => { if (event.pointerType !== 'touch' && hoverable()) showPreview(municipality.slug); }}
                onPointerLeave={() => hidePreview(municipality.slug)}
                onFocus={(event) => { if (event.currentTarget.matches(':focus-visible')) showPreview(municipality.slug); }}
                onBlur={() => hidePreview(municipality.slug)}
              >
                <span className="flex size-11 shrink-0 items-center justify-center" aria-hidden="true">
                  <span
                    className={`flex items-center justify-center rounded-full bg-[#d4a843] shadow-[0_0_0_2px_#173f36] transition-transform duration-200 motion-reduce:transition-none ${scale} ${capital ? 'size-7 max600:size-6' : 'size-[22px] max600:size-[18px]'}`}
                  >
                    <span className={`rounded-full bg-[#173f36] ${capital ? 'size-2.5' : 'size-2'}`} />
                  </span>
                </span>
                <span aria-hidden="true" className={`flex flex-col leading-tight ${LABEL_GAP[knot.label]} ${HALO}`}>
                  <span className="whitespace-nowrap text-[15px] font-extrabold max600:text-[13px]">{municipality.name}</span>
                  <span className="whitespace-nowrap text-[12px] font-bold uppercase tracking-[.08em] text-[#4d5a55] max600:tracking-[.04em]">{municipality.tagline}</span>
                </span>
              </a>
            );
          })}
        </div>
      </div>

      {preview && (
        <MapPreviewCard
          municipality={MUNICIPALITY_LIST.find((municipality) => municipality.slug === preview)}
          count={counts[preview] || 0}
          cardRef={cardRef}
          style={cardStyle}
        />
      )}
      {/* Bisel interior: 1 px blanco arriba, por encima del lienzo. */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-3xl shadow-[inset_0_1px_0_#fff]" />
    </div>
  );
}
