// Agenda (#agenda): filtros en el hash, consulta a GET /api/agenda y ayudas de fecha de las tarjetas.
// Los filtros viajan en el hash (#agenda?mun=<municipio>&cat=<categoria>&anteriores=1), como en
// Talento, para poder compartirlos; los slugs invalidos se ignoran.
import { isActiveSlug } from './culturalBranches.js';
import { MUNICIPALITY_LIST } from './municipalities.js';

export const EMPTY_AGENDA_FILTERS = { mun: '', cat: '', past: false };

const MUNICIPALITY_SLUGS = new Set(MUNICIPALITY_LIST.map(({ slug }) => slug));
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function parseAgendaFilters(hash = window.location.hash) {
  const raw = hash.replace(/^#/, '');
  const params = new URLSearchParams(raw.startsWith('agenda?') ? raw.slice('agenda?'.length) : '');
  const mun = params.get('mun') || '';
  const cat = params.get('cat') || '';
  return {
    mun: MUNICIPALITY_SLUGS.has(mun) ? mun : '',
    // Solo ramas activas (utils/culturalBranches.js; la pantalla relee al llegar la lista).
    cat: isActiveSlug(cat) ? cat : '',
    past: params.get('anteriores') === '1',
  };
}

export function agendaHash(filters) {
  const params = new URLSearchParams();
  if (filters.mun) params.set('mun', filters.mun);
  if (filters.cat) params.set('cat', filters.cat);
  if (filters.past) params.set('anteriores', '1');
  const query = params.toString();
  return `#agenda${query ? `?${query}` : ''}`;
}

export function agendaUrl(filters, offset = 0) {
  const params = new URLSearchParams();
  if (filters.mun) params.set('municipality', filters.mun);
  if (filters.cat) params.set('category', filters.cat);
  if (filters.past) params.set('past', '1');
  if (filters.past && offset) params.set('offset', String(offset));
  const query = params.toString();
  return `/api/agenda${query ? `?${query}` : ''}`;
}

export const sameAgendaFilters = (a, b) => a.mun === b.mun && a.cat === b.cat && a.past === b.past;

// La API manda fechas sin zona ("2026-07-20T19:00:00"): se leen como hora local, sin conversiones.
function parts(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(iso || '');
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  return { year: Number(year), month: Number(month) - 1, day: Number(day), time: hour ? `${hour}:${minute}` : '' };
}

// Hora "7:00 p. m."; vacia si no hay o es 00:00 (el calendario guarda asi la fecha sin hora).
export function eventTime(iso) {
  const p = parts(iso);
  if (!p || !p.time || p.time === '00:00') return '';
  const [hour, minute] = p.time.split(':').map(Number);
  return new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit' }).format(new Date(2000, 0, 1, hour, minute));
}

const shortMonth = (month) => MONTHS[month].slice(0, 3);

// Bloque de fecha de la tarjeta: { day: "20", month: "jul" } o, en un rango, { day: "20–22", month:
// "jul" } / { day: "30 nov", month: "2 dic", range: true }. Con otro año que el actual, lo agrega.
export function dateBadge(start, end) {
  const from = parts(start || end);
  if (!from) return null;
  const to = parts(end);
  const year = from.year !== new Date().getFullYear() ? String(from.year) : '';
  if (!to || (to.year === from.year && to.month === from.month && to.day === from.day)) {
    return { day: String(from.day), month: shortMonth(from.month), year };
  }
  if (to.year === from.year && to.month === from.month) {
    return { day: `${from.day}–${to.day}`, month: shortMonth(from.month), year };
  }
  return { day: `${from.day} ${shortMonth(from.month)}`, month: `${to.day} ${shortMonth(to.month)}`, year: to.year !== from.year ? `${from.year}–${to.year}` : year, range: true };
}

// Texto completo de la fecha para lectores de pantalla y el pie de la tarjeta.
export function dateText(start, end) {
  const from = parts(start || end);
  if (!from) return '';
  const label = (p) => `${p.day} de ${MONTHS[p.month]} de ${p.year}`;
  const to = parts(end);
  const sameDay = to && to.year === from.year && to.month === from.month && to.day === from.day;
  return to && !sameDay ? `Del ${label(from)} al ${label(to)}` : label(from);
}

// Proximos agrupados por mes de inicio: [{ key: "2026-11", label: "Noviembre 2026", events }].
export function groupByMonth(events) {
  const groups = [];
  for (const event of events) {
    const p = parts(event.start_date);
    const key = p ? `${p.year}-${String(p.month + 1).padStart(2, '0')}` : 'sin-fecha';
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      const label = p ? `${MONTHS[p.month][0].toUpperCase()}${MONTHS[p.month].slice(1)} ${p.year}` : 'Sin fecha';
      group = { key, label, events: [] };
      groups.push(group);
    }
    group.events.push(event);
  }
  return groups;
}

// Linea de fecha de la tarjeta (mayusculas en dia y mes): "14 NOV · 4:00 p. m. — 9:00 p. m.",
// "20 al 22 NOV · 6:30 p. m.", "30 NOV al 2 DIC"; con el año si no es el actual.
export function dateLine(start, end) {
  const from = parts(start || end);
  if (!from) return '';
  const to = parts(end);
  const current = new Date().getFullYear();
  const mon = (p) => shortMonth(p.month).toUpperCase();
  const year = (p) => (p.year !== current ? ` ${p.year}` : '');
  const sameDay = !to || (to.year === from.year && to.month === from.month && to.day === from.day);
  let text;
  if (sameDay) text = `${from.day} ${mon(from)}${year(from)}`;
  else if (to.year === from.year && to.month === from.month) text = `${from.day} al ${to.day} ${mon(from)}${year(from)}`;
  else text = `${from.day} ${mon(from)}${to.year !== from.year ? year(from) : ''} al ${to.day} ${mon(to)}${year(to)}`;
  const startTime = eventTime(start);
  const endTime = sameDay && to ? eventTime(end) : '';
  if (startTime) text += ` · ${startTime}${endTime ? ` — ${endTime}` : ''}`;
  return text;
}
