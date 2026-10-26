import { useId, useState } from 'react';
import Icon from './Icon.jsx';
import { BTN_DANGER, BTN_GHOST, BTN_INK_SM, FORM_INPUT } from './uiStyles.js';
import { apiRequest } from '../utils/api.js';

// Moderacion de una publicacion en revision, compartida por el admin (AdminDashboard) y el lider
// de rama (GestorDashboard > Por revisar): PATCH /api/publications/{id}/status. El rechazo exige
// un motivo de 5+ caracteres (el mismo minimo del backend).
export const MIN_REJECT_NOTE = 5;

export const MODERATION_TOASTS = {
  approve: { tone: 'menta', eyebrow: 'Sello puesto', title: 'Publicación aprobada', text: 'Ya está visible en TEJIDO.' },
  reject: { tone: 'menta', eyebrow: 'Hilo devuelto', title: 'Publicación rechazada', text: 'El gestor verá el motivo para ajustarla.' },
};

export function moderatePublication(id, action, note = '') {
  return apiRequest(`/api/publications/${id}/status`, {
    method: 'PATCH',
    body: action === 'approve' ? { status: 'PUBLISHED', note: '' } : { status: 'REJECTED', note },
  });
}

// Botones Aprobar / Rechazar y, al pedir rechazo, el campo de motivo. title nombra la publicacion
// en los aria-label ("Aprobar la publicacion X").
export function ModerationButtons({ title, busy, rejecting, onApprove, onToggleReject }) {
  return (
    <>
      <button type="button" className={BTN_INK_SM} disabled={busy} onClick={onApprove} aria-label={`Aprobar la publicación ${title}`}>
        <Icon name="check" className="size-3.5" /> Aprobar
      </button>
      <button type="button" className={BTN_GHOST} disabled={busy} aria-expanded={rejecting} onClick={onToggleReject} aria-label={`Rechazar la publicación ${title}`}>
        Rechazar
      </button>
    </>
  );
}

export function RejectForm({ busy, onSubmit, onCancel }) {
  const [note, setNote] = useState('');
  const hintId = useId();
  return (
    <form className="mt-4 flex flex-wrap items-end gap-3 max480:grid max480:grid-cols-1" onSubmit={(event) => { event.preventDefault(); onSubmit(note.trim()); }}>
      <label className="grid min-w-[240px] flex-1 gap-1.5 text-[12px] font-bold uppercase tracking-[.12em] text-muted max480:min-w-0">
        Motivo para el gestor
        <input className={FORM_INPUT} value={note} onChange={(event) => setNote(event.target.value)} maxLength={500}
          placeholder="Qué debe ajustar para publicarla" disabled={busy} autoFocus aria-describedby={hintId} />
      </label>
      <span id={hintId} className="sr-only">Mínimo {MIN_REJECT_NOTE} caracteres.</span>
      <button type="submit" className={BTN_DANGER} disabled={busy || note.trim().length < MIN_REJECT_NOTE}>Rechazar con este motivo</button>
      <button type="button" className={BTN_GHOST} disabled={busy} onClick={onCancel}>Cancelar</button>
    </form>
  );
}
