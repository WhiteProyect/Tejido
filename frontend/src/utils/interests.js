/**
 * INTERESTS.JS — Señales locales de interés para el bloque "Para ti".
 *
 * Guardar, reaccionar o marcar "me interesa" deja una señal en localStorage
 * (sin backend). Explorar la usa para recomendar contenidos parecidos por
 * categoría, tipo y municipio.
 */

import { getMunicipalityFromLocation } from './passportUtils.js';

const STORAGE_KEY = 'tejido_interests';
const EVENT = 'tejido:interests';
const MAX_ENTRIES = 40;

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function write(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Sin storage la señal vive solo en memoria durante la sesión.
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENT));
}

/** Guarda una señal de interés de la publicación (idempotente). */
export function recordInterest(publication) {
  if (!publication?.id) return;
  const entries = read();
  const ordered = Object.entries(entries)
    .filter(([id]) => Number(id) !== Number(publication.id))
    .slice(-(MAX_ENTRIES - 1));
  ordered.push([String(publication.id), {
    category: publication.cultural_category || '',
    kind: publication.kind || '',
    municipality: publication.location ? getMunicipalityFromLocation(publication.location) : '',
    at: Date.now(),
  }]);
  write(Object.fromEntries(ordered));
}

/** Entradas guardadas, de la más reciente a la más antigua. */
export function loadInterests() {
  return Object.values(read()).sort((a, b) => (b.at || 0) - (a.at || 0));
}

export function countInterests() {
  return loadInterests().length;
}

/**
 * Publicaciones parecidas a las señales guardadas: categoría (3), tipo (2) y
 * municipio (2). Excluye lo que ya se guardó como interés directo.
 */
export function relatedToInterests(publications = [], limit = 4) {
  const entries = loadInterests();
  if (!entries.length) return [];
  const direct = new Set(Object.keys(read()).map(Number));
  const categories = new Set(entries.map((entry) => entry.category).filter(Boolean));
  const kinds = new Set(entries.map((entry) => entry.kind).filter(Boolean));
  const municipalities = new Set(entries.map((entry) => entry.municipality).filter(Boolean));

  return publications
    .filter((publication) => !direct.has(Number(publication.id)))
    .map((publication) => {
      let score = 0;
      if (categories.has(publication.cultural_category)) score += 3;
      if (kinds.has(publication.kind)) score += 2;
      if (municipalities.has(getMunicipalityFromLocation(publication.location || ''))) score += 2;
      return { publication, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.publication);
}

/** Suscripción a cambios de interés (para refrescar "Para ti" sin recargar). */
export function onInterestsChange(handler) {
  if (typeof window === 'undefined') return () => {};
  const listener = () => handler();
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
