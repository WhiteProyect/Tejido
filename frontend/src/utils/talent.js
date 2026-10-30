import { useState } from 'react';
import { UNVERIFIED_TEXT, isUnverifiedError, notifyUnverified } from '../components/VerifyEmailNotice.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { apiRequest } from './api.js';
import { CULTURAL_CATEGORIES, MUNICIPALITIES } from './constants.js';

// Utilidades del talento contratable (#talento y #talento/<slug>).

export const CATEGORY_BY_KEY = Object.fromEntries(CULTURAL_CATEGORIES.map(([key, label, slug]) => [key, { label, slug }]));
export const CATEGORY_KEY_BY_SLUG = Object.fromEntries(CULTURAL_CATEGORIES.map(([key, , slug]) => [slug, key]));
export const MUNICIPALITY_NAMES = Object.fromEntries(MUNICIPALITIES.map(({ id, name }) => [id, name]));

// Tinte solido por categoria para las portadas sin foto (sin degradados: color de marca mezclado con crema).
const CATEGORY_COLORS = {
  MUSICA: 'var(--river)',
  CINE_AUDIOVISUAL: 'var(--purple)',
  DANZA: 'var(--orange)',
  TEATRO: 'var(--gold)',
  ARTES_VISUALES: 'var(--mint)',
  LITERATURA: 'var(--ink)',
  ARTESANIAS: 'var(--earth)',
  PATRIMONIO_MEMORIA: 'var(--forest)',
  GASTRONOMIA_CULTURAL: 'var(--sunset)',
  EMPRENDIMIENTO_CULTURAL: 'var(--yellow)',
};

export function categoryColor(key) {
  return CATEGORY_COLORS[key] || 'var(--river)';
}

export function categoryTint(key, amount = 22) {
  return `color-mix(in srgb, ${categoryColor(key)} ${amount}%, #f3ece0)`;
}

// Pesos colombianos con punto de miles: 350000 -> "$350.000".
export function formatCOP(value) {
  if (value === null || value === undefined) return '';
  return `$${String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
export const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// "2026-11-12" -> Date local (sin corrimiento por zona horaria).
export function parseDay(iso) {
  const [year, month, day] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function isoDay(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// "2026-11-12" -> "12 nov".
export function formatShortDay(iso) {
  if (!iso) return '';
  const date = parseDay(iso);
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
}

// Iniciales para la portada sin foto: solo de palabras que empiezan por letra.
export function initials(name) {
  return name.split(/\s+/).filter((word) => /^\p{L}/u.test(word)).slice(0, 2).map((word) => word[0]).join('').toUpperCase();
}

export function categoryOrigin(talent) {
  const category = talent.category_label || CATEGORY_BY_KEY[talent.category]?.label || '';
  const origin = talent.origin_label || MUNICIPALITY_NAMES[talent.origin] || '';
  return [category, origin].filter(Boolean).join(' · ');
}

// Solo el ciudadano guarda (y el visitante, que va a login): a gestor y admin no se les muestra.
export function canSave(user) {
  return !user || user.role === 'CIUDADANO';
}

export function talentShareUrl(slug) {
  return `${window.location.origin}/#talento/${slug}`;
}

// ─── Filtros del listado en el hash: #talento?cat=<slug>&mun=<municipio>&q=<texto>&disp=1 ───

export const EMPTY_FILTERS = { cat: '', mun: '', q: '', disp: false };

export function parseTalentFilters(hash = window.location.hash) {
  const raw = hash.replace(/^#/, '');
  const query = raw.startsWith('talento?') ? raw.slice('talento?'.length) : '';
  const params = new URLSearchParams(query);
  const cat = params.get('cat') || '';
  const mun = params.get('mun') || '';
  return {
    cat: CATEGORY_KEY_BY_SLUG[cat] ? cat : '',
    mun: MUNICIPALITY_NAMES[mun] ? mun : '',
    q: (params.get('q') || '').slice(0, 100),
    disp: params.get('disp') === '1',
  };
}

export function talentHash(filters) {
  const params = new URLSearchParams();
  if (filters.cat) params.set('cat', filters.cat);
  if (filters.mun) params.set('mun', filters.mun);
  if (filters.q.trim()) params.set('q', filters.q.trim());
  if (filters.disp) params.set('disp', '1');
  const query = params.toString();
  return `#talento${query ? `?${query}` : ''}`;
}

// ─── Guardar talento (POST/DELETE /api/talent/{id}/favorite) ───
// Sin sesion lleva a login y vuelve a `returnTo`; onChange(favorito) avisa al padre (Guardadas).
export function useTalentFavorite(talent, user, { returnTo, onChange } = {}) {
  const { showToast } = useToast();
  const [favorite, setFavorite] = useState(!!talent.favorite);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    if (!user) {
      sessionStorage.setItem('tejido_return_to', returnTo || window.location.hash.replace('#', '') || 'talento');
      window.location.hash = 'login';
      return;
    }
    const next = !favorite;
    setFavorite(next);
    setBusy(true);
    try {
      await apiRequest(`/api/talent/${talent.id}/favorite`, { method: next ? 'POST' : 'DELETE' });
      showToast(next
        ? { tone: 'menta', eyebrow: 'Talento guardado', title: `${talent.name} quedó en tu agenda`, text: 'Lo encuentras en tus guardados.' }
        : { tone: 'menta', title: 'Talento quitado de tu agenda' });
      onChange?.(next);
    } catch (error) {
      setFavorite(!next);
      if (isUnverifiedError(error)) {
        notifyUnverified();
        showToast({ tone: 'dorado', title: UNVERIFIED_TEXT, text: 'Usa el enlace que te enviamos o pide otro en el aviso de arriba.' });
      } else {
        showToast({ tone: 'naranja', title: 'No pudimos guardar el talento', text: error.message });
      }
    } finally {
      setBusy(false);
    }
  }

  return { favorite, busy, toggle };
}
