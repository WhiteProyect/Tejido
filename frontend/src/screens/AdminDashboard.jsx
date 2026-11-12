import { useCallback, useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import Icon from '../components/Icon.jsx';
import PublicationForm from '../components/PublicationForm.jsx';
import ArtistasPanel from '../components/admin/ArtistasPanel.jsx';
import BandejaPanel from '../components/admin/BandejaPanel.jsx';
import BranchesPanel from '../components/admin/BranchesPanel.jsx';
import CarouselPanel from '../components/admin/carousel/CarouselPanel.jsx';
import GestoresPanel from '../components/admin/GestoresPanel.jsx';
import OpportunityTypesPanel from '../components/admin/OpportunityTypesPanel.jsx';
import PlaceCategoriesPanel from '../components/admin/PlaceCategoriesPanel.jsx';
import AdminNav, { useAdminNavMode } from '../components/admin/AdminNav.jsx';
import KindFilter, { KindEmpty, filterByKind } from '../components/admin/KindFilter.jsx';
import PulsoPanel from '../components/admin/PulsoPanel.jsx';
import TalentManager from '../components/talent/manage/TalentManager.jsx';
import UsersPanel from '../components/admin/UsersPanel.jsx';
import { MODERATION_TOASTS, ModerationButtons, RejectForm, moderatePublication } from '../components/Moderation.jsx';
import { confirmDiscard } from '../components/admin/artist/unsavedChanges.js';
import { BTN_DANGER, BTN_GHOST, BTN_INK_MD, EYEBROW, H1, PANEL, PANEL_TITLE, SECTION } from '../components/uiStyles.js';
import { useToast } from '../context/ToastContext.jsx';
import { apiRequest } from '../utils/api.js';
import { KIND_LABELS } from '../utils/constants.js';
import { branchLabel, useCulturalBranches } from '../utils/culturalBranches.js';
import { formatDateShort } from '../utils/dateUtils.js';
import { STATUS_LABELS } from '../utils/publicationStatus.js';

// Dashboard del Admin (#admin-dashboard[/publicaciones[/<id>]|gestores|usuarios[/<id>]|artistas[/<id>[/<pestana>]]|talento[/<id>[/<pestana>]]|oportunidades|lugares|ramas|carrusel|bandeja]):
// - Pulso: components/admin/PulsoPanel.jsx (GET /api/admin/stats + las tarjetas que cada admin eligio en
//   /api/admin/preferences/pulso), visible en todas las pestanas. El lapiz del header lo pone en modo edicion.
// - Secciones: barra vertical a la derecha (components/admin/AdminNav.jsx: columna en escritorio, riel de
//   iconos en tablet y boton flotante en movil). El panel activo entra con un fundido breve.
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
// - Talento: components/talent/manage/TalentManager.jsx (todas las ramas; lista y editor). Su
//   contador es stats.talent_review.
// - Oportunidades: los tipos de oportunidad (components/admin/OpportunityTypesPanel.jsx).
// - Lugares: las categorias de lugar (components/admin/PlaceCategoriesPanel.jsx). Los lugares mismos se
//   crean, editan y moderan en Publicaciones (filtro "Lugares"); los que envia un lider llegan a la
//   cola de revision como cualquier otra publicacion y solo el admin los aprueba.
// - Ramas: las ramas de cultura administrables, con su portada (components/admin/BranchesPanel.jsx).
//   #admin-dashboard/portadas (la pestana de antes) lleva aqui.
// - Carrusel: el carrusel del inicio elegido por el admin (components/admin/carousel/CarouselPanel.jsx).
// - Bandeja: components/admin/BandejaPanel.jsx (mensajes de Nosotros y reportes).
const STATUSES = ['REVIEW', 'DRAFT', 'REJECTED', 'PUBLISHED'];

const TABS = [
  ['publicaciones', 'Publicaciones', 'book'],
  ['gestores', 'Gestores', 'people'],
  ['usuarios', 'Usuarios', 'id-card'],
  ['artistas', 'Artistas', 'music'],
  ['talento', 'Talento', 'mic'],
  ['oportunidades', 'Oportunidades', 'compass'],
  ['lugares', 'Lugares', 'pin'],
  ['ramas', 'Ramas', 'palette'],
  ['carrusel', 'Carrusel', 'carousel'],
  ['bandeja', 'Bandeja', 'inbox'],
];
const TAB_IDS = TABS.map(([id]) => id);
// La seccion es "<pestana>[/<resto>]": el resto lo interpreta el panel (p. ej. artistas/2/galeria).
function parseSection(section) {
  const [first, ...rest] = String(section || '').split('/');
  const tab = first === 'portadas' ? 'ramas' : first;
  return TAB_IDS.includes(tab) ? { tab, subpath: rest.join('/') } : { tab: 'publicaciones', subpath: '' };
}
const sectionFromHash = () => parseSection(window.location.hash.replace(/^#admin-dashboard\/?/, ''));

const byPriority = (a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status)
  || String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at));


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
            {publication.kind === 'LUGAR' && (
              <><span aria-hidden="true">·</span><span>{publication.place_category?.label || 'Sin categoría de lugar'}</span></>
            )}
            <span aria-hidden="true">·</span>
            <span>{(publication.cultural_category && branchLabel(publication.cultural_category)) || (publication.kind === 'LUGAR' ? 'Sin categoría cultural' : 'Sin categoría')}</span>
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
  useCulturalBranches();

  // La pestana Portadas ahora es Ramas: el enlace viejo se corrige en la barra de direcciones.
  useEffect(() => {
    if (/^#admin-dashboard\/portadas(\/|$)/.test(window.location.hash)) {
      window.history.replaceState(window.history.state, '', '#admin-dashboard/ramas');
    }
  }, [tab]);
  const [stats, setStats] = useState(null);
  const [state, setState] = useState({ loading: true, error: '', publications: [], categories: [] });
  const [editor, setEditor] = useState(null); // null | { publication: null | objeto }
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState('');
  const [kindFilter, setKindFilter] = useState('ALL');
  const navMode = useAdminNavMode();
  const reduce = useReducedMotion();

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
  const listed = filterByKind(publications, kindFilter);
  const inboxPending = (stats?.reports || 0) + (stats?.suggestions || 0) + (stats?.join_requests || 0);

  return (
    <section className={`${SECTION} min-h-[62vh]`}>
      <a className="group mb-8 inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 font-sans text-[15px] font-bold text-[#fff9ec] no-underline transition-colors duration-200 hover:bg-[#2d5a3d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        href="#perfil" data-volver-perfil>
        <Icon name="home" className="size-5 transition-transform duration-200 group-hover:-translate-x-0.5 motion-reduce:transition-none" strokeWidth={2} /> Volver a mi perfil
      </a>
      <header className="mb-10 max-w-[760px]">
        <p className={EYEBROW}>Dashboard de admin</p>
        <h1 className={H1}>Centro de la red</h1>
        <p className="mt-4 mb-0 text-[18px] leading-[1.6] text-[#53645c]">Modera lo que llega a revisión, acompaña a los gestores y cuida todo lo que se publica en TEJIDO.</p>
      </header>

      {/* Dos columnas: contenido y la barra de secciones a la derecha. El DOM conserva el orden Pulso,
          secciones (tablist) y panel: la grilla solo los ubica. */}
      <div className={`grid gap-y-6 ${navMode === 'desktop' ? 'grid-cols-[minmax(0,1fr)_120px] gap-x-6' : navMode === 'rail' ? 'grid-cols-[minmax(0,1fr)_56px] gap-x-3' : 'grid-cols-[minmax(0,1fr)]'}`} data-admin-layout={navMode}>
        <div className="col-start-1 row-start-1 min-w-0"><PulsoPanel stats={stats} cornerSpace={navMode === 'float'} /></div>

        {/* Flotante: la celda cubre el Pulso; solo la barra recibe clics (pointer-events), el resto pasa. */}
        <div className={`row-span-2 row-start-1 flex ${navMode === 'float' ? 'pointer-events-none col-start-1 justify-end [&>*]:pointer-events-auto' : 'col-start-2'}`}>
          <AdminNav
            mode={navMode}
            idPrefix="admin"
            label="Qué gestionar"
            active={tab}
            onChange={changeTab}
            pendingTotal={pending + inboxPending + (stats?.talent_review || 0) + (stats?.artists_review || 0)}
            tabs={TABS.map(([id, label, icon]) => ({
              id, label, icon,
              ...(id === 'publicaciones' && pending > 0 ? { badge: pending, badgeLabel: 'en revisión', badgeTone: 'alert' } : {}),
              ...(id === 'bandeja' && inboxPending > 0 ? { badge: inboxPending, badgeLabel: 'pendientes', badgeTone: 'alert' } : {}),
              ...(id === 'talento' && stats?.talent_review > 0 ? { badge: stats.talent_review, badgeLabel: 'en revisión', badgeTone: 'alert' } : {}),
              ...(id === 'artistas' && stats?.artists_review > 0 ? { badge: stats.artists_review, badgeLabel: 'en revisión', badgeTone: 'alert' } : {}),
            }))}
          />
        </div>

        <div id={`admin-panel-${tab}`} role="tabpanel" aria-labelledby={`admin-tab-${tab}`} className="col-start-1 row-start-2 min-w-0">
          <motion.div key={tab} className="grid grid-cols-[minmax(0,1fr)] gap-6" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduce ? 0 : 0.2, ease: 'easeInOut' }}>
          {tab === 'publicaciones' && (
            <>
              {editor && (
                <div id="admin-editor" className="scroll-mt-24">
                  <PublicationForm
                    key={editor.publication?.id ?? 'nueva'}
                    publication={editor.publication}
                    categories={state.categories}
                    allowPublish
                    canCreatePlaces
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
                {!state.loading && !state.error && <div className="mt-4"><KindFilter value={kindFilter} onChange={setKindFilter} publications={publications} /></div>}
                {actionError && <p className="mt-4 mb-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[14px] text-[#b3442b]" role="alert">{actionError}</p>}
                {state.loading && <p className="m-0 py-6 text-[14px] text-muted" aria-busy="true">Cargando...</p>}
                {state.error && <p className="mt-4 mb-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[14px] text-[#b3442b]" role="alert">{state.error}</p>}
                {!state.loading && !state.error && (
                  <motion.div key={kindFilter} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduce ? 0 : 0.2, ease: 'easeInOut' }} data-lista-publicaciones={kindFilter}>
                    {listed.length ? (
                      <ul className="mt-4 mb-0 grid list-none gap-1 p-0">
                        {listed.map((publication) => (
                          <AdminPublicationItem key={publication.id} publication={publication} busy={busyId === publication.id} onEdit={openEditor} onAction={handleAction} />
                        ))}
                      </ul>
                    ) : <div className="mt-6"><KindEmpty kind={kindFilter} /></div>}
                  </motion.div>
                )}
              </section>
            </>
          )}
          {tab === 'gestores' && <GestoresPanel onStatsChange={loadStats} />}
          {tab === 'usuarios' && <UsersPanel subpath={subpath} onStatsChange={loadStats} />}
          {tab === 'artistas' && <ArtistasPanel subpath={subpath} onChanged={loadStats} />}
          {tab === 'talento' && <TalentManager role="ADMIN" subpath={subpath} onChanged={loadStats} />}
          {tab === 'oportunidades' && <OpportunityTypesPanel />}
          {tab === 'lugares' && <PlaceCategoriesPanel />}
          {tab === 'ramas' && <BranchesPanel />}
          {tab === 'carrusel' && <CarouselPanel />}
          {tab === 'bandeja' && <BandejaPanel onChange={loadStats} />}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
