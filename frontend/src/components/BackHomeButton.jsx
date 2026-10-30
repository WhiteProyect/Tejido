// Píldora "Volver al inicio" de las pantallas de cuenta (login, crear cuenta, recuperar e
// invitación), fija arriba a la izquierda y por encima del arte decorativo.
export default function BackHomeButton() {
  return (
    <a
      href="#inicio"
      className="absolute left-6 top-6 z-30 inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-gold bg-ink py-2 pr-5 pl-4 text-[15px] leading-none font-bold text-cream no-underline shadow-[0_6px_16px_rgba(23,63,54,.18)] hover:-translate-y-0.5 hover:brightness-[1.18] hover:shadow-[0_10px_22px_rgba(23,63,54,.24)] active:translate-y-0 active:brightness-100 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-ink motion-safe:transition-[translate,filter,box-shadow] motion-safe:duration-200 max600:left-3 max600:top-4"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
      </svg>
      Volver al inicio
    </a>
  );
}
