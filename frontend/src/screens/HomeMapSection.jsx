import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import {
  MUNICIPALITIES_DATA,
  MUNICIPALITY_LOCATION_MAP,
  MUNICIPALITY_SVG_POSITIONS,
  normalizeText
} from '../utils/constants.js';
import Icon from '../components/Icon.jsx';
import { BADGE, SECTION_TITLE } from '../components/uiStyles.js';

// La parte HTML usa utilidades. El arte SVG del mapa (region, rutas, rio, particulas,
// anillos y contadores por municipio) conserva sus clases propias en CSS: son
// animaciones y trazos SVG, y el JS busca `.geo-muni` para los eventos.
const PILL = 'font-bold uppercase rounded-[999px] inline-block';
const TAG = 'text-ink bg-[#f3e4c8] font-semibold rounded-[999px]';

function groupPubsByMunicipality(publications) {
  const groups = {};
  Object.keys(MUNICIPALITY_LOCATION_MAP).forEach((key) => {
    groups[key] = [];
  });
  publications.forEach((pub) => {
    const location = normalizeText(pub.location || '');
    for (const [muni, keywords] of Object.entries(MUNICIPALITY_LOCATION_MAP)) {
      if (keywords.some((kw) => location.includes(normalizeText(kw)))) {
        groups[muni].push(pub);
        return;
      }
    }
    groups.caucasia.push(pub);
  });
  return groups;
}

