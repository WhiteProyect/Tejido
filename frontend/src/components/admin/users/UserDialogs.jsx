import { useEffect, useId, useState } from 'react';
import Modal from '../../talent/Modal.jsx';
import { BTN_GHOST, BTN_INK_MD, BTN_INK_OUTLINE_MD } from '../../uiStyles.js';
import { branchLabel, useCulturalBranches } from '../../../utils/culturalBranches.js';
import { MUNICIPALITY_LIST, MUNICIPALITY_BY_SLUG } from '../../../utils/municipalities.js';
import { formatDateShort } from '../../../utils/dateUtils.js';
import {
  clearLeader, getUser, makeAdmin, makeGestor, moveGestor, removeFromBranch, resendInvite, revokeAdmin, setLeader, updateUser,
} from '../../../services/adminApi.js';
import { BranchCell, RoleBadge, StatusBadge } from './userUi.jsx';

// Dialogos de la pestaña Usuarios (Modal del proyecto: foco atrapado, Esc cierra, el foco vuelve a quien
// lo abrio). Cada confirmacion explica su EFECTO en una frase; los errores del servidor quedan dentro
// (role="alert") sin cerrar el dialogo.
const FIELD = 'w-full rounded-[12px] border border-line bg-white py-2.5 px-3.5 text-[16px] font-medium text-ink outline-none transition-colors duration-200 focus:border-ink';
const LABEL = 'grid gap-1.5 text-[14px] font-bold text-ink';
const ALERT = 'm-0 rounded-[14px] border border-[#e9b9a6] bg-[#fdf1ec] py-3 px-4 text-[14px] font-semibold text-[#9a3a1b]';
const EFFECT = 'm-0 rounded-[14px] bg-[#f3e4c8] px-4 py-3 text-[15px] leading-[1.5] text-ink';
// Boton de confirmacion de las acciones que quitan algo (mismo tono que ConfirmDialog de gestor/edit).
const DANGER_MD = BTN_INK_MD.replace('bg-ink', 'bg-[#a8431f]').replace(/hover:bg-\S+/, 'hover:bg-[#8f3719]');
const NOTICE = 'm-0 rounded-[14px] border border-[#e8d29a] bg-[#fbf3dc] px-4 py-3 text-[14px] font-semibold leading-[1.5] text-[#5f4a10]';

const label = (branch) => branchLabel(branch);
const leaderOf = (overview, branch) => overview?.[branch]?.leader || null;

