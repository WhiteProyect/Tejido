import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import EmptyNote from '../EmptyNote.jsx';
import Icon from '../Icon.jsx';
import { BTN_INK_OUTLINE_MD, PANEL, PANEL_TITLE } from '../uiStyles.js';
import { useToast } from '../../context/ToastContext.jsx';
import { branchesOverview, listUsers } from '../../services/adminApi.js';
import { BRANCH_LABELS, CULTURAL_BRANCHES } from '../../utils/constants.js';
import { formatDateShort } from '../../utils/dateUtils.js';
import { MUNICIPALITY_BY_SLUG } from '../../utils/municipalities.js';
import { ActionDialog, EditUserDialog, UserDetailDialog } from './users/UserDialogs.jsx';
import { ActionsMenu, BranchCell, ROLE_PLURALS, RoleBadge, StatusBadge, userActions } from './users/userUi.jsx';

// Pestaña Usuarios del dashboard del admin (#admin-dashboard/usuarios[/<id>] abre la ficha): listado
// paginado de GET /api/admin/users con buscador (espera de 300 ms; cancela las busquedas viejas), chips de
// rol con conteo, estado, rama y paginacion. Tabla desde 768 px y tarjetas en movil. Cada fila tiene su
// menu "Acciones" con SOLO las acciones validas para ese usuario (users/userUi.jsx); cada accion abre su
// dialogo con el efecto explicado (users/UserDialogs.jsx). Tras un cambio: aviso, recarga de la lista y del
// Pulso (onStatsChange); los que tocan lideres o participantes recargan el resumen de ramas.
const PAGE_SIZE = 25;
const SELECT = 'h-11 w-full cursor-pointer rounded-[12px] border border-[#d9cfbe] bg-white px-3 font-sans text-[15px] font-semibold text-ink outline-none focus:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';
const CHIP = 'inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] px-3.5 font-sans text-[14px] font-bold whitespace-nowrap transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';
const EMPTY_FILTERS = { q: '', role: '', status: '', branch: '' };
const town = (slug) => MUNICIPALITY_BY_SLUG[slug]?.name || '–';

function Skeleton() {
  return (
    <ul className="mt-5 mb-0 grid list-none gap-2 p-0" aria-hidden="true" data-esqueleto>
      {[0, 1, 2, 3].map((i) => <li key={i} className="h-[68px] rounded-[14px] bg-[#f3ece0] motion-safe:animate-pulse" />)}
    </ul>
  );
}

function Who({ user }) {
  return (
    <div className="min-w-0">
      <p className="m-0 text-[15px] font-bold text-ink [overflow-wrap:anywhere]">{user.name}{user.is_self && <span className="font-semibold text-[#53645c]"> (tú)</span>}</p>
      <p className="m-0 text-[14px] text-[#3f514a] [overflow-wrap:anywhere]">{user.email}</p>
      {!user.email_verified && <p className="m-0 text-[12px] font-bold text-[#9a3a1b]" data-sin-verificar>Correo sin verificar</p>}
    </div>
  );
}

