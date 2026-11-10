/**
 * SEARCH.JS — Búsqueda compartida de publicaciones.
 *
 * La usan el buscador global del header y Explorar. No consulta la API: puntúa
 * las publicaciones que App ya cargó, con el mismo criterio que el Chat
 * Turístico de Hilo (título, lugar, categoría/tipo y resumen).
 */

import { CULTURAL_CATEGORIES, KIND_LABELS, MUNICIPALITY_LOCATION_MAP, normalizeText } from './constants.js';

const LABEL_BY_CATEGORY = Object.fromEntries(CULTURAL_CATEGORIES.map(([key, label]) => [key, label]));

// Municipio por palabras clave del lugar, sin el valor por defecto de passportUtils
// (allí todo lo desconocido cuenta como Caucasia; para filtrar eso sería engañoso).
export function municipalityOf(location = '') {
  const normalized = normalizeText(location);
  for (const [municipality, keywords] of Object.entries(MUNICIPALITY_LOCATION_MAP)) {
    if (keywords.some((keyword) => normalized.includes(normalizeText(keyword)))) return municipality;
  }
  return '';
}

const STOPWORDS = new Set([
  'de', 'la', 'el', 'que', 'en', 'un', 'una', 'y', 'o', 'hay', 'para', 'por', 'con', 'del',
  'los', 'las', 'me', 'mi', 'tu', 'es', 'esta', 'este', 'como', 'donde', 'cuando', 'quien',
  'cual', 'al', 'se', 'su', 'mas', 'pero', 'muy', 'sin', 'sobre', 'entre', 'hasta', 'desde',
  'lo', 'le', 'les', 'algo', 'quiero', 'busco', 'ver', 'conocer', 'recomiendame', 'buscar',
]);

export function tokensOf(text) {
  return normalizeText(text)
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
}

// Puntúa una publicación según dónde aparecen las palabras buscadas.
export function scorePublication(publication, tokens) {
  const title = normalizeText(publication.title || '');
  const summary = normalizeText(publication.summary || '');
  const location = normalizeText(publication.location || '');
  const meta = normalizeText([
    LABEL_BY_CATEGORY[publication.cultural_category],
    KIND_LABELS[publication.kind],
    publication.cultural_category,
  ].filter(Boolean).join(' '));
  let score = 0;
  for (const token of tokens) {
    if (title.includes(token)) score += 5;
    else if (location.includes(token)) score += 3;
    else if (meta.includes(token)) score += 2;
    else if (summary.includes(token)) score += 1;
  }
  return score;
}

const dateOf = (publication) => {
  const value = publication.start_date || publication.published_at || publication.created_at;
  const time = value ? new Date(value).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
};

/**
 * Publicaciones que coinciden con el texto y los filtros.
 * - Sin texto ni filtros devuelve [] (ni el header ni Explorar muestran todo).
 * - Con filtros y sin texto devuelve todo lo filtrado, lo más reciente primero.
 * - Con texto, solo lo que supera el umbral 3, de mayor a menor puntaje.
 */
export function searchPublications(publications = [], query = '', filters = {}) {
  const { kind = '', municipality = '', category = '' } = filters;
  const tokens = tokensOf(query);
  const hasFilters = Boolean(kind || municipality || category);
  if (!tokens.length && !hasFilters) return [];

  const scored = publications
    .filter((publication) => {
      if (kind && publication.kind !== kind) return false;
      if (category && publication.cultural_category !== category) return false;
      if (municipality && municipalityOf(publication.location || '') !== municipality) return false;      return true;
    })
    .map((publication) => ({
      publication,
      score: tokens.length ? scorePublication(publication, tokens) : 1,
    }))
    .filter((entry) => (tokens.length ? entry.score >= 3 : true));

  scored.sort((a, b) => (b.score - a.score) || (dateOf(b.publication) - dateOf(a.publication)));
  return scored.map((entry) => entry.publication);
}

/** Hash de Explorar con los filtros aplicados (para compartir o deep-link). */
export function exploreHash({ q = '', kind = '', municipality = '', category = '' } = {}) {
  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  if (kind) params.set('kind', kind);
  if (municipality) params.set('mun', municipality);
  if (category) params.set('cat', category);
  const query = params.toString();
  return `#explorar${query ? `?${query}` : ''}`;
}

export function parseExploreFilters(hash = window.location.hash) {
  const raw = hash.replace(/^#/, '');
  const params = new URLSearchParams(raw.startsWith('explorar?') ? raw.slice('explorar?'.length) : '');
  const kind = params.get('kind') || '';
  return {
    q: params.get('q') || '',
    kind: Object.prototype.hasOwnProperty.call(KIND_LABELS, kind) ? kind : '',
    municipality: params.get('mun') || '',
    category: LABEL_BY_CATEGORY[params.get('cat') || ''] ? params.get('cat') : '',
  };
}
