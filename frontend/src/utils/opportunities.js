// Oportunidades (#oportunidades): filtros en el hash, consulta a GET /api/opportunities y aviso de
// cierre. Los filtros viajan en el hash (#oportunidades?mun=&tipo=&cat=&pronto=1), como en la Agenda;
// los slugs de municipio y categoria invalidos se ignoran (el de tipo lo valida la pantalla con la
// lista de tipos activos).
import { isActiveSlug } from './culturalBranches.js';
import { closingNotice as dayNotice, getCountdown } from './dateUtils.js';
import { MUNICIPALITY_LIST } from './municipalities.js';

export const EMPTY_OPPORTUNITY_FILTERS = { mun: '', tipo: '', cat: '', pronto: false };

const MUNICIPALITY_SLUGS = new Set(MUNICIPALITY_LIST.map(({ slug }) => slug));
const TYPE_SLUG = /^[a-z0-9-]{1,60}$/;
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function parseOpportunityFilters(hash = window.location.hash) {
  const raw = hash.replace(/^#/, '');
  const params = new URLSearchParams(raw.startsWith('oportunidades?') ? raw.slice('oportunidades?'.length) : '');
  const mun = params.get('mun') || '';
  const cat = params.get('cat') || '';
  const tipo = params.get('tipo') || '';
  return {
    mun: MUNICIPALITY_SLUGS.has(mun) ? mun : '',
    tipo: TYPE_SLUG.test(tipo) ? tipo : '',
    // Solo ramas activas (utils/culturalBranches.js; la pantalla relee al llegar la lista).
    cat: isActiveSlug(cat) ? cat : '',
    pronto: params.get('pronto') === '1',
  };
}

export function opportunityHash(filters) {
  const params = new URLSearchParams();
  if (filters.mun) params.set('mun', filters.mun);
  if (filters.tipo) params.set('tipo', filters.tipo);
  if (filters.cat) params.set('cat', filters.cat);
  if (filters.pronto) params.set('pronto', '1');
  const query = params.toString();
  return `#oportunidades${query ? `?${query}` : ''}`;
}

export function opportunitiesUrl(filters, offset = 0) {
  const params = new URLSearchParams();
  if (filters.mun) params.set('municipality', filters.mun);
  if (filters.tipo) params.set('type', filters.tipo);
  if (filters.cat) params.set('category', filters.cat);
  if (filters.pronto) params.set('soon', '1');
  if (offset) params.set('offset', String(offset));
  const query = params.toString();
  return `/api/opportunities${query ? `?${query}` : ''}`;
}

export const sameOpportunityFilters = (a, b) => a.mun === b.mun && a.tipo === b.tipo && a.cat === b.cat && a.pronto === b.pronto;

// ¿Ya cerro? (dia del navegador; la API marca `closed` con el dia de Bogota).
export const isClosed = (endDate) => Boolean(endDate) && getCountdown(endDate).isPast;

// Aviso de cierre (dateUtils.closingNotice): "Cierra hoy", "Quedan N dias"...; "Convocatoria abierta"
// sin fecha (kind 'open'); null si ya cerro.
export function closingNotice(endDate) {
  if (!endDate) return { text: 'Convocatoria abierta', tone: 'normal', kind: 'open' };
  return dayNotice(endDate);
}

// "20 nov" (con el año si no es el actual) y la hora si la trae y no es 00:00.
export function closingDate(endDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(endDate || '');
  if (!match) return '';
  const [, year, month, day, hour, minute] = match;
  let text = `${Number(day)} ${MONTHS[Number(month) - 1]}`;
  if (Number(year) !== new Date().getFullYear()) text += ` ${year}`;
  if (hour && `${hour}:${minute}` !== '00:00') {
    text += `, ${new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit' }).format(new Date(2000, 0, 1, Number(hour), Number(minute)))}`;
  }
  return text;
}

// "25 de noviembre, 11:59 p. m." (la hora solo si no es 00:00; el año si no es el actual).
export function closingLine(endDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(endDate || '');
  if (!match) return '';
  const [, year, month, day, hour, minute] = match;
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  let text = `${Number(day)} de ${months[Number(month) - 1]}`;
  if (Number(year) !== new Date().getFullYear()) text += ` de ${year}`;
  if (hour && `${hour}:${minute}` !== '00:00') {
    text += `, ${new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit' }).format(new Date(2000, 0, 1, Number(hour), Number(minute)))}`;
  }
  return text;
}
