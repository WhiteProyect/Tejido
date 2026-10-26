import { useEffect, useRef, useState } from 'react';
import Icon from '../Icon.jsx';
import { BTN_DANGER, BTN_INK_MD, PANEL, PANEL_TITLE } from '../uiStyles.js';
import { useToast } from '../../context/ToastContext.jsx';
import { apiRequest } from '../../utils/api.js';
import { CULTURAL_CATEGORIES } from '../../utils/constants.js';
import { formatDateShort } from '../../utils/dateUtils.js';
import useBranchRequest from '../../utils/useBranchRequest.js';
import { ConfirmDialog } from '../gestor/edit/common.jsx';
import BranchRequestDialog from './BranchRequestDialog.jsx';

// "Participa en una rama" en el perfil del ciudadano (ProfileScreen > CitizenModule). Estados de
// su solicitud mas reciente (GET /api/me/branch-request):
// - sin solicitud o cancelada: invitacion y formulario con selector de rama;
// - pendiente: rama, fecha, su mensaje y "Cancelar solicitud" (con confirmacion);
// - rechazada: la nota de quien decidio (lider o equipo) si la hay y volver a solicitar;
// - aprobada: se refresca la sesion (GET /api/me) y onUserUpdate cambia el perfil al de gestor sin
//   cerrar sesion. Si /api/me aun dijera CIUDADANO, se pide cerrar sesion y volver a entrar.
const LABELS = Object.fromEntries(CULTURAL_CATEGORIES.map(([key, label]) => [key, label]));
const ALERT = 'mt-4 mb-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[14px] text-[#b3442b]';

export default function ParticipateCard({ user, onUserUpdate }) {
  const { showToast } = useToast();
  const branchRequest = useBranchRequest(user);
  const { request } = branchRequest;
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [staleApproval, setStaleApproval] = useState(false);
  const refreshed = useRef(false);

  // Aprobada: la sesion actual aun dice CIUDADANO; se vuelve a leer /api/me para pasar a gestor.
  useEffect(() => {
    if (request?.status !== 'APPROVED' || refreshed.current) return;
    refreshed.current = true;
    apiRequest('/api/me')
      .then(({ user: fresh }) => {
        if (fresh?.role === 'GESTOR') {
          showToast({ tone: 'menta', eyebrow: 'Bienvenida a la rama', title: `Ya eres gestor de ${LABELS[request.branch]}`, text: 'Desde tu dashboard puedes crear tu primera publicación.' });
          onUserUpdate?.(fresh);
        } else {
          setStaleApproval(true);
        }
      })
      .catch(() => setStaleApproval(true));
  }, [request]); // eslint-disable-line react-hooks/exhaustive-deps

  async function cancel() {
    setConfirming(false);
    setBusy(true);
    setError('');
    try {
      await branchRequest.cancel();
      showToast({ tone: 'menta', title: 'Solicitud cancelada', text: 'Puedes pedir participar de nuevo cuando quieras.' });
    } catch (cancelError) {
      setError(cancelError.message);
    } finally {
      setBusy(false);
    }
  }

  const status = request?.status;
  let content;
  if (branchRequest.loading) {
    content = <p className="m-0 py-4 text-[14px] text-muted" aria-busy="true">Cargando...</p>;
  } else if (status === 'PENDING') {
    content = (
      <div className="mt-4 grid gap-3">
        <p className="m-0 flex flex-wrap items-center gap-2 text-[14px] text-[#53645c]">
          <span className="rounded-full bg-[rgba(212,168,67,0.18)] py-0.5 px-2.5 text-[12px] font-bold text-[#7a5c12]">Pendiente</span>
          Pediste participar en <strong className="text-ink">{LABELS[request.branch]}</strong> el {formatDateShort(request.created_at)}.
        </p>
        {request.message && <p className="m-0 whitespace-pre-line rounded-[14px] bg-cream/60 py-3 px-4 text-[15px] leading-[1.55] text-[#3f514a] [overflow-wrap:anywhere]">{request.message}</p>}
        <p className="m-0 text-[14px] text-[#53645c]">Te avisaremos por correo cuando la revisen.</p>
        <div><button type="button" className={BTN_DANGER} disabled={busy} onClick={() => setConfirming(true)}>Cancelar solicitud</button></div>
      </div>
    );
  } else if (status === 'APPROVED' && staleApproval) {
    content = (
      <p className="mt-4 mb-0 rounded-[14px] bg-[rgba(117,183,155,0.14)] py-3 px-4 text-[14px] leading-[1.5] text-[#2f5a46]" role="status">
        Tu solicitud para {LABELS[request.branch]} fue aprobada: cierra sesión y vuelve a entrar para empezar a publicar.
      </p>
    );
  } else {
    const rejected = status === 'REJECTED';
    content = (
      <div className="mt-4 grid justify-items-start gap-3">
        {rejected ? (
          <div className="grid gap-2 rounded-[14px] border border-line bg-paper py-3 px-4 text-[14px] leading-[1.5] text-[#3f514a]">
            <p className="m-0">Tu solicitud para <strong className="text-ink">{LABELS[request.branch]}</strong> no fue aprobada esta vez.</p>
            {request.decision_note && <p className="m-0"><strong className="text-ink">Nota:</strong> {request.decision_note}</p>}
          </div>
        ) : (
          <p className="m-0 max-w-[620px] text-[15px] leading-[1.55] text-[#53645c]">
            ¿Haces música, danza, teatro, artesanías u otra cultura en el Bajo Cauca? Pide unirte a una rama: con la aprobación de su líder podrás publicar en TEJIDO.
          </p>
        )}
        <button type="button" className={`${BTN_INK_MD} max480:w-full`} onClick={() => setOpen(true)}>
          {rejected ? 'Volver a solicitar' : 'Quiero participar'}
        </button>
      </div>
    );
  }

  return (
    <section className={PANEL} aria-labelledby="participa-rama">
      <h2 id="participa-rama" className={`${PANEL_TITLE} flex items-center gap-3`}><Icon name="people" className="size-6 text-river" /> Participa en una rama</h2>
      {branchRequest.error && <p className={ALERT} role="alert">{branchRequest.error}</p>}
      {error && <p className={ALERT} role="alert">{error}</p>}
      {content}
      {open && (
        <BranchRequestDialog initialBranch={status === 'REJECTED' ? request.branch : undefined} onSend={branchRequest.send} onClose={() => setOpen(false)} />
      )}
      {confirming && (
        <ConfirmDialog title="¿Cancelar tu solicitud?" text={`Dejarás de esperar la respuesta para ${LABELS[request.branch]}. Podrás volver a pedirlo cuando quieras.`}
          confirmLabel="Sí, cancelar" danger onConfirm={cancel} onCancel={() => setConfirming(false)} />
      )}
    </section>
  );
}
