import { useEffect, useId, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import Icon from '../Icon.jsx';

// Dialogo modal accesible del perfil de talento (Contratar, agenda completa): foco al abrir en el
// primer control, Tab atrapado dentro, Esc y el fondo cierran, y el foco vuelve a quien lo abrio.
// animated (opcional, apagado por defecto): entrada corta (fundido del fondo y el panel sube 8 px, 200 ms),
// sin animacion con movimiento reducido. Lo usan los dialogos del dashboard del admin.
// sheet (opcional): por debajo de 600 px el dialogo es un panel inferior (pegado abajo, a todo el ancho).
const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

export default function Modal({ title, onClose, children, wide = false, closeIcon = true, animated = false, sheet = false }) {
  const panel = useRef(null);
  const titleId = useId();
  const reduce = useReducedMotion();
  const enter = animated && !reduce;
  const Backdrop = enter ? motion.div : 'div';
  const Panel = enter ? motion.div : 'div';
  const backdropMotion = enter ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2, ease: 'easeOut' } } : {};
  const panelMotion = enter ? { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.2, ease: 'easeOut' } } : {};

  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.querySelector(FOCUSABLE)?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  useEffect(() => {
    function handleKey(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'Tab') {
        const focusable = [...(panel.current?.querySelectorAll(FOCUSABLE) || [])];
        if (focusable.length === 0) return;
        const position = focusable.indexOf(document.activeElement);
        if (event.shiftKey && position <= 0) { event.preventDefault(); focusable[focusable.length - 1].focus(); }
        else if (!event.shiftKey && position === focusable.length - 1) { event.preventDefault(); focusable[0].focus(); }
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <Backdrop className={`fixed inset-0 z-[200] flex items-center justify-center bg-[rgba(8,20,16,.6)] p-4 ${sheet ? 'max600:items-end max600:p-0' : ''}`}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} {...backdropMotion}>
      <Panel ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} {...panelMotion}
        className={`relative max-h-[calc(100dvh-32px)] w-full overflow-y-auto rounded-[28px] border border-[#e2d9ca] bg-[#fffaf2] p-8 [box-shadow:0_30px_80px_rgba(12,36,30,.3)] max600:p-6 ${wide ? 'max-w-[980px]' : 'max-w-[480px]'} ${sheet ? 'max600:max-h-[88dvh] max600:max-w-none max600:rounded-b-none max600:border-b-0' : ''}`}>
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="m-0 font-sans text-[24px] font-extrabold leading-[1.2] tracking-[-.03em] text-ink">{title}</h2>
          {closeIcon && (
            <button type="button" onClick={onClose} aria-label="Cerrar"
              className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line bg-white text-ink hover:bg-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
              <Icon name="close" className="size-5" />
            </button>
          )}
        </div>
        {children}
      </Panel>
    </Backdrop>
  );
}
