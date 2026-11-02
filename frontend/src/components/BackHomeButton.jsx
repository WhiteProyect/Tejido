import { motion, useReducedMotion } from 'framer-motion';

// Píldora "Volver al inicio" de las pantallas de cuenta (login, crear cuenta, recuperar e
// invitación), arriba a la izquierda y por encima del arte decorativo. Tinta sólida, sin borde ni
// sombra; hover un tono más claro y la casa sube 1 px; al pulsar se encoge un poco. Entra desde la
// izquierda al montar. Con `onLeave` (de utils/useLeaveTransition.js) la pantalla sale animada antes
// de navegar; mientras tanto (`leaving`) la casa da un saltito.
const BUTTON = 'group absolute left-6 top-6 z-30 inline-flex min-h-11 items-center gap-2 rounded-full bg-ink py-2 pr-5 pl-4 text-[15px] leading-none font-bold text-cream no-underline hover:bg-[#1f5246] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-ink motion-safe:transition-[background-color,scale] motion-safe:duration-200 max600:left-3 max600:top-4';

export default function BackHomeButton({ onLeave, leaving = false }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.a
      href="#inicio"
      className={BUTTON}
      onClick={onLeave ? (event) => onLeave(event, 'inicio') : undefined}
      {...(reduceMotion ? {} : { initial: { opacity: 0, x: -12 }, animate: { opacity: 1, x: 0 }, transition: { duration: 0.3, ease: 'easeOut' } })}
    >
      <motion.svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-5 shrink-0 group-hover:-translate-y-px motion-safe:transition-[translate] motion-safe:duration-200"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        animate={leaving ? { y: [0, -4, 0] } : { y: 0 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
      >
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
      </motion.svg>
      Volver al inicio
    </motion.a>
  );
}
