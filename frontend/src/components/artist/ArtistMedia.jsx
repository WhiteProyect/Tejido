import { useState } from 'react';
import { AX_SECTION, AX_SECTION_TITLE } from './axStyles.js';

// ── Discografia ──────────────────────────────────────────────────────────────
// El fondo y el color del borde NO van en la base: los tres estados (normal, destacado, abierto)
// los declaran en exclusiva via ternario, porque dos utilidades de la misma propiedad compiten
// por orden en la hoja, no por el orden del className. El :hover gana a los tres (variante hover),
// igual que en el legado, donde .ax-release:hover tenia mas especificidad que --featured/--open.
const RELEASE = 'flex cursor-pointer items-center gap-5 rounded-ax border px-5 py-4 transition-all duration-300 ease-in-out hover:border-ax-border-hover hover:bg-ax-card-hover max768:flex-wrap';
const RELEASE_IDLE = 'border-ax-border bg-ax-card';
const RELEASE_FEATURED = 'border-ax-accent-border bg-ax-accent-dim';
const RELEASE_OPEN = 'border-ax-accent-border bg-ax-card-hover';
// h3 global (main.css) fija font-size y margin -> "!". El letter-spacing global se hereda a proposito.
const RELEASE_TITLE = 'mb-1! text-[16px]! font-bold text-ax-text';
// El peso y el color tampoco van en la base: --disabled los cambia (font-normal) y competirian por orden.
const PLATFORM_LINK = 'rounded-[999px] px-3.5 py-1.5 text-[12px] transition-all duration-200 ease-[ease]';
const PLATFORM_SPOTIFY = 'bg-ax-green font-bold text-white! hover:scale-105 hover:bg-[#1ed760]';
const PLATFORM_YOUTUBE = 'bg-ax-red font-bold text-white! hover:scale-105 hover:bg-[#ff3333]';
const PLATFORM_APPLE = 'bg-ax-apple font-bold text-white! hover:scale-105 hover:bg-[#ff4e55]';
const PLATFORM_DISABLED = 'font-normal text-ax-muted italic';

// ── Galeria ──────────────────────────────────────────────────────────────────
// button lleva "font: inherit" global -> "!" en tamaño y peso (el line-height heredado se respeta).
const GAL_FILTER = 'cursor-pointer rounded-[999px] border px-4.5 py-2 text-[13px]! font-semibold! transition-all duration-300 ease-in-out hover:border-ax-border-hover hover:text-ax-dim';
const GAL_FILTER_IDLE = 'border-ax-border bg-transparent text-ax-muted';
const GAL_FILTER_ACTIVE = 'border-ax-accent bg-ax-accent text-[#0a0a0a]';
// group: el legado usa .ax-gallery-item:hover para animar la imagen y el boton de play.
const GAL_ITEM = 'group relative aspect-[4/3] cursor-pointer overflow-hidden rounded-ax-sm transition-all duration-300 ease-in-out hover:shadow-[0_12px_40px_rgba(0,0,0,0.5)]';
// Valores arbitrarios (y no col-span-2) para copiar el legado exacto: "span 2" deja el final en auto.
const GAL_ITEM_FEATURED = '[grid-column:span_2] [grid-row:span_2] max768:[grid-row:span_1] max480:[grid-column:span_1]';
const GAL_CAPTION = 'absolute right-0 bottom-0 left-0 bg-[linear-gradient(transparent,rgba(0,0,0,0.8))] px-4 pt-10 pb-3 text-[13px] font-semibold text-white';

// ── Videos ───────────────────────────────────────────────────────────────────
const VIDEO_CARD = 'overflow-hidden rounded-ax border border-ax-border bg-ax-card transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.4)]';


