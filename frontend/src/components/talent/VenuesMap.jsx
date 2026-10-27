import Icon from '../Icon.jsx';
import { MUNICIPALITY_NAMES } from '../../utils/talent.js';

// "Dónde se ha presentado": mapa esquematico compacto y la lista de lugares. El SVG del mapa vivo
// (screens/HomeMapSection.jsx) usa degradados, filtros y animaciones, asi que no se reutiliza:
// aqui se dibujan su misma silueta de la region, su mismo rio y los 6 municipios en sus MISMAS
// posiciones (los centros de .geo-muni), en colores solidos. El municipio de origen (donde
// reside) va resaltado en naranja; los municipios con presentaciones, en rio.
const POSITIONS = {
  caucasia: [365, 225],
  caceres: [195, 210],
  taraza: [235, 128],
  nechi: [335, 135],
  elbagre: [490, 148],
  zaragoza: [215, 350],
};
const REGION = 'M140,55 Q180,30 340,35 Q500,30 620,55 Q680,75 685,140 Q690,220 670,300 Q650,380 600,430 Q530,480 400,490 Q270,495 180,450 Q110,410 85,340 Q60,270 70,190 Q80,100 140,55 Z';
const RIVER = 'M90,120 Q160,160 230,195 Q340,230 460,260 Q540,285 620,320';
const TRIBUTARY = 'M210,70 Q230,120 250,175 Q270,240 290,290';

export default function VenuesMap({ origin, venues, name }) {
  const played = new Set(venues.map((venue) => venue.municipality).filter(Boolean));
  const playedNames = [...played].map((key) => MUNICIPALITY_NAMES[key]).filter(Boolean);
  const description = `Mapa del Bajo Cauca: ${name} reside en ${MUNICIPALITY_NAMES[origin] || 'el Bajo Cauca'}`
    + (playedNames.length ? `; se ha presentado en ${playedNames.join(', ')}.` : '.');

  return (
    <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-start gap-8 max900:grid-cols-[minmax(0,1fr)]">
      <div className="rounded-[14px] border border-[#e3d6bf] bg-[#f3e7cf] p-4">
        <p className="m-0 text-center font-sans text-[20px] font-extrabold tracking-[-.01em] text-ink" aria-hidden="true">Bajo Cauca</p>
        <svg viewBox="55 25 640 480" className="block h-auto w-full" role="img" aria-label={description}>
          <path d={REGION} fill="#f8eedb" stroke="#3f514a" strokeOpacity=".45" strokeWidth="1.6" strokeDasharray="6 5" />
          <path d={RIVER} fill="none" stroke="#1b6f78" strokeWidth="15" strokeLinecap="round" />
          <path d={RIVER} fill="none" stroke="#3fa6a8" strokeWidth="10" strokeLinecap="round" />
          <path d={TRIBUTARY} fill="none" stroke="#1b6f78" strokeWidth="10" strokeLinecap="round" />
          <path d={TRIBUTARY} fill="none" stroke="#3fa6a8" strokeWidth="6" strokeLinecap="round" />
          {Object.entries(POSITIONS).map(([key, [x, y]]) => {
            const isOrigin = key === origin;
            const isPlayed = played.has(key);
            return (
              <g key={key}>
                {isOrigin && <circle cx={x} cy={y} r="22" fill="var(--orange)" fillOpacity=".18" />}
                <circle cx={x} cy={y} r={isOrigin ? 12 : isPlayed ? 9 : 6}
                  fill={isOrigin ? 'var(--orange)' : isPlayed ? 'var(--ink)' : '#b5a98f'} stroke="#fffaf2" strokeWidth="3" />
                <text x={x} y={y + (isOrigin ? 40 : 32)} textAnchor="middle" fontFamily="DM Sans, sans-serif"
                  fontSize={isOrigin ? 21 : 17} fontWeight={isOrigin || isPlayed ? 800 : 600} fill={isOrigin || isPlayed ? 'var(--ink)' : '#6c756f'}>
                  {MUNICIPALITY_NAMES[key]}
                </text>
              </g>
            );
          })}
        </svg>
        <ul className="m-0 mt-2 flex list-none flex-wrap gap-x-5 gap-y-1 px-2 pb-1 text-[13px] font-semibold text-[#3f514a]">
          <li className="inline-flex items-center gap-2"><span className="size-3 rounded-full bg-orange" aria-hidden="true" />Reside aquí</li>
          {played.size > 0 && <li className="inline-flex items-center gap-2"><span className="size-3 rounded-full bg-ink" aria-hidden="true" />Se ha presentado</li>}
        </ul>
      </div>

      <div>
        <p className="m-0 inline-flex items-center gap-2 rounded-full bg-[rgba(216,91,54,.1)] py-1.5 px-3.5 text-[14px] font-bold text-[#a8431f]">
          <Icon name="pin" className="size-4" /> Reside en {MUNICIPALITY_NAMES[origin] || 'el Bajo Cauca'}
        </p>
        <ul className="mt-4 mb-0 grid list-none p-0">
          {venues.map((venue, index) => (
            <li key={index} className="relative flex items-start gap-3 pb-4 last:pb-0">
              {index < venues.length - 1 && <span className="absolute left-[10px] top-6 bottom-0 border-l-2 border-dotted border-l-ink" aria-hidden="true" />}
              <svg viewBox="0 0 24 24" className="relative size-[22px] shrink-0 text-ink" fill="currentColor" aria-hidden="true">
                <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />
              </svg>
              <p className="m-0 text-[17px] leading-[1.3] text-ink [overflow-wrap:anywhere]">
                {venue.name}
                {venue.municipality && <span className="text-[14px] text-[#53645c]"> · {MUNICIPALITY_NAMES[venue.municipality]}</span>}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
