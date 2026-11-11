import { useCallback, useEffect, useState } from 'react';
import ArtistForm from '../../admin/ArtistForm.jsx';
import { ArtistAvatar } from '../../admin/artist/common.jsx';
import EmptyNote from '../../EmptyNote.jsx';
import Icon from '../../Icon.jsx';
import { BTN_GHOST, BTN_INK_MD, BTN_INK_SM, PANEL, PANEL_TITLE } from '../../uiStyles.js';
import { useToast } from '../../../context/ToastContext.jsx';
import { leaderArtistApi } from '../../../services/artistApi.js';
import { MUNICIPALITY_NAMES } from '../../../utils/artists.js';

// "Mis artistas" del lider de la rama Musica (#gestor-dashboard/artistas): los artistas de TEJIDO que
// cargo (GET /api/artists/mine) con su estado. Nuevo artista y editar usan el mismo formulario del admin
// sin sello, destacado ni slug (ArtistForm mode="leader"); el backend lo fija en TEJIDO y lo deja En
// revision hasta que el admin lo apruebe. Rechazado: se ve el motivo, se corrige y se reenvia (POST
// /api/artists/{id}/submit). Editar uno ya publicado no lo devuelve a revision.
const STATUS = {
  REVIEW: ['En revisión', 'bg-[rgba(212,168,67,0.18)] text-[#6b500f]'],
  PUBLISHED: ['Publicado', 'bg-[rgba(136,197,164,0.3)] text-ink'],
  REJECTED: ['Rechazado', 'bg-[rgba(216,91,54,0.12)] text-[#a8431f]'],
};
const ALERT = 'mt-4 mb-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[14px] text-[#b3442b]';

function ArtistItem({ artist, busy, onEdit, onResubmit }) {
  const [label, tone] = STATUS[artist.status] || STATUS.REVIEW;
  return (
    <li className="flex flex-wrap items-start justify-between gap-4 border-b border-b-line py-5 last:border-b-0" data-mi-artista={artist.slug} data-estado={artist.status}>
      <div className="flex min-w-0 flex-1 basis-[300px] items-center gap-4">
        <ArtistAvatar artist={{ ...artist, active: true }} />
        <div className="min-w-0">
          <h3 className="m-0 font-sans text-[18px] font-bold leading-[1.25] text-ink [overflow-wrap:anywhere]">{artist.stage_name}</h3>
          <p className="mt-1 mb-0 text-[14px] text-[#53645c]">{[artist.genre, MUNICIPALITY_NAMES[artist.municipality]].filter(Boolean).join(' · ') || 'Sin género'}</p>
          {artist.status === 'REVIEW' && <p className="mt-1 mb-0 text-[14px] text-[#53645c]">El equipo de TEJIDO lo revisa antes de publicarlo.</p>}
          {artist.status === 'REJECTED' && (
            <p className="mt-1 mb-0 text-[14px] leading-[1.5] text-[#a8431f]"><strong>Motivo:</strong> {artist.review_note || 'El equipo no dejó una nota.'}</p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full py-1 px-3 text-[12px] font-bold ${tone}`}>{label}</span>
        {artist.status === 'PUBLISHED' && <a className={BTN_GHOST} href={`#artista/${artist.slug}`}>Ver perfil</a>}
        <button type="button" className={BTN_GHOST} disabled={busy} onClick={() => onEdit(artist)}>
          <Icon name="pen" className="size-3.5" /> {artist.status === 'REJECTED' ? 'Corregir' : 'Editar'}
        </button>
        {artist.status === 'REJECTED' && (
          <button type="button" className={BTN_INK_SM} disabled={busy} onClick={() => onResubmit(artist)}><Icon name="send" className="size-3.5" /> Reenviar</button>
        )}
      </div>
    </li>
  );
}

export default function LeaderArtistsPanel() {
  const { showToast } = useToast();
  const [state, setState] = useState({ loading: true, error: '', artists: [] });
  const [editing, setEditing] = useState(null); // null | 'nuevo' | artista
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    try {
      setState({ loading: false, error: '', artists: await leaderArtistApi.mine() });
    } catch (error) {
      setState({ loading: false, error: error.message, artists: [] });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function open(target) {
    setActionError('');
    setEditing(target);
  }

  function saved(result) {
    setEditing(null);
    showToast(editing === 'nuevo'
      ? { tone: 'menta', eyebrow: 'Hilo en camino', title: 'Artista enviado a revisión', text: `El equipo revisará a ${result.stage_name} antes de publicarlo.` }
      : { tone: 'menta', title: 'Cambios guardados', text: editing?.status === 'REJECTED' ? 'Cuando esté listo, pulsa «Reenviar».' : `${result.stage_name} está al día.` });
    load();
  }

  async function resubmit(artist) {
    setBusyId(artist.id);
    setActionError('');
    try {
      await leaderArtistApi.submit(artist.id);
      showToast({ tone: 'menta', eyebrow: 'Hilo en camino', title: 'Reenviado a revisión', text: `El equipo revisará de nuevo a ${artist.stage_name}.` });
      await load();
    } catch (error) {
      setActionError(error.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className={PANEL} aria-labelledby="lider-artistas" data-panel-mis-artistas>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="lider-artistas" className={`${PANEL_TITLE} flex items-center gap-3`}><Icon name="music" className="size-6 text-river" /> Mis artistas</h2>
          <p className="mt-2 mb-0 max-w-[620px] text-[14px] text-muted">Artistas de TEJIDO de la rama Música. El equipo los revisa antes de que aparezcan en Artistas, en Música y en su municipio.</p>
        </div>
        {!editing && <button type="button" className={BTN_INK_MD} onClick={() => open('nuevo')} data-nuevo-artista><Icon name="music" className="size-4" /> Nuevo artista</button>}
      </div>
      {editing && (
        <ArtistForm key={editing === 'nuevo' ? 'nuevo' : editing.id} mode="leader" artist={editing === 'nuevo' ? null : editing}
          onSaved={saved} onCancel={() => setEditing(null)} />
      )}
      {actionError && <p className={ALERT} role="alert">{actionError}</p>}
      {state.loading && <p className="m-0 py-6 text-[14px] text-muted" aria-busy="true">Cargando...</p>}
      {state.error && <p className={ALERT} role="alert">{state.error}</p>}
      {!state.loading && !state.error && (state.artists.length ? (
        <ul className="mt-4 mb-0 list-none p-0">
          {state.artists.map((artist) => (
            <ArtistItem key={artist.id} artist={artist} busy={busyId === artist.id} onEdit={open} onResubmit={resubmit} />
          ))}
        </ul>
      ) : (
        <div className="mt-6"><EmptyNote icon="music" title="Aún no has cargado artistas" text="Agrega el primero: queda en revisión hasta que el equipo lo apruebe." /></div>
      ))}
    </section>
  );
}
