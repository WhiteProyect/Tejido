import { useEffect, useRef, useState } from 'react';
import WovenMap from '../components/geo/WovenMap.jsx';
import MunicipalityPill from '../components/municipality/MunicipalityPill.jsx';
import { SECTION_TITLE } from '../components/uiStyles.js';
import { consumeMapReturn, markMapReturn } from '../utils/mapReturn.js';
import { MUNICIPALITY_LIST } from '../utils/municipalities.js';

// Seccion Geografia del inicio ("Mapa vivo del Bajo Cauca"): el mapa tejido (components/geo/WovenMap.jsx),
// la etiqueta regional fuera del contenedor y, en movil, las pildoras de los 6 municipios como atajo.
// Cada municipio abre #municipio/<slug>; al volver al inicio (marca de utils/mapReturn.js) la seccion
// se pone a la vista en lugar de dejar la pagina arriba.
const NARROW_QUERY = '(max-width: 768px)';

// Cuenta por el municipio de cada publicacion (publication.municipality). Las que aun no lo tienen
// (anteriores al campo, sin rellenar) no cuentan en ninguno.
function countByMunicipality(publications) {
  const counts = Object.fromEntries(MUNICIPALITY_LIST.map(({ slug }) => [slug, 0]));
  publications.forEach((pub) => {
    if (pub.municipality in counts) counts[pub.municipality] += 1;
  });
  return counts;
}

function plainClick(event) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export default function HomeMapSection({ publications = [] }) {
  const sectionRef = useRef(null);
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW_QUERY).matches);

  useEffect(() => {
    const media = window.matchMedia(NARROW_QUERY);
    const handle = () => setNarrow(media.matches);
    media.addEventListener('change', handle);
    return () => media.removeEventListener('change', handle);
  }, []);

  useEffect(() => {
    if (consumeMapReturn()) sectionRef.current?.scrollIntoView({ block: 'start' });
  }, []);

  const counts = countByMunicipality(publications);

  return (
    <section id="geografia" ref={sectionRef} aria-labelledby="geografia-titulo" className="scroll-mt-4 py-20 px-[7vw] max768:py-[50px] max768:px-4">
      <div className="mb-12 text-center max480:mb-8">
        <span className="mb-4 inline-block rounded-full bg-[#e8e2d4] py-1.5 px-4 text-[12px] font-bold tracking-[0.06em] text-ink">Geografía</span>
        <h2 id="geografia-titulo" className={`${SECTION_TITLE} text-ink`}>
          Nuestros <em className="font-display italic text-[#d85b36]">seis</em> municipios
        </h2>
        <p className="mt-3 mx-0 mb-0 text-[15px] font-medium text-muted">Un recorrido por el Bajo Cauca Antioqueño</p>
      </div>

      <div className="mx-auto max-w-[1180px]">
        <WovenMap counts={counts} narrow={narrow} />
        <p className="mt-4 mb-0 pl-[0.4em] text-center text-[13px] font-bold uppercase tracking-[0.4em] text-[#66746f]">Bajo Cauca Antioqueño</p>

        {narrow && (
          <nav aria-label="Municipios del Bajo Cauca" className="mt-6 block">
            <ul className="m-0 flex list-none flex-wrap justify-center gap-3 p-0">
              {MUNICIPALITY_LIST.map((municipality) => (
                <li key={municipality.slug}>
                  <MunicipalityPill municipality={municipality} onClick={(event) => { if (plainClick(event)) markMapReturn(); }} />
                </li>
              ))}
            </ul>
          </nav>
        )}

        <p className="mt-5 mb-0 text-center text-[12px] text-[#53645c]">
          Límites municipales: DANE, MGN 2025. Ríos: ©{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="text-[#53645c] underline underline-offset-2">colaboradores de OpenStreetMap</a>.
        </p>
      </div>
    </section>
  );
}