// Configuracion de cada accion: titulo, efecto (con los valores elegidos), campos y la llamada.
function actionConfig(kind, user, overview) {
  const name = user.name;
  const from = user.branch_label;
  switch (kind) {
    case 'gestor':
    case 'gestor-lider': {
      const lead = kind === 'gestor-lider';
      return {
        title: lead ? `Convertir a ${name} en gestor y líder` : `Convertir a ${name} en gestor`,
        fields: ['branch', 'org'],
        effect: ({ branch }) => (lead
          ? `${name} pasará a ser gestor y líder de ${label(branch)}.`
          : `${name} pasará a ser gestor participante de ${label(branch)}: podrá publicar en esa rama y su líder (o el equipo) revisará lo que envíe.`),
        notice: ({ branch }) => (lead && leaderOf(overview, branch) ? `${leaderOf(overview, branch).name} pasará a ser participante de la rama.` : ''),
        confirmLabel: lead ? 'Convertir y nombrar líder' : 'Convertir en gestor',
        run: ({ branch, org }) => makeGestor(user.id, { branch, organizationName: org, leader: lead }),
        toast: ({ branch }) => (lead ? `${name} ahora es gestor y líder de ${label(branch)}.` : `${name} ahora es gestor de ${label(branch)}.`),
        branches: true,
      };
    }
    case 'mover':
    case 'mover-lider': {
      const lead = kind === 'mover-lider';
      return {
        title: lead ? `Mover a ${name} y nombrarlo líder` : `Mover a ${name} a otra rama`,
        fields: ['branch'],
        exclude: user.branch,
        effect: ({ branch }) => `${name} pasará de ${from} a ${label(branch)}${lead ? ' como líder' : ' como participante'}; sus publicaciones en revisión vuelven a borrador (lo ya publicado sigue visible).`,
        notice: ({ branch }) => (lead && leaderOf(overview, branch) ? `${leaderOf(overview, branch).name} pasará a ser participante de ${label(branch)}.` : ''),
        confirmLabel: lead ? 'Mover y nombrar líder' : 'Mover de rama',
        run: ({ branch }) => moveGestor(user.id, { branch, lead }),
        toast: ({ branch }) => `${name} ahora está en ${label(branch)}${lead ? ' como líder' : ''}.`,
        branches: true,
      };
    }
    case 'nombrar-lider': {
      const current = leaderOf(overview, user.branch);
      return {
        title: `Nombrar a ${name} líder de ${from}`,
        effect: () => `${name} será líder de ${from}: revisará lo que publiquen los participantes y decidirá quién se suma.`,
        notice: () => (current ? `${current.name} pasará a ser participante de la rama.` : ''),
        confirmLabel: 'Nombrar líder',
        run: () => setLeader(user.branch, user.id),
        toast: () => `${name} ahora lidera ${from}.`,
        branches: true,
      };
    }
    case 'quitar-liderazgo':
      return {
        title: `Quitar el liderazgo a ${name}`,
        effect: () => `${name} sigue en ${from} como participante; la rama queda sin líder y lo que revisaba pasa al equipo de TEJIDO.`,
        confirmLabel: 'Quitar liderazgo', danger: true,
        run: () => clearLeader(user.branch),
        toast: () => `${from} quedó sin líder.`,
        branches: true,
      };
    case 'sacar':
      return {
        title: `Sacar a ${name} de ${from}`,
        effect: () => `${name} vuelve a ser ciudadano. Lo que ya publicó sigue visible; lo que estaba en revisión vuelve a borrador.`,
        confirmLabel: 'Sacar de la rama', danger: true,
        run: () => removeFromBranch(user.id),
        toast: () => `${name} salió de ${from}.`,
        branches: true,
      };
    case 'hacer-admin':
      return {
        title: `Hacer administrador a ${name}`,
        fields: ['understand'],
        effect: () => `${name} tendrá acceso total al panel de administración: podrá moderar, publicar y gestionar cuentas y roles.`
          + (user.role === 'GESTOR' ? ` Su organización queda inactiva (conserva sus datos) y lo que tenga en revisión vuelve a borrador.` : ''),
        confirmLabel: 'Hacer administrador',
        run: () => makeAdmin(user.id),
        toast: () => `${name} ahora es administrador.`,
        branches: user.role === 'GESTOR',
      };
    case 'quitar-admin':
      return {
        title: `Quitar el rol de administrador a ${name}`,
        effect: () => `${name} dejará de ser administrador y quedará como ciudadano (sin acceso a este panel).`,
        confirmLabel: 'Quitar rol', danger: true,
        run: () => revokeAdmin(user.id),
        toast: () => `${name} ya no es administrador.`,
      };
    case 'desactivar':
      return {
        title: `Desactivar a ${name}`,
        effect: () => `${name} no podrá entrar a TEJIDO y se cerrarán sus sesiones abiertas. Es reversible.`
          + (user.is_leader ? ` ${from} quedará sin líder.` : user.role === 'GESTOR' ? ' Su organización y lo publicado se conservan.' : ''),
        confirmLabel: 'Desactivar', danger: true,
        run: () => updateUser(user.id, { active: false }),
        toast: () => `${name} quedó inactivo.`,
        branches: user.role === 'GESTOR',
      };
    case 'activar':
      return {
        title: `Activar a ${name}`,
        effect: () => `${name} podrá volver a entrar con su contraseña.`,
        confirmLabel: 'Activar',
        run: () => updateUser(user.id, { active: true }),
        toast: () => `${name} está activo de nuevo.`,
        branches: user.role === 'GESTOR',
      };
    case 'reenviar':
      return {
        title: `Reenviar la invitación a ${name}`,
        effect: () => `Le enviaremos un enlace nuevo a ${user.email}; el anterior deja de servir.`,
        confirmLabel: 'Reenviar invitación',
        run: () => resendInvite(user.id),
        toast: () => `Invitación reenviada a ${user.email}.`,
      };
    default:
      return null;
  }
}

