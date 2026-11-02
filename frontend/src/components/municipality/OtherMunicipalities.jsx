import { useReducedMotion } from 'framer-motion';
import MunicipalityPill from './MunicipalityPill.jsx';
import { MUNICIPALITY_LIST } from '../../utils/municipalities.js';

// Modulo 7: "Sigue tejiendo el Bajo Cauca": las mismas pildoras del hub para los otros cinco
// municipios, flotando con su desfase. Navegan normal (sin morph): arriba y la portada en cascada.
// Lleva `block`: el estilo base de tailwind.css le da a todo <nav> display flex y lo oculta en
// <= 800 px (pensado para la barra del header).
export default function OtherMunicipalities({ current }) {
  const reduceMotion = useReducedMotion();
  const others = MUNICIPALITY_LIST.filter((municipality) => municipality.slug !== current);
  return (
    <nav aria-labelledby="municipio-otros" className="block rounded-2xl bg-[#e8e2d4] p-6 text-center text-[16px] font-normal">
      <h2 id="municipio-otros" className="m-0 font-sans text-[13px] font-bold uppercase leading-[1.5] tracking-[.16em] text-ink">
        Sigue tejiendo el Bajo Cauca (los otros 5 municipios)
      </h2>
      <p className="mt-2 mb-0 font-display text-[19px] italic leading-[1.5] text-ink">
        «Salta a otro rincón del territorio para seguir tejiendo el Bajo Cauca»
      </p>
      <ul className="mt-5 flex list-none flex-wrap justify-center gap-3 p-0 max480:flex-col max480:items-center">
        {others.map((municipality, index) => (
          <li
            key={municipality.slug}
            style={reduceMotion ? undefined : { animation: `muniFloat ${5.2 + index * 0.65}s ease-in-out ${-index * 1.4}s infinite` }}
          >
            <MunicipalityPill municipality={municipality} />
          </li>
        ))}
      </ul>
    </nav>
  );
}