function ArtistDiscography({ tracks }) {
  const [selected, setSelected] = useState(null);

  if (!tracks || tracks.length === 0) {
    return (
      <section className={`ax-discography ${AX_SECTION}`}>
        <h2 className={AX_SECTION_TITLE}>Discografia</h2>
        <p className="text-[16px] text-ax-muted italic">Proximamente habra musica aqui</p>
      </section>
    );
  }

  // "ax-discography" queda como marcador (sin estilos): ArtistHeader hace querySelector('.ax-discography')
  return (
    <section className={`ax-discography ${AX_SECTION}`}>
      <h2 className={AX_SECTION_TITLE}>Discografia</h2>

      <div className="flex flex-col gap-2">
        {tracks.map((track) => (
          <div
            key={track.id}
            className={`${RELEASE} ${selected === track.id ? RELEASE_OPEN : track.featured ? RELEASE_FEATURED : RELEASE_IDLE}`}
            onClick={() => setSelected(selected === track.id ? null : track.id)}
          >
            <div className="relative size-16 shrink-0 overflow-hidden rounded-[12px] max480:size-13">
              {track.cover_image ? (
                <img className="size-full object-cover" src={track.cover_image} alt={track.title} loading="lazy" />
              ) : (
                <div className="flex size-full items-center justify-center bg-[linear-gradient(135deg,#1a1a2e,#2a1a3e)] text-ax-muted">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M9 18V5l12-2v13"/>
                    <circle cx="6" cy="18" r="3"/>
                    <circle cx="18" cy="16" r="3"/>
                  </svg>
                </div>
              )}
              {/* tracks.featured es boolean en la BD: comparar con === 1 dejaba el badge sin mostrarse nunca.
                  Ternario (y no &&) para que un 0 no acabe pintado como texto. */}
              {track.featured ? <span className="absolute top-1 right-1 rounded-[4px] bg-ax-accent px-1.5 py-0.5 text-[8px] font-bold text-[#0a0a0a] uppercase">Destacado</span> : null}
            </div>

            <div className="min-w-0 flex-1">
              <h3 className={RELEASE_TITLE}>{track.title}</h3>
              <div className="flex gap-3 text-[13px] text-ax-muted">
                <span>{track.album}</span>
                {track.duration && <span>{track.duration}</span>}
                {track.release_date && <span>{track.release_date.split('-')[0]}</span>}
              </div>
            </div>

            <div className="flex shrink-0 gap-2 max768:w-full max768:pl-21 max480:pl-18">
              {track.spotify_url && (
                <a href={track.spotify_url} target="_blank" rel="noopener noreferrer" className={`${PLATFORM_LINK} ${PLATFORM_SPOTIFY}`} onClick={(e) => e.stopPropagation()}>
                  Spotify
                </a>
              )}
              {track.youtube_url && (
                <a href={track.youtube_url} target="_blank" rel="noopener noreferrer" className={`${PLATFORM_LINK} ${PLATFORM_YOUTUBE}`} onClick={(e) => e.stopPropagation()}>
                  YouTube
                </a>
              )}
              {track.apple_music_url && (
                <a href={track.apple_music_url} target="_blank" rel="noopener noreferrer" className={`${PLATFORM_LINK} ${PLATFORM_APPLE}`} onClick={(e) => e.stopPropagation()}>
                  Apple Music
                </a>
              )}
              {!track.spotify_url && !track.youtube_url && !track.apple_music_url && (
                <span className={`${PLATFORM_LINK} ${PLATFORM_DISABLED}`}>Proximamente</span>
              )}
            </div>

            {selected === track.id && track.description && (
              <div className="mt-3 w-full border-t border-t-ax-border pt-4">
                <p className="m-0 text-[14px] leading-[1.7] text-ax-dim">{track.description}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function ArtistGallery({ media }) {
  const [lightbox, setLightbox] = useState(null);
  const [filter, setFilter] = useState('all');

  if (!media || media.length === 0) return null;

  const types = [...new Set(media.map((m) => m.tipo))];
  const filtered = filter === 'all' ? media : media.filter((m) => m.tipo === filter);

  return (
    <section className={AX_SECTION}>
      <h2 className={AX_SECTION_TITLE}>Galeria</h2>

      <div className="mb-8 flex flex-wrap gap-2">
        <button
          className={`${GAL_FILTER} ${filter === 'all' ? GAL_FILTER_ACTIVE : GAL_FILTER_IDLE}`}
          onClick={() => setFilter('all')}
        >
          Todo
        </button>
        {types.map((t) => (
          <button
            key={t}
            className={`${GAL_FILTER} ${filter === t ? GAL_FILTER_ACTIVE : GAL_FILTER_IDLE}`}
            onClick={() => setFilter(t)}
          >
            {t === 'image' ? 'Fotos' : t === 'video' ? 'Videos' : t === 'cover' ? 'Portadas' : 'Momentos'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3 max768:grid-cols-[repeat(2,1fr)] max480:grid-cols-[1fr]">
        {filtered.map((item) => (
          <div
            key={item.id}
            className={`${GAL_ITEM} ${item.destacado ? GAL_ITEM_FEATURED : ''} ax-gallery-item--${item.tipo}`}
            onClick={() => item.tipo === 'image' ? setLightbox(item) : null}
          >
            {item.tipo === 'video' ? (
              <div className="flex size-full flex-col items-center justify-center gap-3 bg-[#111]">
                <div className="flex size-15 items-center justify-center rounded-[50%] bg-[rgba(255,255,255,0.1)] transition-all duration-300 ease-in-out group-hover:scale-110 group-hover:bg-ax-accent">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="white">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </div>
                {item.titulo && <span className={GAL_CAPTION}>{item.titulo}</span>}
              </div>
            ) : (
              <>
                <img className="size-full object-cover transition-[transform] duration-500 ease-[ease] group-hover:[transform:scale(1.05)]" src={item.url} alt={item.titulo || ''} loading="lazy" />
                {item.titulo && <span className={GAL_CAPTION}>{item.titulo}</span>}
              </>
            )}
          </div>
        ))}
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-[9999] flex animate-[axFadeIn_0.2s_ease] items-center justify-center bg-[rgba(0,0,0,0.92)] p-10" onClick={() => setLightbox(null)}>
          <div className="relative max-h-[85vh] max-w-[900px]" onClick={(e) => e.stopPropagation()}>
            <button className="absolute top-[-40px] right-0 cursor-pointer border-none bg-transparent p-2 text-white" onClick={() => setLightbox(null)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
            <img className="max-h-[80vh] max-w-full rounded-ax object-contain" src={lightbox.url} alt={lightbox.titulo || ''} />
            {lightbox.titulo && <p className="mt-4 mb-1 text-[16px] font-semibold text-white">{lightbox.titulo}</p>}
            {lightbox.descripcion && <p className="m-0 text-[14px] text-ax-dim">{lightbox.descripcion}</p>}
          </div>
        </div>
      )}
    </section>
  );
}

function ArtistVideos({ media }) {
  if (!media || media.length === 0) return null;

  const videos = media.filter((m) => m.tipo === 'video');
  if (videos.length === 0) return null;

  function getYoutubeId(url) {
    if (!url) return null;
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }

  return (
    <section className={AX_SECTION}>
      <h2 className={AX_SECTION_TITLE}>Videos</h2>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-6 max768:grid-cols-[1fr]">
        {videos.map((video) => {
          const youtubeId = getYoutubeId(video.url);
          return (
            <div key={video.id} className={VIDEO_CARD}>
              <div className="relative bg-black pb-[56.25%]">
                {youtubeId ? (
                  <iframe
                    className="absolute inset-0 size-full"
                    src={`https://www.youtube.com/embed/${youtubeId}`}
                    title={video.titulo || 'Video'}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                  />
                ) : (
                  <a href={video.url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#111] text-[14px] text-ax-dim! hover:text-ax-accent!">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="white">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                    <span>Ver video</span>
                  </a>
                )}
              </div>
              {video.titulo && <h3 className="mt-4! mr-5! mb-1! ml-5! text-[16px]! font-bold text-ax-text">{video.titulo}</h3>}
              {video.descripcion && <p className="mt-0 mr-5 mb-5 ml-5 text-[13px] leading-[1.5] text-ax-dim">{video.descripcion}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function ArtistMedia({ tracks, media }) {
  const hasMedia = media && media.length > 0;
  const videos = media?.filter((m) => m.tipo === 'video') || [];
  const hasVideos = videos.length > 0;

  return (
    <>
      <div id="ax-discography">
        <ArtistDiscography tracks={tracks} />
      </div>

      {hasMedia && (
        <div id="ax-gallery">
          <ArtistGallery media={media} />
        </div>
      )}

      {hasVideos && (
        <div id="ax-videos">
          <ArtistVideos media={media} />
        </div>
      )}
    </>
  );
}
