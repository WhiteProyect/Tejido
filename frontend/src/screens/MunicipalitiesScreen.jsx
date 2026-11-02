import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import MunicipalityPill from '../components/municipality/MunicipalityPill.jsx';
import { EYEBROW, SCREEN_SECTION } from '../components/uiStyles.js';
import { MUNICIPALITY_LIST } from '../utils/municipalities.js';
import { startMorph } from '../utils/municipalityTransition.js';

// Hub de municipios: #municipios. Seis pildoras iguales (MunicipalityPill) que flotan despacio, cada
// una con su desfase. Al hacer clic (o Enter) en una:
//   0-140 ms: rebote de la pulsada (0.95 -> 1.08) y las otras cinco se desvanecen (0.9).
//   ~140 ms: arriba del todo y cambio de hash; la pildora se expande hasta la portada del municipio
//   (MunicipalityCover, con la caja que se guarda aqui) y alli entra el contenido en cascada.
// Solo se intercepta el clic izquierdo sin modificadores: Ctrl/Cmd/Shift/clic central abren como un
// enlace normal. Durante la animacion se ignoran los clics. Con movimiento reducido: sin flotacion
// ni animacion, el enlace navega directo.
// El flote (CSS, muniFloat) va en el <li> y el rebote/morph (framer-motion) en el enlace, para que
// sus transform no se pisen.
const BOUNCE_MS = 140;

export default function MunicipalitiesScreen() {
  const reduceMotion = useReducedMotion();
  const [leaving, setLeaving] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    document.title = 'Municipios · TEJIDO';
    return () => window.clearTimeout(timer.current);
  }, []);

  function handleClick(event, slug) {
    const pill = event.currentTarget;
    if (reduceMotion) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (leaving) return;
    setLeaving(slug);
    timer.current = window.setTimeout(() => {
      window.scrollTo(0, 0);
      // Caja visible de la pildora (con el scroll ya en 0 y su escala del rebote): de ahi crece la portada.
      startMorph(slug, pill.getBoundingClientRect());
      window.location.hash = `municipio/${slug}`;
    }, BOUNCE_MS);
  }

  const pillState = (slug) => {
    if (!leaving) return { opacity: 1, scale: 1 };
    return leaving === slug ? { opacity: 1, scale: [1, 0.95, 1.08] } : { opacity: 0, scale: 0.9 };
  };

  return (
    <section className={SCREEN_SECTION} aria-labelledby="municipios-titulo">
      <div className="mx-auto max-w-[980px] text-center">
        <p className={EYEBROW}>Bajo Cauca antioqueño</p>
        <h1 id="municipios-titulo" className="m-0 font-sans text-[length:clamp(40px,6vw,76px)] font-extrabold leading-[1] tracking-[-0.05em] text-ink">
          Municipios del <em className="font-display italic font-bold text-purple">Bajo Cauca</em>
        </h1>
        <div className="mx-auto mt-10 max-w-[720px] rounded-2xl bg-[#f5f2eb] py-10 px-8 max600:py-8 max600:px-4">
          <p className="m-0 font-display text-[length:clamp(20px,2.4vw,26px)] italic leading-[1.45] text-ink">
            Elige un territorio y entra a su memoria, su gente y su talento.
          </p>
          <ul className="mt-8 flex list-none flex-col items-center gap-4 p-0 md:mx-auto md:grid md:max-w-[520px] md:grid-cols-2 md:justify-items-center">
            {MUNICIPALITY_LIST.map((municipality, index) => (
              <li
                key={municipality.slug}
                style={reduceMotion ? undefined : { animation: `muniFloat ${5.2 + index * 0.65}s ease-in-out ${-index * 1.4}s infinite` }}
              >
                <MunicipalityPill
                  municipality={municipality}
                  initial={false}
                  animate={pillState(municipality.slug)}
                  transition={{ duration: BOUNCE_MS / 1000, ease: 'easeOut' }}
                  onClick={(event) => handleClick(event, municipality.slug)}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
