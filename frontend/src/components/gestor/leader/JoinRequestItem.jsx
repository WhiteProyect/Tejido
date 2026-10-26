import { useState } from 'react';
import Icon from '../../Icon.jsx';
import { BTN_DANGER, BTN_GHOST, BTN_INK_SM, FORM_INPUT } from '../../uiStyles.js';
import { formatDateShort } from '../../../utils/dateUtils.js';

// Una solicitud de ingreso a una rama, para el lider (Solicitudes) y para el admin (Bandeja).
// Pendiente: Aprobar (con la explicacion de lo que pasa y confirmacion) o Rechazar con una nota
// opcional (<=300, el limite del backend). Resuelta: estado, quien decidio, nota y fecha.
// onDecide(request, 'approve' | 'reject', note) hace la llamada; showBranch muestra la rama (admin).
const STATUS = {
  PENDING: ['Pendiente', 'bg-[rgba(212,168,67,0.18)] text-[#7a5c12]'],
  APPROVED: ['Aprobada', 'bg-[rgba(117,183,155,0.2)] text-[#2f6b52]'],
  REJECTED: ['Rechazada', 'bg-[rgba(216,91,54,0.12)] text-[#a8431f]'],
  CANCELLED: ['Cancelada', 'bg-[rgba(102,116,111,0.12)] text-[#4d5a55]'],
};
export const MAX_DECISION_NOTE = 300;

export default function JoinRequestItem({ request, branchLabel, showBranch = false, busy, onDecide }) {
  const [mode, setMode] = useState(null); // null | 'approve' | 'reject'
  const [note, setNote] = useState('');
  const [label, tone] = STATUS[request.status] || [request.status, STATUS.CANCELLED[1]];
  const pending = request.status === 'PENDING';

  return (
    <li className={`rounded-[16px] border border-line p-5 max600:p-4 ${pending ? 'bg-[rgba(29,143,163,0.05)]' : 'bg-paper'}`}>
      <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
        <strong className="text-[15px] text-ink">{request.name}</strong>
        <a className="break-all text-river no-underline hover:underline" href={`mailto:${request.email}`}>{request.email}</a>
        <span aria-hidden="true">·</span>
        <span>{formatDateShort(request.created_at)}</span>
        <span className={`rounded-full py-0.5 px-2 font-bold ${tone}`}>{label}</span>
        {showBranch && (
          <span className="rounded-full bg-[rgba(29,143,163,0.1)] py-0.5 px-2 font-bold text-[#146f80]">{branchLabel}</span>
        )}
        {showBranch && pending && !request.branch_has_leader && (
          <span className="rounded-full bg-[rgba(216,91,54,0.12)] py-0.5 px-2 font-bold text-[#a8431f]">Sin líder: decide el equipo</span>
        )}
      </p>
      <p className="mt-2 mb-0 whitespace-pre-line text-[15px] leading-[1.55] text-[#44564f] [overflow-wrap:anywhere]">
        {request.message || <em className="text-muted">No dejó un mensaje.</em>}
      </p>

      {!pending && (
        <p className="mt-2 mb-0 text-[13px] text-[#53645c]">
          {label}{request.decided_by_name && ` por ${request.decided_by_name}`}{request.decided_at && ` el ${formatDateShort(request.decided_at)}`}
          {request.decision_note && <>. <strong className="text-ink">Nota:</strong> {request.decision_note}</>}
        </p>
      )}

      {pending && !mode && (
        <div className="mt-3 flex flex-wrap gap-2 max480:grid max480:grid-cols-1">
          <button type="button" className={BTN_INK_SM} disabled={busy} onClick={() => setMode('approve')} aria-label={`Aprobar la solicitud de ${request.name}`}>
            <Icon name="check" className="size-3.5" /> Aprobar
          </button>
          <button type="button" className={BTN_GHOST} disabled={busy} onClick={() => { setMode('reject'); setNote(''); }} aria-label={`Rechazar la solicitud de ${request.name}`}>
            Rechazar
          </button>
        </div>
      )}
      {pending && mode === 'approve' && (
        <div className="mt-3 grid gap-3 rounded-[14px] border border-[rgba(117,183,155,0.5)] bg-[rgba(117,183,155,0.1)] p-4" role="group" aria-label={`Confirmar la aprobación de ${request.name}`}>
          <p className="m-0 text-[14px] leading-[1.5] text-ink">
            <strong>{request.name}</strong> pasará a ser gestor de {branchLabel} y podrá publicar con tu revisión.
          </p>
          <div className="flex flex-wrap gap-2 max480:grid max480:grid-cols-1">
            <button type="button" className={BTN_INK_SM} disabled={busy} onClick={() => onDecide(request, 'approve')} autoFocus>Sí, aprobar</button>
            <button type="button" className={BTN_GHOST} disabled={busy} onClick={() => setMode(null)}>Cancelar</button>
          </div>
        </div>
      )}
      {pending && mode === 'reject' && (
        <form className="mt-3 flex flex-wrap items-end gap-3 max480:grid max480:grid-cols-1" onSubmit={(event) => { event.preventDefault(); onDecide(request, 'reject', note.trim()); }}>
          <label className="grid min-w-[240px] flex-1 gap-1.5 text-[12px] font-bold uppercase tracking-[.12em] text-muted max480:min-w-0">
            Nota para {request.name} (opcional)
            <input className={FORM_INPUT} value={note} onChange={(event) => setNote(event.target.value)} maxLength={MAX_DECISION_NOTE}
              placeholder="Por ejemplo: escríbenos de nuevo en un mes" disabled={busy} autoFocus />
          </label>
          <button type="submit" className={BTN_DANGER} disabled={busy}>Rechazar solicitud</button>
          <button type="button" className={BTN_GHOST} disabled={busy} onClick={() => setMode(null)}>Cancelar</button>
        </form>
      )}
    </li>
  );
}
