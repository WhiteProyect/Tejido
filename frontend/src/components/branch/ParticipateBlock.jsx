import { useState } from 'react';
import Icon from '../Icon.jsx';
import { BTN_INK_MD } from '../uiStyles.js';
import { CULTURAL_CATEGORIES } from '../../utils/constants.js';
import { formatDateShort } from '../../utils/dateUtils.js';
import useBranchRequest from '../../utils/useBranchRequest.js';
import BranchRequestDialog, { nextStepText } from './BranchRequestDialog.jsx';

// "Quiero participar en esta rama" (pantalla de la categoria y perfil publico del lider). Reglas:
// - Gestores y admins no lo ven.
// - Visitante: el boton lleva a #login y guarda la vuelta (tejido_return_to = returnTo).
// - Ciudadano con solicitud pendiente a ESTA rama: "Solicitud enviada", sin boton; pendiente a
//   otra rama: el boton se desactiva y se explica.
// - Si no: el boton abre el formulario con esta rama ya elegida.
// title/text: encabezado del bloque (la categoria lo usa; el perfil del lider va sin titulo).
const LABELS = Object.fromEntries(CULTURAL_CATEGORIES.map(([key, label]) => [key, label]));
const LINK = 'font-bold text-river no-underline hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

export default function ParticipateBlock({ user, branch, hasLeader, returnTo, title, text, className = '' }) {
  const branchRequest = useBranchRequest(user);
  const [open, setOpen] = useState(false);
  if (user && user.role !== 'CIUDADANO') return null;

  const label = LABELS[branch] || '';
  const pending = branchRequest.request?.status === 'PENDING' ? branchRequest.request : null;
  const pendingHere = pending && pending.branch === branch;
  const pendingElsewhere = pending && pending.branch !== branch;

  function goToLogin() {
    sessionStorage.setItem('tejido_return_to', returnTo);
    window.location.hash = 'login';
  }

  let body;
  if (!user) {
    body = (
      <>
        <button type="button" className={`${BTN_INK_MD} max480:w-full`} onClick={goToLogin}>Quiero participar en esta rama</button>
        <p className="m-0 text-[14px] leading-[1.5] text-[#53645c]">
          Primero <button type="button" className={`cursor-pointer border-0 bg-transparent p-0 ${LINK}`} onClick={goToLogin}>entra o crea tu cuenta</button>; al terminar vuelves aquí.
        </p>
      </>
    );
  } else if (branchRequest.loading) {
    body = <p className="m-0 text-[14px] text-muted" aria-busy="true">Cargando...</p>;
  } else if (pendingHere) {
    body = (
      <p className="m-0 flex items-start gap-2 rounded-[14px] bg-[rgba(117,183,155,0.14)] py-3 px-4 text-[14px] leading-[1.5] text-[#2f5a46]" role="status">
        <Icon name="check" className="mt-0.5 size-4 shrink-0" />
        <span><strong>Solicitud enviada</strong> el {formatDateShort(pending.created_at)}. {nextStepText(label, hasLeader)}</span>
      </p>
    );
  } else {
    body = (
      <>
        <button type="button" className={`${BTN_INK_MD} max480:w-full`} disabled={Boolean(pendingElsewhere)} onClick={() => setOpen(true)}
          aria-describedby={pendingElsewhere ? `pendiente-${branch}` : undefined}>
          Quiero participar en esta rama
        </button>
        {pendingElsewhere && (
          <p id={`pendiente-${branch}`} className="m-0 text-[14px] leading-[1.5] text-[#53645c]">
            Ya tienes una solicitud pendiente para {LABELS[pending.branch]}. Solo se puede una a la vez: puedes cancelarla desde <a className={LINK} href="#perfil">tu perfil</a>.
          </p>
        )}
      </>
    );
  }

  return (
    <div className={`grid justify-items-start gap-3 ${className}`}>
      {title && <h2 className="m-0 font-sans text-[24px] font-extrabold tracking-[-0.03em] text-ink">{title}</h2>}
      {text && <p className="m-0 max-w-[620px] text-[15px] leading-[1.55] text-[#53645c]">{text}</p>}
      {body}
      {open && <BranchRequestDialog lockedBranch={branch} onSend={branchRequest.send} onClose={() => setOpen(false)} />}
    </div>
  );
}
