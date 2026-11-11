import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import CategoryCoverEditor from '../components/CategoryCoverEditor.jsx';
import Icon from '../components/Icon.jsx';
import PublicationForm from '../components/PublicationForm.jsx';
import ArtistasPanel from '../components/admin/ArtistasPanel.jsx';
import BandejaPanel from '../components/admin/BandejaPanel.jsx';
import GestoresPanel from '../components/admin/GestoresPanel.jsx';
import OpportunityTypesPanel from '../components/admin/OpportunityTypesPanel.jsx';
import PlaceCategoriesPanel from '../components/admin/PlaceCategoriesPanel.jsx';
import AdminNav, { useAdminNavMode } from '../components/admin/AdminNav.jsx';
import KindFilter, { KindEmpty, filterByKind } from '../components/admin/KindFilter.jsx';
import TalentManager from '../components/talent/manage/TalentManager.jsx';
import UsersPanel from '../components/admin/UsersPanel.jsx';
import { MODERATION_TOASTS, ModerationButtons, RejectForm, moderatePublication } from '../components/Moderation.jsx';
import { confirmDiscard } from '../components/admin/artist/unsavedChanges.js';
import { BTN_DANGER, BTN_GHOST, BTN_INK_MD, EYEBROW, H1, PANEL, PANEL_TITLE, SECTION } from '../components/uiStyles.js';
import { useToast } from '../context/ToastContext.jsx';
import { apiRequest } from '../utils/api.js';
import { CULTURAL_CATEGORIES, KIND_LABELS } from '../utils/constants.js';
import { formatDateShort } from '../utils/dateUtils.js';
import { STATUS_LABELS } from '../utils/publicationStatus.js';

// Dashboard del Admin (#admin-dashboard[/publicaciones[/<id>]|gestores|usuarios[/<id>]|artistas[/<id>[/<pestana>]]|talento[/<id>[/<pestana>]]|oportunidades|lugares|portadas|bandeja]):
// - Pulso: GET /api/admin/stats (incluye gestores_activos), visible en todas las pestanas: 8 tarjetas;
//   reportes, mensajes y solicitudes enlazan a la Bandeja y "Talento y artistas por revisar" suma los dos
//   contadores y enlaza a la pestana con mas pendientes (empate: Talento). Entrada escalonada y conteo
//   ascendente solo la primera vez que llegan los datos (sin animacion con movimiento reducido).
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
// - Portadas: la portada de cada una de las 10 categorias (components/CategoryCoverEditor.jsx).
// - Bandeja: components/admin/BandejaPanel.jsx (mensajes de Nosotros y reportes).
const STATUSES = ['REVIEW', 'DRAFT', 'REJECTED', 'PUBLISHED'];
const CATEGORY_LABELS = Object.fromEntries(CULTURAL_CATEGORIES.map(([key, label]) => [key, label]));

