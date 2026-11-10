import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import Icon from '../components/Icon.jsx';
import { cdnImage, cdnSrcSet } from '../utils/cloudinaryUrl.js';
import { NOTICE_TONES } from '../components/uiStyles.js';
import { closingNotice, eventNotice, formatDateRange, formatDateShort } from '../utils/dateUtils.js';

// Carrusel del inicio ("Carrusel Multitema" de la diseñadora). GET /api/home/carousel trae las
// diapositivas ya intercaladas y con sus textos (services/home_carousel.py): contenido, artista,
// contenido... Tres variantes: la del artista (fondo casi negro, la carta de siempre) y, alternando
// entre el contenido, el tema A "Bosque y Raiz" (tinta) y el B "Ribera Editorial" (papel con grabado).
// Todas las diapositivas se apilan en la misma celda de un grid: la seccion toma la altura de la mas
// alta y nada salta al rotar. La capsula de controles va debajo, fuera del contenedor.
// Avance automatico (WCAG 2.2.2, sin boton de pausa): cada AUTOPLAY_MS, en pausa con hover, foco,
// toque o la pestaña oculta; no arranca con movimiento reducido; se apaga para esta visita con
// cualquier interaccion manual (flechas, puntos, teclado o gesto) y al completar una vuelta entera.
const AUTOPLAY_MS = 7000;
const SWIPE_MIN_PX = 50;

const FOCUS_DARK = 'focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[#fdfbf7]';
const FOCUS_LIGHT = 'focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-ink';
// #b8502b en vez del #c85a32 del diseño: con texto blanco de 11 px el original da 4,2:1 (no pasa AA).
const BADGE = 'inline-block rounded-full bg-[#b8502b] px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white mb-5';
const SLIDE_BOX = 'relative h-full flex flex-col justify-center overflow-hidden py-[60px] px-[8vw] max1024:py-10 max1024:px-[6vw] max600:py-8 max600:px-[clamp(20px,6vw,24px)]';
const SLIDE_GRID = 'relative grid grid-cols-[minmax(0,1fr)_minmax(0,440px)] gap-20 items-center max1024:grid-cols-[minmax(0,1fr)] max1024:gap-10';
const PHOTO_COL = 'relative w-full max1024:[order:-1] max1024:max-w-[440px] max1024:mx-auto';
const PHOTO = 'relative z-1 block w-full aspect-[4/5] object-cover';
const TITLE = 'font-sans leading-[1.02] text-[length:clamp(38px,4.6vw,64px)] font-bold tracking-[-0.04em] mt-0 mx-0 mb-6 [overflow-wrap:anywhere]';

// Carta del artista: mismo contenido de siempre, en colores planos.
const PLAY_BTN = `w-12 h-12 bg-gold border-none rounded-[50%] cursor-pointer flex items-center justify-center transition-all duration-300 ease-[ease] shrink-0 hover:[transform:scale(1.1)] ${FOCUS_DARK}`;
const PLAY_ICON = 'w-5 h-5 text-white ml-0.5';
const SOCIAL_LINK = `w-11 h-11 bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.15)] rounded-[12px] flex items-center justify-center transition-all duration-300 ease-[ease] hover:bg-gold hover:border-gold hover:[transform:translateY(-3px)] ${FOCUS_DARK}`;
const SOCIAL_ICON = 'w-5 h-5 text-white';
const ARTIST_TAG = 'bg-[rgba(255,255,255,0.1)] border border-[rgba(255,255,255,0.2)] rounded-[999px] text-white text-[12px] font-semibold tracking-[0.05em] py-2 px-4 uppercase';

