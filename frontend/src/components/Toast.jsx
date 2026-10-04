import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Icon from './Icon.jsx';
import { TOAST_TONES } from '../utils/constants.js';

// "Anatomia del aviso con Hilo" (lo maneja context/ToastContext.jsx): tarjeta papel, sin fondo
// de color; el tono va en el icono y en el hilo de abajo, que se acorta mientras el aviso
// sigue en pantalla. Capas: icono, antetitulo dorado, titulo y subtitulo en cursiva.
// El antetitulo usa #b8860b (el dorado oscuro de URGENCY.warning en uiStyles.js) y no --gold:
// es texto chico sobre fondo claro y --gold no da contraste suficiente.
//
// Posicion: en escritorio abajo a la derecha, corrida a la izquierda de Hilo (su boton
// y su burbuja ocupan ~210 px desde el borde); en movil arriba, bajo el header, porque abajo Hilo
// y su burbuja ocupan el lado derecho.
export default function Toast({ toast, onDismiss, duration }) {
  const reduceMotion = useReducedMotion();
  // Entra desde el borde donde vive: desde abajo en escritorio, desde arriba en movil.
  const fromTop = window.matchMedia('(max-width: 600px)').matches;
  const offset = reduceMotion ? 0 : fromTop ? -16 : 16;
  const { color, icon } = TOAST_TONES[toast?.tone] || TOAST_TONES.menta;

  return (
    <div
      className="pointer-events-none fixed bottom-6 right-[224px] z-90 w-[min(380px,calc(100vw-256px))] max600:inset-x-4 max600:top-[88px] max600:bottom-auto max600:w-auto"
      aria-live="polite"
    >
      <AnimatePresence mode="wait" initial={false}>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: offset }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: offset, transition: { duration: 0.16 } }}
            transition={{ duration: reduceMotion ? 0.12 : 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto relative overflow-hidden rounded-[20px] border border-line bg-paper py-4 pr-14 pl-5 text-ink [box-shadow:0_18px_44px_rgba(23,63,54,.16),0_2px_6px_rgba(23,63,54,.06)]"
            role="status"
          >
            <span className="grid size-9 place-items-center rounded-full" style={{ color, backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` }}>
              <Icon name={icon} className="size-5" strokeWidth={1.7} />
            </span>
            {toast.eyebrow && <p className="mt-3 mb-1 text-[11px] font-extrabold uppercase tracking-[.18em] text-[#b8860b]">{toast.eyebrow}</p>}
            <p className={`${toast.eyebrow ? 'mt-0' : 'mt-3'} mb-0 font-sans text-[17px] font-bold leading-[1.25] tracking-[-.01em] text-ink`}>{toast.title}</p>
            {toast.text && <p className="mt-1 mb-0 font-display text-[15px] italic leading-[1.4] text-muted">{toast.text}</p>}
            <button
              className="absolute top-1 right-1 grid size-12 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-muted transition-colors duration-200 hover:bg-cream hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ink"
              type="button"
              aria-label="Cerrar aviso"
              onClick={onDismiss}
            >
              <Icon name="close" className="size-[18px]" strokeWidth={1.8} />
            </button>
            {/* El hilo: marca el tiempo que le queda al aviso. Sin movimiento, no se dibuja. */}
            {!reduceMotion && (
              <motion.span
                className="absolute bottom-0 left-0 h-[3px] w-full origin-left opacity-60"
                style={{ backgroundColor: color }}
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: duration / 1000, ease: 'linear' }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