export default function UsersPanel({ subpath = '', onStatsChange }) {
  const { showToast } = useToast();
  const reduce = useReducedMotion();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ loading: true, error: '', data: null });
  const [reloadKey, setReloadKey] = useState(0);
  const [overview, setOverview] = useState({});
  const [lastAdmin, setLastAdmin] = useState(false);
  const [dialog, setDialog] = useState(null); // { kind, user } | { kind: 'ficha', id }
  const returnFocus = useRef(null);

  // Buscador: espera de 300 ms antes de filtrar.
  useEffect(() => {
    const timer = setTimeout(() => { setFilters((current) => (current.q === query ? current : { ...current, q: query })); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({ ...current, loading: true, error: '' }));
    listUsers({ ...filters, q: filters.q.trim().length >= 2 ? filters.q : '', page, pageSize: PAGE_SIZE }, { signal: controller.signal })
      .then((data) => setState({ loading: false, error: '', data }))
      .catch((error) => { if (error.name !== 'AbortError') setState({ loading: false, error: error.message, data: null }); });
    return () => controller.abort();
  }, [filters, page, reloadKey]);

  const loadContext = useCallback(() => {
    branchesOverview().then((rows) => setOverview(Object.fromEntries(rows.map((row) => [row.branch, row])))).catch(() => {});
    listUsers({ role: 'ADMIN', status: 'ACTIVO', pageSize: 2 }).then((data) => setLastAdmin(data.total <= 1)).catch(() => {});
  }, []);
  useEffect(() => { loadContext(); }, [loadContext]);

  // #admin-dashboard/usuarios/<id>: abre la ficha.
  useEffect(() => {
    if (/^\d+$/.test(subpath)) setDialog({ kind: 'ficha', id: Number(subpath) });
  }, [subpath]);

  const setFilter = (key, value) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1); };
  const clear = () => { setQuery(''); setFilters(EMPTY_FILTERS); setPage(1); };
  const filtered = Boolean(filters.q || filters.role || filters.status || filters.branch || query);
  const actionsFor = (user) => userActions(user, { lastAdmin });

  function openAction(kind, user, trigger) {
    if (trigger) returnFocus.current = trigger;
    if (kind === 'ver') setDialog({ kind: 'ficha', id: user.id });
    else setDialog({ kind, user });
  }

  function closeDialog() {
    const fromHash = dialog?.kind === 'ficha' && /^\d+$/.test(subpath);
    setDialog(null);
    if (fromHash) window.history.replaceState(window.history.state, '', '#admin-dashboard/usuarios');
    // El foco vuelve al boton "Acciones" que abrio el dialogo (el Modal lo devuelve a lo que estaba
    // enfocado, que ya no existe si el menu se cerro).
    const trigger = returnFocus.current;
    requestAnimationFrame(() => { if (trigger?.isConnected) trigger.focus(); });
  }

  function done({ toast, branches, keepOpen }) {
    if (toast) showToast({ tone: 'menta', title: 'Listo', text: toast });
    if (!keepOpen) closeDialog();
    setReloadKey((key) => key + 1);
    onStatsChange?.();
    if (branches) loadContext();
    else listUsers({ role: 'ADMIN', status: 'ACTIVO', pageSize: 2 }).then((data) => setLastAdmin(data.total <= 1)).catch(() => {});
  }

  const data = state.data;
  const items = data?.items || [];
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const counts = data?.counts;
  const row = (index) => ({
    initial: reduce ? false : { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 },
    transition: { duration: reduce ? 0 : 0.2, ease: 'easeOut', delay: reduce ? 0 : Math.min(index, 10) * 0.025 },
  });

  return (
    <section className={PANEL} aria-labelledby="admin-usuarios">
      <h2 id="admin-usuarios" className={`${PANEL_TITLE} flex items-center gap-3`}><Icon name="id-card" className="size-6 text-river" /> Usuarios</h2>
      <p className="mt-2 mb-0 max-w-[680px] text-[14px] text-muted">Todas las cuentas de TEJIDO: administradores, gestores y ciudadanos. Edita sus datos, cambia su rol o desactívalas (las cuentas no se borran).</p>

      <div className="mt-5 grid gap-3" data-filtros-usuarios>
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 max-[900px]:grid-cols-2 max600:grid-cols-1">
          <label className="grid gap-1.5 text-[13px] font-bold text-ink max-[900px]:col-span-2 max600:col-span-1" htmlFor="usuarios-q">Buscar por nombre o correo
            <input id="usuarios-q" className={SELECT.replace('cursor-pointer', '')} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ej.: María o maria@correo.com"
              autoComplete="off" maxLength={120} data-buscar-usuarios />
          </label>
          <label className="grid gap-1.5 text-[13px] font-bold text-ink" htmlFor="usuarios-estado">Estado
            <select id="usuarios-estado" className={SELECT} value={filters.status} onChange={(event) => setFilter('status', event.target.value)} data-filtro-estado>
              <option value="">Todos</option><option value="ACTIVO">Activos</option><option value="INACTIVO">Inactivos</option><option value="INVITADO">Invitados</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-[13px] font-bold text-ink" htmlFor="usuarios-rama">Rama
            <select id="usuarios-rama" className={SELECT} value={filters.branch} onChange={(event) => setFilter('branch', event.target.value)} data-filtro-rama>
              <option value="">Todas</option>
              {CULTURAL_BRANCHES.map((key) => <option key={key} value={key}>{BRANCH_LABELS[key]}</option>)}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="-mx-1 flex max-w-full gap-1.5 overflow-x-auto px-1 py-1" role="group" aria-label="Filtrar por rol" data-filtro-rol>
            {[['', 'Todos', 'ALL'], ['ADMIN', ROLE_PLURALS.ADMIN, 'ADMIN'], ['GESTOR', ROLE_PLURALS.GESTOR, 'GESTOR'], ['CIUDADANO', ROLE_PLURALS.CIUDADANO, 'CIUDADANO']].map(([value, text, key]) => {
              const pressed = filters.role === value;
              return (
                <button key={key} type="button" aria-pressed={pressed} onClick={() => setFilter('role', value)} data-rol-filtro={key}
                  className={`${CHIP} ${pressed ? 'border-ink bg-ink text-[#fff9ec]' : 'border-[#d9cfbe] bg-white text-ink hover:border-ink'}`}>
                  {pressed && <Icon name="check" className="size-4" strokeWidth={2.4} />}{text}
                  {counts && <span className={`inline-flex min-w-6 items-center justify-center rounded-full px-1.5 text-[12px] font-extrabold tabular-nums ${pressed ? 'bg-[#fff9ec] text-ink' : 'bg-[#f3e4c8] text-ink'}`}>{counts[key]}</span>}
                </button>
              );
            })}
          </div>
          {filtered && (
            <button type="button" onClick={clear} data-limpiar-filtros
              className="inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-full border-0 bg-transparent px-2 font-sans text-[14px] font-bold text-ink underline decoration-2 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      <p className="mt-4 mb-0 min-h-[22px] text-[14px] font-semibold text-[#3f514a]" aria-live="polite" data-total-usuarios>
        {data && !state.loading ? `${data.total} ${data.total === 1 ? 'cuenta' : 'cuentas'}${filtered ? ' con estos filtros' : ''}` : ''}
      </p>

      {state.loading && !data && <Skeleton />}
      {state.error && (
        <div className="mt-4 grid justify-items-start gap-3 rounded-[16px] border-2 border-[#b8502b] bg-white p-4" role="alert" data-error-usuarios>
          <p className="m-0 text-[15px] font-semibold text-ink">{state.error}</p>
          <button type="button" className={BTN_INK_OUTLINE_MD} onClick={() => setReloadKey((key) => key + 1)}>Reintentar</button>
        </div>
      )}
      {data && !state.error && !items.length && (
        <div className="mt-4" data-vacio-usuarios>
          <EmptyNote icon="search" title="No hay cuentas con estos filtros" text={filtered ? 'Prueba con otra búsqueda o usa «Limpiar filtros» para ver todas.' : 'Aún no hay cuentas registradas.'} />
        </div>
      )}
      {data && !state.error && items.length > 0 && (
        <div className={`mt-2 transition-opacity duration-150 ${state.loading ? 'opacity-60' : ''}`} aria-busy={state.loading || undefined}>
          {/* Escritorio y tablet: tabla. */}
          <div className="relative overflow-x-auto max-[767px]:hidden">
            <table className="w-full min-w-[760px] border-collapse text-left text-[14px]" data-tabla-usuarios>
              <caption className="sr-only">Usuarios, página {data.page} de {pages}</caption>
              <thead>
                <tr className="border-b border-b-line text-[12px] uppercase tracking-[.1em] text-[#53645c]">
                  <th scope="col" className="py-3 pr-4 font-bold">Nombre y correo</th>
                  <th scope="col" className="py-3 pr-4 font-bold">Rol</th>
                  <th scope="col" className="py-3 pr-4 font-bold">Estado</th>
                  <th scope="col" className="py-3 pr-4 font-bold">Rama</th>
                  <th scope="col" className="py-3 pr-4 font-bold">Municipio</th>
                  <th scope="col" className="py-3 pr-4 font-bold">Alta</th>
                  <th scope="col" className="py-3 font-bold"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {items.map((user, index) => (
                  <motion.tr key={user.id} className="border-b border-b-line align-middle last:border-b-0" {...row(index)} data-fila-usuario={user.id}>
                    <td className="py-3 pr-4"><Who user={user} /></td>
                    <td className="py-3 pr-4"><RoleBadge role={user.role} /></td>
                    <td className="py-3 pr-4"><StatusBadge status={user.status} /></td>
                    <td className="py-3 pr-4"><BranchCell user={user} /></td>
                    <td className="py-3 pr-4 text-[#3f514a]">{town(user.municipality)}</td>
                    <td className="py-3 pr-4 whitespace-nowrap text-[#3f514a]">{formatDateShort(user.created_at)}</td>
                    <td className="py-3 text-right"><ActionsMenu user={user} actions={actionsFor(user)} onAction={openAction} /></td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Movil: tarjetas. */}
          <ul className="m-0 grid list-none gap-3 p-0 min-[768px]:hidden" data-tarjetas-usuarios>
            {items.map((user, index) => (
              <motion.li key={user.id} className="grid gap-2.5 rounded-[16px] border border-[#ddd5c7] bg-[#fffdf6] p-4" {...row(index)} data-tarjeta-usuario={user.id}>
                <Who user={user} />
                <div className="flex flex-wrap items-center gap-1.5"><RoleBadge role={user.role} /><StatusBadge status={user.status} /></div>
                <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[14px]">
                  <dt className="font-bold text-[#53645c]">Rama</dt><dd className="m-0"><BranchCell user={user} /></dd>
                  <dt className="font-bold text-[#53645c]">Municipio</dt><dd className="m-0 text-ink">{town(user.municipality)}</dd>
                  <dt className="font-bold text-[#53645c]">Alta</dt><dd className="m-0 text-ink">{formatDateShort(user.created_at)}</dd>
                </dl>
                <div><ActionsMenu user={user} actions={actionsFor(user)} onAction={openAction} /></div>
              </motion.li>
            ))}
          </ul>
          <nav className="mt-4 flex flex-wrap items-center justify-between gap-3" aria-label="Paginación de usuarios" data-paginacion>
            <button type="button" className={BTN_INK_OUTLINE_MD} disabled={page <= 1 || state.loading} onClick={() => setPage((p) => p - 1)}>
              <Icon name="arrow-left" className="size-4" /> Anterior
            </button>
            <p className="m-0 text-[14px] font-bold text-ink" aria-live="polite" data-pagina>Página {data.page} de {pages}</p>
            <button type="button" className={BTN_INK_OUTLINE_MD} disabled={page >= pages || state.loading} onClick={() => setPage((p) => p + 1)}>
              Siguiente <Icon name="arrow-right" className="size-4" />
            </button>
          </nav>
        </div>
      )}

      {dialog?.kind === 'ficha' && <UserDetailDialog userId={dialog.id} actions={actionsFor} onAction={(kind, user) => setDialog(kind === 'ver' ? dialog : { kind, user })} onClose={closeDialog} />}
      {dialog?.kind === 'editar' && <EditUserDialog user={dialog.user} onClose={closeDialog} onDone={done} />}
      {dialog && !['ficha', 'editar'].includes(dialog.kind) && <ActionDialog kind={dialog.kind} user={dialog.user} overview={overview} onClose={closeDialog} onDone={done} />}
    </section>
  );
}
