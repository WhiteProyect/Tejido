import { useEffect, useState } from 'react';
import EmptyNote from '../../EmptyNote.jsx';
import Icon from '../../Icon.jsx';
import FilterToggle from '../../FilterToggle.jsx';
import { PANEL, PANEL_TITLE } from '../../uiStyles.js';
import { useToast } from '../../../context/ToastContext.jsx';
import { apiRequest } from '../../../utils/api.js';
import JoinRequestItem from './JoinRequestItem.jsx';

// Solicitudes (lider de rama): quien pide participar en su rama. Pendientes (las que trae el
// dashboard, la mas antigua primero) o Resueltas (GET /api/branches/{rama}/requests?status=ALL).
// Aprobar o rechazar avisa al dashboard (onChanged) para refrescar contadores y Participantes.
const ALERT = 'mt-4 mb-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[14px] text-[#b3442b]';

export async function decideRequest(branch, request, action, note) {
  const path = `/api/branches/${branch}/requests/${request.id}/${action}`;
  return action === 'approve'
    ? apiRequest(path, { method: 'POST' })
    : apiRequest(path, { method: 'POST', body: { note: note || null } });
}

export const DECISION_TOASTS = {
  approve: (request) => ({ tone: 'menta', eyebrow: 'Hilo sumado', title: 'Solicitud aprobada', text: `${request.name} ya aparece en Participantes.` }),
  reject: (request) => ({ tone: 'menta', title: 'Solicitud rechazada', text: `Le avisamos a ${request.name} por correo.` }),
};

export default function RequestsPanel({ branch, branchLabel, pending, onChanged }) {
  const { showToast } = useToast();
  const [filter, setFilter] = useState('pending');
  const [resolved, setResolved] = useState({ loading: false, items: [], error: '' });
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (filter !== 'resolved') return undefined;
    let alive = true;
    setResolved((current) => ({ ...current, loading: true }));
    apiRequest(`/api/branches/${branch}/requests?status=ALL`)
      .then((items) => alive && setResolved({ loading: false, items: items.filter((item) => item.status !== 'PENDING'), error: '' }))
      .catch((loadError) => alive && setResolved({ loading: false, items: [], error: loadError.message }));
    return () => { alive = false; };
  }, [filter, branch, pending]);

  async function decide(request, action, note) {
    setBusy(request.id);
    setError('');
    try {
      await decideRequest(branch, request, action, note);
      showToast(DECISION_TOASTS[action](request));
      await onChanged();
    } catch (decideError) {
      setError(decideError.message);
    } finally {
      setBusy(null);
    }
  }

  const items = filter === 'pending' ? pending : resolved.items;
  return (
    <section className={PANEL} aria-labelledby="solicitudes">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="solicitudes" className={`${PANEL_TITLE} flex items-center gap-3`}><Icon name="inbox" className="size-6 text-river" /> Solicitudes</h2>
          <p className="mt-2 mb-0 text-[14px] text-[#53645c]">Personas que quieren participar en {branchLabel}.</p>
        </div>
        <FilterToggle value={filter} onChange={setFilter} label="Filtrar solicitudes" options={[['pending', 'Pendientes'], ['resolved', 'Resueltas']]} />
      </div>
      {error && <p className={ALERT} role="alert">{error}</p>}
      {filter === 'resolved' && resolved.loading && <p className="m-0 py-6 text-[14px] text-muted" aria-busy="true">Cargando...</p>}
      {filter === 'resolved' && resolved.error && <p className={ALERT} role="alert">{resolved.error}</p>}
      {!(filter === 'resolved' && (resolved.loading || resolved.error)) && (items.length ? (
        <ul className="mt-5 mb-0 grid list-none gap-3 p-0">
          {items.map((request) => (
            <JoinRequestItem key={request.id} request={request} branchLabel={branchLabel} busy={busy === request.id} onDecide={decide} />
          ))}
        </ul>
      ) : (
        <div className="mt-6">
          {filter === 'pending'
            ? <EmptyNote icon="inbox" title="Ninguna solicitud pendiente" text={`Cuando alguien pida participar en ${branchLabel}, la verás aquí para darle la bienvenida.`} />
            : <EmptyNote icon="inbox" title="Aún no hay solicitudes resueltas" text="Las que apruebes o rechaces quedarán aquí." />}
        </div>
      ))}
    </section>
  );
}
