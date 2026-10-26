import { useCallback, useEffect, useState } from 'react';
import EmptyNote from '../components/EmptyNote.jsx';
import Icon from '../components/Icon.jsx';
import PublicationForm from '../components/PublicationForm.jsx';
import ArtistasPanel from '../components/admin/ArtistasPanel.jsx';
import BandejaPanel from '../components/admin/BandejaPanel.jsx';
import GestoresPanel from '../components/admin/GestoresPanel.jsx';
import { MODERATION_TOASTS, ModerationButtons, RejectForm, moderatePublication } from '../components/Moderation.jsx';
import PillTabs from '../components/admin/PillTabs.jsx';
import { confirmDiscard } from '../components/admin/artist/unsavedChanges.js';
import { BTN_DANGER, BTN_GHOST, BTN_INK_MD, EYEBROW, H1, PANEL, PANEL_TITLE, SECTION } from '../components/uiStyles.js';
import { useToast } from '../context/ToastContext.jsx';
import { apiRequest } from '../utils/api.js';
import { CULTURAL_CATEGORIES, KIND_LABELS } from '../utils/constants.js';
import { formatDateShort } from '../utils/dateUtils.js';
import { STATUS_LABELS } from '../utils/publicationStatus.js';

// Dashboard del Admin (#admin-dashboard[/publicaciones[/<id>]|gestores|artistas[/<id>[/<pestana>]]|bandeja]):
// - Pulso: GET /api/admin/stats (incluye gestores_activos), visible en todas las pestanas. Los
//   mosaicos de reportes y mensajes enlazan a la Bandeja.
// - Pestanas: solo se monta el panel activo. La pestana va en la URL con replaceState (sin
//   hashchange: App subiria la pagina y cada cambio llenaria el historial).
// - Gestores: components/admin/GestoresPanel.jsx, tal cual vivia en el perfil.
// - Artistas: components/admin/ArtistasPanel.jsx (lista y, con un id, el editor del artista).
// - Publicaciones de TODOS los autores: GET /api/publications?status=<X> por cada estado (sin
//   status el listado solo trae las publicadas). Acciones:
//   REVIEW: Aprobar / Rechazar (motivo de 5+ caracteres) -> PATCH .../status
//   cualquier estado: Editar (PublicationForm con allowPublish) / Eliminar (DELETE).
// - Nueva publicacion: PublicationForm con allowPublish (puede publicar directo).
// - publicaciones/<id> (enlace desde un reporte de la Bandeja) abre el editor de esa publicacion.
// - Bandeja: components/admin/BandejaPanel.jsx (mensajes de Nosotros y reportes).
const STATUSES = ['REVIEW', 'DRAFT', 'REJECTED', 'PUBLISHED'];
const CATEGORY_LABELS = Object.fromEntries(CULTURAL_CATEGORIES.map(([key, label]) => [key, label]));

const TABS = [
  ['publicaciones', 'Publicaciones', 'book'],
  ['gestores', 'Gestores', 'people'],
  ['artistas', 'Artistas', 'music'],
  ['bandeja', 'Bandeja', 'inbox'],
];
const TAB_IDS = TABS.map(([id]) => id);
// La seccion es "<pestana>[/<resto>]": el resto lo interpreta el panel (p. ej. artistas/2/galeria).
function parseSection(section) {
  const [tab, ...rest] = String(section || '').split('/');
  return TAB_IDS.includes(tab) ? { tab, subpath: rest.join('/') } : { tab: 'publicaciones', subpath: '' };
}
const sectionFromHash = () => parseSection(window.location.hash.replace(/^#admin-dashboard\/?/, ''));

const byPriority = (a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status)
  || String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at));

const INBOX_HREF = '#admin-dashboard/bandeja';

