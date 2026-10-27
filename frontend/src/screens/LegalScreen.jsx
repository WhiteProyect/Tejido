import { useReducedMotion } from 'framer-motion';
import { EYEBROW, H1, SECTION } from '../components/uiStyles.js';
import { LEGAL_UPDATED, PRIVACY, TERMS } from './legal/legalContent.jsx';

// Terminos y condiciones (#terminos) y Politica de privacidad (#privacidad): una sola pantalla con
// dos variantes; los textos viven en legal/legalContent.jsx. Indice de secciones (al lado en
// pantallas anchas, arriba en las angostas): como el sitio enruta por hash, los enlaces del indice
// no cambian la URL; desplazan hasta la seccion (sin animar si se prefiere menos movimiento) y le
// pasan el foco. La transicion de entrada la pone App, como en todas las pantallas.
const DOCS = { terminos: TERMS, privacidad: PRIVACY };
const H2 = 'm-0 font-sans text-[26px] font-extrabold leading-[1.2] tracking-[-0.03em] text-ink scroll-mt-28 focus:outline-none';
const TOC_LINK = 'block rounded-[8px] py-1.5 px-2 text-[14px] font-semibold leading-[1.35] text-[#3f514a] no-underline hover:bg-cream hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink';

function updatedLabel() {
  const [year, month, day] = LEGAL_UPDATED.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function LegalScreen({ doc = 'terminos' }) {
  const reduceMotion = useReducedMotion();
  const content = DOCS[doc] || TERMS;
  const other = doc === 'privacidad'
    ? ['terminos', 'Lee también nuestros', 'términos y condiciones']
    : ['privacidad', 'Lee también nuestra', 'política de privacidad'];

  function goTo(event, id) {
    event.preventDefault();
    const heading = document.getElementById(`legal-${id}`);
    if (!heading) return;
    heading.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    heading.focus({ preventScroll: true });
  }

  return (
    <article className={`${SECTION} min-h-[62vh]`}>
      <header className="max-w-[820px]">
        <p className={EYEBROW}>{content.eyebrow}</p>
        <h1 className={`${H1} [overflow-wrap:anywhere]`}>{content.title}</h1>
        <p className="mt-5 mb-0 text-[18px] leading-[1.6] text-[#53645c]">{content.intro}</p>
        <p className="mt-4 mb-0 text-[14px] font-semibold text-[#53645c]">
          Última actualización: <time dateTime={LEGAL_UPDATED}>{updatedLabel()}</time>
        </p>
      </header>

      <div className="mt-12 grid grid-cols-[260px_minmax(0,1fr)] items-start gap-14 max1024:grid-cols-[minmax(0,1fr)] max1024:gap-8">
        {/* div con role y no <nav>: el CSS legado oculta la etiqueta nav en movil. */}
        <div role="navigation" aria-label={`Contenido de ${content.title}`}
          className="sticky top-28 rounded-[20px] border border-[#e2d9ca] bg-[#fffaf2] p-4 max1024:static">
          <p className="m-0 mb-2 px-2 text-[11px] font-extrabold uppercase tracking-[.16em] text-[#53645c]">En esta página</p>
          <ol className="m-0 grid list-none gap-0.5 p-0">
            {content.sections.map((section, index) => (
              <li key={section.id}>
                <a className={TOC_LINK} href={`#${doc}`} onClick={(event) => goTo(event, section.id)}>
                  <span className="text-muted">{index + 1}.</span> {section.title}
                </a>
              </li>
            ))}
          </ol>
        </div>

        <div className="grid min-w-0 max-w-[760px] gap-10">
          {content.sections.map((section, index) => (
            <section key={section.id} aria-labelledby={`legal-${section.id}`} className="grid gap-4">
              <h2 id={`legal-${section.id}`} tabIndex={-1} className={H2}>
                <span className="text-river">{index + 1}.</span> {section.title}
              </h2>
              {section.body}
            </section>
          ))}
          <p className="m-0 border-t border-t-line pt-6 text-[15px] text-[#53645c]">
            {other[1]}{' '}
            <a className="font-bold text-river underline decoration-[rgba(29,143,163,.35)] underline-offset-4 hover:decoration-river focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink" href={`#${other[0]}`}>
              {other[2]}
            </a>.
          </p>
        </div>
      </div>
    </article>
  );
}
