import { useEffect, useId, useRef, useState } from 'react';
import AuthDialog from './AuthDialog.jsx';
import { TS } from '../territory/territoryStyles.js';
import { UNVERIFIED_TEXT, notifyUnverified } from '../VerifyEmailNotice.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { apiRequest } from '../../utils/api.js';
import { isClosed } from '../../utils/opportunities.js';

// Postulacion fase 1 en el detalle de una OPORTUNIDAD (#publicacion/<id>), bloque inferior:
// - Sin sesion: "Postularme a esta oportunidad" y "Guardar" abren el aviso (AuthDialog) y, tras entrar,
//   se vuelve a esta oportunidad.
// - CIUDADANO: "Postularme..." es el enlace de la convocatoria (pestaña nueva) y ademas la guarda
//   (POST .../favorite, idempotente); "Guardar" solo guarda y se puede quitar.
// - GESTOR y ADMIN: sin botones, con una nota (solo el ciudadano guarda).
// - Cerrada: "Plazo finalizado" deshabilitado (aria-disabled).
// En movil (<= 768 px) el bloque es una barra fija abajo: reserva su alto en el body y lo publica en
// --barra-inferior para que el lanzador de Hilo suba y no la tape. Queda por debajo del header y del
// menu (z 60 contra 90+).
const MOBILE = '(max-width: 768px)';

function useMobile() {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia(MOBILE).matches);
  useEffect(() => {
    const query = window.matchMedia(MOBILE);
    const onChange = () => setMobile(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return mobile;
}

export default function OpportunityApply({ publication, user }) {
  const { showToast } = useToast();
  const [saved, setSaved] = useState(Boolean(publication.favorite));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { tone: 'ok' | 'warn', text }
  const [dialog, setDialog] = useState(false);
  const opener = useRef(null);
  const bar = useRef(null);
  const mobile = useMobile();
  const lockedId = useId();
  const closed = isClosed(publication.end_date);
  const link = publication.link;
  const showButtons = !user || user.role === 'CIUDADANO';

  // Barra fija en movil: el body reserva su alto (asi no tapa el final del contenido).
  useEffect(() => {
    if (!mobile || !bar.current) return undefined;
    const apply = () => {
      const height = `${bar.current.offsetHeight}px`;
      document.body.style.paddingBottom = height;
      document.documentElement.style.setProperty('--barra-inferior', height);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(bar.current);
    return () => {
      observer.disconnect();
      document.body.style.paddingBottom = '';
      document.documentElement.style.removeProperty('--barra-inferior');
    };
  }, [mobile, message, closed, showButtons]);

  function openDialog(event) {
    event.preventDefault();
    opener.current = event.currentTarget;
    setDialog(true);
  }

  function closeDialog() {
    setDialog(false);
    requestAnimationFrame(() => opener.current?.focus());
  }

  async function save(next) {
    setBusy(true);
    try {
      await apiRequest(`/api/publications/${publication.id}/favorite`, { method: next ? 'POST' : 'DELETE' });
      setSaved(next);
      return true;
    } catch (error) {
      if (error.code === 'EMAIL_NOT_VERIFIED') {
        notifyUnverified();
        setMessage({ tone: 'warn', text: `${UNVERIFIED_TEXT} Así podremos guardarla y avisarte antes del cierre.` });
      } else {
        setMessage({ tone: 'warn', text: error.message || 'No pudimos guardarla. Intenta de nuevo.' });
      }
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleApply(event) {
    if (!user) { openDialog(event); return; }
    if (!link) event.preventDefault();
    // El enlace abre en su pestaña sin esperar a la red (los bloqueadores de ventanas no lo frenan).
    const ok = saved || await save(true);
    if (ok) setMessage({ tone: 'ok', text: publication.end_date ? 'Guardada en tus guardadas. Te avisaremos antes del cierre.' : 'Guardada en tus guardadas.' });
  }

  async function handleSave(event) {
    if (!user) { openDialog(event); return; }
    const next = !saved;
    if (await save(next)) {
      setMessage(null);
      showToast(next
        ? { tone: 'menta', eyebrow: 'Oportunidad guardada', title: 'Está en tus guardadas', text: publication.end_date ? 'Te avisaremos antes del cierre.' : 'Encuéntrala en Guardadas.' }
        : { tone: 'menta', title: 'Quitada de tus guardadas' });
    }
  }

  const shell = mobile
    ? 'fixed inset-x-0 bottom-0 z-[60] border-t-2 border-[#173f36] bg-[#fff9ec] px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]'
    : 'mt-10 rounded-[22px] border border-[#ddd5c7] bg-[#fff9ec] p-6';
  const buttonWidth = mobile ? 'flex-1' : '';
  let inner;
  if (!showButtons) {
    inner = <p className="m-0 text-[15px] text-[#3f514a]">Las postulaciones son para cuentas de ciudadano.</p>;
  } else if (closed) {
    inner = (
      <>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={`${TS.btnDisabled} ${TS.focus} ${buttonWidth}`} aria-disabled="true" aria-describedby={lockedId}
            onClick={(event) => event.preventDefault()}>Plazo finalizado</button>
        </div>
        <p id={lockedId} className="mt-2 mb-0 text-[15px] text-[#3f514a]">Esta convocatoria ya cerró.</p>
      </>
    );
  } else {
    inner = (
      <>
        <div className="flex flex-wrap items-center gap-3">
          {link ? (
            <a href={link} target="_blank" rel="noopener noreferrer" className={`${TS.btnSolid} ${buttonWidth}`} onClick={handleApply}>
              Postularme a esta oportunidad<span className="sr-only"> (abre la convocatoria en una pestaña nueva)</span>
            </a>
          ) : (
            <button type="button" className={`${TS.btnSolid} ${buttonWidth}`} onClick={handleApply} disabled={busy}>Postularme a esta oportunidad</button>
          )}
          <button type="button" className={`${TS.btnOutline} ${mobile ? 'shrink-0' : ''}`} style={saved ? { backgroundColor: '#f3e4c8' } : undefined} onClick={handleSave}
            disabled={busy} aria-pressed={user ? saved : undefined}>
            <span aria-hidden="true">{saved ? '♥' : '♡'}</span> {saved ? 'Guardada' : 'Guardar'}
          </button>
        </div>
        {!mobile && (
          <p className="mt-3 mb-0 text-[15px] text-[#3f514a]">
            {user ? 'Al postularte la guardamos en tus guardadas para avisarte antes del cierre.' : 'Para postularte o guardarla, inicia sesión con tu cuenta de ciudadano.'}
          </p>
        )}
        <p role="status" aria-live="polite"
          className={message ? `mt-3 mb-0 rounded-[12px] px-3.5 py-2.5 text-[15px] font-semibold ${message.tone === 'ok' ? 'bg-[#f3e4c8] text-[#173f36]' : 'bg-[#f4b942] text-[#173f36]'}` : 'sr-only'}>
          {message?.text || ''}
        </p>
      </>
    );
  }

  return (
    <div ref={bar} className={shell} data-postulacion={!showButtons ? 'sin-botones' : closed ? 'cerrada' : 'abierta'} data-barra-fija={mobile || undefined}>
      {inner}
      {dialog && <AuthDialog returnTo={`publicacion/${publication.id}`} onClose={closeDialog} />}
    </div>
  );
}