export default function HomeMapSection({ publications = [] }) {
  const mapRef = useRef(null);
  const [selectedMunicipality, setSelectedMunicipality] = useState(null);
  const [hoveredMunicipality, setHoveredMunicipality] = useState(null);
  // Ancla del punto (relativa al contenedor exterior y al viewport) y colocacion final de la
  // tarjeta, que se calcula midiendo la tarjeta real (ver useLayoutEffect).
  const [hoverAnchor, setHoverAnchor] = useState(null);
  const [hoverPlacement, setHoverPlacement] = useState({ left: 0, top: 0, below: false });
  const cardRef = useRef(null);

  const pubsByMunicipality = groupPubsByMunicipality(publications);

  useEffect(() => {
    if (!mapRef.current) return;
    const municipalities = mapRef.current.querySelectorAll('.geo-muni');

    municipalities.forEach((muni) => {
      muni.addEventListener('mouseenter', () => {
        const name = muni.getAttribute('data-name');
        setHoveredMunicipality(MUNICIPALITIES_DATA[name]);
        const rect = muni.getBoundingClientRect();
        const containerRect = mapRef.current.getBoundingClientRect();
        setHoverAnchor({
          x: rect.left - containerRect.left + rect.width / 2,
          top: rect.top - containerRect.top - 10,
          bottom: rect.bottom - containerRect.top + 10,
          viewportTop: rect.top,
          containerLeft: containerRect.left,
        });
      });

      muni.addEventListener('mouseleave', () => {
        setHoveredMunicipality(null);
      });

      muni.addEventListener('click', () => {
        const name = muni.getAttribute('data-name');
        setSelectedMunicipality(MUNICIPALITIES_DATA[name]);
      });

      muni.style.cursor = 'pointer';
    });
  }, []);

  // Coloca la tarjeta antes del primer pintado: arriba del punto (como siempre) si cabe bajo
  // el header fijo; si no, debajo. En horizontal se acota al viewport para no salirse por
  // los lados en los puntos de borde ni en movil.
  useLayoutEffect(() => {
    if (!hoveredMunicipality || !hoverAnchor || !cardRef.current) return;
    const { offsetWidth: width, offsetHeight: height } = cardRef.current;
    const header = document.querySelector('header');
    const topLimit = Math.max(0, header ? header.getBoundingClientRect().bottom : 0) + 8;
    const below = hoverAnchor.viewportTop - 10 - height < topLimit;
    const minLeft = width / 2 + 8 - hoverAnchor.containerLeft;
    const maxLeft = window.innerWidth - width / 2 - 8 - hoverAnchor.containerLeft;
    setHoverPlacement({
      left: Math.min(Math.max(hoverAnchor.x, minLeft), maxLeft),
      top: below ? hoverAnchor.bottom : hoverAnchor.top,
      below,
    });
  }, [hoveredMunicipality, hoverAnchor]);

  return (
    <section className="py-20 px-[7vw] bg-[radial-gradient(ellipse_60%_40%_at_30%_60%,rgba(29,143,163,0.04)_0%,transparent_100%),radial-gradient(ellipse_50%_50%_at_70%_30%,rgba(212,168,67,0.03)_0%,transparent_100%),linear-gradient(180deg,transparent_0%,rgba(29,143,163,0.02)_50%,transparent_100%)] max768:py-[50px] max768:px-[5vw]">
      <div className="text-center mb-12 max480:mb-8">
        <span className={BADGE}>Geografía</span>
        <h2 className={SECTION_TITLE}>Nuestros <em className="text-sunset font-display italic">seis</em> municipios</h2>
        <p className="text-[15px] text-muted mt-3 mx-0 mb-0 font-medium">Un recorrido por el Bajo Cauca Antioqueño</p>
      </div>

      {/* Dos capas: el contenedor exterior (sin recorte, z-1 para quedar sobre la lista de
          municipios y bajo el header z-5) es la capa de interaccion donde vive la tarjeta; el
          marco interior conserva overflow-hidden y las esquinas del arte. */}
      <div className="relative z-1 max-w-[1020px] my-0 mx-auto" ref={mapRef}>
      <div className="relative overflow-hidden pt-10 px-12 pb-8 bg-[linear-gradient(160deg,#fefefe_0%,#f8f5ee_40%,#f0efe8_100%)] rounded-[28px] [box-shadow:0_24px_80px_rgba(18,60,52,0.07),0_0_0_1px_rgba(18,60,52,0.04),inset_0_1px_0_rgba(255,255,255,0.9)] before:content-[''] before:absolute before:inset-0 before:bg-[radial-gradient(ellipse_at_40%_50%,rgba(29,143,163,0.03)_0%,transparent_70%)] before:pointer-events-none max768:pt-6 max768:px-5 max768:pb-5 max768:rounded-[22px]">
        <svg className="w-full h-auto block" viewBox="0 0 800 560" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="geoGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#1d8fa3" stopOpacity="0.25"/>
              <stop offset="100%" stopColor="#1d8fa3" stopOpacity="0"/>
            </radialGradient>
            <linearGradient id="riverGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1d8fa3" stopOpacity="0.15"/>
              <stop offset="40%" stopColor="#1d8fa3" stopOpacity="0.55"/>
              <stop offset="60%" stopColor="#1d8fa3" stopOpacity="0.55"/>
              <stop offset="100%" stopColor="#1d8fa3" stopOpacity="0.15"/>
            </linearGradient>
            <linearGradient id="regionFill" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f5e6c4" stopOpacity="0.18"/>
              <stop offset="50%" stopColor="#e8f4f8" stopOpacity="0.12"/>
              <stop offset="100%" stopColor="#f5e6c4" stopOpacity="0.18"/>
            </linearGradient>
            <linearGradient id="pathDash" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#1d8fa3" stopOpacity="0"/>
              <stop offset="15%" stopColor="#1d8fa3" stopOpacity="0.3"/>
              <stop offset="85%" stopColor="#1d8fa3" stopOpacity="0.3"/>
              <stop offset="100%" stopColor="#1d8fa3" stopOpacity="0"/>
            </linearGradient>
            <filter id="softGlow">
              <feGaussianBlur stdDeviation="4" result="blur"/>
              <feMerge>
                <feMergeNode in="blur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            <filter id="bigGlow">
              <feGaussianBlur stdDeviation="8" result="blur"/>
              <feMerge>
                <feMergeNode in="blur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          <path
            className="geo-region"
            d="M140,55 Q180,30 340,35 Q500,30 620,55 Q680,75 685,140 Q690,220 670,300 Q650,380 600,430 Q530,480 400,490 Q270,495 180,450 Q110,410 85,340 Q60,270 70,190 Q80,100 140,55 Z"
            fill="url(#regionFill)"
            stroke="#1d8fa3"
            strokeWidth="1.5"
            strokeOpacity="0.2"
          />

          <g className="geo-routes">
            <path className="geo-route" d="M195,210 Q260,160 235,128" strokeDasharray="6 8"/>
            <path className="geo-route" d="M235,128 Q280,100 335,135" strokeDasharray="6 8"/>
            <path className="geo-route" d="M335,135 Q410,150 490,148" strokeDasharray="6 8"/>
            <path className="geo-route" d="M195,210 Q250,280 215,350" strokeDasharray="6 8"/>
            <path className="geo-route" d="M365,225 Q390,280 365,340" strokeDasharray="6 8"/>
            <path className="geo-route" d="M490,148 Q430,200 365,225" strokeDasharray="6 8"/>
          </g>

          <path className="geo-river" d="M90,120 Q160,160 230,195 Q340,230 460,260 Q540,285 620,320" stroke="url(#riverGrad)" strokeWidth="12" strokeLinecap="round" fill="none"/>
          <path className="geo-river-flow" d="M90,120 Q160,160 230,195 Q340,230 460,260 Q540,285 620,320" stroke="url(#riverGrad)" strokeWidth="6" strokeLinecap="round" fill="none"/>
          <path className="geo-river geo-river-tributary" d="M210,70 Q230,120 250,175 Q270,240 290,290" stroke="url(#riverGrad)" strokeWidth="7" strokeLinecap="round" fill="none"/>

          <g className="geo-particles">
            <circle className="geo-particle p1" cx="150" cy="180" r="2"/>
            <circle className="geo-particle p2" cx="300" cy="90" r="1.5"/>
            <circle className="geo-particle p3" cx="500" cy="200" r="2"/>
            <circle className="geo-particle p4" cx="250" cy="350" r="1.5"/>
            <circle className="geo-particle p5" cx="580" cy="300" r="2"/>
            <circle className="geo-particle p6" cx="420" cy="400" r="1.5"/>
            <circle className="geo-particle p7" cx="130" cy="300" r="1.8"/>
            <circle className="geo-particle p8" cx="620" cy="150" r="1.5"/>
          </g>

          <g className="geo-municipalities">
            <g className="geo-muni caucasia" data-name="caucasia">
              <circle className="muni-ring ring-outer" cx="365" cy="225" r="28" />
              <circle className="muni-ring ring-mid" cx="365" cy="225" r="20" />
              <circle className="muni-dot" cx="365" cy="225" r="10" />
              <circle className="muni-core" cx="365" cy="225" r="4" />
              <text className="muni-name" x="365" y="268">Caucasia</text>
              <text className="muni-role" x="365" y="286">Capital</text>
            </g>
            <g className="geo-muni caceres" data-name="caceres">
              <circle className="muni-ring ring-outer" cx="195" cy="210" r="22" />
              <circle className="muni-ring ring-mid" cx="195" cy="210" r="16" />
              <circle className="muni-dot" cx="195" cy="210" r="8" />
              <circle className="muni-core" cx="195" cy="210" r="3.5" />
              <text className="muni-name" x="195" y="248">Cáceres</text>
              <text className="muni-role" x="195" y="264">Historia</text>
            </g>
            <g className="geo-muni taraza" data-name="taraza">
              <circle className="muni-ring ring-outer" cx="235" cy="128" r="22" />
              <circle className="muni-ring ring-mid" cx="235" cy="128" r="16" />
              <circle className="muni-dot" cx="235" cy="128" r="8" />
              <circle className="muni-core" cx="235" cy="128" r="3.5" />
              <text className="muni-name" x="235" y="166">Tarazá</text>
              <text className="muni-role" x="235" y="182">Café</text>
            </g>
            <g className="geo-muni nechi" data-name="nechi">
              <circle className="muni-ring ring-outer" cx="335" cy="135" r="22" />
              <circle className="muni-ring ring-mid" cx="335" cy="135" r="16" />
              <circle className="muni-dot" cx="335" cy="135" r="8" />
              <circle className="muni-core" cx="335" cy="135" r="3.5" />
              <text className="muni-name" x="335" y="173">Nechí</text>
              <text className="muni-role" x="335" y="189">Río</text>
            </g>
            <g className="geo-muni elbagre" data-name="elbagre">
              <circle className="muni-ring ring-outer" cx="490" cy="148" r="22" />
              <circle className="muni-ring ring-mid" cx="490" cy="148" r="16" />
              <circle className="muni-dot" cx="490" cy="148" r="8" />
              <circle className="muni-core" cx="490" cy="148" r="3.5" />
              <text className="muni-name" x="490" y="186">El Bagre</text>
              <text className="muni-role" x="490" y="202">Oro</text>
            </g>
            <g className="geo-muni zaragoza" data-name="zaragoza">
              <circle className="muni-ring ring-outer" cx="215" cy="350" r="22" />
              <circle className="muni-ring ring-mid" cx="215" cy="350" r="16" />
              <circle className="muni-dot" cx="215" cy="350" r="8" />
              <circle className="muni-core" cx="215" cy="350" r="3.5" />
              <text className="muni-name" x="215" y="388">Zaragoza</text>
              <text className="muni-role" x="215" y="404">Fundación</text>
            </g>
          </g>

          <g className="geo-pub-dots">
            {Object.entries(pubsByMunicipality).map(([muni, pubs]) => {
              if (pubs.length === 0) return null;
              const pos = MUNICIPALITY_SVG_POSITIONS[muni];
              if (!pos) return null;
              return (
                <g key={muni} className="geo-pub-group"
                  onMouseEnter={() => {}}
                  onMouseLeave={() => {}}
                >
                  <circle className="pub-halo" cx={pos.x} cy={pos.y} r={14 + pubs.length * 2} fill="none" stroke="#1d8fa3" strokeWidth="1" strokeOpacity="0.3"/>
                  <circle className="pub-counter-bg" cx={pos.x} cy={pos.y} r={10} fill="#1d8fa3" fillOpacity="0.9"/>
                  <text className="pub-counter-text" x={pos.x} y={pos.y + 1} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="8" fontWeight="800">
                    {pubs.length}
                  </text>
                </g>
              );
            })}
          </g>

          <text x="400" y="530" className="geo-map-title">BAJO CAUCA ANTIOQUEÑO</text>
        </svg>
      </div>

        {hoveredMunicipality && (
          <div ref={cardRef} className={`absolute bg-white rounded-[18px] overflow-hidden [box-shadow:0_16px_48px_rgba(18,60,52,0.14),0_0_0_1px_rgba(18,60,52,0.06)] w-[260px] z-20 pointer-events-none max768:w-[220px] ${hoverPlacement.below ? '[transform:translate(-50%,0)] animate-[geoHoverInBelow_0.25s_cubic-bezier(.34,1.56,.64,1)]' : '[transform:translate(-50%,-100%)] animate-[geoHoverIn_0.25s_cubic-bezier(.34,1.56,.64,1)]'}`} style={{ left: hoverPlacement.left, top: hoverPlacement.top }}>
            <div className="relative h-[110px] bg-cover bg-center bg-cream after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-10 after:bg-[linear-gradient(transparent,white)]" style={{backgroundImage: `url(${hoveredMunicipality.image})`}}></div>
            <div className="pt-4 px-[18px] pb-[18px]">
              <span className={`${PILL} text-[9px] tracking-[0.12em] text-[#1d8fa3] bg-[rgba(29,143,163,0.08)] py-1 px-2.5 mb-2`}>Municipio</span>
              <h4 className="text-[17px] font-extrabold mt-0 mx-0 mb-0.5 text-ink">{hoveredMunicipality.name}</h4>
              <p className="text-[12px] font-semibold text-[#d4a843] mt-0! mx-0! mb-2!">{hoveredMunicipality.title}</p>
              <p className="text-[12px] leading-[1.45] text-muted mt-0 mx-0 mb-2.5 line-clamp-3">{hoveredMunicipality.description}</p>
              <div className="flex gap-1.5 flex-wrap">
                {hoveredMunicipality.tags.map((tag, i) => (
                  <span key={i} className={`${TAG} text-[10px] py-[3px] px-2`}>{tag}</span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="max-w-[900px] mt-8 mx-auto mb-0 grid grid-cols-[repeat(3,1fr)] gap-3 max768:grid-cols-[repeat(2,1fr)] max480:grid-cols-[1fr]">
        {Object.entries(MUNICIPALITIES_DATA).map(([key, muni], index) => (
          <button
            key={key}
            className="group flex items-center gap-3 py-3.5 px-4 bg-white border border-[rgba(18,60,52,0.06)] rounded-[14px] cursor-pointer relative overflow-hidden transition-all duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] [box-shadow:0_4px_16px_rgba(18,60,52,0.04)] text-left animate-[geoCardIn_0.5s_cubic-bezier(.34,1.56,.64,1)_both] hover:[transform:translateY(-3px)] hover:[box-shadow:0_8px_28px_rgba(18,60,52,0.1)] hover:border-[rgba(29,143,163,0.15)]"
            style={{ animationDelay: `${index * 0.1}s` }}
            onClick={() => setSelectedMunicipality(muni)}
          >
            <div className="w-1 h-9 rounded-[4px] shrink-0" style={{
              background: `linear-gradient(135deg, ${
                index === 0 ? '#d4a843' :
                index === 1 ? '#1d8fa3' :
                index === 2 ? '#75b79b' :
                index === 3 ? '#1d8fa3' :
                index === 4 ? '#d4a843' :
                '#8a4f7d'
              }, transparent)`
            }}></div>
            <div className="flex-1 min-w-0">
              <h4 className="text-[14px] font-bold m-0 text-ink">{muni.name}</h4>
              <p className="text-[11px] text-muted mt-0.5 mx-0 mb-0 font-medium">{muni.title}</p>
            </div>
            <Icon name="arrow-right" className="size-[18px] text-ink opacity-0 transition-opacity duration-300 ease-[ease] group-hover:opacity-100 group-focus-visible:opacity-100" />
          </button>
        ))}
      </div>

      {selectedMunicipality && (
        <div className="fixed top-0 left-0 right-0 bottom-0 bg-[rgba(0,0,0,0.7)] backdrop-blur-[8px] flex items-center justify-center z-1000 p-5 animate-[fadeIn_0.3s_ease]" onClick={() => setSelectedMunicipality(null)}>
          <div className="bg-white rounded-[24px] max-w-[500px] w-full overflow-hidden [box-shadow:0_32px_80px_rgba(0,0,0,0.3)] animate-[slideUp_0.4s_cubic-bezier(0.175,0.885,0.32,1.275)] relative" onClick={(e) => e.stopPropagation()}>
            <button className="absolute top-4 right-4 w-9 h-9 bg-[rgba(255,255,255,0.9)] border-none rounded-[50%] cursor-pointer flex items-center justify-center z-10 transition-all duration-300 ease-[ease] hover:bg-white" onClick={() => setSelectedMunicipality(null)} aria-label="Cerrar">
              <Icon name="close" className="size-5 text-ink" />
            </button>
            <div className="h-[200px] bg-cover bg-center bg-cream" style={{backgroundImage: `url(${selectedMunicipality.image})`}}></div>
            <div className="p-7">
              <span className={`${PILL} bg-[rgba(29,143,163,0.1)] text-[#1d8fa3] text-[11px] tracking-[0.1em] py-1.5 px-3 mb-3`}>Municipio</span>
              <h3 className="font-sans tracking-[-.055em] text-[28px] font-extrabold mt-0 mx-0 mb-1.5 text-ink">{selectedMunicipality.name}</h3>
              <p className="text-[16px] font-semibold text-[#d4a843] mt-0 mx-0 mb-4">{selectedMunicipality.title}</p>
              <p className="text-[14px] leading-[1.6] text-muted mt-0 mx-0 mb-5">{selectedMunicipality.description}</p>
              <div className="flex gap-2 flex-wrap">
                {selectedMunicipality.tags.map((tag, index) => (
                  <span key={index} className={`${TAG} text-[12px] py-1.5 px-3`}>{tag}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
