import { useState, useEffect } from 'react';
import { fetchMediaKit } from '../services/artistApi.js';

function getSlug() {
  const hash = window.location.hash.replace('#', '');
  const parts = hash.split('/');
  return parts[1] || 'og-mauro';
}

export default function ArtistMediaKit() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const slug = getSlug();
    fetchMediaKit(slug)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // `ax-artist-page` en el contenedor (no en el body) da al Media Kit el tema oscuro de
  // artista: fondo, texto y los tokens ax-* (sin el, --ax-accent no existia y los
  // acentos salian blancos en vez de dorados). Por eso el contenedor no lleva bg/color/font.
  if (loading) {
    return (
      <div className="ax-artist-page min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-[rgba(255,255,255,0.5)]">Cargando media kit...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="ax-artist-page min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-[rgba(255,255,255,0.5)]">Artista no encontrado</p>
        <a href="/#moneystack" className="text-ax-accent!">Volver</a>
      </div>
    );
  }

  const { artist, tracks, featured_track, social_links, upcoming_events } = data;

  return (
    <div className="ax-artist-page min-h-screen">
      <header className="border-b border-b-[rgba(255,255,255,0.08)] py-5 px-[7vw]">
        <div className="flex items-center gap-3">
          <span className="text-[14px] font-extrabold tracking-[0.16em] text-white">TEJIDO</span>
          <span className="text-[rgba(255,255,255,0.2)]">/</span>
          <span className="text-[14px] text-[rgba(255,255,255,0.4)]">Media Kit</span>
        </div>
      </header>

      <main className="max-w-[800px] mx-auto py-15 px-[7vw]">
        <div className="flex gap-10 items-center mb-15 max600:flex-col max600:text-center">
          {artist.image && (
            <div className="w-40 h-40 rounded-[20px] overflow-hidden shrink-0 max600:w-30 max600:h-30">
              <img src={artist.image} alt={artist.stage_name} className="w-full h-full object-cover" />
            </div>
          )}
          <div>
            <span className="text-[11px] font-bold tracking-[0.15em] uppercase text-ax-accent block mb-2">Media Kit</span>
            <h1 className="text-[length:clamp(32px,5vw,52px)]! font-extrabold tracking-[-0.03em]! mb-1!">{artist.stage_name}</h1>
            {artist.real_name && <p className="text-[16px] text-[rgba(255,255,255,0.5)] mt-0 mx-0 mb-4">{artist.real_name}</p>}
            <div className="flex gap-3 flex-wrap max600:justify-center">
              {artist.genre && <span className={MK_META}>{artist.genre}</span>}
              {artist.city && <span className={MK_META}>{artist.city}</span>}
              {artist.region && <span className={MK_META}>{artist.region}</span>}
            </div>
          </div>
        </div>

        <section className={MK_BLOCK}>
          <h2 className={MK_TITLE}>Biografia</h2>
          <p className="text-[16px] leading-[1.8] text-[rgba(255,255,255,0.7)] m-0">{artist.bio}</p>
        </section>

        {tracks && tracks.length > 0 && (
          <section className={MK_BLOCK}>
            <h2 className={MK_TITLE}>Discografia destacada</h2>
            <div className="flex flex-col gap-2">
              {tracks.slice(0, 3).map((track) => (
                <div key={track.id} className="flex items-center justify-between py-3.5 px-4.5 bg-ax-card border border-[rgba(255,255,255,0.06)] rounded-[12px] max600:flex-col max600:items-start max600:gap-2.5">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[15px] font-bold text-white">{track.title}</span>
                    <span className="text-[12px] text-[rgba(255,255,255,0.4)]">
                      {track.album} · {track.release_date?.split('-')[0]}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {track.spotify_url && (
                      <a href={track.spotify_url} target="_blank" rel="noopener noreferrer" className={`${MK_LINK} bg-ax-green`}>
                        Spotify
                      </a>
                    )}
                    {track.youtube_url && (
                      <a href={track.youtube_url} target="_blank" rel="noopener noreferrer" className={`${MK_LINK} bg-ax-red`}>
                        YouTube
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {social_links && social_links.length > 0 && (
          <section className={MK_BLOCK}>
            <h2 className={MK_TITLE}>Redes sociales</h2>
            <div className="flex flex-wrap gap-2.5">
              {social_links.map((link) => (
                <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 py-2.5 px-4.5 bg-ax-card border border-ax-border rounded-ax-sm transition-all duration-200 ease-[ease] hover:bg-ax-accent-dim hover:border-ax-accent-border">
                  <span className="text-[12px] font-bold uppercase text-ax-accent">{link.platform}</span>
                  <span className="text-[13px] text-ax-dim">{link.username || link.url}</span>
                </a>
              ))}
            </div>
          </section>
        )}

        {upcoming_events && upcoming_events.length > 0 && (
          <section className={MK_BLOCK}>
            <h2 className={MK_TITLE}>Eventos destacados</h2>
            <div className="flex flex-col gap-2">
              {upcoming_events.map((event) => (
                <div key={event.id} className="flex items-center gap-4 py-3.5 px-4.5 bg-ax-card rounded-ax-sm">
                  <span className="text-[12px] font-bold text-ax-accent uppercase min-w-[50px]">
                    {event.start_date && new Date(event.start_date).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })}
                  </span>
                  <div>
                    <span className="text-[14px] font-bold text-white block">{event.title}</span>
                    <span className="text-[12px] text-[rgba(255,255,255,0.4)] block">{event.venue || event.location}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mb-12 pb-12 text-center">
          <h2 className={MK_TITLE}>Contacto</h2>
          <p className="text-[15px] text-[rgba(255,255,255,0.5)] mt-0 mx-0 mb-4">
            Para presentaciones, colaboraciones y medios:
          </p>
          <a href="mailto:contacto@tejido.co" className="text-[18px] font-bold text-ax-accent! hover:underline!">
            contacto@tejido.co
          </a>
        </section>
      </main>

      {/* La regla global `footer {...}` de main.css lo volvia la pildora verde del sitio
          (texto descentrado y franja crema debajo): los `!` la anulan. */}
      <footer className="block! static! overflow-visible! m-0! rounded-none! bg-transparent! py-7.5! px-[7vw]! border-t border-t-[rgba(255,255,255,0.06)] text-center text-[12px] text-[rgba(255,255,255,0.25)]!">
        <span>Generado desde TEJIDO — {new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}

// Clases repetidas del Media Kit. Los h2 conservan su etiqueta: la regla global
// `h1, h2` fija font-size, margin y letter-spacing, de ahi los `!`.
const MK_BLOCK = 'mb-12 pb-12 border-b border-b-[rgba(255,255,255,0.06)]';
const MK_TITLE = 'text-[14px]! font-bold tracking-[0.1em]! uppercase text-ax-accent mb-5!';
const MK_META = 'text-[12px] text-[rgba(255,255,255,0.4)] border border-[rgba(255,255,255,0.1)] py-1 px-3 rounded-[999px]';
const MK_LINK = 'text-[11px] font-bold py-[5px] px-3 rounded-[999px] transition-[transform] duration-200 ease-[ease] hover:[transform:scale(1.05)]';
