import { useEffect, useId, useRef, useState } from 'react';
import { BTN_INK_MD, BTN_INK_OUTLINE_MD, FORM_INPUT, FORM_LABEL } from '../uiStyles.js';
import { useToast } from '../../context/ToastContext.jsx';
import { apiRequest } from '../../utils/api.js';
import { CULTURAL_CATEGORIES } from '../../utils/constants.js';
import { UnverifiedNotice, isUnverifiedError } from '../VerifyEmailNotice.jsx';

// Formulario "Quiero participar" en un dialogo accesible (categoria, perfil del lider y perfil del
// ciudadano). lockedBranch: la rama viene elegida y no se cambia. onSend(branch, message) es el
// send de useBranchRequest. Al enviar se explica que sigue: si la rama tiene lider (GET
// /api/gestores?branch=), lo revisa el lider; si no, el equipo. Foco al primer campo, Esc cierra,
// Tab queda dentro y el foco vuelve a donde estaba al cerrar.
export const MAX_REQUEST_MESSAGE = 500;
const LABELS = Object.fromEntries(CULTURAL_CATEGORIES.map(([key, label]) => [key, label]));
const ALERT = 'm-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[14px] text-[#b3442b]';

async function branchHasLeader(branch) {
  try {
    const gestores = await apiRequest(`/api/gestores?branch=${encodeURIComponent(branch)}`);
    return gestores.some((gestor) => gestor.is_leader);
  } catch {
    return null;
  }
}

export function nextStepText(branchLabel, hasLeader) {
  return hasLeader === false
    ? `El equipo de TEJIDO revisará tu solicitud para ${branchLabel} y te avisaremos por correo.`
    : `El líder de ${branchLabel} revisará tu solicitud y te avisaremos por correo.`;
}

export default function BranchRequestDialog({ lockedBranch, initialBranch, onSend, onClose }) {
  const { showToast } = useToast();
  const id = useId();
  const boxRef = useRef(null);
  const [branch, setBranch] = useState(lockedBranch || initialBranch || CULTURAL_CATEGORIES[0][0]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [unverified, setUnverified] = useState(false);
  const [sent, setSent] = useState(null); // { label, hasLeader }

  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    boxRef.current?.querySelector('select:not([disabled]), textarea')?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  useEffect(() => {
    if (sent) boxRef.current?.querySelector('button')?.focus();
  }, [sent]);

  function handleKeyDown(event) {
    if (event.key === 'Escape' && !sending) { event.preventDefault(); event.stopPropagation(); onClose(); }
    if (event.key === 'Tab') {
      const focusable = [...boxRef.current.querySelectorAll('select:not([disabled]), textarea, button:not([disabled]), a[href]')];
      const index = focusable.indexOf(document.activeElement);
      if (event.shiftKey && index <= 0) { event.preventDefault(); focusable.at(-1)?.focus(); }
      else if (!event.shiftKey && index === focusable.length - 1) { event.preventDefault(); focusable[0]?.focus(); }
    }
  }

  async function submit(event) {
    event.preventDefault();
    setSending(true);
    setError('');
    setUnverified(false);
    try {
      await onSend(branch, message.trim());
      const hasLeader = await branchHasLeader(branch);
      setSent({ label: LABELS[branch], hasLeader });
      showToast({ tone: 'menta', eyebrow: 'Hilo en camino', title: 'Solicitud enviada', text: `Pediste participar en ${LABELS[branch]}.` });
    } catch (sendError) {
      // Correo sin verificar: el aviso de verificacion (con reenviar), no un error generico.
      if (isUnverifiedError(sendError)) setUnverified(true);
      else setError(sendError.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[210] grid place-items-center overflow-y-auto bg-[rgba(8,20,16,.55)] p-4" onKeyDown={handleKeyDown}
      onClick={(event) => { if (event.target === event.currentTarget && !sending) onClose(); }}>
      <div ref={boxRef} role="dialog" aria-modal="true" aria-labelledby={`${id}-t`}
        className="grid w-full max-w-[520px] gap-4 rounded-[24px] bg-paper p-6 shadow-[0_24px_60px_rgba(8,20,16,.3)] max480:p-5">
        <h2 id={`${id}-t`} className="m-0 font-sans text-[22px] font-extrabold tracking-[-0.02em] text-ink">
          {sent ? '¡Solicitud enviada!' : 'Quiero participar'}
        </h2>
        {sent ? (
          <>
            <p className="m-0 text-[15px] leading-[1.6] text-[#3f514a]">{nextStepText(sent.label, sent.hasLeader)} Mientras tanto, puedes ver el estado en tu perfil.</p>
            <div><button type="button" className={`${BTN_INK_MD} max480:w-full`} onClick={onClose}>Entendido</button></div>
          </>
        ) : (
          <form className="grid gap-4" onSubmit={submit} noValidate>
            <p className="m-0 text-[15px] leading-[1.55] text-[#53645c]">Pide unirte a una rama cultural de TEJIDO. Si te aprueban, podrás publicar con la revisión de su líder.</p>
            <label className={FORM_LABEL}>
              Rama cultural
              <select className={FORM_INPUT} value={branch} onChange={(event) => setBranch(event.target.value)} disabled={Boolean(lockedBranch) || sending}>
                {CULTURAL_CATEGORIES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </label>
            <div className="grid gap-1.5">
              <label htmlFor={`${id}-m`} className={`${FORM_LABEL} flex items-end justify-between gap-3`}>
                <span>Mensaje (opcional)</span>
                <span className={`text-[12px] font-semibold normal-case tracking-normal ${message.length > MAX_REQUEST_MESSAGE ? 'text-[#b3442b]' : 'text-[#53645c]'}`} aria-live="polite">
                  {message.length} / {MAX_REQUEST_MESSAGE}
                </span>
              </label>
              <textarea id={`${id}-m`} className={`${FORM_INPUT} min-h-[120px] resize-y leading-[1.55]`} value={message} maxLength={MAX_REQUEST_MESSAGE}
                onChange={(event) => setMessage(event.target.value)} disabled={sending} aria-describedby={`${id}-h`} />
              <p id={`${id}-h`} className="m-0 text-[13px] leading-[1.45] text-[#53645c]">
                Cuéntale al líder qué cultura haces, dónde y desde cuándo. Si tienes un enlace a tu trabajo, inclúyelo.
              </p>
            </div>
            {error && <p className={ALERT} role="alert">{error}</p>}
            {unverified && <UnverifiedNotice />}
            <div className="flex flex-wrap gap-3 max480:grid max480:grid-cols-1">
              <button type="submit" className={`${BTN_INK_MD} max480:w-full`} disabled={sending}>{sending ? 'Enviando...' : 'Enviar solicitud'}</button>
              <button type="button" className={`${BTN_INK_OUTLINE_MD} max480:w-full`} onClick={onClose} disabled={sending}>Cancelar</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
