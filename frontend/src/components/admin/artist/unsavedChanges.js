import { useEffect, useRef } from 'react';

// Aviso de cambios sin guardar del editor de artistas. Cada formulario con cambios se anota aqui
// (useUnsavedChanges); quien va a sacar al usuario de la vista (pestanas del editor y del dashboard,
// "Volver a Artistas") pregunta antes con confirmDiscard(). Cerrar o recargar la pagina lo cubre
// beforeunload. Un enlace del menu del sitio (hash) no se puede cancelar: ahi no hay aviso.

const dirtyForms = new Set();
const MESSAGE = 'Tienes cambios sin guardar. ¿Salir y descartarlos?';

function handleBeforeUnload(event) {
  event.preventDefault();
  event.returnValue = '';
}

function sync() {
  if (dirtyForms.size) window.addEventListener('beforeunload', handleBeforeUnload);
  else window.removeEventListener('beforeunload', handleBeforeUnload);
}

export function useUnsavedChanges(dirty) {
  const token = useRef(Symbol('formulario'));
  useEffect(() => {
    const key = token.current;
    if (dirty) dirtyForms.add(key);
    else dirtyForms.delete(key);
    sync();
    return () => {
      dirtyForms.delete(key);
      sync();
    };
  }, [dirty]);
}

// true si se puede salir: no hay cambios o el usuario acepta descartarlos.
export function confirmDiscard() {
  if (!dirtyForms.size) return true;
  if (!window.confirm(MESSAGE)) return false;
  dirtyForms.clear();
  sync();
  return true;
}
