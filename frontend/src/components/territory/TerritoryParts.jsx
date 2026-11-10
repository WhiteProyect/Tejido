import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import Icon from '../Icon.jsx';
import { PILL_BASE, TERRITORY, noticeStyle, pillStyle } from '../uiStyles.js';
import { TS } from './territoryStyles.js';

// Piezas compartidas del rediseño de Agenda y Oportunidades: entrada, filtros, pildoras, avisos,
// barras de bloque, tarjetas de Hilo y esqueletos. Los colores salen de uiStyles.js.

export function Pill({ colors, band, icon, children, ...rest }) {
  return (
    <span className={PILL_BASE} style={pillStyle(colors, band)} {...rest}>
      {icon && <Icon name={icon} className="size-4 shrink-0" />}
      {children}
    </span>
  );
}

export function DayNotice({ notice, band }) {
  if (!notice) return null;
  return <span className={PILL_BASE} style={noticeStyle(notice.kind, band)} data-aviso={notice.kind}>{notice.text}</span>;
}

// Entrada: caja crema, kicker ocre, titulo con las ultimas palabras en Arial y texto corto.
export function PageHero({ kicker, title, italic, text }) {
  return (
    <header className={TS.hero}>
      <div className="min-w-0">
        <p className={TS.kicker}>{kicker}</p>
        <h1 className={TS.heroTitle}>{title} <span className={TS.heroItalic}>{italic}</span></h1>
      </div>
      <p className={TS.heroText}>{text}</p>
    </header>
  );
}

// Barra de bloque a todo el ancho. variant: 'ink' | 'purple' | 'cream'.
const BAR_COLORS = {
  ink: { backgroundColor: TERRITORY.ink, color: TERRITORY.paper },
  purple: { backgroundColor: TERRITORY.purple, color: TERRITORY.paper },
  cream: { backgroundColor: TERRITORY.cream, color: TERRITORY.ink, border: `1px solid ${TERRITORY.line}` },
};
export function BlockBar({ as: Tag = 'h2', id, variant = 'ink', children, className = '' }) {
  return <Tag id={id} className={`${TS.bar} ${className}`} style={BAR_COLORS[variant]} tabIndex={-1}>{children}</Tag>;
}

export function AnimatedBlock({ children, labelledBy }) {
  const reduce = useReducedMotion();
  return (
    <motion.section className={TS.block} aria-labelledby={labelledBy}
      initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: 'easeOut' }}>
      {children}
    </motion.section>
  );
}

// Tarjeta de Hilo: invitacion (en la celda vecina de una tarjeta sola) o estado vacio centrado.
export function HiloCard({ title, text, action, empty = false }) {
  return (
    <div className={empty ? TS.hiloEmpty : TS.hiloCard} data-hilo>
      <img src="/images/hilo/hilo-saluda.webp" alt="" width="120" height="116" loading="lazy" className={TS.hiloImg} />
      <p className={TS.hiloTitle}>{title}</p>
      {text && <p className={TS.hiloText}>{text}</p>}
      {action}
    </div>
  );
}

export function SkeletonCards({ pills = 3, buttons = false }) {
  return (
    <ul className={TS.grid} aria-hidden="true">
      {Array.from({ length: 4 }, (_, index) => (
        <li key={index} className={TS.skeleton}>
          <div className={`${TS.skeletonBlock} aspect-[16/9] rounded-none max-[1023px]:aspect-auto max-[1023px]:h-[180px]`} />
          <div className="flex gap-2 px-5 py-3">{Array.from({ length: pills }, (_, i) => <span key={i} className={`${TS.skeletonBlock} h-7 w-20 rounded-full`} />)}</div>
          <div className="grid gap-3 px-5 pb-5">
            <div className={`${TS.skeletonBlock} h-6 w-3/4`} />
            <div className={`${TS.skeletonBlock} h-4 w-full`} />
            <div className={`${TS.skeletonBlock} h-11 w-full`} />
            {buttons && <div className="flex gap-3"><span className={`${TS.skeletonBlock} h-12 w-40 rounded-full`} /><span className={`${TS.skeletonBlock} h-12 w-28 rounded-full`} /></div>}
          </div>
        </li>
      ))}
    </ul>
  );
}

