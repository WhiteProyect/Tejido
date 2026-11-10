/**
 * APPLICATIONS.JS — Registro local de postulaciones a convocatorias.
 *
 * La postulación sigue siendo el enlace externo de la convocatoria (fase 1),
 * pero se recuerda en el navegador que el ciudadano ya se postuló, para que
 * el detalle se lo muestre al volver.
 */

const STORAGE_KEY = 'tejido_applications';
const EVENT = 'tejido:applications';

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function isApplied(publicationId) {
  return Boolean(read()[String(publicationId)]);
}

export function appliedAt(publicationId) {
  return read()[String(publicationId)] || '';
}

/** Marca la postulación (idempotente) y avisa a los componentes abiertos. */
export function markApplied(publicationId) {
  if (!publicationId) return;
  const entries = read();
  entries[String(publicationId)] = new Date().toISOString();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Sin storage el estado vive solo en memoria durante la sesión.
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENT));
}

/** Fecha legible: "10 de noviembre de 2026". */
export function formatAppliedDate(isoDate) {
  const date = isoDate ? new Date(isoDate) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

export function onApplicationsChange(handler) {
  if (typeof window === 'undefined') return () => {};
  const listener = () => handler();
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
