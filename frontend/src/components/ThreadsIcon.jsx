import { motion, useReducedMotion } from 'framer-motion';

// Icono "tres hebras" del menu movil: tres lineas de 2 px de largo distinto alineadas a la derecha
// (18 px crema, 13 px dorada al centro, 16 px crema). Abierto: la 1 y la 3 giran a +45 y -45 grados
// (la 3 pasa a dorado: el cruce es crema + dorado) y la del centro se funde. `fromClosed` hace que
// arranque como hebras y gire hasta la X al montarse (boton de cierre del panel).
const SPRING = { type: 'spring', stiffness: 320, damping: 24 };

function lineState(index, open, line, accent) {
  if (!open) return [{ y: 0, rotate: 0, width: 18, backgroundColor: line, opacity: 1 }, { opacity: 1, width: 13, backgroundColor: accent }, { y: 0, rotate: 0, width: 16, backgroundColor: line, opacity: 1 }][index];
  return [{ y: 6, rotate: 45, width: 16, backgroundColor: line, opacity: 1 }, { opacity: 0, width: 13, backgroundColor: accent }, { y: -6, rotate: -45, width: 16, backgroundColor: accent, opacity: 1 }][index];
}

export default function ThreadsIcon({ open = false, fromClosed = false, line = '#f3e4c8', accent = '#d4a843' }) {
  const reduceMotion = useReducedMotion();
  return (
    <span aria-hidden="true" className="flex flex-col items-end gap-1">
      {[0, 1, 2].map((index) => (
        <motion.span
          key={index}
          className="block h-0.5 rounded-full"
          initial={fromClosed && !reduceMotion ? lineState(index, false, line, accent) : false}
          animate={lineState(index, open, line, accent)}
          transition={reduceMotion ? { duration: 0 } : SPRING}
        />
      ))}
    </span>
  );
}