function Chevron() {
  return (
    <svg className="pointer-events-none absolute right-3.5 bottom-[15px] size-3.5 text-[#173f36]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function SelectField({ id, label, value, options, onChange, placeholder }) {
  return (
    <div className={`${TS.field} relative`}>
      <label htmlFor={id} className={TS.fieldLabel}>{label}</label>
      <select id={id} className={TS.select} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{placeholder}</option>
        {options.map(([value_, text]) => <option key={value_} value={value_}>{text}</option>)}
      </select>
      <Chevron />
    </div>
  );
}

function Switch({ label, checked, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className={TS.switchBtn} onClick={() => onChange(!checked)}>
      <span className={`${TS.switchTrack} ${checked ? TS.switchOn : TS.switchOff}`} aria-hidden="true">
        <span className={TS.switchThumb} style={{ left: checked ? 22 : 2 }} />
      </span>
      {label}
    </button>
  );
}

// Panel inferior (movil) con los selectores en borrador; "Aplicar" los pasa de una vez.
function FilterSheet({ selects, onApply, onClose }) {
  const titleId = useId();
  const ref = useRef(null);
  const [draft, setDraft] = useState(() => Object.fromEntries(selects.map((s) => [s.key, s.value])));

  useEffect(() => {
    ref.current?.querySelector('select')?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  function onKeyDown(event) {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
    if (event.key !== 'Tab') return;
    const items = [...ref.current.querySelectorAll('select, button')];
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  return createPortal(
    <>
      <div className={TS.sheetBackdrop} onClick={onClose} aria-hidden="true" />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} className={TS.sheet} onKeyDown={onKeyDown} data-panel-filtros>
        <span className={TS.sheetGrip} aria-hidden="true" />
        <h2 id={titleId} className={TS.sheetTitle}>Filtros</h2>
        <div className="grid gap-4">
          {selects.map((s) => (
            <SelectField key={s.key} id={`${titleId}-${s.key}`} label={s.label} value={draft[s.key]} options={s.options}
              placeholder={s.placeholder} onChange={(value) => setDraft((current) => ({ ...current, [s.key]: value }))} />
          ))}
        </div>
        <div className="mt-6 grid gap-3">
          <button type="button" className={TS.btnSolid} onClick={() => onApply(draft)}>Aplicar</button>
          <button type="button" className={TS.btnCream} onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </>,
    document.body,
  );
}

// Barra de filtros. selects: [{ key, label, value, options: [[valor, texto]], placeholder }];
// toggles: [{ key, label, checked }]. onChange(patch) aplica (y persiste) los cambios.
// Escritorio: una fila; tablet: selectores arriba e interruptores abajo; movil: boton "Filtros" fijo
// (abre el panel inferior) y una fila de pildoras desplazable con los interruptores.
export function FilterBar({ label, selects, toggles, onChange, onClear }) {
  const id = useId().replace(/:/g, '');
  const [sheet, setSheet] = useState(false);
  const opener = useRef(null);
  const active = selects.filter((s) => s.value).length;
  const hasFilters = active > 0 || toggles.some((t) => t.checked);

  function closeSheet() {
    setSheet(false);
    requestAnimationFrame(() => opener.current?.focus());
  }

  return (
    <>
      <div className={`${TS.filters} max-[767px]:hidden`} role="group" aria-label={label}>
        <div className={TS.filtersRow}>
          <div className={TS.selects} style={{ '--cols': selects.length }}>
            {selects.map((s) => (
              <SelectField key={s.key} id={`${id}-${s.key}`} label={s.label} value={s.value} options={s.options}
                placeholder={s.placeholder} onChange={(value) => onChange({ [s.key]: value })} />
            ))}
          </div>
          <div className={TS.toggles}>
            {toggles.map((t) => <Switch key={t.key} label={t.label} checked={t.checked} onChange={(checked) => onChange({ [t.key]: checked })} />)}
            {hasFilters && <button type="button" className={TS.clear} onClick={onClear}>Quitar filtros</button>}
          </div>
        </div>
      </div>

      <div className={`${TS.mobileBar} hidden max-[767px]:flex`} role="group" aria-label={label}>
        <button ref={opener} type="button" className={TS.mobileFilterBtn} onClick={() => setSheet(true)} aria-haspopup="dialog" aria-expanded={sheet}>
          <Icon name="search" className="size-4" /> Filtros{active ? <span className="ml-0.5 rounded-full bg-[#fff9ec] px-2 text-[13px] text-[#173f36]">{active}</span> : null}
          {active ? <span className="sr-only"> ({active} activos)</span> : null}
        </button>
        <div className={TS.mobileScroller}>
          {toggles.map((t) => (
            <button key={t.key} type="button" role="switch" aria-checked={t.checked}
              className={`${TS.togglePill} ${t.checked ? TS.togglePillOn : TS.togglePillOff}`} onClick={() => onChange({ [t.key]: !t.checked })}>
              {t.checked && <Icon name="check" className="size-4" />}{t.label}
            </button>
          ))}
          {hasFilters && <button type="button" className={`${TS.togglePill} ${TS.togglePillOff}`} style={{ borderColor: TERRITORY.line }} onClick={onClear}>Quitar filtros</button>}
        </div>
      </div>
      {sheet && <FilterSheet selects={selects} onClose={closeSheet} onApply={(draft) => { onChange(draft); closeSheet(); }} />}
    </>
  );
}
