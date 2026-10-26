import { useEffect, useState } from 'react';
import EmptyNote from '../components/EmptyNote.jsx';
import Icon from '../components/Icon.jsx';
import Lightbox from '../components/Lightbox.jsx';
import PublicationActions from '../components/PublicationActions.jsx';
import { BTN_INK_OUTLINE_MD, SECTION } from '../components/uiStyles.js';
import { apiRequest } from '../utils/api.js';
import { cdnImage } from '../utils/cloudinaryUrl.js';
import { BRANCH_LABELS, CULTURAL_CATEGORIES, KIND_COLORS, KIND_LABELS } from '../utils/constants.js';
import { formatDate, getDeadlineText } from '../utils/dateUtils.js';
import { getInitials } from '../utils/initials.js';
import { STATUS_LABELS } from '../utils/publicationStatus.js';

// Pagina de una publicacion (#publicacion/<id>), la que abren los enlaces compartidos y
// "Ver detalles" de la tarjeta. GET /api/publications/{id} trae todo: la fila, su evento u
// oportunidad (venue, capacity / organization_name, deadline), la organizacion publica del autor
// y la galeria (images). Una publicada es publica; otro estado solo lo ven su autor o un admin
// (403/404 -> "no disponible"), que ademas ven una nota con el estado.
const CATEGORY_BY_KEY = Object.fromEntries(CULTURAL_CATEGORIES.map(([key, label, slug]) => [key, { label, slug }]));
const DETAIL_LABEL = 'm-0 text-[11px] font-bold uppercase tracking-[.14em] text-muted';
const DETAIL_VALUE = 'mt-1 mb-0 text-[15px] leading-[1.5] text-ink';
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

const isRealImage = (url) => Boolean(url) && !url.startsWith('linear-gradient(');

// "sabado 7 de noviembre de 2026 · 3:00 p. m." (la hora solo si la fecha trae una distinta de 00:00).
function formatDateTime(iso) {
  if (!iso) return '';
  const text = formatDate(iso);
  const time = String(iso).match(/T(\d{2}):(\d{2})/);
  if (!time || (time[1] === '00' && time[2] === '00')) return text;
  const hours = Number(time[1]);
  return `${text} · ${hours % 12 || 12}:${time[2]} ${hours < 12 ? 'a. m.' : 'p. m.'}`;
}

function Detail({ label, children }) {
  return (
    <div className="border-b border-b-line py-4 first:pt-0 last:border-b-0 last:pb-0">
      <p className={DETAIL_LABEL}>{label}</p>
      <div className={DETAIL_VALUE}>{children}</div>
    </div>
  );
}

function Unavailable() {
  return (
    <section className={`${SECTION} min-h-[62vh]`}>
      <div className="mx-auto max-w-[640px]">
        <EmptyNote
          icon="book"
          title="Esta publicación no está disponible"
          text="Puede que la hayan retirado o que aún no esté publicada."
          action={<a className={BTN_INK_OUTLINE_MD} href="#explorar">Ir a Explorar <Icon name="arrow-right" className="size-4" /></a>}
        />
      </div>
    </section>
  );
}

