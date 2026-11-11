import { useEffect, useRef, useState } from 'react';
import PillTabs from './PillTabs.jsx';
import EmptyNote from '../EmptyNote.jsx';
import Icon from '../Icon.jsx';
import ArtistForm from './ArtistForm.jsx';
import ArtistEditor, { TABS as EDITOR_TABS } from './artist/ArtistEditor.jsx';
import { SelloChip } from '../artists/ArtistCard.jsx';
import { ModerationButtons, RejectForm } from '../Moderation.jsx';
import { ALERT, ArtistAvatar, ConfirmButton, TAG } from './artist/common.jsx';
import { BTN_GHOST, BTN_INK_MD, BTN_INK_SM, PANEL, PANEL_TITLE } from '../uiStyles.js';
import { useToast } from '../../context/ToastContext.jsx';
import { adminArtistApi } from '../../services/artistApi.js';

// Pestana "Artistas" del dashboard de admin. Sin subpath: la lista (GET /api/admin/artists, con
// archivados, en revision y conteos), el alta (ArtistForm) y archivar/restaurar. Dos entradas al mismo
// formulario: "Nuevo artista Moneystack" y "Nuevo artista TEJIDO" (solo cambia el sello preseleccionado).
// "nuevo" abre la lista con el alta Moneystack ya desplegada (el "Agregar artista" de Moneystack). Cada
// fila lleva el chip de su sello; filtros Todos | Moneystack | TEJIDO | En revision | Archivados. Lo que
// carga el lider de Musica llega "En revision": Aprobar / Rechazar (con motivo, que ve el lider) con
// POST /api/artists/{id}/review. Con subpath "<id>[/<pestana>]" (#admin-dashboard/artistas/2/galeria):
// el editor de ese artista, unica via de edicion.
// Alta Moneystack: sobre el formulario, la barra de pestanas del editor con solo Datos activa (las otras
// seis con candado); al guardar se pasa al editor en Datos con las siete activas, sin navegar por hash
// (replaceState: sin salto de scroll ni recarga). Alta TEJIDO: solo el formulario; al guardar, aviso y
// de vuelta a la lista. Cambiar el sello en pleno alta muestra u oculta la barra.

const FILTER = 'inline-flex cursor-pointer items-center gap-2 rounded-full border-0 py-2 px-4 text-[14px] font-bold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

// [clave del conteo, singular, plural]
const COUNT_LABELS = [
  ['tracks', 'canción', 'canciones'],
  ['media', 'foto o video', 'fotos y videos'],
  ['timeline', 'hito', 'hitos'],
  ['social', 'red social', 'redes sociales'],
  ['connections', 'conexión', 'conexiones'],
  ['metrics', 'métrica', 'métricas'],
];

function countsText(counts = {}) {
  const parts = COUNT_LABELS
    .filter(([key]) => counts[key] > 0)
    .map(([key, one, many]) => `${counts[key]} ${counts[key] === 1 ? one : many}`);
  return parts.length ? parts.join(' · ') : 'Sin contenido todavía';
}

const REVIEW_TAG = `${TAG.gold} normal-case tracking-normal text-[12px]`;

