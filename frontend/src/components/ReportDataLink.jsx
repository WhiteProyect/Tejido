import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';
import AuthDialog from './opportunities/AuthDialog.jsx';
import { TS } from './territory/territoryStyles.js';
import { UNVERIFIED_TEXT, notifyUnverified } from './VerifyEmailNotice.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { apiRequest } from '../utils/api.js';

// "Reportar un dato incorrecto" de un lugar: usa el flujo de reportes de siempre
// (POST /api/publications/{id}/report, motivo de 5+ caracteres, sesion con correo verificado; llega a la
// Bandeja del admin). Sin sesion abre el aviso de cuenta (AuthDialog) y, tras entrar, vuelve al lugar.
// Con sesion abre un dialogo con el motivo: foco atrapado, Esc y el fondo lo cierran, el foco vuelve al enlace.
const REASON_MIN = 5;
const REASON_MAX = 500;

function ReportDialog({ publication, onClose, onSent }) {
  const titleId = useId();
  const fieldId = useId();
  const ref = useRef(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { ref.current?.querySelector('textarea')?.focus(); }, []);

  function onKeyDown(event) {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
    if (event.key !== 'Tab') return;
    const items = [...ref.current.querySelectorAll('button, textarea')].filter((item) => !item.disabled);
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  async function submit(event) {
    event.preventDefault();
    if (reason.trim().length < REASON_MIN) { setError('Cuéntanos qué dato está mal (al menos 5 caracteres).'); return; }
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/api/publications/${publication.id}/report`, { method: 'POST', body: { reason: reason.trim() } });
      onSent();
    } catch (failure) {
      if (failure.code === 'EMAIL_NOT_VERIFIED') {
        notifyUnverified();
        setError(`${UNVERIFIED_TEXT}: así podremos recibir tu reporte.`);
      } else {
        setError(failure.message || 'No pudimos enviar el reporte. Intenta de nuevo.');
      }
      setBusy(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[98] flex items-end justify-center bg-[rgba(12,36,30,.55)] p-4 min-[640px]:items-center"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={onKeyDown} onSubmit={submit} noValidate data-dialogo-reporte
        className="relative grid w-full max-w-[480px] gap-4 rounded-[24px] border-2 border-[#173f36] bg-[#fff9ec] p-7 text-[#173f36] max-[767px]:p-5">
        <button type="button" onClick={onClose} aria-label="Cerrar"
          className={`absolute top-3 right-3 inline-flex size-11 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-[#173f36] hover:bg-[#f3e4c8] ${TS.focus}`}>
          <Icon name="close" className="size-5" />
        </button>
        <div>
          <p className={TS.kicker}>Directorio TEJIDO</p>
          <h2 id={titleId} className="mt-2 mb-0 pr-10 font-sans text-[24px] font-extrabold leading-[1.15] tracking-[-0.02em]">Reportar un dato incorrecto</h2>
          <p className="mt-2 mb-0 text-[16px] leading-[1.5] text-[#3f514a]">¿Qué está mal en «{publication.title}»? El equipo lo revisa y lo corrige.</p>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor={fieldId} className="text-[15px] font-bold">Qué dato está mal</label>
          <textarea id={fieldId} value={reason} onChange={(event) => { setReason(event.target.value); setError(''); }} maxLength={REASON_MAX} rows={4}
            placeholder="P. ej. «El horario cambió: ahora abren a las 9 a. m.»" disabled={busy}
            aria-invalid={error ? true : undefined} aria-describedby={error ? `${fieldId}-error` : undefined}
            className={`w-full resize-y rounded-[12px] border bg-white px-3.5 py-2.5 font-sans text-[16px] text-[#173f36] ${error ? 'border-[#b3442b]' : 'border-[#ddd5c7]'} ${TS.focus}`} />
          {error && <p id={`${fieldId}-error`} role="alert" className="m-0 text-[15px] font-semibold text-[#b3442b]">{error}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3 max-[480px]:grid-cols-1">
          <button type="submit" className={TS.btnSolid} disabled={busy}>{busy ? 'Enviando...' : 'Enviar reporte'}</button>
          <button type="button" className={TS.btnOutline} onClick={onClose} disabled={busy}>Cancelar</button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

export default function ReportDataLink({ publication, user }) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(null); // null | 'report' | 'auth'
  const opener = useRef(null);

  function close() {
    setOpen(null);
    requestAnimationFrame(() => opener.current?.focus());
  }

  return (
    <>
      <button ref={opener} type="button" onClick={() => setOpen(user ? 'report' : 'auth')} data-reportar-dato
        className={`inline-flex min-h-11 cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-[15px] font-semibold text-[#173f36] underline underline-offset-4 hover:text-[#a44727] ${TS.focus}`}>
        <Icon name="pen" className="size-4" /> Reportar un dato incorrecto
      </button>
      {open === 'auth' && (
        <AuthDialog returnTo={`publicacion/${publication.id}`} onClose={close}
          title={<>Inicia sesión para <span className={TS.heroItalic}>reportar</span></>}
          text="Con tu cuenta en TEJIDO puedes avisarnos de un dato incorrecto para que el equipo lo corrija." />
      )}
      {open === 'report' && (
        <ReportDialog publication={publication} onClose={close}
          onSent={() => { close(); showToast({ tone: 'menta', eyebrow: 'Gracias', title: 'Reporte enviado', text: 'El equipo de TEJIDO revisará el dato.' }); }} />
      )}
    </>
  );
}
