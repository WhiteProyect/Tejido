import { motion, useReducedMotion } from 'framer-motion';
import { COVER_EASE, entranceDelays } from './MunicipalityCover.jsx';

// Modulos 2 y 3: datos rapidos (una sola tarjeta, cuatro datos con su barra de color fija) y memoria
// y esencia local. Lo que venga vacio en utils/municipalities.js no se pinta (ni deja hueco).
// Los datos rapidos entran despues de la portada (misma cascada, ver MunicipalityCover).
const FACTS = [
  ['location', 'Ubicación', '#1d8fa3'],
  ['altitudeClimate', 'Altitud / clima', '#d4a843'],
  ['population', 'Población', '#88c5a4'],
  ['founded', 'Fundación', '#c85a32'],
];
// Rio #1d8fa3 solo da 3.81:1 como texto sobre blanco: la etiqueta usa el tono ajustado (4.75:1).
const RIVER_TEXT = '#1a7e8f';

export function QuickFacts({ municipality, viaMorph = false }) {
  const reduceMotion = useReducedMotion();
  const facts = FACTS.filter(([key]) => municipality.facts?.[key]);
  if (facts.length === 0) return null;
  const entrance = reduceMotion ? {} : {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.32, delay: entranceDelays(viaMorph).facts, ease: COVER_EASE },
  };
  return (
    <motion.section aria-labelledby="municipio-datos" className="rounded-2xl border border-[#ddd5c7] bg-white p-6 max600:p-5" {...entrance}>
      <h2 id="municipio-datos" className="sr-only">Datos rápidos de {municipality.name}</h2>
      <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
        {facts.map(([key, label, color]) => (
          <div key={key} className="min-w-0 border-l-4 pl-4" style={{ borderLeftColor: color }}>
            <dt className="text-[11px] font-bold uppercase tracking-[.14em] text-[#53645c]">{label}</dt>
            <dd className="mt-1.5 mb-0 ml-0 text-[17px] font-bold leading-[1.35] text-ink break-words max480:text-[15px]">{municipality.facts[key]}</dd>
            {key === 'population' && <p className="mt-1 mb-0 text-[12px] text-[#53645c]">Fuente: DANE</p>}
          </div>
        ))}
      </dl>
    </motion.section>
  );
}

export function MemoryCard({ municipality }) {
  const { memory } = municipality;
  if (!memory?.text && !memory?.quote) return null;
  return (
    <section aria-labelledby="municipio-memoria" className="h-full rounded-2xl border border-[#ddd5c7] bg-white p-8 max600:p-6">
      <p className="m-0 text-[12px] font-bold uppercase tracking-[.16em]" style={{ color: RIVER_TEXT }}>Memoria y esencia local</p>
      <h2 id="municipio-memoria" className="mt-2 mb-0 font-sans text-[26px] font-extrabold leading-[1.2] tracking-[-0.03em] text-ink">
        {memory.title || `La memoria de ${municipality.name}`}
      </h2>
      {memory.text && <p className="mt-4 mb-0 text-[17px] leading-[1.7] text-[#44564f]">{memory.text}</p>}
      {memory.quote && (
        <blockquote className="mt-6 mb-0 ml-0 border-l-4 pl-5 font-display text-[20px] italic leading-[1.5] text-ink" style={{ borderColor: municipality.accent }}>
          {memory.quote}
        </blockquote>
      )}
    </section>
  );
}