function ArtistRow({ artist, busy, onArchive, onRestore, onReview }) {
  const [rejecting, setRejecting] = useState(false);
  const inReview = artist.active && artist.status === 'REVIEW';
  const published = artist.status === 'PUBLISHED';
  return (
    <li className={`border-b border-b-line py-4 last:border-b-0 ${artist.active ? '' : 'rounded-[16px] bg-[rgba(102,116,111,0.07)] px-4 max600:px-3'} ${inReview ? 'rounded-[16px] bg-[rgba(212,168,67,0.08)] px-4 max600:px-3' : ''}`}
      data-artista-admin={artist.slug} data-estado={artist.status}>
      <div className="flex items-center justify-between gap-4 max600:flex-col max600:items-stretch">
      <div className="flex min-w-0 items-center gap-4">
        <ArtistAvatar artist={artist} />
        <div className="min-w-0">
          <h3 className="m-0 flex flex-wrap items-center gap-2 font-sans text-[18px] font-bold leading-[1.25] tracking-[-0.02em] text-ink">
            {artist.stage_name}
            <SelloChip artist={artist} />
            {inReview && <span className={REVIEW_TAG}>En revisión</span>}
            {artist.status === 'REJECTED' && <span className={TAG.grey}>Rechazado</span>}
            {artist.featured && <span className={TAG.gold}>Destacado</span>}
            {!artist.active && <span className={TAG.grey}>Archivado</span>}
          </h3>
          <p className="mt-1 mb-0 text-[14px] text-[#53645c]">{artist.genre || 'Sin género'}</p>
          <p className="mt-0.5 mb-0 font-mono text-[13px] text-[#53645c] [overflow-wrap:anywhere]">/artistas/{artist.slug}</p>
          {artist.status !== 'PUBLISHED' && artist.created_by_name && <p className="mt-1 mb-0 text-[13px] text-[#53645c]">Lo cargó {artist.created_by_name}</p>}
          {artist.status === 'REJECTED' && artist.review_note && <p className="mt-1 mb-0 text-[13px] text-[#a8431f]"><strong>Motivo:</strong> {artist.review_note}</p>}
          <p className="mt-1 mb-0 text-[13px] text-muted">{countsText(artist.counts)}</p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 max600:justify-start">
        {inReview && (
          <ModerationButtons title={artist.stage_name} noun="el artista" busy={busy} rejecting={rejecting}
            onApprove={() => onReview(artist, 'approve')} onToggleReject={() => setRejecting(!rejecting)} />
        )}
        {artist.active ? (
          <>
            {published && <a className={BTN_GHOST} href={`/artistas/${artist.slug}`}>Ver perfil</a>}
            <a className={BTN_GHOST} href={`#admin-dashboard/artistas/${artist.id}`}><Icon name="pen" className="size-3.5" /> Editar perfil</a>
            <ConfirmButton label="Archivar" confirmLabel="Sí, archivar" itemName={artist.stage_name} busy={busy} onConfirm={() => onArchive(artist)} />
          </>
        ) : (
          <>
            <a className={BTN_GHOST} href={`#admin-dashboard/artistas/${artist.id}`}>Abrir (solo lectura)</a>
            <button type="button" className={BTN_INK_SM} disabled={busy} onClick={() => onRestore(artist)}>Restaurar</button>
          </>
        )}
      </div>
      </div>
      {rejecting && inReview && (
        <RejectForm busy={busy} label="Motivo para el líder" placeholder="Qué debe ajustar para publicarlo"
          onSubmit={(note) => { setRejecting(false); onReview(artist, 'reject', note); }} onCancel={() => setRejecting(false)} />
      )}
    </li>
  );
}

// Filtros de la lista: [clave, etiqueta, prueba].
const FILTERS = [
  ['all', 'Todos', (artist) => artist.active],
  ['moneystack', 'Moneystack', (artist) => artist.active && artist.moneystack],
  ['tejido', 'TEJIDO', (artist) => artist.active && !artist.moneystack],
  ['review', 'En revisión', (artist) => artist.active && artist.status === 'REVIEW'],
  ['archived', 'Archivados', (artist) => !artist.active],
];
const EMPTY = {
  all: ['Aún no hay artistas', 'Crea el primero con uno de los dos botones.'],
  moneystack: ['Aún no hay artistas Moneystack', 'Crea uno con «Nuevo artista Moneystack».'],
  tejido: ['Aún no hay artistas de TEJIDO', 'Crea uno con «Nuevo artista TEJIDO» o espera los que cargue el líder de Música.'],
  review: ['Nada esperando revisión', 'Los artistas que cargue el líder de Música aparecerán aquí para aprobarlos.'],
  archived: ['No hay artistas archivados', 'Los que archives quedan aquí, fuera de la web pública, listos para restaurarse.'],
};

const LOCKED_HINT = 'Guarda el artista para completar esta sección';

// Barra de pestanas del alta Moneystack: las mismas del editor, solo Datos disponible.
function NewArtistTabs() {
  return (
    <div className="mt-6" data-pestanas-alta>
      <PillTabs idPrefix="artist-new" size="compact" label="Secciones del nuevo artista" active="datos" onChange={() => {}}
        tabs={EDITOR_TABS.map(([id, label, icon]) => (id === 'datos' ? { id, label, icon } : { id, label, icon, disabled: true, disabledHint: LOCKED_HINT }))} />
      <p className="mt-2 mb-0 text-[13px] text-muted">{LOCKED_HINT}: Música, Galería, Trayectoria, Redes, Conexiones y Métricas.</p>
    </div>
  );
}

