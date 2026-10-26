import { useCallback, useEffect, useState } from 'react';
import { BTN_DANGER, BTN_GHOST } from '../uiStyles.js';
import { useToast } from '../../context/ToastContext.jsx';
import { apiRequest } from '../../utils/api.js';
import { LeaderBadge } from '../gestor/GestorHeader.jsx';
import { ConfirmDialog } from '../gestor/edit/common.jsx';

// Participantes de una rama en la cobertura del admin (GET /api/branches/{rama}/participants), con
// sus acciones: nombrar lider (PUT /api/admin/branches/{rama}/leader), quitar el liderazgo (DELETE
// .../leader) y sacar de la rama (DELETE /api/branches/{rama}/participants/{id}; al lider primero
// hay que quitarle el liderazgo). Cada accion pide confirmacion explicando sus consecuencias y al
// terminar avisa a la cobertura (onChanged) para recargar conteos y la tabla.
const ALERT = 'm-0 rounded-[12px] bg-[rgba(216,91,54,.08)] py-2.5 px-3 text-[14px] text-[#b3442b]';

function confirmation(action, person, branchLabel, leader) {
  if (action === 'lead') {
    return {
      title: `¿Nombrar a ${person.name} líder de ${branchLabel}?`,
      text: `${leader ? `${leader.name} dejará de ser líder y pasará a participante. ` : 'Hoy la rama no tiene líder. '}`
        + `Desde ahora ${person.name} revisará las publicaciones de los participantes (también las que ya están en revisión) y aprobará quién se suma a la rama. Le avisaremos por correo.`,
      confirmLabel: 'Sí, nombrar líder',
    };
  }
  if (action === 'unlead') {
    return {
      title: `¿Quitar el liderazgo a ${person.name}?`,
      text: `${person.name} sigue en la rama como participante. Las publicaciones de los participantes y las solicitudes de ${branchLabel} pasarán a revisarlas el equipo de TEJIDO hasta que haya un nuevo líder.`,
      confirmLabel: 'Sí, quitar liderazgo',
    };
  }
  return {
    title: `¿Sacar a ${person.name} de ${branchLabel}?`,
    text: 'Vuelve a ser ciudadano. Lo que ya publicó sigue visible; lo que estaba en revisión vuelve a borrador.',
    confirmLabel: 'Sí, sacar de la rama',
  };
}

export default function BranchParticipants({ branch, branchLabel, onChanged }) {
  const { showToast } = useToast();
  const [state, setState] = useState({ loading: true, error: '', people: [] });
  const [pending, setPending] = useState(null); // { action, person }
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const people = await apiRequest(`/api/branches/${branch}/participants`);
      setState({ loading: false, error: '', people });
    } catch (loadError) {
      setState({ loading: false, error: loadError.message, people: [] });
    }
  }, [branch]);

  useEffect(() => { load(); }, [load]);

  const leader = state.people.find((person) => person.is_leader) || null;

  async function run({ action, person }) {
    setPending(null);
    setBusy(person.id);
    setError('');
    try {
      if (action === 'lead') {
        await apiRequest(`/api/admin/branches/${branch}/leader`, { method: 'PUT', body: { gestor_id: person.id } });
        showToast({ tone: 'menta', eyebrow: 'Rama con líder', title: `${person.name} ahora lidera ${branchLabel}` });
      } else if (action === 'unlead') {
        await apiRequest(`/api/admin/branches/${branch}/leader`, { method: 'DELETE' });
        showToast({ tone: 'menta', title: 'Liderazgo quitado', text: `${branchLabel} queda sin líder: el equipo gestiona la rama.` });
      } else {
        await apiRequest(`/api/branches/${branch}/participants/${person.id}`, { method: 'DELETE' });
        showToast({ tone: 'menta', title: 'Participante fuera de la rama', text: `${person.name} vuelve a ser ciudadano.` });
      }
      await load();
      onChanged?.();
    } catch (runError) {
      setError(runError.message);
    } finally {
      setBusy(null);
    }
  }

  if (state.loading) return <p className="m-0 text-[14px] text-muted" aria-busy="true">Cargando participantes...</p>;
  if (state.error) return <p className={ALERT} role="alert">{state.error}</p>;

  const dialog = pending && confirmation(pending.action, pending.person, branchLabel, leader);
  return (
    <div className="grid gap-2">
      {error && <p className={ALERT} role="alert">{error}</p>}
      {state.people.length === 0 ? (
        <p className="m-0 text-[14px] text-[#53645c]">Nadie participa todavía en esta rama.</p>
      ) : (
        <ul className="m-0 grid list-none gap-2 p-0" aria-label={`Participantes de ${branchLabel}`}>
          {state.people.map((person) => (
            <li key={person.id} className="grid gap-2 rounded-[14px] border border-line bg-paper p-3">
              <div className="min-w-0">
                <p className="m-0 text-[15px] font-bold text-ink [overflow-wrap:anywhere]">{person.name}</p>
                <p className="m-0 text-[13px] text-[#53645c] [overflow-wrap:anywhere]">
                  {person.organization}
                  {' · '}{person.active ? 'Activo' : 'Invitación pendiente'}
                  {' · '}{person.published} {person.published === 1 ? 'publicada' : 'publicadas'} · {person.in_review} en revisión
                </p>
                {person.is_leader && <span className="mt-1 inline-block"><LeaderBadge small branchLabel={branchLabel} /></span>}
              </div>
              <div className="flex flex-wrap gap-2 max480:grid max480:grid-cols-1">
                {person.is_leader ? (
                  <button type="button" className={BTN_GHOST} disabled={busy === person.id}
                    onClick={() => setPending({ action: 'unlead', person })} aria-label={`Quitar el liderazgo a ${person.name}`}>Quitar liderazgo</button>
                ) : (
                  <>
                    <button type="button" className={BTN_GHOST} disabled={busy === person.id}
                      onClick={() => setPending({ action: 'lead', person })} aria-label={`Nombrar a ${person.name} líder de ${branchLabel}`}>Nombrar líder</button>
                    <button type="button" className={BTN_DANGER} disabled={busy === person.id}
                      onClick={() => setPending({ action: 'remove', person })} aria-label={`Sacar a ${person.name} de ${branchLabel}`}>Sacar de la rama</button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {leader && <p className="m-0 text-[12px] text-[#53645c]">Para sacar al líder de la rama, primero quítale el liderazgo.</p>}
      {dialog && (
        <ConfirmDialog title={dialog.title} text={dialog.text} confirmLabel={dialog.confirmLabel} danger={pending.action === 'remove'}
          onConfirm={() => run(pending)} onCancel={() => setPending(null)} />
      )}
    </div>
  );
}
