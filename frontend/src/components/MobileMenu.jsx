import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Logo from './Logo.jsx';
import ThreadsIcon from './ThreadsIcon.jsx';
import { MUNICIPALITY_LIST } from '../utils/municipalities.js';
import { NAV_COMPACT_QUERY, NAV_DESCRIPTIONS, NAV_LINKS } from '../utils/navSections.js';

// Menu movil (por debajo de NAV_COMPACT_QUERY): panel a la derecha, en un portal a <body> (el header
// tiene transform y un `fixed` dentro de el quedaria atrapado en su caja). En telefonos ocupa todo
// el ancho; desde 640 px es un cajon de 384 px. Cuatro zonas: cabecera "telar" (logo crema y cierre
// en el mismo sitio que el boton del header, barra de 4 hilos), frase, enlaces (sin Municipios, que
// cubre el bloque de territorios) con Moneystack aparte, y territorios + cuenta.
// Dialogo modal: el resto de la app queda `inert` (no se llega con Tab ni con el lector) y Tab da la
// vuelta dentro del panel; foco al cierre al abrir. Esc, el boton de cierre y el velo cierran pidiendo
// devolver el foco al boton del header (onClose(true)); un enlace, un cambio de hash o ensanchar la
// ventana cierran sin devolverlo (onClose(false)). Scroll del body bloqueado mientras esta abierto.
const THREADS = ['#88c5a4', '#d4a843', '#9b72a6', '#c85a32'];
const ROW = 'group flex min-h-12 items-center gap-3 rounded-xl px-3 no-underline transition-colors duration-150 hover:bg-[#f3eee3] active:bg-[#f3eee3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none';
const TERRITORY_PILL = 'inline-flex min-h-11 items-center rounded-full px-4 text-[14px] font-bold no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';
const ACCOUNT_BUTTON = 'flex min-h-12 w-full cursor-pointer items-center justify-center rounded-full border-0 bg-ink px-6 text-[16px] font-bold text-cream no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

