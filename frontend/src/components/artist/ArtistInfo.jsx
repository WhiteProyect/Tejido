import { motion } from 'framer-motion';
import { AX_SECTION, AX_SECTION_TITLE } from './axStyles.js';

// ── Linea de tiempo ──────────────────────────────────────────────────────────
// Mobile (<=768px): una sola columna; la curva serpenteante (svg) no tiene espacio para mecerse,
// asi que el svg se oculta y el ::before del track dibuja una linea recta pegada a los puntos.
const TRACK = "relative mx-auto max-w-[900px] max768:before:absolute max768:before:top-0 max768:before:bottom-0 max768:before:left-5 max768:before:w-0.5 max768:before:bg-[linear-gradient(to_bottom,var(--ax-accent),var(--ax-border),transparent)] max768:before:content-['']";
// El trazo del rio (.ax-timeline-river-path: stroke url(#gradiente), dasharray y axRiverFlow) sigue en artist.css.
const RIVER_SVG = 'pointer-events-none absolute inset-0 z-0 size-full max768:hidden';
const ITEM = 'relative z-1 mb-12 flex items-start max768:justify-start max768:pr-0 max768:pl-13';
const ITEM_LEFT = 'justify-start pr-[calc(50%_+_40px)]';
const ITEM_RIGHT = 'justify-end pl-[calc(50%_+_40px)]';
const DOT = 'absolute top-5 left-1/2 z-2 flex size-4.5 -translate-x-1/2 items-center justify-center rounded-[50%] border-2 border-ax-accent bg-ax-bg shadow-[0_0_0_4px_rgba(212,168,67,0.12),0_0_18px_3px_rgba(212,168,67,0.35)] transition-[box-shadow] duration-300 ease-[ease] max768:left-5';
const CARD = 'max-w-[380px] rounded-ax border border-ax-border bg-ax-card p-6 transition-all duration-300 ease-in-out hover:-translate-y-1 hover:bg-ax-card-hover hover:shadow-[0_12px_40px_rgba(0,0,0,0.4)] max768:max-w-full';
// h3 y a globales (main.css): "!" en font-size y margin (h3) y en color / text-decoration (a).
const TL_TITLE = 'mb-2.5! text-[18px]! font-bold text-ax-text';
const LINK = 'text-[13px] font-semibold text-ax-accent! hover:underline!';

// ── Territorio ───────────────────────────────────────────────────────────────
const CONN_CARD = 'rounded-ax border border-ax-border bg-ax-card p-6 transition-all duration-300 ease-in-out hover:-translate-y-[3px] hover:bg-ax-card-hover';
const CONN_TITLE = 'mb-2! text-[18px]! font-bold text-ax-text';

// ── Eventos ──────────────────────────────────────────────────────────────────
const EVENT_CARD = 'flex items-center gap-6 rounded-ax border border-ax-border bg-ax-card px-6 py-5 transition-all duration-300 ease-in-out hover:translate-x-1 hover:bg-ax-card-hover max768:flex-wrap max768:gap-3';
const BADGE = 'rounded-[999px] px-3 py-[5px] text-[11px] font-bold tracking-[0.05em] uppercase';
const BADGE_UPCOMING = 'bg-[rgba(16,185,129,0.15)] text-[#10B981]';
const BADGE_PAST = 'bg-[rgba(255,255,255,0.06)] text-ax-muted';

// Genera una curva tipo rio (mismo lenguaje visual que la serpiente del hero
// cultural, ver MANUAL_ESENCIA_TEJIDO.md "LA SERPIENTE / EL RIO") que se
// balancea suavemente hacia el lado de cada tarjeta alternada, en vez de una
// linea recta -- el manual describe la linea de tiempo como "un rio de
// eventos que fluye", no una linea recta.
function buildRiverPath(count) {
  if (count === 0) return '';
  const anchors = Array.from({ length: count }, (_, i) => ({
    x: i % 2 === 0 ? 40 : 60,
    y: i * 100 + 50,
  }));

  let d = 'M 50 0';
  let prevX = 50;
  let prevY = 0;
  anchors.forEach(({ x, y }) => {
    const midY = (prevY + y) / 2;
    d += ` C ${prevX} ${midY}, ${x} ${midY}, ${x} ${y}`;
    prevX = x;
    prevY = y;
  });
  d += ` C ${prevX} ${prevY + 40}, 50 ${count * 100 - 15}, 50 ${count * 100}`;
  return d;
}

