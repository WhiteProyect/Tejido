/**
 * HILOBUS.JS — Puente de reacciones entre el sitio y Hilo.
 *
 * Permite que Hilo reaccione a acciones hechas fuera de su panel (guardar,
 * compartir) sin acoplar los componentes: quien actua emite, Hilo escucha.
 */

export const HILO_REACTION_EVENT = 'hilo:reaction';

export function hiloReaction(kind, detail = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(HILO_REACTION_EVENT, { detail: { kind, ...detail } }));
}

export function onHiloReaction(handler) {
  if (typeof window === 'undefined') return () => {};
  const listener = (event) => handler(event.detail || {});
  window.addEventListener(HILO_REACTION_EVENT, listener);
  return () => window.removeEventListener(HILO_REACTION_EVENT, listener);
}
