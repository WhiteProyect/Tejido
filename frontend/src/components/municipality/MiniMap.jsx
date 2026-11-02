import { GEO_HEIGHT, GEO_WIDTH, MUNICIPAL_DIVISIONS, MUNICIPALITY_KNOTS, MUNICIPALITY_SHAPES, REGION_OUTLINE, RIVERS } from '../../utils/geoMap.js';
import { MUNICIPALITY_LIST } from '../../utils/municipalities.js';

// Modulo 6: mini mapa en tarjeta de tinta, con la misma silueta y los mismos nudos del mapa del inicio
// (utils/geoMap.js) en colores planos; el municipio actual, un tono mas claro. Pin dorado (#d4a843) del
// municipio actual con la punta sobre su nudo y borde de tinta. El pulso solo con movimiento permitido.
// Contraste sobre la region (#21503f): nombres 7.4:1 y puntos 4.7:1; el nombre del actual, 6.6:1 sobre su
// tono (#2d6552), y el pin 3.1:1; el contorno (#5aadbc, 4.5:1 sobre la tinta) separa la region del fondo.
const PIN_GOLD = '#d4a843';
const REGION = '#21503f';
const CURRENT = '#2d6552';
const PIN_HEIGHT = 25;

function pinPath(x, tip) {
  const y = tip - PIN_HEIGHT;
  return `M ${x} ${tip} C ${x - 7.5} ${tip - 11} ${x - 15} ${y + 7.5} ${x - 15} ${y} A 15 15 0 1 1 ${x + 15} ${y} C ${x + 15} ${y + 7.5} ${x + 7.5} ${tip - 11} ${x} ${tip} Z`;
}

export default function MiniMap({ municipality }) {
  const { x, y } = MUNICIPALITY_KNOTS[municipality.slug];
  return (
    <section aria-labelledby="municipio-mapa" className="flex h-full flex-col rounded-2xl bg-ink p-8 text-paper max600:p-6">
      <p className="m-0 text-[12px] font-bold uppercase tracking-[.16em] text-gold">Ubicación en el Bajo Cauca</p>
      <h2 id="municipio-mapa" className="mt-2 mb-0 font-sans text-[24px] font-extrabold leading-[1.2] tracking-[-0.03em] text-white">
        {municipality.mapCaption || municipality.name}
      </h2>
      <svg
        viewBox={`0 0 ${GEO_WIDTH} ${GEO_HEIGHT}`}
        className="mt-4 block h-auto w-full"
        role="img"
        aria-label={`Mapa del Bajo Cauca antioqueño con ${municipality.name} resaltado entre los seis municipios`}
      >
        {Object.entries(MUNICIPALITY_SHAPES).map(([slug, d]) => (
          <path key={slug} d={d} fill={slug === municipality.slug ? CURRENT : REGION} />
        ))}
        <path d={MUNICIPAL_DIVISIONS} fill="none" stroke="#5aadbc" strokeOpacity="0.4" strokeWidth="2" strokeDasharray="6 6" />
        <path d={REGION_OUTLINE} fill="none" stroke="#5aadbc" strokeWidth="2.5" strokeLinejoin="round" />
        {Object.entries(RIVERS).map(([key, d]) => (
          <path key={key} d={d} stroke="#5aadbc" strokeOpacity="0.45" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        ))}
        {MUNICIPALITY_LIST.map((other) => {
          const current = other.slug === municipality.slug;
          const knot = MUNICIPALITY_KNOTS[other.slug];
          return (
            <g key={other.slug}>
              <circle cx={knot.x} cy={knot.y} r={current ? 9 : 7.5} fill={current ? '#fdfbf7' : '#a9bdb5'} />
              <text x={knot.x} y={knot.y + 40} textAnchor="middle" fontSize="25" fontWeight={current ? 800 : 600} fill={current ? '#fdfbf7' : '#dfe8e4'} fontFamily="'DM Sans', sans-serif">
                {other.name}
              </text>
            </g>
          );
        })}
        <circle
          cx={x}
          cy={y}
          r="17"
          fill={PIN_GOLD}
          className="[transform-box:fill-box] [transform-origin:center] motion-safe:animate-[muniPinPulse_2.4s_ease-out_infinite] motion-reduce:hidden"
        />
        <path d={pinPath(x, y)} fill={PIN_GOLD} stroke="#173f36" strokeWidth="3" />
        <circle cx={x} cy={y - PIN_HEIGHT} r="5.5" fill="#173f36" />
      </svg>
      <p className="mt-auto mb-0 pt-4 text-[14px] font-semibold text-[#88c5a4]">Confluencia vial y fluvial de los 6 municipios</p>
    </section>
  );
}