export default function PublicationScreen({ id, user, canGoBack }) {
  const [state, setState] = useState({ loading: true, data: null, unavailable: false, error: '' });
  const [viewer, setViewer] = useState(null); // indice de la foto ampliada

  useEffect(() => {
    let alive = true;
    if (!/^\d+$/.test(String(id || ''))) {
      setState({ loading: false, data: null, unavailable: true, error: '' });
      return undefined;
    }
    setState((current) => ({ ...current, loading: true }));
    apiRequest(`/api/publications/${id}`)
      .then((data) => alive && setState({ loading: false, data, unavailable: false, error: '' }))
      .catch((error) => alive && setState({
        loading: false, data: null,
        unavailable: [403, 404].includes(error.status),
        error: [403, 404].includes(error.status) ? '' : error.message,
      }));
    return () => { alive = false; };
  }, [id, user?.id]);

  // Titulo de la pestana mientras se ve; al salir vuelve el anterior.
  useEffect(() => {
    const previous = document.title;
    return () => { document.title = previous; };
  }, []);
  useEffect(() => {
    if (state.data?.title) document.title = `${state.data.title} · TEJIDO`;
  }, [state.data?.title]);

  function goBack() {
    if (canGoBack) window.history.back();
    else window.location.hash = 'explorar';
  }

  if (state.loading) return <section className={`${SECTION} min-h-[62vh]`} aria-busy="true"><p className="m-0 text-[14px] text-muted">Cargando...</p></section>;
  if (state.unavailable) return <Unavailable />;
  if (state.error) {
    return (
      <section className={`${SECTION} min-h-[62vh]`}>
        <p className="m-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[14px] text-[#b3442b]" role="alert">{state.error}</p>
      </section>
    );
  }

  const pub = state.data;
  const kindColor = KIND_COLORS[pub.kind] || 'var(--river)';
  const photos = [
    ...(isRealImage(pub.image) ? [{ key: 'principal', url: pub.image, alt: pub.title, caption: '' }] : []),
    ...(pub.images || []).map((image) => ({ key: image.id, url: image.url, alt: image.alt_text || pub.title, caption: image.caption || '' })),
  ];
  const [cover, ...rest] = photos;
  const hasGallery = photos.length > 1;
  const category = CATEGORY_BY_KEY[pub.cultural_category];
  const organization = pub.author_organization;
  const authorName = organization?.name || pub.author || 'Equipo TEJIDO';
  const branch = organization?.branch && BRANCH_LABELS[organization.branch];
  const deadline = pub.kind === 'OPORTUNIDAD' ? (pub.deadline || pub.end_date) : null;
  const [statusLabel, statusTone] = STATUS_LABELS[pub.status] || [pub.status, STATUS_LABELS.DRAFT[1]];
  const move = (delta) => setViewer((current) => (current + delta + photos.length) % photos.length);

  const coverImage = cover && (
    <img
      src={cdnImage(cover.url, { width: 1600 })}
      alt={cover.alt}
      className="block aspect-[16/10] w-full object-cover max600:aspect-[4/3]"
    />
  );

  return (
    <article className={`${SECTION} min-h-[62vh]`} style={{ '--kind': kindColor }}>
      <div className="mx-auto max-w-[1100px]">
        <button type="button" onClick={goBack} className={`mb-8 inline-flex cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-[14px] font-semibold text-ink hover:underline ${FOCUS}`}>
          <Icon name="arrow-left" className="size-4" /> Volver
        </button>

        {pub.status !== 'PUBLISHED' && (
          <p className="mt-0 mb-6 flex flex-wrap items-center gap-2 rounded-[14px] border border-line bg-[#fffaf2] py-3 px-4 text-[14px] text-[#53645c]" role="note">
            <span className={`rounded-full py-0.5 px-2.5 text-[12px] font-bold ${statusTone}`}>{statusLabel}</span>
            {user && pub.author_id !== user.id && user.role !== 'ADMIN'
              ? 'La ves porque lideras esta rama: está esperando tu revisión. Apruébala o recházala desde tu dashboard, en «Por revisar».'
              : 'Solo tú y el equipo de TEJIDO pueden ver esta página mientras no esté publicada.'}
            {pub.status === 'REJECTED' && pub.moderation_note && <span className="basis-full text-[#a8431f]"><strong>Motivo:</strong> {pub.moderation_note}</span>}
          </p>
        )}

        <header className="max-w-[820px]">
          <span className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[.1em] text-white" style={{ backgroundColor: 'var(--kind)' }}>
            {KIND_LABELS[pub.kind] || pub.kind}
          </span>
          <h1 className="mt-4 mb-0 font-sans text-[length:clamp(36px,5vw,64px)] font-extrabold leading-[1.02] tracking-[-.045em] text-ink [overflow-wrap:anywhere]">{pub.title}</h1>
          <p className="font-display mt-4 mb-0 text-[length:clamp(19px,2.2vw,24px)] font-bold italic leading-[1.4] text-[#2d5a3d]">{pub.summary}</p>
        </header>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <PublicationActions key={`${pub.id}-${user?.id ?? 'anon'}`} publication={pub} user={user} returnTo={`publicacion/${pub.id}`} withLabels menuUp={false} />
        </div>

        {cover && (
          <div className="mt-8">
            {hasGallery ? (
              <button type="button" className={`block w-full cursor-zoom-in overflow-hidden rounded-[28px] border-0 bg-[#f3ece0] p-0 ${FOCUS}`} onClick={() => setViewer(0)} aria-label={`Ampliar foto 1 de ${photos.length}`}>
                {coverImage}
              </button>
            ) : (
              <div className="overflow-hidden rounded-[28px] bg-[#f3ece0]">{coverImage}</div>
            )}
            {hasGallery && (
              <ul className="mt-3 mb-0 grid list-none grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3 p-0 max600:grid-cols-3 max600:gap-2" aria-label="Galería">
                {rest.map((photo, i) => (
                  <li key={photo.key}>
                    <button type="button" className={`block w-full cursor-zoom-in overflow-hidden rounded-[16px] border-0 bg-[#f3ece0] p-0 ${FOCUS}`} onClick={() => setViewer(i + 1)} aria-label={`Ampliar foto ${i + 2} de ${photos.length}`}>
                      <img src={cdnImage(photo.url, { width: 320, fit: 'fill' })} alt={photo.alt} loading="lazy" className="block aspect-square w-full object-cover transition-[scale] duration-300 motion-safe:hover:scale-[1.04]" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="mt-10 grid grid-cols-[minmax(0,1fr)_320px] items-start gap-10 max900:grid-cols-[minmax(0,1fr)] max900:gap-8">
          <div className="min-w-0 whitespace-pre-line text-[17px] leading-[1.75] text-[#3f514a] [overflow-wrap:anywhere]">{pub.content}</div>

          <aside className="min-w-0 rounded-[24px] border border-[#e2d9ca] bg-[#fffaf2] p-6" aria-label="Detalles">
            {pub.start_date && (
              <Detail label={pub.end_date && pub.kind !== 'OPORTUNIDAD' ? 'Desde' : 'Fecha'}>{formatDateTime(pub.start_date)}</Detail>
            )}
            {pub.end_date && pub.kind !== 'OPORTUNIDAD' && <Detail label="Hasta">{formatDateTime(pub.end_date)}</Detail>}
            {deadline && (
              <Detail label="Plazo">
                {formatDateTime(deadline)}
                <span className="mt-1 block text-[13px] font-bold text-[var(--kind)]">{getDeadlineText(deadline)}</span>
              </Detail>
            )}
            {pub.kind === 'OPORTUNIDAD' && pub.organization_name && <Detail label="Convoca">{pub.organization_name}</Detail>}
            <Detail label="Lugar">
              <span className="inline-flex items-start gap-1.5"><Icon name="pin" className="mt-1 size-4 shrink-0 text-muted" />{(pub.kind === 'EVENTO' && pub.venue) || pub.location || 'Caucasia'}</span>
            </Detail>
            {pub.kind === 'EVENTO' && pub.capacity ? <Detail label="Cupo">{pub.capacity} personas</Detail> : null}
            {category && (
              <Detail label="Categoría cultural">
                <a className={`font-bold text-river no-underline hover:underline ${FOCUS}`} href={`#categoria/${category.slug}`}>{category.label}</a>
              </Detail>
            )}
            {pub.link && (
              <Detail label="Más información">
                <a className={`inline-flex items-center gap-1.5 font-bold text-river no-underline [overflow-wrap:anywhere] hover:underline ${FOCUS}`} href={pub.link} target="_blank" rel="noopener noreferrer">
                  Abrir enlace <Icon name="arrow-right" className="size-4" /><span className="sr-only"> (se abre en una pestaña nueva)</span>
                </a>
              </Detail>
            )}
            <Detail label="Publicado por">
              <span className="mt-1 flex items-center gap-3">
                {organization?.photo_url ? (
                  <img src={cdnImage(organization.photo_url, { width: 96, fit: 'fill' })} alt="" className="size-11 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[rgba(29,143,163,0.14)] text-[15px] font-extrabold text-[#146f80]" aria-hidden="true">{getInitials(authorName)}</span>
                )}
                <span className="min-w-0">
                  {pub.author_slug ? (
                    <a href={`#gestor/${pub.author_slug}`} className={`block font-bold text-river no-underline [overflow-wrap:anywhere] hover:underline ${FOCUS}`}>{authorName}</a>
                  ) : <strong className="block [overflow-wrap:anywhere]">{authorName}</strong>}
                  {branch && <span className="block text-[13px] text-muted">{branch}</span>}
                </span>
              </span>
            </Detail>
          </aside>
        </div>
      </div>

      {viewer !== null && <Lightbox photos={photos} index={viewer} onClose={() => setViewer(null)} onMove={move} />}
    </article>
  );
}