export default function MobileMenu({ open, onClose, bandHeight = 88, active, municipalitySlug, user, onLogin, onLogout }) {
  const reduceMotion = useReducedMotion();
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const root = document.getElementById('root');
    const wasInert = root?.inert;
    if (root) root.inert = true;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (event) => {
      if (event.key === 'Escape') {
        onCloseRef.current(true);
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const items = [...panelRef.current.querySelectorAll('a[href], button:not([disabled])')];
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const onHash = () => onCloseRef.current(false);
    const media = window.matchMedia(NAV_COMPACT_QUERY);
    const onMedia = () => { if (!media.matches) onCloseRef.current(false); };
    document.addEventListener('keydown', onKey);
    window.addEventListener('hashchange', onHash);
    media.addEventListener('change', onMedia);
    return () => {
      if (root) root.inert = Boolean(wasInert);
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('hashchange', onHash);
      media.removeEventListener('change', onMedia);
    };
  }, [open]);

  const fade = { duration: 0.1 };
  const list = { hidden: {}, show: { transition: reduceMotion ? {} : { staggerChildren: 0.045, delayChildren: 0.08 } } };
  const item = reduceMotion
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : { hidden: { opacity: 0, x: 14 }, show: { opacity: 1, x: 0, transition: { duration: 0.22, ease: 'easeOut' } } };
  const links = NAV_LINKS.filter(([key]) => key !== 'municipios' && key !== 'moneystack');
  const close = () => onClose(false);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div key="velo" aria-hidden="true" className="fixed inset-0 z-[96] bg-ink/40 backdrop-blur-xs" onClick={() => onClose(true)}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={reduceMotion ? fade : { duration: 0.24 }} />
      )}
      {open && (
        <motion.div
          key="panel"
          ref={panelRef}
          id="menu-principal"
          role="dialog"
          aria-modal="true"
          aria-label="Menú principal"
          className="fixed inset-y-0 right-0 z-[97] flex h-[100dvh] w-full flex-col bg-[#fdfbf7] sm:max-w-sm sm:overflow-hidden sm:rounded-l-3xl sm:shadow-[0_12px_40px_rgba(23,63,54,0.18)]"
          initial={reduceMotion ? { opacity: 0 } : { x: '100%' }}
          animate={reduceMotion ? { opacity: 1, transition: fade } : { x: 0, transition: { duration: 0.28, ease: 'easeOut' } }}
          exit={reduceMotion ? { opacity: 0, transition: fade } : { x: '100%', transition: { duration: 0.2, ease: 'easeIn' } }}
        >
          {/* Cabecera "telar": misma altura y margen que el header, asi el cierre queda donde estaba el boton. */}
          <div className="flex shrink-0 items-center justify-between bg-ink px-[5vw] sm:px-6" style={{ height: bandHeight }}>
            {/* Un clic en el logo cierra tambien si ya se esta en el inicio (no hay cambio de hash). */}
            <span onClick={close} className="[&>a]:rounded-lg [&>a:focus-visible]:outline-2 [&>a:focus-visible]:outline-offset-4 [&>a:focus-visible]:outline-cream"><Logo className="text-cream" ringClassName="border-cream" /></span>
            <button
              ref={closeRef}
              type="button"
              className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full border-0 bg-[rgba(255,255,255,0.12)] p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream"
              aria-label="Cerrar menú"
              onClick={() => onClose(true)}
            >
              <ThreadsIcon open fromClosed />
            </button>
          </div>
          <div className="flex h-1 shrink-0" aria-hidden="true">
            {THREADS.map((color, index) => (
              <motion.span
                key={color}
                className="h-full flex-1 origin-left"
                style={{ backgroundColor: color }}
                initial={reduceMotion ? false : { scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.22, delay: 0.1 + index * 0.04, ease: 'easeOut' }}
              />
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
            <p className="m-0 border-b border-[#ddd5c7] pb-3 font-display text-[15px] italic text-muted">«¿Qué rincón quieres explorar hoy, vecino?»</p>

            <nav aria-label="Principal" className="mt-3 block">
              <motion.ul className="m-0 grid list-none gap-1 p-0" variants={list} initial="hidden" animate="show">
                {links.map(([key, label]) => {
                  const current = active === key;
                  return (
                    <motion.li key={key} variants={item}>
                      <a href={`#${key}`} className={`${ROW} ${current ? 'bg-[#efe9dc] hover:bg-[#efe9dc]' : ''}`} aria-current={current ? 'page' : undefined} onClick={close}>
                        <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${current ? 'bg-[#d4a843]' : 'bg-[#cdd5d3]'}`} />
                        <span className="text-[16px] font-bold text-ink transition-colors duration-150 group-hover:text-orange">{label}</span>
                        <span className={`ml-auto text-[13px] ${current ? 'font-display italic text-[#53645c]' : 'text-muted'}`}>
                          {NAV_DESCRIPTIONS[key]}{current ? '' : ' →'}
                        </span>
                      </a>
                    </motion.li>
                  );
                })}
                <motion.li variants={item} className="mt-2">
                  <a
                    href="#moneystack"
                    className={`${ROW} bg-[#0d0f0e] hover:bg-[#1c2220] active:bg-[#1c2220] ${active === 'moneystack' ? 'ring-2 ring-[#d4a843]' : ''}`}
                    aria-current={active === 'moneystack' ? 'page' : undefined}
                    onClick={close}
                  >
                    <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-[#d4a843]" />
                    <span className="text-[16px] font-bold text-white">Moneystack</span>
                    <span className="ml-auto text-[13px] font-bold text-[#d4a843]">{NAV_DESCRIPTIONS.moneystack} ↗</span>
                  </a>
                </motion.li>
              </motion.ul>
            </nav>

            <section aria-labelledby="menu-territorios" className="mt-5 rounded-2xl bg-[#efe9dc] p-3">
              <div className="flex items-center justify-between gap-3">
                <h2 id="menu-territorios" className="m-0 font-sans text-[11px] font-extrabold uppercase tracking-[.14em] text-ink">Territorios del Bajo Cauca</h2>
                <a href="#municipios" className="inline-flex min-h-11 items-center px-1 text-[13px] font-bold text-ink no-underline hover:text-orange focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink" onClick={close}>Ver todos →</a>
              </div>
              <ul className="m-0 mt-1 flex list-none flex-wrap gap-2 p-0">
                {MUNICIPALITY_LIST.map(({ slug, name }) => {
                  const current = municipalitySlug === slug;
                  return (
                    <li key={slug}>
                      <a href={`#municipio/${slug}`} className={`${TERRITORY_PILL} ${current ? 'bg-[#d4a843] text-ink' : 'bg-ink text-cream'}`} aria-current={current ? 'page' : undefined} onClick={close}>{name}</a>
                    </li>
                  );
                })}
              </ul>
            </section>

            <div className="mt-5 grid gap-2">
              {user ? (
                <>
                  <a href="#perfil" className={ACCOUNT_BUTTON} onClick={close}>Mi perfil</a>
                  <button type="button" className="min-h-11 cursor-pointer border-0 bg-transparent text-[15px] font-bold text-ink underline decoration-[rgba(23,63,54,.35)] underline-offset-4 hover:text-orange focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink" onClick={() => { close(); onLogout(); }}>
                    Cerrar sesión
                  </button>
                </>
              ) : (
                <button type="button" className={ACCOUNT_BUTTON} onClick={() => { close(); onLogin(); }}>Ingresar o crear cuenta</button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
