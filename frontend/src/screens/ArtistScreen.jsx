import { useState, useEffect } from 'react';
import { fetchArtistProfile } from '../services/artistApi.js';
import ArtistHeader from '../components/artist/ArtistHeader.jsx';
import ArtistMedia from '../components/artist/ArtistMedia.jsx';
import ArtistInfo from '../components/artist/ArtistInfo.jsx';
import { AX_STATE, AX_BTN, AX_BTN_PRIMARY } from '../components/artist/axStyles.js';

function getSlug() {
  const hash = window.location.hash.replace('#', '');
  const parts = hash.split('/');
  return parts[1] || 'og-mauro';
}

export default function ArtistScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const slug = getSlug();
    setLoading(true);
    setError('');
    fetchArtistProfile(slug)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

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
      <ArtistHeader
        artist={artist}
        featuredTrack={featured_track}
        socialLinks={social_links}
      />

      <ArtistMedia tracks={tracks} media={media} />

      <ArtistInfo
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
