import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

// Salida animada de una pantalla antes de navegar (p. ej. "Volver al inicio" en las pantallas de
// cuenta). `leave(event, hash)` va en el onClick de un enlace real: con clic izquierdo sin
// modificadores (o Enter) marca `leaving`, espera `duration` ms y navega; Ctrl/Cmd/Shift/clic central
// y el movimiento reducido dejan el enlace normal. Mientras sale ignora los clics extra.
// Si se vuelve a esta pantalla antes de que termine de salir (Atras muy rapido), React la reutiliza:
// al cambiar el hash a otro que no es el destino se deshace la salida.
export default function useLeaveTransition(duration = 300) {
  const reduceMotion = useReducedMotion();
  const [leaving, setLeaving] = useState(false);
  const target = useRef(null);
  const timer = useRef(null);

  useEffect(() => {
    const reset = () => {
      if (target.current && window.location.hash !== `#${target.current}`) {
        target.current = null;
        setLeaving(false);
      }
    };
    window.addEventListener('hashchange', reset);
    return () => {
      window.removeEventListener('hashchange', reset);
      window.clearTimeout(timer.current);
    };
  }, []);

  const leave = useCallback((event, hash) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (reduceMotion) return;
    event.preventDefault();
    if (target.current) return;
    target.current = hash;
    setLeaving(true);
    timer.current = window.setTimeout(() => { window.location.hash = hash; }, duration);
  }, [duration, reduceMotion]);

  return { leaving, leave };
}