export function ActionDialog({ kind, user, overview, onClose, onDone }) {
  const id = useId().replace(/:/g, '');
  const config = actionConfig(kind, user, overview);
  // Solo ramas activas (utils/culturalBranches.js).
  const branchKeys = useCulturalBranches().list.map(({ key }) => key);
  const firstBranch = branchKeys.find((key) => key !== config?.exclude) || branchKeys[0] || '';
  const [values, setValues] = useState({ branch: firstBranch, org: user.name, understand: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [link, setLink] = useState('');
  if (!config) return null;
  const fields = config.fields || [];
  const notice = config.notice?.(values);
  const blocked = fields.includes('understand') && !values.understand;

  async function submit(event) {
    event.preventDefault();
    if (saving || blocked) return;
    setSaving(true);
    setError('');
    try {
      const result = await config.run(values);
      if (kind === 'reenviar' && result && result.email_sent === false) {
        setLink(result.invite_link);
        setSaving(false);
        onDone({ toast: 'Invitación nueva creada: el correo no salió, comparte el enlace.', branches: false, keepOpen: true });
        return;
      }
      onDone({ toast: config.toast(values), branches: Boolean(config.branches), result });
    } catch (runError) {
      setError(runError.message);
      setSaving(false);
    }
  }

  return (
    <Modal animated title={config.title} onClose={onClose}>
      <form className="mt-5 grid gap-4" onSubmit={submit} data-dialogo-accion={kind}>
        {fields.includes('branch') && (
          <label className={LABEL} htmlFor={`${id}-rama`}>Rama
            <select id={`${id}-rama`} className={FIELD} value={values.branch} onChange={(event) => setValues({ ...values, branch: event.target.value })} data-campo-rama>
              {branchKeys.filter((key) => key !== config.exclude).map((key) => <option key={key} value={key}>{label(key)}</option>)}
            </select>
          </label>
        )}
        {fields.includes('org') && (
          <label className={LABEL} htmlFor={`${id}-org`}>Nombre de su organización
            <input id={`${id}-org`} className={FIELD} value={values.org} maxLength={120} onChange={(event) => setValues({ ...values, org: event.target.value })} data-campo-org />
            <span className="text-[13px] font-medium text-[#53645c]">Opcional: si lo dejas vacío, se usa su nombre.</span>
          </label>
        )}
        <p className={EFFECT} data-efecto>{config.effect(values)}</p>
        {notice && <p className={NOTICE} data-aviso-efecto>{notice}</p>}
        {fields.includes('understand') && (
          <label className="flex cursor-pointer items-start gap-3 rounded-[14px] border-2 border-ink bg-white px-4 py-3 text-[15px] font-bold text-ink">
            <input type="checkbox" className="mt-1 size-5 shrink-0 accent-[#173f36]" checked={values.understand}
              onChange={(event) => setValues({ ...values, understand: event.target.checked })} data-entiendo />
            Entiendo que tendrá acceso total
          </label>
        )}
        {link && (
          <p className="m-0 grid gap-2 rounded-[14px] bg-white px-4 py-3 text-[14px] text-ink" role="status">
            No pudimos enviar el correo. Comparte este enlace:
            <input className={`${FIELD} font-mono text-[13px]`} value={link} readOnly onFocus={(event) => event.target.select()} aria-label="Enlace de invitación" />
          </p>
        )}
        {error && <p className={ALERT} role="alert" data-error-accion>{error}</p>}
        <div className="flex flex-wrap justify-end gap-3 max480:grid max480:grid-cols-1">
          <button type="button" className={`${BTN_INK_OUTLINE_MD} max480:w-full`} onClick={onClose} disabled={saving}>{link ? 'Cerrar' : 'Cancelar'}</button>
          {!link && (
            <button type="submit" className={`${config.danger ? DANGER_MD : BTN_INK_MD} max480:w-full`}
              disabled={saving || blocked} aria-disabled={blocked || undefined} data-confirmar-accion>
              {saving ? 'Guardando…' : config.confirmLabel}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

export function EditUserDialog({ user, onClose, onDone }) {
  const id = useId().replace(/:/g, '');
  const [name, setName] = useState(user.name);
  const [municipality, setMunicipality] = useState(user.municipality || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await updateUser(user.id, { name, municipality: municipality || null });
      onDone({ toast: `Guardamos los cambios de ${name.trim() || user.name}.`, branches: false });
    } catch (saveError) {
      setError(saveError.message);
      setSaving(false);
    }
  }

  return (
    <Modal animated title={`Editar a ${user.name}`} onClose={onClose}>
      <form className="mt-5 grid gap-4" onSubmit={submit} data-dialogo-editar>
        <label className={LABEL} htmlFor={`${id}-nombre`}>Nombre
          <input id={`${id}-nombre`} className={FIELD} value={name} maxLength={120} required onChange={(event) => setName(event.target.value)} data-campo-nombre />
        </label>
        <label className={LABEL} htmlFor={`${id}-mun`}>Municipio
          <select id={`${id}-mun`} className={FIELD} value={municipality} onChange={(event) => setMunicipality(event.target.value)} data-campo-municipio>
            <option value="">Sin municipio</option>
            {MUNICIPALITY_LIST.map(({ slug, name: town }) => <option key={slug} value={slug}>{town}</option>)}
          </select>
        </label>
        <p className="m-0 text-[14px] text-[#53645c]">Correo: <strong className="text-ink">{user.email}</strong> (no se edita: afecta su acceso y la verificación).</p>
        {error && <p className={ALERT} role="alert" data-error-accion>{error}</p>}
        <div className="flex flex-wrap justify-end gap-3 max480:grid max480:grid-cols-1">
          <button type="button" className={`${BTN_INK_OUTLINE_MD} max480:w-full`} onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" className={`${BTN_INK_MD} max480:w-full`} disabled={saving} data-confirmar-accion>{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </Modal>
  );
}

const PUB_LABELS = [['PUBLISHED', 'Publicadas'], ['REVIEW', 'En revisión'], ['DRAFT', 'Borradores'], ['REJECTED', 'Rechazadas']];
const REQUEST_LABELS = { PENDING: 'Pendiente', APPROVED: 'Aprobada', REJECTED: 'Rechazada', CANCELLED: 'Cancelada' };

// Ficha: datos, publicaciones por estado, solicitudes recientes, organizacion y acciones frecuentes.
export function UserDetailDialog({ userId, actions, onAction, onClose }) {
  const [state, setState] = useState({ loading: true, error: '', user: null });
  useEffect(() => {
    let alive = true;
    getUser(userId).then((user) => alive && setState({ loading: false, error: '', user }))
      .catch((loadError) => alive && setState({ loading: false, error: loadError.message, user: null }));
    return () => { alive = false; };
  }, [userId]);
  const user = state.user;
  const quick = user ? (actions(user) || []).filter((action) => action.id !== 'ver' && !action.disabled).slice(0, 3) : [];
  return (
    <Modal animated title={user ? user.name : 'Ficha del usuario'} onClose={onClose} wide>
      {state.loading && <p className="mt-5 mb-0 text-[15px] text-[#53645c]" aria-busy="true">Cargando la ficha…</p>}
      {state.error && <p className={`${ALERT} mt-5`} role="alert">{state.error}</p>}
      {user && (
        <div className="mt-5 grid gap-5" data-ficha-usuario={user.id}>
          <div className="flex flex-wrap items-center gap-2"><RoleBadge role={user.role} /><StatusBadge status={user.status} />{user.is_self && <span className="text-[13px] font-bold text-[#53645c]">(tú)</span>}</div>
          <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-x-6 gap-y-3 text-[15px]">
            {[
              ['Correo', <>{user.email}{!user.email_verified && <span className="ml-1.5 text-[13px] font-bold text-[#9a3a1b]">· Correo sin verificar</span>}</>],
              ['Municipio', MUNICIPALITY_BY_SLUG[user.municipality]?.name || '–'],
              ['Rama', <BranchCell user={user} />],
              ['Alta', formatDateShort(user.created_at) || '–'],
            ].map(([term, value]) => (
              <div key={term} className="min-w-0"><dt className="text-[12px] font-bold uppercase tracking-[.08em] text-[#53645c]">{term}</dt><dd className="m-0 mt-0.5 text-ink [overflow-wrap:anywhere]">{value}</dd></div>
            ))}
          </dl>
          <section aria-labelledby="ficha-pubs">
            <h3 id="ficha-pubs" className="m-0 text-[16px] font-extrabold text-ink">Publicaciones</h3>
            <ul className="mt-2 mb-0 grid list-none grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-2 p-0">
              {PUB_LABELS.map(([key, text]) => (
                <li key={key} className="rounded-[12px] border border-[#ddd5c7] bg-[#fffdf6] px-3 py-2"><strong className="block text-[22px] leading-none text-ink">{user.publications[key]}</strong><span className="text-[13px] text-[#53645c]">{text}</span></li>
              ))}
            </ul>
          </section>
          {user.organization && (
            <section aria-labelledby="ficha-org">
              <h3 id="ficha-org" className="m-0 text-[16px] font-extrabold text-ink">Organización</h3>
              <p className="mt-2 mb-0 text-[15px] text-ink">
                {user.organization.name} · {user.organization.branch_label || 'Sin rama'}{user.organization.is_leader ? ' · Líder' : ''}{user.organization.active ? '' : ' · Inactiva'}
                {user.organization.slug && user.organization.active && <> · <a className="font-bold text-river underline" href={`#gestor/${user.organization.slug}`}>Ver perfil público</a></>}
              </p>
            </section>
          )}
          <section aria-labelledby="ficha-sol">
            <h3 id="ficha-sol" className="m-0 text-[16px] font-extrabold text-ink">Solicitudes de ingreso</h3>
            {user.join_requests.length ? (
              <ul className="mt-2 mb-0 grid list-none gap-1 p-0 text-[15px]">
                {user.join_requests.map((request) => <li key={request.id}>{request.branch_label} · {REQUEST_LABELS[request.status] || request.status} · {formatDateShort(request.created_at)}</li>)}
              </ul>
            ) : <p className="mt-2 mb-0 text-[15px] text-[#53645c]">Sin solicitudes.</p>}
          </section>
          {quick.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t border-[#ddd5c7] pt-4" data-acciones-ficha>
              {quick.map((action) => <button key={action.id} type="button" className={BTN_GHOST} onClick={() => onAction(action.id, user)}>{action.label.replace('…', '')}</button>)}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
