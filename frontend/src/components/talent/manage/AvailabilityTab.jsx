import { useState } from 'react';
import Icon from '../../Icon.jsx';
import { useUnsavedChanges } from '../../admin/artist/unsavedChanges.js';
import { HINT } from '../../gestor/edit/common.jsx';
import { BTN_GHOST } from '../../uiStyles.js';
import { MONTHS, isoDay, parseDay } from '../../../utils/talent.js';
import { ALERT, LIMITS, SaveBar, talentApi } from './common.jsx';

// Pestaña Disponibilidad: calendario mensual editable de hoy a +366 dias. Cada dia es un boton:
// clic, Enter o Espacio alternan Disponible -> Ocupado -> sin dato (y las flechas del teclado
// recorren los dias). "Marcar todo el mes como disponible" y "Limpiar mes" actuan sobre el mes
// visible. Guardar manda UN PUT con el rango que va del primer al ultimo dia modificado (el
// backend reemplaza solo ese rango). La disponibilidad no cambia el estado del talento.
const NEXT = { undefined: 'AVAILABLE', AVAILABLE: 'BUSY', BUSY: undefined };
const STATE_TEXT = { AVAILABLE: 'disponible', BUSY: 'ocupado' };
const WEEKDAYS = [['L', 'lunes'], ['M', 'martes'], ['M', 'miércoles'], ['J', 'jueves'], ['V', 'viernes'], ['S', 'sábado'], ['D', 'domingo']];

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export default function AvailabilityTab({ detail, onSaved }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = isoDay(today);
  const lastIso = isoDay(addDays(today, LIMITS.windowDays));
  const [initial] = useState(() => Object.fromEntries(detail.availability.map((item) => [String(item.day).slice(0, 10), item.state])));
  const [states, setStates] = useState(initial);
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [announce, setAnnounce] = useState('');

  const changedDays = [...new Set([...Object.keys(initial), ...Object.keys(states)])].filter((day) => initial[day] !== states[day]).sort();
  const dirty = changedDays.length > 0;
  useUnsavedChanges(dirty);

  const first = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  const monthDays = Array.from({ length: daysInMonth }, (_, i) => isoDay(new Date(first.getFullYear(), first.getMonth(), i + 1)));
  const editable = (iso) => iso >= todayIso && iso <= lastIso;
  const maxOffset = (parseDay(lastIso).getFullYear() - today.getFullYear()) * 12 + parseDay(lastIso).getMonth() - today.getMonth();
  const monthLabel = `${MONTHS[first.getMonth()]} ${first.getFullYear()}`;

  function setDay(iso, value) {
    setStates((current) => {
      const next = { ...current };
      if (value) next[iso] = value; else delete next[iso];
      return next;
    });
  }

  function toggle(iso) {
    const value = NEXT[states[iso]];
    setDay(iso, value);
    setAnnounce(`${parseDay(iso).getDate()} de ${MONTHS[first.getMonth()]}: ${value ? STATE_TEXT[value] : 'sin dato'}.`);
  }

  function fillMonth(value) {
    setStates((current) => {
      const next = { ...current };
      for (const iso of monthDays) {
        if (!editable(iso)) continue;
        if (value) next[iso] = value; else delete next[iso];
      }
      return next;
    });
    setAnnounce(value ? `${monthLabel}: todo disponible.` : `${monthLabel}: sin datos.`);
  }

  function handleKey(event, index) {
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 }[event.key];
    if (!step) return;
    event.preventDefault();
    const target = Math.min(daysInMonth - 1, Math.max(0, index + step));
    document.getElementById(`dispo-${monthDays[target]}`)?.focus();
  }

  async function save(event) {
    event.preventDefault();
    if (!dirty) return;
    const from = changedDays[0];
    const to = changedDays[changedDays.length - 1];
    const days = Object.entries(states).filter(([day]) => day >= from && day <= to).map(([day, state]) => ({ day, state }));
    setBusy(true);
    setError('');
    try {
      await talentApi.putAvailability(detail.id, { from, to, days });
      await onSaved({ title: 'Disponibilidad guardada', text: 'Ya se ve en el calendario del perfil.' });
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  }

  const NAV = `${BTN_GHOST} px-[11px]!`;
  return (
    <form onSubmit={save} noValidate aria-labelledby="dispo-titulo">
      <h3 id="dispo-titulo" className="m-0 font-sans text-[22px] font-extrabold tracking-[-0.03em] text-ink">Disponibilidad</h3>
      <p className={`${HINT} mt-2 max-w-[680px]`}>
        Toca un día (o usa Enter o Espacio) para cambiarlo: disponible, ocupado o sin dato. Las flechas del teclado pasan de un día a otro. Va de hoy hasta un año adelante.
      </p>
      <p className="sr-only" aria-live="polite">{announce}</p>

      <div className="mt-5 max-w-[520px]">
        <div className="flex items-center justify-between gap-2">
          <button type="button" className={NAV} onClick={() => setOffset(offset - 1)} disabled={offset === 0} aria-label="Mes anterior"><Icon name="arrow-left" className="size-4" /></button>
          <p className="m-0 text-[17px] font-bold capitalize text-ink" aria-live="polite">{monthLabel}</p>
          <button type="button" className={NAV} onClick={() => setOffset(offset + 1)} disabled={offset >= maxOffset} aria-label="Mes siguiente"><Icon name="arrow-right" className="size-4" /></button>
        </div>
        <div className="mt-3 grid grid-cols-[repeat(7,minmax(0,1fr))] gap-1.5" role="group" aria-label={`Días de ${monthLabel}`}>
          {WEEKDAYS.map(([short, full]) => <span key={full} className="pb-1 text-center text-[12px] font-bold text-[#3f514a]" aria-hidden="true">{short}</span>)}
          {Array.from({ length: lead }, (_, i) => <span key={`v${i}`} aria-hidden="true" />)}
          {monthDays.map((iso, index) => {
            const state = states[iso];
            const canEdit = editable(iso);
            const day = parseDay(iso).getDate();
            const tone = !canEdit ? 'bg-transparent text-[#a3aca8] cursor-not-allowed'
              : state === 'AVAILABLE' ? 'bg-mint text-ink-deep font-extrabold'
                : state === 'BUSY' ? 'bg-gold text-ink-deep font-extrabold' : 'bg-white text-ink hover:bg-cream';
            return (
              <button key={iso} id={`dispo-${iso}`} type="button" disabled={!canEdit} onClick={() => toggle(iso)} onKeyDown={(event) => handleKey(event, index)}
                aria-label={`${day} de ${MONTHS[first.getMonth()]}: ${state ? STATE_TEXT[state] : 'sin dato'}`}
                className={`h-11 cursor-pointer rounded-[8px] border border-line text-[15px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none ${tone}`}>
                {day}
              </button>
            );
          })}
        </div>
        <ul className="mt-3 mb-0 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-[13px] font-semibold text-[#3f514a]">
          <li className="inline-flex items-center gap-2"><span className="size-3.5 rounded-[4px] bg-mint" aria-hidden="true" />Disponible</li>
          <li className="inline-flex items-center gap-2"><span className="size-3.5 rounded-[4px] bg-gold" aria-hidden="true" />Ocupado</li>
          <li className="inline-flex items-center gap-2"><span className="size-3.5 rounded-[4px] border border-line bg-white" aria-hidden="true" />Sin dato</li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={BTN_GHOST} onClick={() => fillMonth('AVAILABLE')}>Marcar todo el mes como disponible</button>
          <button type="button" className={BTN_GHOST} onClick={() => fillMonth(undefined)}>Limpiar mes</button>
        </div>
      </div>

      {error && <p className={`${ALERT} mt-5`} role="alert">{error}</p>}
      <SaveBar busy={busy} dirty={dirty} label="Guardar disponibilidad" disabledText={dirty ? '' : 'Sin cambios'} />
    </form>
  );
}
