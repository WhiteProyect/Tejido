import { useId, useState } from 'react';
import { CARD, SECTION_LABEL } from './talentUi.js';

// Tarjeta de la fila "Qué ofrece / Ficha técnica / Disponibilidad". En escritorio es una tarjeta
// abierta; en movil es un acordeon con borde de tinta (boton con aria-expanded que muestra u
// oculta el contenido). `hint` ("(3 servicios)") solo se ve en el acordeon.
export default function InfoCard({ label, hint, mobile, children }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  if (!mobile) {
    return (
      <section className={CARD} aria-labelledby={`${id}-title`}>
        <h2 id={`${id}-title`} className={SECTION_LABEL}>{label}</h2>
        <div className="mt-4">{children}</div>
      </section>
    );
  }

  return (
    <section className="rounded-[8px] border-[1.5px] border-ink bg-[#fffdf7]">
      <h2 className="m-0 font-sans text-[17px] leading-normal">
        <button type="button" aria-expanded={open} aria-controls={`${id}-panel`} onClick={() => setOpen(!open)}
          className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-[7px] border-0 bg-transparent py-3 px-4 text-left font-sans text-[17px] font-bold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
          <span>{label}{hint && <span className="font-normal"> {hint}</span>}</span>
          <svg className={`size-5 shrink-0 transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </h2>
      <div id={`${id}-panel`} hidden={!open} className="border-t border-t-[#e3d6bf] px-4 pt-3 pb-4">{children}</div>
    </section>
  );
}
