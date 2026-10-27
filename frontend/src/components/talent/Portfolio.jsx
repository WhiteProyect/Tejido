import { useEffect, useRef, useState } from 'react';
import Icon from '../Icon.jsx';
import Lightbox from '../Lightbox.jsx';
import { cdnImage } from '../../utils/cloudinaryUrl.js';
import { categoryTint } from '../../utils/talent.js';
import { videoEmbed, videoHost } from '../../utils/videoEmbed.js';

// "Portafolio": fila de piezas con la primera mas ancha (en movil, la primera ocupa las dos columnas). Las fotos abren el Lightbox; los videos
// se reproducen AQUI MISMO, en su tarjeta: al pulsar play la miniatura se cambia por el
// reproductor (YouTube sin cookies, Vimeo o un archivo .mp4/.webm), con autoplay y el foco en el
// reproductor. Solo suena uno a la vez y se detiene si la tarjeta sale de la pantalla. Un host
// que no se reconoce queda como enlace externo, con aviso.

export function VideoTile({ item, category, playing, onPlay, onStop }) {
  const box = useRef(null);
  const player = useRef(null);
  const embed = videoEmbed(item.url);
  const label = item.title || 'video';

  useEffect(() => {
    if (playing) player.current?.focus();
  }, [playing]);

  // Al salir de la pantalla, se detiene (se desmonta el reproductor).
  useEffect(() => {
    if (!playing || !box.current || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) onStop(); }, { threshold: 0 });
    observer.observe(box.current);
    return () => observer.disconnect();
  }, [playing, onStop]);

  if (playing && embed) {
    return (
      <div ref={box} className="absolute inset-0 bg-black">
        {embed.kind === 'iframe' ? (
          <iframe ref={player} src={embed.src} title={`Video: ${label}`} className="size-full border-0"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
        ) : (
          <video ref={player} src={embed.src} controls autoPlay playsInline className="size-full bg-black object-contain" aria-label={`Video: ${label}`} />
        )}
      </div>
    );
  }

  return (
    <div ref={box} className="absolute inset-0" style={{ backgroundColor: categoryTint(category, 30) }}>
      {item.thumbnail_url && <img src={cdnImage(item.thumbnail_url, { width: 960 })} alt="" loading="lazy" className="size-full object-cover" />}
      {embed ? (
        <button type="button" onClick={onPlay} aria-label={`Reproducir ${label}`}
          className="group absolute inset-0 flex cursor-pointer items-center justify-center border-0 bg-[rgba(12,36,30,.12)] p-0 focus-visible:outline-3 focus-visible:-outline-offset-4 focus-visible:outline-white">
          <span className="inline-flex size-14 items-center justify-center rounded-full border-2 border-[rgba(255,255,255,.85)] bg-[rgba(12,36,30,.45)] text-white transition-transform duration-200 motion-safe:group-hover:scale-105">
            <Icon name="play" className="ml-1 size-6 fill-current" />
          </span>
        </button>
      ) : (
        <div className="absolute inset-x-3 bottom-3 rounded-[14px] bg-[#fff9ec] p-3 text-[13px] leading-[1.45] text-ink">
          <p className="m-0">Este video está en {videoHost(item.url)} y no se puede ver aquí.</p>
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-bold text-ink underline underline-offset-4">
            Abrir el video en otra pestaña
          </a>
        </div>
      )}
    </div>
  );
}

export default function Portfolio({ media, category, name }) {
  const [playing, setPlaying] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const photos = media
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.type === 'image')
    .map(({ item, index }) => ({ index, url: item.url, alt: item.title || `Foto de ${name}`, caption: item.caption || item.title || '' }));

  function openPhoto(index) {
    setPlaying(null);
    setLightbox(photos.findIndex((photo) => photo.index === index));
  }

  return (
    <>
      <ul className="m-0 grid list-none grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))] items-start gap-3.5 p-0 max768:grid-cols-[repeat(2,minmax(0,1fr))]">
        {media.map((item, index) => {
          const big = index === 0;
          return (
            <li key={index} className={`min-w-0 ${big ? 'max768:[grid-column:span_2]' : ''}`}>
              <figure className="m-0">
                <div className={`relative overflow-hidden rounded-[10px] ${big ? 'h-[210px] max768:h-[220px]' : 'h-[160px] max768:h-[130px]'}`} style={{ backgroundColor: categoryTint(category, 30) }}>
                  {item.type === 'video' ? (
                    <VideoTile item={item} category={category} playing={playing === index}
                      onPlay={() => setPlaying(index)} onStop={() => setPlaying((current) => (current === index ? null : current))} />
                  ) : (
                    <button type="button" onClick={() => openPhoto(index)} aria-label={`Ampliar foto${item.title ? `: ${item.title}` : ''}`}
                      className="group absolute inset-0 block cursor-zoom-in border-0 bg-transparent p-0 focus-visible:outline-3 focus-visible:-outline-offset-4 focus-visible:outline-white">
                      <img src={cdnImage(item.url, { width: big ? 1600 : 960 })} alt={item.title || `Foto de ${name}`} loading="lazy"
                        className="size-full object-cover transition-[scale] duration-500 motion-safe:group-hover:scale-[1.03]" />
                    </button>
                  )}
                </div>
                {(item.title || item.caption) && (
                  <figcaption className="pt-2">
                    {item.title && <p className="m-0 text-[14px] font-semibold leading-[1.3] text-ink">{item.title}</p>}
                    {item.caption && <p className="mt-0.5 mb-0 text-[13px] leading-[1.45] text-[#53645c]">{item.caption}</p>}
                  </figcaption>
                )}
              </figure>
            </li>
          );
        })}
      </ul>
      {lightbox !== null && lightbox >= 0 && (
        <Lightbox photos={photos} index={lightbox} onClose={() => setLightbox(null)}
          onMove={(step) => setLightbox((current) => (current + step + photos.length) % photos.length)} />
      )}
    </>
  );
}