const THEMES = {
  A: {
    box: 'bg-ink text-[#fdfbf7]',
    accent: 'text-gold',
    tagline: 'text-gold',
    summary: 'text-[rgba(253,251,247,0.85)]',
    chip: 'border border-[rgba(253,251,247,0.4)] text-[#fdfbf7]',
    firstChip: '',
    sheet: 'bg-[#f3ede0] text-ink',
    cta: `bg-gold text-ink hover:bg-[#e0b95a] ${FOCUS_DARK}`,
    // Filete dorado interior (concentrico con la tarjeta: 40 - 12 = 28; en movil 40 - 8 = 32).
    card: 'inset-3 rounded-[28px] border-[1.5px] border-[rgba(212,168,67,0.75)] max600:inset-2 max600:rounded-[32px]',
    // Marco con 8 px de aire entre el borde dorado y la foto.
    frame: 'rounded-[28px] border-[1.5px] border-gold p-2',
    photo: 'rounded-[20px]',
    caption: 'text-gold',
  },
  B: {
    box: 'bg-[#f3ede0] text-ink',
    accent: 'text-ink',
    tagline: 'text-ink',
    summary: 'text-[#3f514a]',
    chip: 'border border-ink text-ink',
    firstChip: 'bg-[rgba(117,183,155,0.25)]',
    sheet: 'bg-white text-ink',
    cta: `bg-ink text-[#fdfbf7] hover:bg-forest ${FOCUS_LIGHT}`,
    card: 'inset-0 rounded-[40px] border-[1.5px] border-ink',
    frame: 'rounded-[24px] border-[3px] border-ink overflow-hidden',
    photo: '',
    caption: 'text-ink',
  },
};

// Ultimas palabras del titulo en Arial: 1 si tiene 2-3 palabras, 2 si tiene 4-5 y 3 si
// tiene mas. Con una sola palabra no hay cursiva (nunca todo el titulo).
function splitTitle(title) {
  const words = String(title || '').trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return [words.join(' '), ''];
  const count = words.length <= 3 ? 1 : words.length <= 5 ? 2 : 3;
  return [words.slice(0, -count).join(' '), words.slice(-count).join(' ')];
}

function SlidePhoto({ src, alt, first, frame = '', photo = 'rounded-[28px]' }) {
  return (
    <div className={`relative ${frame}`}>
      <img src={cdnImage(src, { width: 960 })} srcSet={cdnSrcSet(src, [640, 960, 1600])} sizes="(max-width: 1024px) 90vw, 440px"
        alt={alt} className={`${PHOTO} ${photo}`} loading={first ? 'eager' : 'lazy'} decoding="async" />
    </div>
  );
}

