import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';

// Calendario para elegir una fecha o un rango inicio-fin, con hora opcional. Sin librerias.
// - Valores como los del antiguo datetime-local: "AAAA-MM-DDTHH:mm" o "" (sin hora = "T00:00"; al
//   leer, 00:00 se muestra como "sin hora"). onChange({ start, end }).
// - Pildora de modo "Fecha | Rango" (salvo single): en Fecha cada clic elige el dia; en Rango, el primer
//   clic es el inicio y uno posterior el fin (uno anterior, o con el rango completo, es un nuevo inicio).
// - Mes en cuadricula (role="grid"), semanas desde el lunes, en español (es-CO), hoy con borde dorado y
//   un punto; elegidos en tinta, intermedios en crema; dias de otros meses apagados (aria-label completo).
// - Teclado: flechas (dia/semana), Inicio/Fin (semana), RePag/AvPag (mes; con Mayus, año),
//   Enter/Espacio elige, Esc cierra y devuelve el foco al boton; Tab queda dentro del panel.
// - Escritorio (>= 1024 px): popover de 340 px bajo el campo; tablet: modal ligero centrado (celdas de
//   42 px); movil (< 768 px): panel inferior con barra de arrastre y "Confirmar fecha" grande.
// - single: una sola fecha (el cierre de una oportunidad): solo `start` y una hora.
// - pastHint: aviso suave (no bloquea) si la fecha elegida ya paso.
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const WEEKDAYS = [['lu', 'lunes'], ['ma', 'martes'], ['mi', 'miércoles'], ['ju', 'jueves'], ['vi', 'viernes'], ['sá', 'sábado'], ['do', 'domingo']];
const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173f36]';
// Estilos del calendario, juntos para ajustes (colores del sistema TEJIDO: uiStyles.js::TERRITORY).
const S = {
  trigger: `flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-[12px] border border-[#ddd5c7] bg-white py-2 px-3.5 text-left font-sans text-[15px] font-medium text-[#173f36] hover:border-[#173f36] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS}`,
  panel: 'z-[80] border-2 border-[#173f36] bg-[#fff9ec] text-[#173f36]',
  popover: 'absolute left-0 top-[calc(100%+8px)] w-[340px] max-w-[calc(100vw-32px)] rounded-[18px] p-3 [box-shadow:0_18px_44px_rgba(23,63,54,.22)]',
  modal: 'fixed left-1/2 top-1/2 w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-[22px] p-4 [box-shadow:0_24px_60px_rgba(12,36,30,.3)]',
  sheet: 'fixed inset-x-0 bottom-0 max-h-[92vh] overflow-y-auto rounded-t-[24px] border-x-0 border-b-0 px-4 pt-2 pb-[max(16px,env(safe-area-inset-bottom))]',
  backdrop: 'fixed inset-0 z-[79] bg-[rgba(12,36,30,.45)]',
  grip: 'mx-auto mb-2 block h-1.5 w-12 rounded-full bg-[#ddd5c7]',
  head: 'mb-2 flex items-center gap-1',
  nav: `inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#ddd5c7] bg-white text-[#173f36] hover:border-[#173f36] ${FOCUS}`,
  title: 'm-0 flex-1 text-center text-[16px] font-extrabold',
  modes: 'mb-2 flex justify-center',
  modePill: 'inline-flex rounded-full border border-[#173f36] bg-white p-0.5',
  modeBtn: `min-h-9 cursor-pointer rounded-full border-0 px-4 font-sans text-[15px] font-bold ${FOCUS}`,
  modeOn: 'bg-[#173f36] text-[#fff9ec]',
  modeOff: 'bg-transparent text-[#173f36]',
  table: 'w-full table-fixed border-collapse',
  weekday: 'bg-[#173f36] py-1.5 text-center text-[15px] font-bold text-[#f3e4c8] first:rounded-tl-[8px] last:rounded-tr-[8px]',
  cell: 'border border-[#ddd5c7] p-0 text-center',
  // Sin fondo en la base: lo pone el estado (libre o elegido), asi no compiten dos clases de fondo.
  day: `relative mx-auto flex w-full cursor-pointer items-center justify-center border-0 font-sans text-[15px] font-semibold ${FOCUS}`,
  dayFree: 'bg-transparent text-[#173f36] hover:bg-[#f3e4c8]',
  dayOutside: 'font-medium !text-[#8c857a]',
  dayToday: 'shadow-[inset_0_0_0_2px_#d4a843]',
  daySelected: 'bg-[#173f36] text-[#fff9ec] hover:bg-[#2d5a3d]',
  inRange: 'bg-[#f3e4c8]',
  todayDot: 'absolute bottom-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-[#d4a843]',
  chosen: 'mt-3 mb-0 rounded-[10px] border-l-4 border-[#d4a843] bg-[#f3e4c8] px-3.5 py-2.5 text-[15px] font-bold leading-[1.4]',
  times: 'mt-3 grid grid-cols-2 gap-3',
  timeLabel: 'grid gap-1 text-[15px] font-semibold text-[#173f36]',
  time: `h-11 w-full rounded-[12px] border border-[#ddd5c7] bg-white px-3 font-sans text-[15px] text-[#173f36] outline-none focus:border-[#173f36] disabled:opacity-50 ${FOCUS}`,
  past: 'm-0 mt-3 rounded-[10px] bg-[#f4b942] px-3.5 py-2.5 text-[15px] font-semibold leading-[1.4] text-[#173f36]',
  actions: 'mt-4 flex items-center justify-between gap-3',
  clear: `min-h-11 cursor-pointer border-0 bg-transparent px-1 font-sans text-[15px] font-bold text-[#173f36] underline decoration-2 underline-offset-4 disabled:cursor-not-allowed disabled:text-[#8c857a] ${FOCUS}`,
  done: `min-h-11 cursor-pointer rounded-full border-0 bg-[#173f36] px-6 font-sans text-[15px] font-bold text-[#fff9ec] hover:bg-[#2d5a3d] ${FOCUS}`,
  doneBig: 'min-h-14 w-full text-[17px]',
};