function ArtistList({ startCreating, onChanged, onOpenCreated }) {
  const { showToast } = useToast();
  const [state, setState] = useState({ loading: true, error: '', artists: [] });
  const [filter, setFilter] = useState('all');
  const [creating, setCreating] = useState(startCreating ? 'moneystack' : null); // null | 'moneystack' | 'tejido'
  const [createSello, setCreateSello] = useState(startCreating ? 'moneystack' : null);
  const [busyId, setBusyId] = useState(null);
  const [rowError, setRowError] = useState('');

  async function load() {
    try {
      const artists = await adminArtistApi.list();
      setState({ loading: false, error: '', artists });
    } catch (loadError) {
      setState({ loading: false, error: loadError.message, artists: [] });
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate(sello) {
    setRowError('');
    setCreating(sello);
    setCreateSello(sello);
  }

  function closeCreate() {
    setCreating(null);
    if (window.location.hash.endsWith('/nuevo')) window.history.replaceState(window.history.state, '', '#admin-dashboard/artistas');
  }

  async function handleActive(artist, active) {
    setBusyId(artist.id);
    setRowError('');
    try {
      if (active) {
        await adminArtistApi.restore(artist.id);
        showToast({ tone: 'menta', eyebrow: 'De vuelta', title: 'Artista restaurado', text: `${artist.stage_name} vuelve a aparecer en ${artist.moneystack ? 'Moneystack' : 'Artistas'}.` });
      } else {
        await adminArtistApi.archive(artist.id);
        showToast({ tone: 'menta', eyebrow: 'Guardado aparte', title: 'Artista archivado', text: `${artist.stage_name} ya no aparece en la web pública. Puedes restaurarlo cuando quieras.` });
      }
      await load();
    } catch (actionError) {
      setRowError(actionError.message);
    } finally {
      setBusyId(null);
    }
  }

  function handleCreated(saved) {
    if (saved.moneystack) {
      showToast({ tone: 'menta', eyebrow: 'Nuevo en Moneystack', title: 'Artista creado', text: `${saved.stage_name} ya tiene su perfil. Completa sus secciones aquí.` });
      onOpenCreated(saved);
      return;
    }
    showToast({ tone: 'menta', eyebrow: 'Nuevo en TEJIDO', title: 'Artista creado', text: `${saved.stage_name} ya aparece en Artistas.` });
    closeCreate();
    load();
    onChanged?.();
  }

  async function handleReview(artist, action, note = '') {
    setBusyId(artist.id);
    setRowError('');
    try {
      await adminArtistApi.review(artist.id, action, note);
      showToast(action === 'approve'
        ? { tone: 'menta', eyebrow: 'Sello puesto', title: 'Artista aprobado', text: `${artist.stage_name} ya aparece en Artistas.` }
        : { tone: 'menta', eyebrow: 'Hilo devuelto', title: 'Artista rechazado', text: 'El líder verá el motivo para ajustarlo.' });
      await load();
      onChanged?.();
    } catch (actionError) {
      setRowError(actionError.message);
    } finally {
      setBusyId(null);
    }
  }

  const counts = Object.fromEntries(FILTERS.map(([key, , test]) => [key, state.artists.filter(test).length]));
  const visible = state.artists.filter(FILTERS.find(([key]) => key === filter)[2]);

  return (
    <section className={PANEL} aria-labelledby="admin-artistas">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="admin-artistas" className={`${PANEL_TITLE} flex items-center gap-3`}><Icon name="music" className="size-6 text-river" /> Artistas</h2>
          <p className="mt-2 mb-0 text-[14px] text-muted">Moneystack y TEJIDO. Los admins crean y archivan; el líder de Música carga artistas de TEJIDO que se aprueban aquí.</p>
        </div>
        {!creating && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className={BTN_INK_MD} onClick={() => openCreate('moneystack')} data-nuevo-sello="moneystack"><Icon name="music" className="size-4" /> Nuevo artista Moneystack</button>
            <button type="button" className={BTN_INK_MD} onClick={() => openCreate('tejido')} data-nuevo-sello="tejido"><Icon name="music" className="size-4" /> Nuevo artista TEJIDO</button>
          </div>
        )}
      </div>

      {creating && createSello === 'moneystack' && <NewArtistTabs />}
      {creating && (
        <div id="artist-new-panel-datos" role={createSello === 'moneystack' ? 'tabpanel' : undefined}
          aria-labelledby={createSello === 'moneystack' ? 'artist-new-tab-datos' : undefined}>
          <ArtistForm key={creating} artist={null} defaultSello={creating} onSelloChange={setCreateSello} onSaved={handleCreated} onCancel={closeCreate} />
        </div>
      )}
      {rowError && <p className={`${ALERT} mt-4`} role="alert">{rowError}</p>}

      {state.loading && <p className="m-0 py-6 text-[14px] text-muted" aria-busy="true">Cargando...</p>}
      {state.error && <p className={`${ALERT} mt-4`} role="alert">{state.error}</p>}
      {!state.loading && !state.error && (
        <>
          <div className="mt-6 inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-cream p-1" role="group" aria-label="Filtrar artistas">
            {FILTERS.map(([value, label]) => [value, label, counts[value]]).map(([value, label, count]) => (
              <button
                key={value}
                type="button"
                className={`${FILTER} ${filter === value ? 'bg-ink text-white' : 'bg-transparent text-ink hover:bg-[rgba(23,63,54,.08)]'}`}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label} <span className={`rounded-full px-2 text-[12px] ${filter === value ? 'bg-white/20' : 'bg-[rgba(23,63,54,.08)]'}`}>{count}</span>
              </button>
            ))}
          </div>
          {visible.length ? (
            <ul className="mt-4 mb-0 grid list-none gap-1 p-0">
              {visible.map((artist) => (
                <ArtistRow
                  key={artist.id}
                  artist={artist}
                  busy={busyId === artist.id}
                  onArchive={(item) => handleActive(item, false)}
                  onRestore={(item) => handleActive(item, true)}
                  onReview={handleReview}
                />
              ))}
            </ul>
          ) : (
            <div className="mt-6"><EmptyNote icon="music" title={EMPTY[filter][0]} text={EMPTY[filter][1]} /></div>
          )}
        </>
      )}
    </section>
  );
}

