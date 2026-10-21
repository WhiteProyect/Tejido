import { useCallback, useEffect, useState } from 'react';
import Icon from '../../Icon.jsx';
import PillTabs from '../PillTabs.jsx';
import { BTN_GHOST, BTN_INK_SM, PANEL } from '../../uiStyles.js';
import { useToast } from '../../../context/ToastContext.jsx';
import { adminArtistApi, fetchAdminArtist } from '../../../services/artistApi.js';
import { ALERT, ArtistAvatar, ErrorAlert, TAG, useAction } from './common.jsx';
import { confirmDiscard } from './unsavedChanges.js';
import ConexionesTab from './ConexionesTab.jsx';
import DatosTab from './DatosTab.jsx';
import GaleriaTab from './GaleriaTab.jsx';
import MetricasTab from './MetricasTab.jsx';
import MusicaTab from './MusicaTab.jsx';
import RedesTab from './RedesTab.jsx';
import TrayectoriaTab from './TrayectoriaTab.jsx';

// Editor de un artista (#admin-dashboard/artistas/<id>[/<pestana>]). Carga el detalle UNA vez
// (GET /api/admin/artists/{id}: tambien archivado y con borradores) y se lo pasa a las pestanas;
// tras cada cambio lo recarga conservando lo que se ve (sin parpadeo). La pestana va en la URL con
// replaceState, como las del dashboard. Archivado = solo lectura, con aviso y "Restaurar".

const TABS = [
  ['datos', 'Datos', 'pen'],
  ['musica', 'Música', 'music'],
  ['galeria', 'Galería', 'palette'],
  ['trayectoria', 'Trayectoria', 'sprout'],
  ['redes', 'Redes', 'share'],
  ['conexiones', 'Conexiones', 'confluence'],
  ['metricas', 'Métricas', 'columns'],
];
const TAB_IDS = TABS.map(([id]) => id);
const tabFrom = (value) => (TAB_IDS.includes(value) ? value : 'datos');
const COUNTS = { musica: 'tracks', galeria: 'media', trayectoria: 'timeline', redes: 'social_links', conexiones: 'connections', metricas: 'metrics' };

function BackLink() {
  return (
    <a
      className="inline-flex items-center gap-2 text-[14px] font-semibold text-ink no-underline hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      href="#admin-dashboard/artistas"
      onClick={(event) => { if (!confirmDiscard()) event.preventDefault(); }}
    >
      <Icon name="arrow-left" className="size-4" /> Volver a Artistas
    </a>
  );
}

export default function ArtistEditor({ artistId, tab: tabFromUrl }) {
  const { showToast } = useToast();
  const [tab, setTab] = useState(() => tabFrom(tabFromUrl));
  const [state, setState] = useState({ loading: true, error: '', detail: null });
  const restore = useAction();

  // Un enlace a otra pestana de este mismo artista (hashchange) mueve la pestana.
  useEffect(() => { setTab(tabFrom(tabFromUrl)); }, [tabFromUrl]);

  const reload = useCallback(async () => {
    try {
      const detail = await fetchAdminArtist(artistId);
      setState({ loading: false, error: '', detail });
    } catch (loadError) {
      setState((current) => ({ ...current, loading: false, error: loadError.message }));
    }
  }, [artistId]);

  useEffect(() => { reload(); }, [reload]);

  function changeTab(id) {
    if (id === tab || !confirmDiscard()) return;
    setTab(id);
    window.history.replaceState(window.history.state, '', `#admin-dashboard/artistas/${artistId}/${id}`);
  }

  async function handleRestore() {
    const ok = await restore.run(async () => {
      await adminArtistApi.restore(artistId);
      await reload();
    });
    if (ok) showToast({ tone: 'menta', eyebrow: 'De vuelta en el sello', title: 'Artista restaurado', text: 'Vuelve a aparecer en Moneystack y ya puedes editarlo.' });
  }

  const { detail } = state;
  if (!detail) {
    return (
      <section className={PANEL} aria-busy={state.loading}>
        <BackLink />
        {state.loading
          ? <p className="m-0 pt-6 text-[14px] text-muted">Cargando el artista...</p>
          : <p className={`${ALERT} mt-6`} role="alert">{state.error}</p>}
      </section>
    );
  }

  const { artist } = detail;
  const readOnly = !artist.active;
  const tabProps = { artist, readOnly, onChanged: reload };

  return (
    <section className={PANEL} aria-labelledby="artist-editor-title">
      <BackLink />
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <ArtistAvatar artist={artist} size="size-16" text="text-[26px]" />
          <div className="min-w-0">
            <h2 id="artist-editor-title" className="m-0 flex flex-wrap items-center gap-2 font-sans text-[28px] font-extrabold leading-[1.1] tracking-[-0.03em] text-ink">
              {artist.stage_name}
              {artist.featured && <span className={TAG.gold}>Destacado</span>}
              {readOnly && <span className={TAG.grey}>Archivado</span>}
            </h2>
            <p className="mt-1 mb-0 font-mono text-[13px] text-[#53645c] [overflow-wrap:anywhere]">/artistas/{artist.slug}</p>
          </div>
        </div>
        {!readOnly && (
          <a className={BTN_GHOST} href={`/artistas/${artist.slug}`} target="_blank" rel="noopener noreferrer">
            Ver perfil público <Icon name="share" className="size-3.5" /><span className="sr-only"> (se abre en otra pestaña)</span>
          </a>
        )}
      </div>

      {readOnly && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[16px] bg-[rgba(102,116,111,0.1)] py-4 px-5" role="status">
          <p className="m-0 text-[15px] leading-[1.5] text-ink">
            <strong>Este artista está archivado.</strong> No aparece en la web pública y aquí se ve en solo lectura.
          </p>
          <button type="button" className={BTN_INK_SM} disabled={restore.busy} onClick={handleRestore}>
            {restore.busy ? 'Restaurando...' : 'Restaurar'}
          </button>
          <ErrorAlert className="w-full">{restore.error}</ErrorAlert>
        </div>
      )}

      <div className="mt-6">
        <PillTabs
          idPrefix="artist-editor"
          size="compact"
          label={`Secciones de ${artist.stage_name}`}
          active={tab}
          onChange={changeTab}
          tabs={TABS.map(([id, label, icon]) => ({
            id, label, icon,
            ...(COUNTS[id] ? { badge: detail[COUNTS[id]].length, badgeLabel: 'elementos', badgeTone: 'neutral' } : {}),
          }))}
        />
      </div>

      <div id={`artist-editor-panel-${tab}`} role="tabpanel" aria-labelledby={`artist-editor-tab-${tab}`} className="mt-6">
        {tab === 'datos' && <DatosTab {...tabProps} />}
        {tab === 'musica' && <MusicaTab {...tabProps} tracks={detail.tracks} />}
        {tab === 'galeria' && <GaleriaTab {...tabProps} media={detail.media} />}
        {tab === 'trayectoria' && <TrayectoriaTab {...tabProps} timeline={detail.timeline} />}
        {tab === 'redes' && <RedesTab {...tabProps} socialLinks={detail.social_links} />}
        {tab === 'conexiones' && <ConexionesTab {...tabProps} connections={detail.connections} />}
        {tab === 'metricas' && <MetricasTab {...tabProps} metrics={detail.metrics} />}
      </div>
    </section>
  );
}
