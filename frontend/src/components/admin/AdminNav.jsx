import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import Icon from '../Icon.jsx';
import PillTabs from './PillTabs.jsx';

// Barra de secciones del dashboard del admin, a la derecha del contenido (PillTabs vertical).
// - Escritorio (>= 1024 px): columna de 120 px, icono sobre etiqueta, pegada bajo el header (sticky).
// - Riel (601-1023 px): reserva 56 px con solo iconos; el boton de despliegue la abre SUPERPUESTA al
//   contenido (no lo empuja) con las etiquetas.
// - Flotante (<= 600 px): con el riel reservado el contenido quedaba en ~227 px utiles (formularios y
//   tarjetas de Gestores ilegibles), asi que no reserva ancho: solo el boton de despliegue, pegado arriba
//   a la derecha; abierto muestra el mismo panel con etiquetas.
// Abierto (riel o flotante) se cierra al elegir una seccion, con Escape (el foco vuelve al boton) o con
// un clic fuera. El alto maximo deja libres el header (arriba) y el lanzador de Hilo (abajo): si la
// ventana es baja, la columna se desplaza por dentro.
export const NAV_TOP = 'calc(var(--header-height, 88px) + 16px)';
// 16 px bajo el header y 144 px abajo: el lanzador de Hilo (capsula y figura) ocupa ~116 px desde el borde
// inferior. Es un div con role="navigation": la hoja heredada de tailwind.css oculta todo <nav> en <= 800 px.
const MAX_H = 'max-h-[calc(100dvh-var(--header-height,88px)-160px)]';
// Riel y flotante: ademas del boton de despliegue (44 px) que va encima.
const MAX_H_RAIL = 'max-h-[calc(100dvh-var(--header-height,88px)-212px)]';

function useMode() {
  const read = () => (window.matchMedia('(min-width: 1024px)').matches ? 'desktop' : window.matchMedia('(min-width: 601px)').matches ? 'rail' : 'float');
  const [mode, setMode] = useState(read);
  useEffect(() => {
    const lists = ['(min-width: 1024px)', '(min-width: 601px)'].map((q) => window.matchMedia(q));
    const onChange = () => setMode(read());
    lists.forEach((list) => list.addEventListener('change', onChange));
    return () => lists.forEach((list) => list.removeEventListener('change', onChange));
  }, []);
  return mode;
}

export function useAdminNavMode() {
  return useMode();
}

export default function AdminNav({ mode, tabs, active, onChange, idPrefix, label, pendingTotal = 0 }) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const wrapRef = useRef(null);
  const toggleRef = useRef(null);
  const panelId = `${idPrefix}-secciones`;
  const desktop = mode === 'desktop';

  useEffect(() => { setOpen(false); }, [mode]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      // Tras cerrar se monta otra caja (otro boton): el foco se pone despues de pintarla.
      requestAnimationFrame(() => toggleRef.current?.focus());
    };
    const onPointer = (event) => { if (!wrapRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  // Al abrir, el foco entra en la seccion activa.
  useEffect(() => {
    if (open) requestAnimationFrame(() => wrapRef.current?.querySelector('[role=tab][aria-selected=true]')?.focus());
  }, [open]);

  function choose(id) {
    onChange(id);
    if (!desktop && open) {
      setOpen(false);
      requestAnimationFrame(() => toggleRef.current?.focus());
    }
  }

  const tabsEl = (collapsed, className) => (
    <PillTabs orientation="vertical" collapsed={collapsed} idPrefix={idPrefix} label={label} active={active} onChange={choose} tabs={tabs} className={className} />
  );

  if (desktop) {
    return (
      <div role="navigation" aria-label="Secciones del dashboard" className="sticky self-start" style={{ top: NAV_TOP }} data-admin-nav="escritorio">
        <div className="rounded-[32px] bg-[#f3e4c8] p-1.5">{tabsEl(false, `${MAX_H} rounded-[26px]`)}</div>
      </div>
    );
  }

  const float = mode === 'float';
  const toggle = (
    <button ref={toggleRef} type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((value) => !value)} data-desplegar-secciones
      className={`relative inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 font-sans transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
        float || open ? 'border-ink bg-ink text-[#fff9ec] hover:bg-[#2d5a3d]' : 'border-transparent bg-transparent text-ink hover:bg-[rgba(23,63,54,.08)]'}`}>
      <Icon name={open ? 'close' : 'list'} className="size-5" strokeWidth={2} />
      <span className="sr-only">{open ? 'Ocultar las secciones del dashboard' : 'Ver las secciones del dashboard con sus nombres'}</span>
      {!open && float && pendingTotal > 0 && (
        <span className="absolute -top-1 -right-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#b8502b] px-1 text-[10px] font-extrabold text-[#fff9ec]" data-badge>
          {pendingTotal}<span className="sr-only"> pendientes</span>
        </span>
      )}
    </button>
  );

  // Riel cerrado: caja de 56 px en el flujo de su columna. Abierto (o flotante abierto): la misma caja pasa a
  // ser una capa superpuesta anclada a la derecha.
  const box = open
    ? 'absolute top-0 right-0 z-40 w-[148px] rounded-[28px] border-2 border-ink bg-[#f3e4c8] p-1.5 [box-shadow:0_4px_12px_rgba(23,63,54,.16)]'
    : float ? 'absolute top-0 right-[-10px] z-30' : 'flex w-14 flex-col items-center gap-1.5 rounded-[28px] bg-[#f3e4c8] py-1.5';

  return (
    <div ref={wrapRef} role="navigation" aria-label="Secciones del dashboard" className={`sticky self-start ${float ? 'z-30 h-0 w-0 justify-self-end' : 'w-14'}`} style={{ top: NAV_TOP }}
      data-admin-nav={float ? 'flotante' : 'riel'} data-abierta={open ? 'si' : 'no'}>
      <motion.div key={open ? 'abierta' : 'cerrada'} className={box} initial={reduce || !open ? false : { opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
        transition={{ duration: reduce ? 0 : 0.18, ease: 'easeOut' }}>
        <div className={open ? 'mb-1 flex justify-end' : ''}>{toggle}</div>
        <div id={panelId} className={float && !open ? 'hidden' : ''}>
          {tabsEl(!open, `${MAX_H_RAIL} ${open ? '' : 'w-14 px-1.5'}`)}
        </div>
      </motion.div>
    </div>
  );
}