const TABS = [
  ['publicaciones', 'Publicaciones', 'book'],
  ['gestores', 'Gestores', 'people'],
  ['usuarios', 'Usuarios', 'id-card'],
  ['artistas', 'Artistas', 'music'],
  ['talento', 'Talento', 'mic'],
  ['oportunidades', 'Oportunidades', 'compass'],
  ['lugares', 'Lugares', 'pin'],
  ['portadas', 'Portadas', 'palette'],
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

// Talento y artistas en una tarjeta: el total, el detalle y el enlace a la pestaña con mas pendientes.
export function reviewTile(stats) {
  const talent = stats?.talent_review;
  const artists = stats?.artists_review;
  const known = talent != null || artists != null;
  const t = talent || 0;
  const a = artists || 0;
  return {
    value: known ? t + a : null,
    detail: known ? `${t} talento · ${a} ${a === 1 ? 'artista' : 'artistas'}` : '',
    href: a > t ? '#admin-dashboard/artistas' : '#admin-dashboard/talento',
    linkLabel: `Talento y artistas por revisar: ${t} de talento y ${a} ${a === 1 ? 'artista' : 'artistas'}`,
  };
}

const easeOut = (t) => 1 - (1 - t) ** 3;
const CARD = 'relative flex h-full min-h-[132px] flex-col justify-between gap-3 rounded-[16px] border border-[#ddd5c7] bg-[#fffdf6] p-5 [box-shadow:0_1px_2px_rgba(23,63,54,.06),0_2px_6px_rgba(23,63,54,.05)] max600:min-h-[120px] max600:p-4';

function StatsPanel({ stats, cornerSpace = false }) {
  const reduce = useReducedMotion();
  // Conteo ascendente solo la primera vez que llegan los datos; los refrescos ponen el valor directo.
  const [progress, setProgress] = useState(stats ? 1 : 0);
  const started = useRef(Boolean(stats));
  const frame = useRef(0);
  const firstMount = useRef(true);
  useEffect(() => { firstMount.current = false; }, []);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  useEffect(() => {
    if (!stats || started.current) return;
    started.current = true;
    if (reduce) { setProgress(1); return; }
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, Math.max(0, (now - start) / 700));
      setProgress(easeOut(t));
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, [stats, reduce]);

  const review = reviewTile(stats);
  const tiles = [
    { label: 'Publicadas', value: stats?.published },
    { label: 'En revisión', value: stats?.pending },
    { label: 'Gestores activos', value: stats?.gestores_activos },
    { label: 'Usuarios activos', value: stats?.users },
    { label: 'Reportes abiertos', value: stats?.reports, href: INBOX_HREF },
    { label: 'Mensajes nuevos', value: stats?.suggestions, href: INBOX_HREF },
    { label: 'Solicitudes de ingreso', value: stats?.join_requests, href: INBOX_HREF },
    { label: 'Talento y artistas por revisar', value: review.value, href: review.href, detail: review.detail, linkLabel: review.linkLabel, id: 'revision' },
  ];
  const animateIn = firstMount.current && !reduce;
  return (
    <section className={PANEL} aria-labelledby="admin-pulso">
      <h2 id="admin-pulso" className={`${PANEL_TITLE} ${cornerSpace ? 'pr-12' : ''}`}>Pulso de la plataforma</h2>
      {/* 4 columnas (4x2) cuando el panel tiene >= 600 px utiles; si no, 2. Depende del ancho real del panel
          (container query): a 768 px el riel de secciones lo deja en ~540 px y 4 columnas partian las etiquetas. */}
      <div className="@container mt-6">
      <dl className="m-0 grid auto-rows-fr grid-cols-[repeat(2,minmax(0,1fr))] gap-3 @min-[600px]:grid-cols-[repeat(4,minmax(0,1fr))] @min-[600px]:gap-4" data-pulso>
        {tiles.map(({ label, value, href, detail, linkLabel, id }, index) => {
          const shown = value == null ? null : Math.round(value * progress);
          return (
            <motion.div key={label} className={`${CARD} ${href ? 'transition-[border-color] duration-200 hover:border-ink has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-ink' : ''}`}
              initial={animateIn ? { opacity: 0, y: 8 } : false} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduce ? 0 : 0.25, ease: 'easeOut', delay: animateIn ? index * 0.04 : 0 }}
              whileHover={href && !reduce ? { y: -2, transition: { duration: 0.15 } } : undefined}
              data-tarjeta-pulso={id || label}>
              <dt className="order-2 text-[12px] font-bold uppercase leading-[1.3] tracking-[.1em] text-[#53645c]">
                {href ? (
                  <a className="inline-flex items-start gap-1 text-ink no-underline outline-none after:absolute after:inset-0 after:rounded-[16px] hover:underline" href={href} aria-label={linkLabel} data-enlace-pulso>
                    <span>{label}</span> <Icon name="arrow-right" className="mt-px size-3.5 shrink-0" strokeWidth={2} />
                  </a>
                ) : label}
                {detail && <span className="mt-1 block text-[12px] font-semibold normal-case tracking-normal text-[#53645c]" data-detalle>{detail}</span>}
              </dt>
              <dd className="order-1 m-0 font-sans text-[40px] font-extrabold leading-none tracking-[-0.04em] text-ink max600:text-[34px]" data-valor={value ?? ''}>
                {value == null ? '–' : <><span aria-hidden="true">{shown}</span><span className="sr-only">{value}</span></>}
              </dd>
            </motion.div>
          );
        })}
      </dl>
      </div>
    </section>
  );
}

function CoversPanel() {
  return (
    <section className={PANEL} aria-labelledby="admin-portadas">
      <h2 id="admin-portadas" className={`${PANEL_TITLE} flex items-center gap-3`}><Icon name="palette" className="size-6 text-river" /> Portadas de las categorías</h2>
      <p className="mt-2 mb-0 max-w-[640px] text-[14px] text-muted">Las imágenes de Explorar y de cada categoría. Sin una portada propia se ve la original. Los líderes también pueden cambiar la de su rama.</p>
      <ul className="mt-6 mb-0 grid list-none grid-cols-[repeat(4,minmax(0,1fr))] gap-5 p-0 max1200:grid-cols-[repeat(3,minmax(0,1fr))] max800:grid-cols-[repeat(2,minmax(0,1fr))] max480:grid-cols-[minmax(0,1fr)]">
        {CULTURAL_CATEGORIES.map(([key]) => <li key={key} className="flex min-w-0 [&>*]:w-full"><CategoryCoverEditor categoryKey={key} /></li>)}
      </ul>
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
            {publication.kind === 'LUGAR' && (
              <><span aria-hidden="true">·</span><span>{publication.place_category?.label || 'Sin categoría de lugar'}</span></>
            )}
            <span aria-hidden="true">·</span>
            <span>{CATEGORY_LABELS[publication.cultural_category] || (publication.kind === 'LUGAR' ? 'Sin categoría cultural' : 'Sin categoría')}</span>
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
        <div className="col-start-1 row-start-1 min-w-0"><StatsPanel stats={stats} cornerSpace={navMode === 'float'} /></div>

        <div className={`row-span-2 row-start-1 flex ${navMode === 'float' ? 'col-start-1 justify-end' : 'col-start-2'}`}>
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
          {tab === 'portadas' && <CoversPanel />}
          {tab === 'bandeja' && <BandejaPanel onChange={loadStats} />}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
