import { motion } from 'framer-motion';

// Pildora de municipio, igual en el hub (#municipios) y en "Sigue tejiendo" (modulo 7): tinta, punto
// dorado decorativo, nombre y flecha. Es un enlace de verdad (<a href="#municipio/<slug>">): quien
// la usa decide si intercepta el clic (el hub, para su animacion) o deja navegar normal.
// Hover: fondo mas claro, punto amarillo, la flecha sube en diagonal y la pildora se eleva (con la
// propiedad `translate` de Tailwind, aparte del `transform` que usa framer-motion).
// Foco: contorno dorado de 2 px con separacion y, por fuera, un anillo de tinta: el dorado solo no
// llega a 3:1 sobre los fondos claros (1.7-2.1:1).
const PILL = 'group inline-flex min-h-11 items-center gap-2.5 rounded-full border-0 bg-[#173f36] py-3.5 px-7 font-bold text-[#fdfbf7] no-underline shadow-sm ring-0 transition-[background-color,translate,box-shadow] duration-200 hover:-translate-y-0.5 hover:bg-[#1f5246] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4a843] focus-visible:shadow-[0_0_0_6px_#173f36] motion-reduce:transition-none motion-reduce:hover:translate-y-0';

export default function MunicipalityPill({ municipality, arrow = true, className = '', ...props }) {
  return (
    <motion.a href={`#municipio/${municipality.slug}`} className={`${PILL} ${className}`} {...props}>
      <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-[#d4a843] transition-colors duration-200 group-hover:bg-yellow" />
      {municipality.name}
      {arrow && (
        <span aria-hidden="true" className="inline-block transition-[translate] duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none">↗</span>
      )}
    </motion.a>
  );
}