export default function ArtistasPanel({ subpath = '', onChanged }) {
  // "<id>[/<pestana>]" o "<id>?tab=<pestana>".
  const [path, query = ''] = subpath.split('?');
  const [id, tabInPath] = path.split('/');
  const tab = new URLSearchParams(query).get('tab') || tabInPath;
  // Recien creado (Moneystack): su editor, sin pasar por un cambio de hash. Cualquier navegacion real
  // (hashchange, p. ej. "Volver a Artistas") devuelve al control de la URL.
  const [created, setCreated] = useState(null);
  const panelRef = useRef(null);
  useEffect(() => {
    const reset = () => setCreated(null);
    window.addEventListener('hashchange', reset);
    return () => window.removeEventListener('hashchange', reset);
  }, []);

  function openCreated(saved) {
    const { values, ...rest } = saved;
    setCreated({ ...values, ...rest, active: true, featured: Boolean(values.featured), status: rest.status || 'PUBLISHED' });
    window.history.replaceState(window.history.state, '', `#admin-dashboard/artistas/${saved.id}/datos`);
    onChanged?.();
    requestAnimationFrame(() => {
      const top = panelRef.current?.getBoundingClientRect().top ?? 0;
      if (top < 0) panelRef.current.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
  }

  let content;
  if (created) content = <ArtistEditor key={`nuevo-${created.id}`} artistId={created.id} tab="datos" initialArtist={created} />;
  else if (/^\d+$/.test(id || '')) content = <ArtistEditor key={id} artistId={Number(id)} tab={tab} />;
  else content = <ArtistList key={id || 'lista'} startCreating={id === 'nuevo'} onChanged={onChanged} onOpenCreated={openCreated} />;
  return <div ref={panelRef} className="scroll-mt-24">{content}</div>;
}
