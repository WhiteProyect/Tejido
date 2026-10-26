import { useState } from 'react';
import EmptyNote from '../../EmptyNote.jsx';
import Icon from '../../Icon.jsx';
import { BTN_DANGER, PANEL, PANEL_TITLE } from '../../uiStyles.js';
import { useToast } from '../../../context/ToastContext.jsx';
import { apiRequest } from '../../../utils/api.js';
import { cdnImage } from '../../../utils/cloudinaryUrl.js';
import { formatDateShort } from '../../../utils/dateUtils.js';
import { getInitials } from '../../../utils/initials.js';
import { LeaderBadge } from '../GestorHeader.jsx';
import { ConfirmDialog } from '../edit/common.jsx';

// Participantes (lider de rama): quienes publican en su rama (GET /api/branches/{rama}/participants,
// el lider primero). "Sacar de la rama" (DELETE .../participants/{id}) no aparece en el lider ni
// en uno mismo; la confirmacion explica exactamente lo que pasa.
const ALERT = 'mt-4 mb-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[14px] text-[#b3442b]';
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

function ParticipantCard({ person, branchLabel, removable, busy, onRemove }) {
  const [failed, setFailed] = useState(false);
  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-[18px] border border-line bg-white/70 p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-[#e2d9ca] bg-cream text-[18px] font-extrabold text-ink" aria-hidden="true">
          {person.photo_url && !failed
            ? <img src={cdnImage(person.photo_url, { width: 160, fit: 'fill' })} alt="" className="size-full object-cover" onError={() => setFailed(true)} />
            : getInitials(person.organization || person.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[16px] font-bold leading-[1.25] text-ink [overflow-wrap:anywhere]">{person.organization}</p>
          <p className="mt-0.5 mb-0 text-[14px] text-[#53645c] [overflow-wrap:anywhere]">{person.name}</p>
          {person.is_leader && <span className="mt-1.5 inline-block"><LeaderBadge small branchLabel={branchLabel} /></span>}
        </div>
      </div>
      <p className="m-0 text-[13px] text-[#53645c]">
        {person.joined_at ? `Desde el ${formatDateShort(person.joined_at)}` : 'Gestor de la rama'}
        {' · '}{person.published} {person.published === 1 ? 'publicada' : 'publicadas'}
        {' · '}{person.in_review} en revisión
      </p>
      <div className="mt-auto flex flex-wrap gap-2 max480:grid max480:grid-cols-1">
        {person.slug && (
          <a className={`inline-flex items-center gap-1 text-[14px] font-bold text-river no-underline hover:underline ${FOCUS}`} href={`#gestor/${person.slug}`}
            aria-label={`Ver el perfil de ${person.organization}`}>Ver perfil <Icon name="arrow-right" className="size-3.5" /></a>
        )}
        {removable && (
          <button type="button" className={`${BTN_DANGER} ml-auto max480:ml-0`} disabled={busy} onClick={() => onRemove(person)}
            aria-label={`Sacar a ${person.name} de la rama`}>Sacar de la rama</button>
        )}
      </div>
    </li>
  );
}

export default function ParticipantsPanel({ branch, branchLabel, participants, userId, onChanged }) {
  const { showToast } = useToast();
  const [confirming, setConfirming] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  async function remove(person) {
    setConfirming(null);
    setBusy(person.id);
    setError('');
    try {
      await apiRequest(`/api/branches/${branch}/participants/${person.id}`, { method: 'DELETE' });
      showToast({ tone: 'menta', title: 'Participante fuera de la rama', text: `${person.name} vuelve a ser ciudadano.` });
      await onChanged();
    } catch (removeError) {
      setError(removeError.message);
    } finally {
      setBusy(null);
    }
  }

  const others = participants.filter((person) => !person.is_leader);
  return (
    <section className={PANEL} aria-labelledby="participantes">
      <h2 id="participantes" className={`${PANEL_TITLE} flex items-center gap-3`}><Icon name="people" className="size-6 text-river" /> Participantes</h2>
      <p className="mt-2 mb-0 text-[14px] text-[#53645c]">
        {others.length === 0 ? `Todavía no hay participantes en ${branchLabel}.` : `${others.length} ${others.length === 1 ? 'persona publica' : 'personas publican'} en ${branchLabel} contigo.`}
      </p>
      {error && <p className={ALERT} role="alert">{error}</p>}
      {others.length === 0 && (
        <div className="mt-6"><EmptyNote icon="people" title="Tu rama te espera" text="Cuando apruebes una solicitud de ingreso, la persona aparecerá aquí." /></div>
      )}
      <ul className="mt-5 mb-0 grid list-none grid-cols-2 gap-3 p-0 max800:grid-cols-1">
        {participants.map((person) => (
          <ParticipantCard key={person.id} person={person} branchLabel={branchLabel} busy={busy === person.id}
            removable={!person.is_leader && person.id !== userId} onRemove={setConfirming} />
        ))}
      </ul>
      {confirming && (
        <ConfirmDialog
          title={`¿Sacar a ${confirming.name} de ${branchLabel}?`}
          text="Vuelve a ser ciudadano. Lo que ya publicó sigue visible; lo que estaba en revisión vuelve a borrador."
          confirmLabel="Sí, sacar de la rama"
          danger
          onConfirm={() => remove(confirming)}
          onCancel={() => setConfirming(null)}
        />
      )}
    </section>
  );
}