function ArtistSlide({ slide, first }) {
  const { artist, featured_track: track } = slide;
  return (
    <div className={`${SLIDE_BOX} bg-[#0d0f0e] text-white`}>
      <div className={SLIDE_GRID}>
        <div className="relative z-2 min-w-0">
          <span className={BADGE}>{slide.badge}</span>
          <h2 className="font-sans leading-[.98] text-[length:clamp(48px,5.5vw,76px)] font-extrabold tracking-[-0.05em] mt-0 mx-0 mb-6 [overflow-wrap:anywhere]">
            <a href={slide.href} className={`text-white no-underline hover:underline underline-offset-8 ${FOCUS_DARK}`}>{artist.stage_name}</a>
          </h2>
          <p className="text-[rgba(255,255,255,0.8)] text-[18px] leading-[1.7] mt-0 mx-0 mb-8 max-w-[480px]">{artist.bio}</p>
          <div className="flex gap-3 flex-wrap">
            {slide.tags.map((tag) => <span key={tag} className={ARTIST_TAG}>{tag}</span>)}
          </div>

          {track && (
            <div className="my-6 mx-0">
              <div className="flex items-center gap-4 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-[16px] p-4">
                {track.spotify_url ? (
                  <a href={track.spotify_url} target="_blank" rel="noopener noreferrer" className={PLAY_BTN} aria-label="Escuchar en Spotify">
                    <Icon name="play" className={PLAY_ICON} strokeWidth={1.75} />
                  </a>
                ) : track.youtube_url ? (
                  <a href={track.youtube_url} target="_blank" rel="noopener noreferrer" className={PLAY_BTN} aria-label="Ver en YouTube">
                    <Icon name="play" className={PLAY_ICON} strokeWidth={1.75} />
                  </a>
                ) : (
                  <button className={PLAY_BTN} type="button" disabled aria-label="Escuchar (no disponible)">
                    <Icon name="play" className={PLAY_ICON} strokeWidth={1.75} />
                  </button>
                )}
                <div className="flex-1">
                  <span className="text-[14px] font-semibold mb-2 block">{track.title}</span>
                  <div className="h-1 bg-[rgba(255,255,255,0.2)] rounded-[2px] mb-1.5 overflow-hidden">
                    <div className="h-full w-[36%] bg-gold rounded-[2px]"></div>
                  </div>
                  <span className="text-[11px] text-[rgba(255,255,255,0.6)]">{track.duration}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 mb-6">
            {artist.instagram_url && (
              <a href={artist.instagram_url} target="_blank" rel="noopener noreferrer" className={SOCIAL_LINK} aria-label="Instagram">
                <Icon name="instagram" className={SOCIAL_ICON} />
              </a>
            )}
            {artist.youtube_url && (
              <a href={artist.youtube_url} target="_blank" rel="noopener noreferrer" className={SOCIAL_LINK} aria-label="YouTube">
                <Icon name="youtube" className={SOCIAL_ICON} />
              </a>
            )}
            {artist.spotify_url && (
              <a href={artist.spotify_url} target="_blank" rel="noopener noreferrer" className={SOCIAL_LINK} aria-label="Spotify">
                <Icon name="spotify" className={SOCIAL_ICON} />
              </a>
            )}
          </div>

          <div className="bg-[rgba(212,168,67,0.12)] border border-[rgba(212,168,67,0.3)] rounded-[16px] py-4 px-5">
            <span className="text-[11px] font-bold tracking-[0.1em] uppercase text-gold block mb-1.5">Sello Independiente</span>
            <a href="#moneystack" className={`text-[20px] font-extrabold block mb-1 ${FOCUS_DARK}`}>Moneystack</a>
            <span className="text-[13px] text-[rgba(255,255,255,0.7)]">Bajo Cauca Antioqueño</span>
          </div>
        </div>
        <div className={PHOTO_COL}>
          {artist.image ? (
            <SlidePhoto src={artist.image} alt={artist.stage_name} first={first} />
          ) : (
            <div className="w-full aspect-[4/5] rounded-[28px] bg-gold flex items-center justify-center">
              <span className="text-white text-[100px] font-extrabold tracking-[-0.05em]">{artist.stage_name.charAt(0)}</span>
            </div>
          )}
          <p className="mt-6 mb-0 text-center text-[rgba(255,255,255,0.6)] text-[14px] font-bold tracking-[0.2em] uppercase">Moneystack</p>
        </div>
      </div>
    </div>
  );
}

// Ficha y boton de cada tipo de diapositiva (slide.kind). Filas, en orden:
// - when: fecha o rango + aviso (falta N dias, es hoy, en curso);
// - closes: "Cierra el <fecha>" + aviso (quedan N dias, cierra hoy);
// - place: lugar y municipio (sin repetir el municipio si el lugar ya lo nombra);
// - territory: el municipio.
// Las filas sin datos no se muestran; una ficha sin filas, tampoco.
const KIND_SHEET = {
  EVENTO: { label: 'Fecha y lugar', rows: ['when', 'place'], cta: 'Ver evento' },
  OPORTUNIDAD: { label: 'Convocatoria', rows: ['closes', 'place'], cta: 'Ver convocatoria' },
  HISTORIA: { label: 'Lugar', rows: ['place'], cta: 'Leer historia' },
  INICIATIVA: { label: 'Lugar', rows: ['place', 'when'], cta: 'Conocer iniciativa' },
  LUGAR: { label: 'Lugar', rows: ['place'], cta: 'Ver lugar' },
  TALENT: { label: 'Territorio', rows: ['territory'], cta: 'Ver perfil' },
};
const CONTENT_GRID = 'relative grid grid-cols-[minmax(0,1fr)_minmax(0,440px)] gap-20 items-center max1024:grid-cols-[minmax(0,1fr)] max1024:gap-8 max600:gap-6';
const CONTENT_PHOTO_COL = 'relative w-full max1024:[order:-1] max1024:max-w-[560px] max1024:mx-auto max600:max-w-none';
const CONTENT_PHOTO = 'relative z-1 block w-full aspect-[4/5] object-cover max1024:aspect-[4/3]';

const fold = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function placeText(location, municipality) {
  if (location && municipality && !fold(location).includes(fold(municipality))) return `${location} · ${municipality}`;
  return location || municipality || '';
}

function sheetRows(slide, rows) {
  return rows.map((row) => {
    if (row === 'when') {
      const when = formatDateRange(slide.start_date, slide.end_date);
      return when && { key: row, icon: 'calendar', label: 'Fecha', text: when, notice: eventNotice(slide.start_date, slide.end_date) };
    }
    if (row === 'closes') {
      const date = formatDateShort(slide.end_date);
      return date && { key: row, icon: 'calendar', label: 'Cierre', text: `Cierra el ${date}`, notice: closingNotice(slide.end_date) };
    }
    if (row === 'place') {
      const text = placeText(slide.location, slide.municipality);
      return text && { key: row, icon: 'pin', label: 'Lugar', text };
    }
    return slide.municipality && { key: row, icon: 'pin', label: 'Municipio', text: slide.municipality };
  }).filter(Boolean);
}

function ContentPhoto({ src, first, frame, photo }) {
  return (
    <div className={`relative ${frame}`}>
      <img src={cdnImage(src, { width: 960 })} srcSet={cdnSrcSet(src, [640, 960, 1600])} sizes="(max-width: 1024px) 92vw, 440px"
        alt="" className={`${CONTENT_PHOTO} ${photo}`} loading={first ? 'eager' : 'lazy'} decoding="async" />
    </div>
  );
}

// Columna de texto: insignia, titulo, eslogan (o las ultimas palabras del titulo en cursiva si no hay),
// descripcion (4 lineas), pildoras, ficha y boton. Cada cosa solo si hay dato. Pie de la foto: el
// municipio o, si no hay, la categoria.
function ContentSlide({ slide, first, theme }) {
  const t = THEMES[theme];
  const sheet = KIND_SHEET[slide.kind] || { label: 'Lugar', rows: ['place'] };
  const rows = sheetRows(slide, sheet.rows);
  const [lead, accent] = slide.tagline ? [slide.title, ''] : splitTitle(slide.title);
  const caption = slide.municipality || slide.category_label;
  return (
    <div className={`${SLIDE_BOX} ${t.box}`}>
      {/* Decoracion: grabado botanico (B; a <= 1024 px solo la franja de arriba, alrededor de la foto, con el borde derecho)
          y el contorno de la tarjeta (filete dorado en A, borde tinta en B). No ocupa espacio. */}
      {theme === 'B' && (
        <img src="/images/carrusel/botanico.svg" alt="" aria-hidden="true" data-botanico
          className="pointer-events-none absolute inset-0 h-full w-full object-cover max1024:inset-auto max1024:top-0 max1024:right-0 max1024:h-[45%] max1024:object-[right_top]" />
      )}
      <span aria-hidden="true" data-contorno className={`pointer-events-none absolute ${t.card}`} />
      <div className={CONTENT_GRID}>
        <div className="relative z-2 min-w-0">
          {slide.badge && <span className={BADGE}>{slide.badge}</span>}
          <h2 className={`${TITLE} ${slide.tagline ? 'mb-2' : ''}`}>
            {lead}{lead && accent ? ' ' : ''}
            {accent && <em className={`font-display italic font-bold ${t.accent}`}>{accent}</em>}
          </h2>
          {slide.tagline && (
            <p className={`mt-0 mx-0 mb-6 font-display text-[length:clamp(22px,2.2vw,30px)] font-bold italic leading-[1.25] [overflow-wrap:anywhere] max600:mb-5 ${t.tagline}`} data-eslogan>
              {slide.tagline}
            </p>
          )}
          {slide.summary && (
            <p className={`text-[18px] leading-[1.7] mt-0 mx-0 mb-6 max-w-[480px] line-clamp-4 [overflow-wrap:anywhere] max600:text-[16px] max600:mb-5 ${t.summary}`}>{slide.summary}</p>
          )}
          {slide.tags?.length > 0 && (
            <div className="flex gap-2.5 flex-wrap mb-6 max600:mb-5">
              {slide.tags.slice(0, 3).map((tag, position) => (
                <span key={tag} className={`rounded-full py-1.5 px-3.5 text-[12px] font-semibold uppercase tracking-[0.06em] ${t.chip} ${position === 0 ? t.firstChip : ''}`}>{tag}</span>
              ))}
            </div>
          )}
          {rows.length > 0 && (
            <div className={`m-0 mb-8 rounded-[18px] py-4 px-5 max-w-[440px] max600:mb-6 ${t.sheet}`} data-ficha>
              <p className="m-0 mb-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#53645c]">{sheet.label}</p>
              <dl className="m-0 grid gap-2.5">
                {rows.slice(0, 2).map((row) => (
                  <div key={row.key} className="flex items-start gap-2.5" data-fila={row.key}>
                    <dt className="shrink-0"><Icon name={row.icon} className="size-5 text-ink" /><span className="sr-only">{row.label}</span></dt>
                    <dd className="m-0 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[15px] font-semibold leading-[1.4] [overflow-wrap:anywhere]">
                      <span>{row.text}</span>
                      {row.notice && <span className={`rounded-full py-0.5 px-2.5 text-[12px] font-bold ${NOTICE_TONES[row.notice.tone]}`} data-aviso={row.notice.tone}>{row.notice.text}</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          <a href={slide.href} className={`inline-flex items-center gap-2 rounded-full no-underline font-bold text-[16px] py-3.5 px-7 transition-colors duration-200 ${t.cta}`}>
            {sheet.cta || slide.cta_label} <span aria-hidden="true">→</span>
            <span className="sr-only">: {slide.title}</span>
          </a>
        </div>
        <div className={CONTENT_PHOTO_COL}>
          <ContentPhoto src={slide.image} first={first} frame={t.frame} photo={t.photo} />
          {caption && <p className={`mt-5 mb-0 text-center text-[13px] font-bold uppercase tracking-[0.2em] max1024:mt-3 ${t.caption}`}>{caption}</p>}
        </div>
      </div>
    </div>
  );
}

const DOCK_BTN = `w-9 h-9 shrink-0 rounded-full border-none bg-ink text-[#fdfbf7] flex items-center justify-center cursor-pointer transition-colors duration-200 hover:bg-forest ${FOCUS_LIGHT}`;
// isolate: los z-index de adentro (diapositiva activa, decoracion) no salen a competir con el header.
const SECTION = 'mt-[clamp(24px,3vw,40px)] mb-0 mx-[4vw] relative isolate';
const SLIDES_BOX = 'relative overflow-hidden rounded-[40px] bg-[#0d0f0e]';
// Con mas de estas diapositivas los puntitos no caben: contador "3 / 22".
const MAX_DOTS = 8;

// Variante de cada diapositiva: el artista siempre la suya; las demas alternan A, B, A... en su orden.
function variantsFor(slides) {
  let count = 0;
  return slides.map((slide) => (slide.type === 'ARTIST' && slide.artist ? 'ARTIST' : (count++ % 2 === 0 ? 'A' : 'B')));
}

export default function HomeCarousel() {
  const [slides, setSlides] = useState(null);
  const [index, setIndex] = useState(0);
  // Avance automatico apagado para esta visita (interaccion manual o una vuelta completa).
  const [stopped, setStopped] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [touching, setTouching] = useState(false);
  const [pageHidden, setPageHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  const reduceMotion = useReducedMotion();
  const pointer = useRef(null);
  const advances = useRef(0);
  const id = useId().replace(/:/g, '');

  useEffect(() => {
    let alive = true;
    fetch('/api/home/carousel')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.status))))
      .then((data) => { if (alive) setSlides(Array.isArray(data.slides) ? data.slides : []); })
      .catch(() => { if (alive) setSlides([]); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const onVisibility = () => setPageHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const count = slides?.length ?? 0;
  const go = useCallback((next) => setIndex(((next % count) + count) % count), [count]);
  // Cualquier cambio hecho por la persona (flechas, puntos, teclado o gesto) apaga el avance automatico.
  const goManual = useCallback((next) => { setStopped(true); go(next); }, [go]);
  const autoplay = count > 1 && !reduceMotion && !stopped;
  const rotating = autoplay && !hovering && !focusWithin && !touching && !pageHidden;

  useEffect(() => {
    if (!rotating) return undefined;
    const timer = window.setTimeout(() => {
      // Una vuelta entera (vuelve a la primera) y se queda quieto.
      advances.current += 1;
      if (advances.current >= count) setStopped(true);
      go(index + 1);
    }, AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [rotating, index, go, count]);

  if (slides === null) {
    return (
      <section className={SECTION} aria-label="Destacados de TEJIDO" aria-busy="true">
        {/* Alturas medidas con la carta del artista (la mas alta) mas la capsula de controles: lo de
            abajo casi no se mueve al cargar. */}
        <div className={SLIDES_BOX}>
          <div className={SLIDE_BOX}>
            <div className={`${SLIDE_GRID} min-h-[max(690px,calc(685px_+_(1300px_-_100vw)_*_0.67))] max1024:min-h-[1300px] max600:min-h-[1295px]`}>
              <div className="grid gap-5 content-center motion-safe:animate-pulse">
                <div className="h-6 w-40 rounded-full bg-[rgba(255,255,255,0.1)]" />
                <div className="h-16 w-4/5 rounded-[16px] bg-[rgba(255,255,255,0.1)]" />
                <div className="h-24 w-full rounded-[16px] bg-[rgba(255,255,255,0.07)]" />
              </div>
              <div className={`${PHOTO_COL} aspect-[4/5] rounded-[28px] bg-[rgba(255,255,255,0.07)] motion-safe:animate-pulse`} />
            </div>
          </div>
        </div>
        <div className="mt-4 mb-7 h-[52px]" aria-hidden="true" />
      </section>
    );
  }
  if (!count) return null;
  const variants = variantsFor(slides);

  function onKeyDown(event) {
    if (count < 2) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); goManual(index + 1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); goManual(index - 1); }
  }

  // Deslizar solo con el dedo y en horizontal: el scroll vertical sigue siendo de la pagina (touch-action).
  function onPointerDown(event) {
    if (event.pointerType !== 'touch') return;
    pointer.current = { x: event.clientX, y: event.clientY };
    setTouching(true);
  }
  function onPointerEnd(event) {
    const start = pointer.current;
    pointer.current = null;
    setTouching(false);
    if (!start || count < 2 || event.type === 'pointercancel') return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) >= SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy)) goManual(index + (dx < 0 ? 1 : -1));
  }

  return (
    <section
      className={SECTION}
      role="region"
      aria-roledescription="carrusel"
      aria-label="Destacados de TEJIDO"
      onKeyDown={onKeyDown}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setFocusWithin(true)}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocusWithin(false); }}
    >
      <div className={SLIDES_BOX} data-diapositivas>
        <div
          id={`${id}-slides`}
          className="grid touch-pan-y"
          aria-live={rotating ? 'off' : 'polite'}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
        >
          {slides.map((slide, position) => {
            const active = position === index;
            const variant = variants[position];
            return (
              <motion.div
                // Un artista puede repetirse (Moneystack va entre cada contenido): la posicion hace unica la clave.
                key={`${slide.key}-${position}`}
                role="group"
                aria-roledescription="diapositiva"
                aria-label={`${position + 1} de ${count}`}
                aria-hidden={!active}
                inert={!active}
                data-variant={variant}
                className={`[grid-area:1/1] min-w-0 ${active ? 'z-1' : 'pointer-events-none'}`}
                initial={false}
                animate={{ opacity: active ? 1 : 0, visibility: active ? 'visible' : 'hidden' }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.5, ease: [0.22, 1, 0.36, 1], visibility: { delay: active ? 0 : 0.5 } }}
              >
                {variant === 'ARTIST'
                  ? <ArtistSlide slide={slide} first={position === 0} />
                  : <ContentSlide slide={slide} first={position === 0} theme={variant} />}
              </motion.div>
            );
          })}
        </div>
      </div>

      {count > 1 && (
        <div className="mt-4 mb-7 flex justify-center" data-dock>
          <div className="flex items-center gap-2 rounded-full bg-[#f5f2eb] px-4 py-2 shadow-md max-[400px]:gap-1 max-[400px]:px-2">
            <button type="button" className={DOCK_BTN} onClick={() => goManual(index - 1)} aria-controls={`${id}-slides`} aria-label="Diapositiva anterior">
              <Icon name="arrow-left" className="size-4" />
            </button>
            {count > MAX_DOTS ? (
              <p className="m-0 min-w-[64px] px-1 text-center text-[15px] font-bold tabular-nums text-ink" data-contador>
                <span aria-hidden="true">{index + 1} / {count}</span>
                <span className="sr-only">Diapositiva {index + 1} de {count}</span>
              </p>
            ) : (
              <div className="flex items-center">
                {slides.map((slide, position) => (
                  <button
                    key={`${slide.key}-${position}`}
                    type="button"
                    className={`flex h-6 w-6 items-center justify-center rounded-full border-none bg-transparent p-0 cursor-pointer ${FOCUS_LIGHT}`}
                    onClick={() => goManual(position)}
                    aria-controls={`${id}-slides`}
                    aria-label={`Ir a la diapositiva ${position + 1}`}
                    aria-current={position === index ? 'true' : undefined}
                  >
                    {/* Activo alargado (se distingue sin color); dorado oscurecido (#aa8636) para 3:1 sobre la capsula. */}
                    <span className={`block h-1.5 rounded-full transition-all duration-300 ${position === index ? 'w-6 bg-[#aa8636]' : 'w-1.5 bg-[#8c857a]'}`} />
                  </button>
                ))}
              </div>
            )}
            <button type="button" className={DOCK_BTN} onClick={() => goManual(index + 1)} aria-controls={`${id}-slides`} aria-label="Diapositiva siguiente">
              <Icon name="arrow-right" className="size-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