function StatsPanel({ stats }) {
  const tiles = [
    ['Publicadas', stats?.published],
    ['En revisión', stats?.pending],
    ['Gestores activos', stats?.gestores_activos],
    ['Usuarios activos', stats?.users],
    ['Reportes abiertos', stats?.reports, INBOX_HREF],
    ['Mensajes nuevos', stats?.suggestions, INBOX_HREF],
    ['Solicitudes de ingreso', stats?.join_requests, INBOX_HREF],
  ];
  return (
    <section className={PANEL} aria-labelledby="admin-pulso">
      <h2 id="admin-pulso" className={PANEL_TITLE}>Pulso de la plataforma</h2>
      <dl className="mt-6 mb-0 grid grid-cols-[repeat(7,minmax(0,1fr))] gap-4 max1200:grid-cols-[repeat(4,1fr)] max800:grid-cols-[repeat(3,1fr)] max600:grid-cols-[repeat(2,1fr)]">
        {tiles.map(([label, value, href]) => (
          <div key={label} className="relative flex flex-col-reverse border-l-2 border-l-[rgba(29,143,163,0.35)] pl-4">
            <dt className="mt-2 text-[12px] font-bold uppercase tracking-[.1em] text-muted">
              {href ? (
                <a className="inline-flex items-center gap-1 text-river no-underline after:absolute after:inset-0 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink" href={href}>
                  {label} <Icon name="arrow-right" className="size-3" />
                </a>
              ) : label}
            </dt>
            <dd className="m-0 text-[40px] font-extrabold leading-none tracking-[-0.04em] text-ink">{value ?? '–'}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function AdminPublicationItem({ publication, busy, onEdit, onAction }) {
  const [mode, setMode] = useState(null); // null | 'reject' | 'delete'
  const [statusLabel, statusTone] = STATUS_LABELS[publication.status] || [publication.status, STATUS_LABELS.DRAFT[1]];
  const date = formatDateShort(publication.start_date || publication.created_at);
  const inReview = publication.status === 'REVIEW';

  return (
    <li className={`border-b border-b-line py-5 last:border-b-0 ${inReview ? 'rounded-[16px] bg-[rgba(212,168,67,0.08)] px-4 max600:px-3' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 basis-[320px]">
          <p className="m-0 mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-bold uppercase tracking-[.08em] text-muted">
            <span>{KIND_LABELS[publication.kind] || publication.kind}</span>
            <span aria-hidden="true">·</span>
            <span>{CATEGORY_LABELS[publication.cultural_category] || 'Sin categoría'}</span>
            {date && <><span aria-hidden="true">·</span><span className="font-semibold normal-case tracking-normal">{date}</span></>}
          </p>
          <h3 className="m-0 font-sans text-[19px] font-bold leading-[1.25] tracking-[-0.02em] text-ink">{publication.title}</h3>
          <p className="mt-1 mb-0 text-[14px] text-[#53645c]">Por <strong className="text-ink">{publication.author || 'Autor desconocido'}</strong></p>
          {publication.status === 'REJECTED' && publication.moderation_note && (
            <p className="mt-2 mb-0 text-[14px] leading-[1.5] text-[#a8431f]"><strong>Motivo:</strong> {publication.moderation_note}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 max600:justify-start">
          <span className={`rounded-full py-1 px-3 text-[12px] font-bold ${statusTone}`}>{statusLabel}</span>
          {inReview && (
            <ModerationButtons title={publication.title} busy={busy} rejecting={mode === 'reject'}
              onApprove={() => onAction(publication, 'approve')} onToggleReject={() => setMode(mode === 'reject' ? null : 'reject')} />
          )}
          <button type="button" className={BTN_GHOST} disabled={busy} onClick={() => onEdit(publication)}><Icon name="pen" className="size-3.5" /> Editar</button>
          {mode === 'delete' ? (
            <>
              <button type="button" className={BTN_DANGER} disabled={busy} onClick={() => onAction(publication, 'delete')}>Sí, eliminar</button>
              <button type="button" className={BTN_GHOST} disabled={busy} onClick={() => setMode(null)}>No</button>
            </>
          ) : (
            <button type="button" className={BTN_DANGER} disabled={busy} onClick={() => setMode('delete')}>Eliminar</button>
          )}
        </div>
      </div>
      {mode === 'reject' && <RejectForm busy={busy} onSubmit={(note) => onAction(publication, 'reject', note)} onCancel={() => setMode(null)} />}
    </li>
  );
}

export default function AdminDashboard({ section }) {
  const { showToast } = useToast();
  const [{ tab, subpath }, setSection] = useState(() => parseSection(section));
  const [stats, setStats] = useState(null);
  const [state, setState] = useState({ loading: true, error: '', publications: [], categories: [] });
  const [editor, setEditor] = useState(null); // null | { publication: null | objeto }
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    try {
      const [statsData, categories, ...lists] = await Promise.all([
        apiRequest('/api/admin/stats'),
        apiRequest('/api/categories'),
        ...STATUSES.map((status) => apiRequest(`/api/publications?status=${status}`)),
      ]);
      setStats(statsData);
      setState({ loading: false, error: '', publications: lists.flat().sort(byPriority), categories });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message }));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadStats = useCallback(() => apiRequest('/api/admin/stats').then(setStats).catch(() => {}), []);

  // publicaciones/<id>: abre el editor de esa publicacion en cuanto esta la lista.
  useEffect(() => {
    if (tab !== 'publicaciones' || !/^\d+$/.test(subpath) || state.loading) return;
    const target = state.publications.find((item) => String(item.id) === subpath);
    setSection({ tab, subpath: '' });
    window.history.replaceState(window.history.state, '', '#admin-dashboard/publicaciones');
    if (target) openEditor(target);
    else setActionError('Esa publicación ya no está en la lista: puede que la hayan eliminado.');
  }, [tab, subpath, state.loading, state.publications]); // eslint-disable-line react-hooks/exhaustive-deps

  // Enlaces a #admin-dashboard/<seccion> (desde fuera o abrir/cerrar el editor de un artista)
  // llegan por hashchange.
  useEffect(() => {
    const sync = () => setSection(sectionFromHash());
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  function changeTab(id) {
    if (!confirmDiscard()) return;
    setSection({ tab: id, subpath: '' });
    window.history.replaceState(window.history.state, '', `#admin-dashboard/${id}`);
  }

  function openEditor(publication = null) {
    setActionError('');
    setEditor({ publication });
    // El formulario aparece sobre la lista: se lleva la vista hasta el (tras pintarlo).
    requestAnimationFrame(() => document.getElementById('admin-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  async function handleAction(publication, action, note = '') {
    setBusyId(publication.id);
    setActionError('');
    try {
      if (action === 'approve' || action === 'reject') {
        await moderatePublication(publication.id, action, note);
        showToast(MODERATION_TOASTS[action]);
      } else {
        await apiRequest(`/api/publications/${publication.id}`, { method: 'DELETE' });
        showToast({ tone: 'menta', title: 'Publicación eliminada' });
      }
      await load();
    } catch (error) {
      setActionError(error.message);
    } finally {
      setBusyId(null);
    }
  }

  const { publications } = state;
  const pending = publications.filter((item) => item.status === 'REVIEW').length;
  const inboxPending = (stats?.reports || 0) + (stats?.suggestions || 0) + (stats?.join_requests || 0);

  return (
    <section className={`${SECTION} min-h-[62vh]`}>
      <a className="mb-8 inline-flex items-center gap-2 text-[14px] font-semibold text-ink no-underline hover:underline" href="#perfil">
        <Icon name="arrow-left" className="size-4" /> Volver a mi perfil
      </a>
      <header className="mb-10 max-w-[760px]">
        <p className={EYEBROW}>Dashboard de admin</p>
        <h1 className={H1}>Centro de la red</h1>
        <p className="mt-4 mb-0 text-[18px] leading-[1.6] text-[#53645c]">Modera lo que llega a revisión, acompaña a los gestores y cuida todo lo que se publica en TEJIDO.</p>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
        <StatsPanel stats={stats} />

        <PillTabs
          idPrefix="admin"
          label="Qué gestionar"
          active={tab}
          onChange={changeTab}
          tabs={TABS.map(([id, label, icon]) => ({
            id, label, icon,
            ...(id === 'publicaciones' && pending > 0 ? { badge: pending, badgeLabel: 'en revisión', badgeTone: 'alert' } : {}),
            ...(id === 'bandeja' && inboxPending > 0 ? { badge: inboxPending, badgeLabel: 'pendientes', badgeTone: 'alert' } : {}),
          }))}
        />

        <div id={`admin-panel-${tab}`} role="tabpanel" aria-labelledby={`admin-tab-${tab}`} className="grid grid-cols-[minmax(0,1fr)] gap-6">
          {tab === 'publicaciones' && (
            <>
              {editor && (
                <div id="admin-editor" className="scroll-mt-24">
                  <PublicationForm
                    key={editor.publication?.id ?? 'nueva'}
                    publication={editor.publication}
                    categories={state.categories}
                    allowPublish
                    onCancel={() => setEditor(null)}
                    onSaved={() => { setEditor(null); load(); }}
                  />
                </div>
              )}

              <section className={PANEL} aria-labelledby="admin-publicaciones">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h2 id="admin-publicaciones" className={`${PANEL_TITLE} flex items-center gap-3`}><Icon name="book" className="size-6 text-river" /> Publicaciones</h2>
                    <p className="mt-2 mb-0 text-[14px] text-muted">De todos los gestores. {pending ? `${pending} esperando revisión, arriba.` : 'Nada esperando revisión.'}</p>
                  </div>
                  {!editor && <button type="button" className={BTN_INK_MD} onClick={() => openEditor()}><Icon name="pen" className="size-4" /> Nueva publicación</button>}
                </div>
                {actionError && <p className="mt-4 mb-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[14px] text-[#b3442b]" role="alert">{actionError}</p>}
                {state.loading && <p className="m-0 py-6 text-[14px] text-muted" aria-busy="true">Cargando...</p>}
                {state.error && <p className="mt-4 mb-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[14px] text-[#b3442b]" role="alert">{state.error}</p>}
                {!state.loading && !state.error && (publications.length ? (
                  <ul className="mt-4 mb-0 grid list-none gap-1 p-0">
                    {publications.map((publication) => (
                      <AdminPublicationItem key={publication.id} publication={publication} busy={busyId === publication.id} onEdit={openEditor} onAction={handleAction} />
                    ))}
                  </ul>
                ) : (
                  <div className="mt-6"><EmptyNote icon="book" title="Aún no hay publicaciones" text="Crea la primera o espera a que los gestores envíen las suyas." /></div>
                ))}
              </section>
            </>
          )}
          {tab === 'gestores' && <GestoresPanel />}
          {tab === 'artistas' && <ArtistasPanel subpath={subpath} />}
          {tab === 'bandeja' && <BandejaPanel onChange={loadStats} />}
        </div>
      </div>
    </section>
  );
}
