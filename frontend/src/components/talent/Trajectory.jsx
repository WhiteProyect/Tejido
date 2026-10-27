import { useEffect, useRef, useState } from 'react';

// "Historia / Trayectoria", segun el diseño: un hilo tejido horizontal hecho con SVG de colores de
// marca SOLIDOS (tres hebras trenzadas, cabos deshilachados en los extremos, flechas entre nudos y
// nudos como ovillos de color). Bajo cada nudo, el año y el titulo en un boton; al enfocarlo o
// seleccionarlo se muestra su descripcion debajo. Si no cabe, la pista se desplaza en horizontal
// con snap; las flechas del teclado pasan de un hito a otro. En movil es una lista vertical con
// el mismo hilo a la izquierda y las descripciones visibles. Arriba va la descripcion del talento.
const KNOTS = ['var(--orange)', 'var(--gold)', 'var(--forest)', 'var(--mint)'];
const STRANDS = ['var(--forest)', 'var(--orange)', 'var(--gold)'];
// Ancho de cada etiqueta = separacion minima entre nudos = el doble del margen lateral.
const COL = 160;
const EDGE = COL / 2;
const Y = 32;
const HEIGHT = 64;

function strand(width, phase) {
  const points = [];
  for (let x = 14; x <= width - 14; x += 4) points.push(`${x},${(Y + 3.2 * Math.sin((2 * Math.PI * x) / 26 + phase)).toFixed(2)}`);
  return `M ${points.join(' L ')}`;
}

function fray(x, direction) {
  return [-7, -3, 2, 6].map((dy, i) => `M ${x} ${Y} q ${direction * 8} ${dy / 2} ${direction * (12 + i * 2)} ${dy}`);
}

function Vertical({ milestones }) {
  return (
    <ol className="m-0 list-none p-0">
      {milestones.map((item, index) => {
        const color = KNOTS[index % KNOTS.length];
        const last = index === milestones.length - 1;
        return (
          <li key={index} className="relative grid grid-cols-[28px_minmax(0,1fr)] gap-3 pb-6 last:pb-0">
            {!last && <span className="absolute left-[12px] top-[24px] bottom-0 w-1 rounded-full bg-forest" aria-hidden="true" />}
            <span className="relative mt-0.5 size-[22px] rounded-full border-2 border-[rgba(12,36,30,.35)]" style={{ backgroundColor: color }} aria-hidden="true" />
            <div>
              <p className="m-0 font-display text-[20px] font-bold italic leading-none text-ink">{item.year}</p>
              <p className="mt-1.5 mb-0 text-[16px] font-bold leading-[1.3] text-ink">{item.title}</p>
              {item.description && <p className="mt-1 mb-0 text-[14px] leading-[1.55] text-[#53645c]">{item.description}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function Trajectory({ milestones, description, mobile }) {
  const [selected, setSelected] = useState(0);
  const [available, setAvailable] = useState(0);
  const track = useRef(null);
  const buttons = useRef([]);

  useEffect(() => {
    if (mobile || !track.current) return undefined;
    const observer = new ResizeObserver(([entry]) => setAvailable(entry.contentRect.width));
    observer.observe(track.current);
    return () => observer.disconnect();
  }, [mobile]);

  const intro = description && <p className="mt-0 mb-6 max-w-[760px] whitespace-pre-line text-[16px] leading-[1.65] text-[#3f514a]">{description}</p>;
  if (milestones.length === 0) return intro;
  if (mobile) return <>{intro}<Vertical milestones={milestones} /></>;

  const n = milestones.length;
  const width = Math.max(available, EDGE * 2 + (n - 1) * COL, 320);
  const step = n > 1 ? (width - EDGE * 2) / (n - 1) : 0;
  const xs = milestones.map((_, i) => (n > 1 ? EDGE + i * step : width / 2));
  const current = milestones[selected];

  function handleKey(event, index) {
    const move = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!move) return;
    event.preventDefault();
    const next = Math.min(n - 1, Math.max(0, index + move));
    setSelected(next);
    buttons.current[next]?.focus();
  }

  return (
    <div>
      {intro}
      <div ref={track} className="snap-x snap-mandatory overflow-x-auto pb-2 [scrollbar-width:thin]">
        <div className="relative" style={{ width, height: HEIGHT + 64 }}>
          <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} className="block" fill="none" aria-hidden="true">
            {STRANDS.map((color, i) => (
              <path key={color} d={strand(width, (i * 2 * Math.PI) / 3)} stroke={color} strokeWidth="2.6" strokeLinecap="round" />
            ))}
            {[...fray(14, -1), ...fray(width - 14, 1)].map((d, i) => (
              <path key={i} d={d} stroke={STRANDS[i % STRANDS.length]} strokeWidth="2" strokeLinecap="round" />
            ))}
            {xs.slice(0, -1).map((x, i) => {
              const mid = (x + xs[i + 1]) / 2;
              return <path key={i} d={`M ${mid - 4} ${Y - 7} L ${mid + 4} ${Y} L ${mid - 4} ${Y + 7}`} stroke="var(--forest)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />;
            })}
            {xs.map((x, i) => {
              const active = i === selected;
              const r = active ? 14 : 12;
              return (
                <g key={i}>
                  {active && <circle cx={x} cy={Y} r={r + 5} stroke="var(--ink)" strokeWidth="2" />}
                  <circle cx={x} cy={Y} r={r} fill={KNOTS[i % KNOTS.length]} stroke="rgba(12,36,30,.4)" strokeWidth="1.5" />
                  <path d={`M ${x - r * 0.7} ${Y - r * 0.2} q ${r * 0.7} ${-r * 0.7} ${r * 1.4} 0 M ${x - r * 0.75} ${Y + r * 0.25} q ${r * 0.75} ${-r * 0.6} ${r * 1.5} 0 M ${x - r * 0.5} ${Y + r * 0.65} q ${r * 0.5} ${-r * 0.4} ${r} 0`}
                    stroke="rgba(255,255,255,.55)" strokeWidth="1.3" strokeLinecap="round" />
                </g>
              );
            })}
          </svg>
          <ol className="m-0 list-none p-0">
            {milestones.map((item, index) => (
              <li key={index} className="absolute snap-center px-1" style={{ left: xs[index] - COL / 2, top: HEIGHT, width: COL }}>
                <button ref={(node) => { buttons.current[index] = node; }} type="button" aria-pressed={index === selected}
                  aria-controls="trayectoria-detalle" onClick={() => setSelected(index)} onFocus={() => setSelected(index)}
                  onKeyDown={(event) => handleKey(event, index)}
                  className={`w-full cursor-pointer rounded-[10px] border-0 py-1.5 px-1.5 text-center transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${index === selected ? 'bg-cream' : 'bg-transparent hover:bg-[#f3ead9]'}`}>
                  <span className="block font-display text-[19px] font-bold italic leading-none text-ink">{item.year}</span>
                  <span className="mt-1 block text-[13px] font-bold leading-[1.3] text-ink">{item.title}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div id="trayectoria-detalle" aria-live="polite" className="mt-3 rounded-[12px] border border-[#e3d6bf] bg-[#fffaf0] py-3.5 px-5">
        <p className="m-0 text-[15px] font-bold text-ink"><span className="font-display italic">{current.year}</span> · {current.title}</p>
        {current.description && <p className="mt-1 mb-0 text-[15px] leading-[1.6] text-[#53645c]">{current.description}</p>}
      </div>
    </div>
  );
}
