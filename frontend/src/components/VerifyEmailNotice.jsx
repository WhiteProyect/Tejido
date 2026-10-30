import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../utils/api.js';

// Aviso de correo sin verificar. Dos formas, el mismo texto y el mismo "Reenviar correo"
// (POST /api/auth/resend-verification; el limite de 60 s llega como mensaje del backend):
// - VerifyEmailBanner: franja discreta bajo el header, solo con sesion y email_verified false.
//   Cuando una accion bloqueada responde EMAIL_NOT_VERIFIED, notifyUnverified() la resalta y le
//   pasa el foco, en vez de mostrar un error generico.
// - UnverifiedNotice: el mismo aviso dentro de un formulario (p. ej. pedir participar en una rama).
export const UNVERIFIED_TEXT = 'Verifica tu correo para guardar y participar';
const EVENT = 'tejido:verificar-correo';

export function isUnverifiedError(error) {
  return error?.code === 'EMAIL_NOT_VERIFIED';
}

export function notifyUnverified() {
  window.dispatchEvent(new CustomEvent(EVENT));
}

function useResend() {
  const [state, setState] = useState({ busy: false, message: '', error: false });
  async function resend() {
    setState({ busy: true, message: '', error: false });
    try {
      const result = await apiRequest('/api/auth/resend-verification', { method: 'POST' });
      setState({ busy: false, message: result.message, error: false });
    } catch (error) {
      setState({ busy: false, message: error.message, error: true });
    }
  }
  return { ...state, resend };
}

const RESEND = 'cursor-pointer rounded-full border border-ink bg-transparent py-1.5 px-4 text-[13px] font-bold text-ink transition-colors duration-200 hover:bg-ink hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-wait disabled:opacity-60';

function Body({ resendState, email }) {
  return (
    <>
      <p className="m-0 min-w-0 flex-1 text-[14px] leading-[1.45] text-ink">
        <strong>{UNVERIFIED_TEXT}.</strong>{' '}
        <span className="text-[#3f514a]">Te enviamos un enlace{email ? ` a ${email}` : ''} cuando creaste tu cuenta.</span>
      </p>
      <button type="button" className={RESEND} onClick={resendState.resend} disabled={resendState.busy}>
        {resendState.busy ? 'Enviando...' : 'Reenviar correo'}
      </button>
      <p className={`m-0 w-full text-[13px] font-semibold ${resendState.error ? 'text-[#a8431f]' : 'text-[#2f5a46]'}`} aria-live="polite">
        {resendState.message}
      </p>
    </>
  );
}

export function VerifyEmailBanner({ user }) {
  const resendState = useResend();
  const ref = useRef(null);
  const [flash, setFlash] = useState(false);
  const visible = Boolean(user) && user.email_verified === false;

  useEffect(() => {
    function show() {
      setFlash(true);
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      ref.current?.focus({ preventScroll: true });
      setTimeout(() => setFlash(false), 2400);
    }
    window.addEventListener(EVENT, show);
    return () => window.removeEventListener(EVENT, show);
  }, []);

  if (!visible) return null;
  return (
    <div ref={ref} tabIndex={-1} role="region" aria-label="Correo sin verificar"
      className={`border-b py-2.5 px-[5vw] transition-colors duration-300 focus:outline-none motion-reduce:transition-none ${flash ? 'border-b-gold bg-[#f6dfa6]' : 'border-b-[#ecd9a8] bg-[#fdf3dc]'}`}>
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-4 gap-y-1">
        <Body resendState={resendState} email={user.email} />
      </div>
    </div>
  );
}

export function UnverifiedNotice({ email }) {
  const resendState = useResend();
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[14px] border border-[#ecd9a8] bg-[#fdf3dc] py-3 px-4 text-left" role="alert">
      <Body resendState={resendState} email={email} />
    </div>
  );
}