function ArtistTimeline({ timeline }) {
  if (!timeline || timeline.length === 0) return null;

  const riverPath = buildRiverPath(timeline.length);

  return (
    <section className={AX_SECTION}>
      <h2 className={AX_SECTION_TITLE}>Historia</h2>

      <div className={TRACK}>
        <svg
          className={RIVER_SVG}
          viewBox={`0 0 100 ${timeline.length * 100}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="ax-timeline-river-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--ax-accent)" />
              <stop offset="100%" stopColor="var(--river, #1d8fa3)" />
            </linearGradient>
          </defs>
          <path d={riverPath} className="ax-timeline-river-path" />
        </svg>

        {timeline.map((item, index) => (
          <motion.div
            key={item.id}
            className={`${ITEM} ${index % 2 === 0 ? ITEM_LEFT : ITEM_RIGHT}`}
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className={DOT} aria-hidden="true">
              <div className="size-1.5 rounded-[50%] bg-ax-accent" />
            </div>

            <div className={CARD}>
              {item.fecha && (
                <span className="mb-2 inline-block text-[12px] font-extrabold tracking-[0.1em] text-ax-accent">
                  {item.fecha.split('-')[0]}
                </span>
              )}
              <h3 className={TL_TITLE}>{item.titulo}</h3>
              {item.descripcion && (
                <p className="m-0 text-[14px] leading-[1.6] text-ax-dim">{item.descripcion}</p>
              )}
              {item.imagen_url && (
                <div className="mt-3 overflow-hidden rounded-ax-sm">
                  <img className="block h-auto w-full" src={item.imagen_url} alt={item.titulo} loading="lazy" />
                </div>
              )}
              {item.video_url && (
                <a href={item.video_url} target="_blank" rel="noopener noreferrer" className={`mt-3 inline-flex items-center gap-1.5 ${LINK}`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                  Ver video
                </a>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

const entityLabels = {
  event: 'Evento',
  artist: 'Artista',
  collective: 'Colectivo',
  story: 'Historia',
  place: 'Lugar',
};

const entityColors = {
  event: '#F59E0B',
  artist: '#EC4899',
  collective: '#8B5CF6',
  story: '#3B82F6',
  place: '#10B981',
};

function ArtistTerritory({ connections }) {
  if (!connections || connections.length === 0) return null;

  return (
    <section className={AX_SECTION}>
      <h2 className={AX_SECTION_TITLE}>Desde el territorio</h2>
      <p className="-mt-4 mb-10 text-[16px] leading-[1.6] text-ax-dim">
        Las conexiones de {connections[0]?.titulo ? 'este artista' : 'OG MAURO'} con el ecosistema cultural del Bajo Cauca.
      </p>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
        {connections.map((conn) => (
          <div key={conn.id} className={CONN_CARD}>
            <div className="mb-3 flex items-center justify-between">
              <span
                className="text-[11px] font-bold tracking-[0.1em] uppercase"
                style={{ color: entityColors[conn.entity_type] || '#999' }}
              >
                {entityLabels[conn.entity_type] || conn.entity_type}
              </span>
              {conn.imagen_url && (
                <div className="size-10 overflow-hidden rounded-[10px]">
                  <img className="size-full object-cover" src={conn.imagen_url} alt={conn.titulo} loading="lazy" />
                </div>
              )}
            </div>
            <h3 className={CONN_TITLE}>{conn.titulo}</h3>
            {conn.descripcion && (
              <p className="mt-0 mb-4 text-[14px] leading-[1.6] text-ax-dim">{conn.descripcion}</p>
            )}
            {conn.url && (
              <a href={conn.url} target="_blank" rel="noopener noreferrer" className={LINK}>
                Conocer mas
              </a>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function ArtistEvents({ events }) {
  if (!events || events.length === 0) return null;

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-CO', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function isPast(dateStr) {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  }

  return (
    <section className={AX_SECTION}>
      <h2 className={AX_SECTION_TITLE}>Eventos</h2>

      <div className="flex flex-col gap-3">
        {events.map((event) => {
          const past = isPast(event.start_date);
          return (
            <div key={event.id} className={`${EVENT_CARD} ${past ? 'opacity-50' : ''}`}>
              <div className="flex min-w-[60px] flex-col items-center">
                {event.start_date && (
                  <>
                    <span className="text-[12px] font-bold tracking-[0.1em] text-ax-accent uppercase">
                      {new Date(event.start_date).toLocaleDateString('es-CO', { month: 'short' })}
                    </span>
                    <span className="text-[28px] leading-none font-extrabold text-ax-text">
                      {new Date(event.start_date).getDate()}
                    </span>
                  </>
                )}
              </div>
              <div className="flex-1">
                <h3 className="mb-1! text-[16px]! font-bold text-ax-text">{event.title}</h3>
                <p className="m-0 text-[14px] text-ax-dim">{event.venue || event.location}</p>
                {event.summary && <span className="mt-1.5 block text-[13px] leading-[1.4] text-ax-muted">{event.summary}</span>}
              </div>
              <div className="ax-event-status">
                {past ? (
                  <span className={`${BADGE} ${BADGE_PAST}`}>Pasado</span>
                ) : (
                  <span className={`${BADGE} ${BADGE_UPCOMING}`}>Proximo</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function ArtistInfo({ timeline, connections, events }) {
  const hasTimeline = timeline && timeline.length > 0;
  const hasConnections = connections && connections.length > 0;
  const hasEvents = events && events.length > 0;

  return (
    <>
      {hasTimeline && (
        <div id="ax-timeline">
          <ArtistTimeline timeline={timeline} />
        </div>
      )}

      {hasConnections && (
        <div id="ax-territory">
          <ArtistTerritory connections={connections} />
        </div>
      )}

      {hasEvents && (
        <div id="ax-events">
          <ArtistEvents events={events} />
        </div>
      )}
    </>
  );
}
