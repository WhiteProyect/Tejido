/**
 * REACTIONS.JS — Reacción rápida "me interesa" (local).
 *
 * No hay endpoint de reacciones todavía: el estado y el contador viven en
 * localStorage. Además de dar feedback inmediato, la reacción alimenta el
 * bloque "Para ti" (utils/interests.js).
 */

import { countInterests, recordInterest } from './interests.js';

const STORAGE_KEY = 'tejido_reactions';
const EVENT = 'tejido:reactions';

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function hasReacted(publicationId) {
  return Boolean(read()[String(publicationId)]);
}

export function countReactions() {
  return Object.keys(read()).length;
}

/**
 * Alterna la reacción. Devuelve el estado nuevo (true = le interesa).
 * Al reaccionar también se guarda la señal para "Para ti".
 */
export function toggleReaction(publication) {
  if (!publication?.id) return false;
  const entries = read();
  const key = String(publication.id);
  const next = !entries[key];
  if (next) {
    entries[key] = Date.now();
    recordInterest(publication);
  } else {
    delete entries[key];
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Sin storage la reacción vive solo en memoria durante la sesión.
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENT));
  return next;
}

export function onReactionsChange(handler) {
  if (typeof window === 'undefined') return () => {};
  const listener = () => handler();
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

// El contador global de señales se muestra en "Para ti".
export { countInterests };