const pad = (n) => String(n).padStart(2, '0');
const isoDay = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const fromIso = (day) => { const [y, m, d] = day.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (date, n) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
function addMonths(date, n) {
  const target = new Date(date.getFullYear(), date.getMonth() + n, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), last));
}

// "AAAA-MM-DDTHH:mm" -> { day: "AAAA-MM-DD", time: "HH:mm" | "" } (00:00 = sin hora).
function split(value) {
  const match = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/.exec(value || '');
  if (!match) return { day: '', time: '' };
  return { day: match[1], time: match[2] && match[2] !== '00:00' ? match[2] : '' };
}
const join = (day, time) => (day ? `${day}T${time || '00:00'}` : '');

const longDate = (date) => `${DAY_NAMES[date.getDay()]} ${date.getDate()} de ${MONTHS[date.getMonth()]} de ${date.getFullYear()}`;
const shortDate = (day) => { const d = fromIso(day); return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`; };
// "Sáb 14 nov" (+ año si se pide).
const chosenDate = (day, withYear) => { const d = fromIso(day); return `${DAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}${withYear ? ` ${d.getFullYear()}` : ''}`; };
function timeText(time) {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  return new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit' }).format(new Date(2000, 0, 1, h, m));
}

export function summaryText(start, end) {
  const a = split(start);
  const b = split(end);
  if (!a.day && !b.day) return '';
  const first = a.day ? `${shortDate(a.day)}${a.time ? `, ${timeText(a.time)}` : ''}` : 'Sin inicio';
  if (!b.day || (b.day === a.day && !b.time)) return first;
  if (b.day === a.day) return `${first} – ${timeText(b.time)}`;
  return `${first} – ${shortDate(b.day)}${b.time ? `, ${timeText(b.time)}` : ''}`;
}

function chosenText(a, b, single) {
  if (!a.day) return 'Aún no eliges una fecha';
  if (!single && b.day && b.day !== a.day) {
    const sameYear = a.day.slice(0, 4) === b.day.slice(0, 4);
    return `Rango elegido: ${chosenDate(a.day, !sameYear)} — ${chosenDate(b.day, true)}`;
  }
  return `Fecha elegida: ${chosenDate(a.day, true)}`;
}

// 'sheet' (< 768 px), 'modal' (768-1023 px) o 'popover' (>= 1024 px).
function useLayoutMode() {
  const read = () => (typeof window === 'undefined' ? 'popover'
    : window.matchMedia('(max-width: 767px)').matches ? 'sheet'
      : window.matchMedia('(max-width: 1023px)').matches ? 'modal' : 'popover');
  const [mode, setMode] = useState(read);
  useEffect(() => {
    const queries = [window.matchMedia('(max-width: 767px)'), window.matchMedia('(max-width: 1023px)')];
    const onChange = () => setMode(read());
    queries.forEach((q) => q.addEventListener('change', onChange));
    return () => queries.forEach((q) => q.removeEventListener('change', onChange));
  }, []);
  return mode;
}

function weeksOf(month) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7; // lunes = 0
  const start = addDays(first, -offset);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const count = Math.ceil((offset + last.getDate()) / 7);
  return Array.from({ length: count }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
}

export default function DatePicker({ label, start = '', end = '', onChange, disabled = false, hint, pastHint, single = false }) {
  const id = useId().replace(/:/g, '');
  const layout = useLayoutMode();
  const [open, setOpen] = useState(false);
  const a = split(start);
  const b = split(end);
  const today = isoDay(new Date());
  const [focusDay, setFocusDay] = useState(() => fromIso(a.day || today));
  const [mode, setMode] = useState(() => (!single && b.day && b.day !== a.day ? 'rango' : 'fecha'));
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const wrapRef = useRef(null);
  const focusOnRender = useRef(false);

  const range = !single && mode === 'rango';
  const choosingEnd = range && Boolean(a.day && (!b.day || b.day === a.day));
  const lastDay = b.day || a.day;
  const isPast = Boolean(lastDay && lastDay < today);
  const summary = summaryText(start, end);

  // Un fin el mismo dia sin hora no aporta nada (y quedaria antes de un inicio con hora): se quita.
  const emit = (next) => {
    const sameDayNoTime = next.endDay === next.startDay && !next.endTime;
    onChange({ start: join(next.startDay, next.startTime), end: sameDayNoTime ? '' : join(next.endDay, next.endTime) });
  };
  const current = { startDay: a.day, startTime: a.time, endDay: b.day, endTime: b.time };

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  function openPanel() {
    setFocusDay(fromIso(a.day || today));
    focusOnRender.current = true;
    setOpen(true);
  }

  function pick(date) {
    const day = isoDay(date);
    setFocusDay(date);
    if (!range) {
      // Fecha: el dia elegido; un fin el mismo dia (solo con hora) se conserva.
      const keepEnd = b.day && b.day === a.day;
      emit({ startDay: day, startTime: a.time, endDay: keepEnd ? day : '', endTime: keepEnd ? b.time : '' });
      return;
    }
    if (!a.day || day < a.day || (b.day && b.day !== a.day)) emit({ startDay: day, startTime: a.time, endDay: '', endTime: '' });
    else if (day > a.day) emit({ ...current, endDay: day });
  }

  function switchMode(next) {
    setMode(next);
    // Al pasar a Fecha, un rango de varios dias se reduce a su inicio.
    if (next === 'fecha' && b.day && b.day !== a.day) emit({ ...current, endDay: '', endTime: '' });
  }

  useLayoutEffect(() => {
    if (!open || !focusOnRender.current) return;
    focusOnRender.current = false;
    panelRef.current?.querySelector('[data-dia-enfocado="true"]')?.focus();
  });

  // Popover: un clic afuera lo cierra (sin devolver el foco a la fuerza).
  useEffect(() => {
    if (!open || layout !== 'popover') return undefined;
    const onDown = (event) => { if (!wrapRef.current?.contains(event.target)) close(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, layout, close]);

  // Modal y panel inferior: la pagina de atras no se desplaza.
  useEffect(() => {
    if (!open || layout === 'popover') return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open, layout]);

  function onGridKey(event) {
    const moves = {
      ArrowLeft: () => addDays(focusDay, -1), ArrowRight: () => addDays(focusDay, 1),
      ArrowUp: () => addDays(focusDay, -7), ArrowDown: () => addDays(focusDay, 7),
      Home: () => addDays(focusDay, -((focusDay.getDay() + 6) % 7)), End: () => addDays(focusDay, 6 - ((focusDay.getDay() + 6) % 7)),
      PageUp: () => addMonths(focusDay, event.shiftKey ? -12 : -1), PageDown: () => addMonths(focusDay, event.shiftKey ? 12 : 1),
    };
    if (moves[event.key]) {
      event.preventDefault();
      focusOnRender.current = true;
      setFocusDay(moves[event.key]());
    }
  }

  function onPanelKey(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = [...panelRef.current.querySelectorAll('button:not([disabled]), input:not([disabled])')].filter((el) => el.tabIndex !== -1);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  const month = new Date(focusDay.getFullYear(), focusDay.getMonth(), 1);
  const titleId = `${id}-mes`;
  const focusIso = isoDay(focusDay);
  const cellHeight = layout === 'modal' ? 'h-[42px]' : 'h-11';
  const monthName = MONTHS[month.getMonth()];

  const panel = open && (
    <div ref={panelRef} role="dialog" aria-modal="true" aria-label={label ? `Elegir ${label.toLowerCase()}` : 'Elegir fechas'}
      className={`${S.panel} ${layout === 'sheet' ? S.sheet : layout === 'modal' ? S.modal : S.popover}`} onKeyDown={onPanelKey} data-calendario={layout === 'sheet' ? 'inferior' : layout}>
      {layout === 'sheet' && <span className={S.grip} aria-hidden="true" />}
      <div className={S.head}>
        <button type="button" className={S.nav} onClick={() => setFocusDay((day) => addMonths(day, -1))} aria-label="Mes anterior"><Icon name="arrow-left" className="size-5" /></button>
        <h2 id={titleId} className={S.title} aria-live="polite">{monthName[0].toUpperCase()}{monthName.slice(1)} {month.getFullYear()}</h2>
        <button type="button" className={S.nav} onClick={() => setFocusDay((day) => addMonths(day, 1))} aria-label="Mes siguiente"><Icon name="arrow-right" className="size-5" /></button>
      </div>
      {!single && (
        <div className={S.modes}>
          <div className={S.modePill} role="group" aria-label="Modo de selección">
            {[['fecha', 'Fecha'], ['rango', 'Rango']].map(([value, text]) => (
              <button key={value} type="button" aria-pressed={mode === value} className={`${S.modeBtn} ${mode === value ? S.modeOn : S.modeOff}`}
                onClick={() => switchMode(value)}>{text}</button>
            ))}
          </div>
        </div>
      )}
      <p className="sr-only" id={`${id}-paso`}>{single || !range ? 'Elige el día' : choosingEnd ? 'Elige el día de fin' : 'Elige el día de inicio'}</p>
      <table role="grid" aria-labelledby={titleId} aria-describedby={`${id}-paso`} className={S.table} onKeyDown={onGridKey}>
        <thead>
          <tr>{WEEKDAYS.map(([short, full]) => <th key={short} scope="col" className={S.weekday}><abbr title={full} className="no-underline">{short.toUpperCase()}</abbr></th>)}</tr>
        </thead>
        <tbody>
          {weeksOf(month).map((week) => (
            <tr key={isoDay(week[0])}>
              {week.map((date) => {
                const day = isoDay(date);
                const outside = date.getMonth() !== month.getMonth();
                const isStart = day === a.day;
                const isEnd = day === b.day;
                const selected = isStart || (range && isEnd);
                const between = range && a.day && b.day && day > a.day && day < b.day;
                const role = isStart && isEnd ? ', elegido' : isStart ? (range && b.day && b.day !== a.day ? ', inicio' : ', elegido') : range && isEnd ? ', fin' : between ? ', dentro del rango' : '';
                return (
                  <td key={day} role="gridcell" aria-selected={selected} className={`${S.cell} ${between ? S.inRange : ''}`}>
                    <button type="button" tabIndex={day === focusIso ? 0 : -1} data-dia-enfocado={day === focusIso}
                      className={`${S.day} ${cellHeight} ${selected ? S.daySelected : `${S.dayFree} ${outside ? S.dayOutside : ''}`} ${day === today ? S.dayToday : ''}`}
                      aria-label={`${longDate(date)}${day === today ? ', hoy' : ''}${role}`}
                      onClick={() => pick(date)} onFocus={() => { if (day !== focusIso) setFocusDay(date); }}>
                      {date.getDate()}
                      {day === today && <span className={S.todayDot} aria-hidden="true" />}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className={S.chosen} aria-live="polite" data-elegido>{chosenText(a, b, single)}</p>
      <div className={single ? 'mt-3 grid gap-3' : S.times}>
        <label className={S.timeLabel}>{single ? 'Hora (opcional)' : 'Hora de inicio (opcional)'}
          <input type="time" className={S.time} value={a.time} disabled={!a.day}
            onChange={(event) => emit({ ...current, startTime: event.target.value })} />
        </label>
        {!single && (
          <label className={S.timeLabel}>Hora de fin (opcional)
            <input type="time" className={S.time} value={b.time} disabled={!a.day}
              onChange={(event) => emit({ ...current, endDay: b.day || a.day, endTime: event.target.value })} />
          </label>
        )}
      </div>
      {isPast && pastHint && <p className={S.past} role="status">{pastHint}</p>}
      <div className={layout === 'sheet' ? 'mt-4 grid gap-2' : S.actions}>
        <button type="button" className={`${S.clear} ${layout === 'sheet' ? 'justify-self-start' : ''}`} onClick={() => emit({ startDay: '', startTime: '', endDay: '', endTime: '' })} disabled={!a.day && !b.day}>Quitar fecha</button>
        <button type="button" className={`${S.done} ${layout === 'sheet' ? S.doneBig : ''}`} onClick={() => close()}>Confirmar fecha</button>
      </div>
    </div>
  );

  return (
    <div ref={wrapRef} className="relative grid content-start gap-1.5">
      <span id={`${id}-etiqueta`} className="text-[12px] font-bold uppercase tracking-[.12em] text-muted">{label}</span>
      <button ref={triggerRef} type="button" className={S.trigger} disabled={disabled} onClick={() => (open ? close(false) : openPanel())}
        aria-haspopup="dialog" aria-expanded={open} aria-labelledby={`${id}-etiqueta ${id}-valor`}
        aria-describedby={[hint && `${id}-ayuda`, isPast && pastHint && `${id}-pasada`].filter(Boolean).join(' ') || undefined}>
        <Icon name="calendar" className="size-5 shrink-0 text-[#3f514a]" />
        <span id={`${id}-valor`} className={summary ? '' : 'text-[#66746f]'}>{summary || 'Sin fecha'}</span>
      </button>
      {hint && <span id={`${id}-ayuda`} className="text-[15px] text-muted">{hint}</span>}
      {isPast && pastHint && <p id={`${id}-pasada`} className="m-0 rounded-[10px] bg-[#f4b942] px-3 py-2 text-[15px] font-semibold text-[#173f36]" aria-live="polite">{pastHint}</p>}
      {open && (layout === 'popover' ? panel : createPortal(<><div className={S.backdrop} onClick={() => close()} aria-hidden="true" />{panel}</>, document.body))}
    </div>
  );
}
