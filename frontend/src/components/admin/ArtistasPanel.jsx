import { useEffect, useState } from 'react';
import EmptyNote from '../EmptyNote.jsx';
import Icon from '../Icon.jsx';
import ArtistForm from './ArtistForm.jsx';
import ArtistEditor from './artist/ArtistEditor.jsx';
import { ALERT, ArtistAvatar, ConfirmButton, TAG } from './artist/common.jsx';
import { BTN_GHOST, BTN_INK_MD, BTN_INK_SM, PANEL, PANEL_TITLE } from '../uiStyles.js';
import { useToast } from '../../context/ToastContext.jsx';
import { adminArtistApi } from '../../services/artistApi.js';

// Pestana "Artistas" del dashboard de admin. Sin subpath: la lista (GET /api/admin/artists, con
// archivados y conteos), el alta (ArtistForm) y archivar/restaurar. "nuevo" abre la lista con el alta
// ya desplegada (el "Agregar artista" de Moneystack). Con subpath "<id>[/<pestana>]"
// (#admin-dashboard/artistas/2/galeria): el editor de ese artista, unica via de edicion. Tras crear
// un artista se abre su editor para completar el perfil.

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

function ArtistRow({ artist, busy, onArchive, onRestore }) {
  return (
    <li className={`flex items-center justify-between gap-4 border-b border-b-line py-4 last:border-b-0 max600:flex-col max600:items-stretch ${artist.active ? '' : 'rounded-[16px] bg-[rgba(102,116,111,0.07)] px-4 max600:px-3'}`}>
      <div className="flex min-w-0 items-center gap-4">
        <ArtistAvatar artist={artist} />
        <div className="min-w-0">
          <h3 className="m-0 flex flex-wrap items-center gap-2 font-sans text-[18px] font-bold leading-[1.25] tracking-[-0.02em] text-ink">
            {artist.stage_name}
            {artist.featured && <span className={TAG.gold}>Destacado</span>}
            {!artist.active && <span className={TAG.grey}>Archivado</span>}
          </h3>
          <p className="mt-1 mb-0 text-[14px] text-[#53645c]">{artist.genre || 'Sin género'}</p>
          <p className="mt-0.5 mb-0 font-mono text-[13px] text-[#53645c] [overflow-wrap:anywhere]">/artistas/{artist.slug}</p>
          <p className="mt-1 mb-0 text-[13px] text-muted">{countsText(artist.counts)}</p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 max600:justify-start">
        {artist.active ? (
          <>
            <a className={BTN_GHOST} href={`/artistas/${artist.slug}`}>Ver perfil</a>
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
    </li>
  );
}

function ArtistList({ startCreating }) {
  const { showToast } = useToast();
  const [state, setState] = useState({ loading: true, error: '', artists: [] });
  const [filter, setFilter] = useState('active');
  const [creating, setCreating] = useState(startCreating);
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

  function openCreate() {
    setRowError('');
    setCreating(true);
  }

  function closeCreate() {
    setCreating(false);
    if (window.location.hash.endsWith('/nuevo')) window.history.replaceState(window.history.state, '', '#admin-dashboard/artistas');
  }

  async function handleActive(artist, active) {
    setBusyId(artist.id);
    setRowError('');
    try {
      if (active) {
        await adminArtistApi.restore(artist.id);
        showToast({ tone: 'menta', eyebrow: 'De vuelta en el sello', title: 'Artista restaurado', text: `${artist.stage_name} vuelve a aparecer en Moneystack.` });
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
    showToast({ tone: 'menta', eyebrow: 'Nuevo en Moneystack', title: 'Artista creado', text: `${saved.stage_name} ya tiene su perfil en /artistas/${saved.slug}. Complétalo aquí.` });
    window.location.hash = `admin-dashboard/artistas/${saved.id}`;
  }

  const active = state.artists.filter((artist) => artist.active);
  const archived = state.artists.filter((artist) => !artist.active);
  const visible = filter === 'active' ? active : archived;

  return (
    <section className={PANEL} aria-labelledby="admin-artistas">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="admin-artistas" className={`${PANEL_TITLE} flex items-center gap-3`}><Icon name="music" className="size-6 text-river" /> Artistas</h2>
          <p className="mt-2 mb-0 text-[14px] text-muted">Los perfiles de Moneystack. Solo los admins crean y archivan.</p>
        </div>
        {!creating && <button type="button" className={BTN_INK_MD} onClick={openCreate}><Icon name="music" className="size-4" /> Nuevo artista</button>}
      </div>

      {creating && <ArtistForm artist={null} onSaved={handleCreated} onCancel={closeCreate} />}
      {rowError && <p className={`${ALERT} mt-4`} role="alert">{rowError}</p>}

      {state.loading && <p className="m-0 py-6 text-[14px] text-muted" aria-busy="true">Cargando...</p>}
      {state.error && <p className={`${ALERT} mt-4`} role="alert">{state.error}</p>}
      {!state.loading && !state.error && (
        <>
          <div className="mt-6 inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-cream p-1" role="group" aria-label="Filtrar artistas">
            {[['active', 'Activos', active.length], ['archived', 'Archivados', archived.length]].map(([value, label, count]) => (
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
                />
              ))}
            </ul>
          ) : (
            <div className="mt-6">
              {filter === 'active'
                ? <EmptyNote icon="music" title="Aún no hay artistas" text="Crea el primero para darle su perfil en Moneystack." />
                : <EmptyNote icon="music" title="No hay artistas archivados" text="Los que archives quedan aquí, fuera de la web pública, listos para restaurarse." />}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default function ArtistasPanel({ subpath = '' }) {
  const [id, tab] = subpath.split('/');
  if (/^\d+$/.test(id || '')) return <ArtistEditor key={id} artistId={Number(id)} tab={tab} />;
  return <ArtistList key={id || 'lista'} startCreating={id === 'nuevo'} />;
}
