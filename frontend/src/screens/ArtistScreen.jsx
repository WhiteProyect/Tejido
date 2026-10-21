import { useState, useEffect } from 'react';
import { fetchArtistProfile } from '../services/artistApi.js';
import ArtistHeader from '../components/artist/ArtistHeader.jsx';
import ArtistMedia from '../components/artist/ArtistMedia.jsx';
import ArtistInfo from '../components/artist/ArtistInfo.jsx';
import { AX_STATE, AX_BTN, AX_BTN_PRIMARY } from '../components/artist/axStyles.js';

// Barra solo para admins sobre el perfil publico, hacia su editor. Enlaces absolutos a la raiz: esta
// pagina suele abrirse por path (/artistas/<slug>) y un enlace que solo cambia el hash no navegaria.
const ADMIN_LINK = 'rounded-ax-sm border border-ax-border px-3.5 py-1.5 text-[13px]! font-semibold! text-ax-text! no-underline transition-colors duration-200 hover:border-ax-accent-border hover:text-ax-accent! focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-accent';

function AdminBar({ artist }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-b-ax-border bg-ax-card px-[7vw] py-2.5" role="region" aria-label="Vista de administrador">
      <span className="text-[11px] font-bold tracking-[0.12em] text-ax-accent uppercase">Vista de administrador</span>
      <div className="flex flex-wrap gap-2">
        <a href={`/#admin-dashboard/artistas/${artist.id}`} className={ADMIN_LINK}>Editar perfil</a>
        <a href="/#admin-dashboard/artistas" className={ADMIN_LINK}>Volver al panel</a>
      </div>
    </div>
  );
}

export default function ArtistScreen({ slug, user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(slug));
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    setError('');
    if (!slug) {
      setLoading(false);
      return;
    }
    // Si el slug cambia antes de que llegue la respuesta, la vieja no pisa al artista nuevo.
    let active = true;
    setLoading(true);
    fetchArtistProfile(slug)
      .then((result) => { if (active) setData(result); })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);

  useEffect(() => {
    document.body.classList.add('ax-artist-page');
    return () => document.body.classList.remove('ax-artist-page');
  }, []);

  if (loading) {
    return (
      <div className={AX_STATE}>
        <div className="size-10 animate-[axSpin_0.8s_linear_infinite] rounded-[50%] border-[3px] border-ax-border border-t-ax-accent" />
        <p>Cargando artista...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={AX_STATE}>
        <h2 className="text-[28px]!">Artista no encontrado</h2>
        <p className="mt-0 mb-6 text-ax-dim">{error || 'No se pudo cargar el perfil'}</p>
        <a href="/#moneystack" className={`${AX_BTN} ${AX_BTN_PRIMARY}`}>Volver a Moneystack</a>
      </div>
    );
  }

  const { artist, tracks, featured_track, timeline, media, social_links, connections, upcoming_events } = data;

  return (
    <div className="ax-artist">
      {user?.role === 'ADMIN' && <AdminBar artist={artist} />}
      <ArtistHeader
        artist={artist}
        featuredTrack={featured_track}
        socialLinks={social_links}
      />

      <ArtistMedia tracks={tracks} media={media} />

      <ArtistInfo
        artistName={artist.stage_name}
        timeline={timeline}
        connections={connections}
        events={upcoming_events}
      />

      <footer className="py-10 px-[7vw] border-t border-t-ax-border">
        <div className="flex justify-between items-center">
          <a href="/#moneystack" className="text-[14px] text-ax-dim no-underline transition-[color] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] hover:text-ax-accent">← Moneystack</a>
          <a href="#inicio" className="text-[16px] font-extrabold tracking-[0.16em] text-ax-text no-underline">TEJIDO</a>
        </div>
      </footer>
    </div>
  );
}
