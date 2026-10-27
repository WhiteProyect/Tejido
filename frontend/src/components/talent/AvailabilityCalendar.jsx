import { useState } from 'react';
import Icon from '../Icon.jsx';
import Modal from './Modal.jsx';
import { MONTHS, isoDay } from '../../utils/talent.js';

// "Disponibilidad": calendario del mes (lunes primero). Disponible = menta solido, ocupado =
// dorado solido, el resto neutro; la leyenda y el texto oculto de cada dia dicen el estado, no
// solo el color. Se navega del mes actual hasta 6 meses (lo que trae el perfil publico: hoy a
// +180 dias). "Ver agenda completa" abre un panel con los 6 meses, sin salir de la pagina.
const MONTHS_AHEAD = 6;
const WEEKDAYS = [['L', 'lunes'], ['M', 'martes'], ['M', 'miércoles'], ['J', 'jueves'], ['V', 'viernes'], ['S', 'sábado'], ['D', 'domingo']];
const STATE_TEXT = { AVAILABLE: 'disponible', BUSY: 'ocupado' };
const STATE_CLASS = { AVAILABLE: 'bg-mint font-bold text-ink-deep', BUSY: 'bg-gold font-bold text-ink-deep' };

function monthStart(offset) {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth() + offset, 1);
}

function weeksOf(first) {
  const lead = (first.getDay() + 6) % 7; // lunes = 0
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => new Date(first.getFullYear(), first.getMonth(), i + 1))];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, row) => cells.slice(row * 7, row * 7 + 7));
}

function Month({ first, states, today, captionVisible = false }) {
  const label = `${MONTHS[first.getMonth()]} ${first.getFullYear()}`;
  return (
    <table className="w-full table-fixed border-separate border-spacing-[3px] text-center">
      <caption className={captionVisible ? 'mb-2 text-left text-[15px] font-bold capitalize text-ink' : 'sr-only'}>{label}</caption>
      <thead>
        <tr>
          {WEEKDAYS.map(([short, full]) => (
            <th key={full} scope="col" abbr={full} className="pb-0.5 text-[12px] font-semibold text-[#3f514a]">{short}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {weeksOf(first).map((week, row) => (
          <tr key={row}>
            {week.map((date, col) => {
              if (!date) return <td key={col} />;
              const iso = isoDay(date);
              const state = states[iso];
              const past = iso < today;
              return (
                <td key={col} className={`h-[30px] rounded-[4px] text-[13px] ${state && !past ? STATE_CLASS[state] : past ? 'text-[#a3aca8]' : 'text-ink'}`}>
                  {date.getDate()}
                  {state && !past && <span className="sr-only">, {STATE_TEXT[state]}</span>}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Legend() {
  return (
    <ul className="mt-2 mb-0 flex list-none flex-wrap justify-center gap-x-4 gap-y-1 p-0 text-[12px] font-semibold text-[#3f514a]">
      <li className="inline-flex items-center gap-2"><span className="size-3.5 rounded-[4px] bg-mint" aria-hidden="true" />Disponible</li>
      <li className="inline-flex items-center gap-2"><span className="size-3.5 rounded-[4px] bg-gold" aria-hidden="true" />Ocupado</li>
    </ul>
  );
}

const NAV_BUTTON = 'inline-flex size-8 cursor-pointer items-center justify-center rounded-full border border-line bg-white text-ink hover:bg-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-40';

export default function AvailabilityCalendar({ availability, name }) {
  const [offset, setOffset] = useState(0);
  const [full, setFull] = useState(false);
  const states = Object.fromEntries(availability.map((item) => [String(item.day).slice(0, 10), item.state]));
  const today = isoDay(new Date());
  const first = monthStart(offset);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <button type="button" className={NAV_BUTTON} onClick={() => setOffset(offset - 1)} disabled={offset === 0} aria-label="Mes anterior">
          <Icon name="arrow-left" className="size-4" />
        </button>
        <p className="m-0 text-[15px] font-bold capitalize text-ink" aria-live="polite">{MONTHS[first.getMonth()]} {first.getFullYear()}</p>
        <button type="button" className={NAV_BUTTON} onClick={() => setOffset(offset + 1)} disabled={offset >= MONTHS_AHEAD - 1} aria-label="Mes siguiente">
          <Icon name="arrow-right" className="size-4" />
        </button>
      </div>
      <Month first={first} states={states} today={today} />
      <Legend />
      <div className="mt-3 text-center">
        <button type="button" onClick={() => setFull(true)}
          className="cursor-pointer border-0 bg-transparent p-0 text-[14px] font-semibold text-ink underline underline-offset-4 hover:decoration-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
          Ver agenda completa
        </button>
      </div>
      {full && (
        <Modal title={`Agenda de ${name}`} wide onClose={() => setFull(false)}>
          <p className="mt-2 mb-0 text-[14px] text-[#53645c]">Los próximos {MONTHS_AHEAD} meses.</p>
          <Legend />
          <div className="mt-6 grid grid-cols-[repeat(3,minmax(0,1fr))] gap-x-8 gap-y-6 max1024:grid-cols-[repeat(2,minmax(0,1fr))] max600:grid-cols-[minmax(0,1fr)]">
            {Array.from({ length: MONTHS_AHEAD }, (_, index) => (
              <Month key={index} first={monthStart(index)} states={states} today={today} captionVisible />
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
