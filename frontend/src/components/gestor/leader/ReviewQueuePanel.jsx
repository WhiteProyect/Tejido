import { useEffect, useState } from 'react';
import EmptyNote from '../../EmptyNote.jsx';
import Icon from '../../Icon.jsx';
import { MODERATION_TOASTS, ModerationButtons, RejectForm, moderatePublication } from '../../Moderation.jsx';
import { BTN_GHOST, PANEL, PANEL_TITLE } from '../../uiStyles.js';
import { useToast } from '../../../context/ToastContext.jsx';
import { apiRequest } from '../../../utils/api.js';
import { cdnImage } from '../../../utils/cloudinaryUrl.js';
import { KIND_LABELS } from '../../../utils/constants.js';
import { formatDate, formatDateShort } from '../../../utils/dateUtils.js';

// Por revisar (lider de rama): lo que sus participantes enviaron a revision, el mas antiguo
// primero (GET /api/branches/{rama}/review-queue). "Leer" despliega el detalle en la misma fila
// (GET /api/publications/{id} + imagenes) y se aprueba o rechaza con el mismo control del admin.
const ALERT = 'mt-3 mb-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[14px] text-[#b3442b]';
const isRealImage = (url) => Boolean(url) && !url.startsWith('linear-gradient(');

function Detail({ id }) {
  const [state, setState] = useState({ loading: true, data: null, images: [], error: '' });
  useEffect(() => {
    let alive = true;
    Promise.all([apiRequest(`/api/publications/${id}`), apiRequest(`/api/publications/${id}/images`)])
      .then(([data, images]) => alive && setState({ loading: false, data, images, error: '' }))
      .catch((error) => alive && setState({ loading: false, data: null, images: [], error: error.message }));
    return () => { alive = false; };
  }, [id]);
  if (state.loading) return <p className="mt-4 mb-0 text-[14px] text-muted" aria-busy="true">Cargando la publicación...</p>;
  if (state.error) return <p className={ALERT} role="alert">{state.error}</p>;
  const pub = state.data;
  const photos = [...(isRealImage(pub.image) ? [{ url: pub.image, alt: pub.title }] : []), ...state.images.map((image) => ({ url: image.url, alt: image.alt_text || pub.title }))];
  const facts = [
    pub.location && ['Lugar', pub.location],
    pub.start_date && ['Fecha', formatDate(pub.start_date)],
    pub.end_date && [pub.kind === 'OPORTUNIDAD' ? 'Plazo' : 'Hasta', formatDate(pub.end_date)],
  ].filter(Boolean);
  return (
    <div className="mt-4 grid gap-4 rounded-[16px] border border-line bg-white p-5 max600:p-4">
      <p className="font-display m-0 text-[18px] font-bold italic leading-[1.4] text-[#2d5a3d]">{pub.summary}</p>
      <div className="whitespace-pre-line text-[15px] leading-[1.7] text-[#3f514a] [overflow-wrap:anywhere]">{pub.content}</div>
      {photos.length > 0 && (
        <ul className="m-0 grid list-none grid-cols-4 gap-2 p-0 max600:grid-cols-2" aria-label="Imágenes">
          {photos.map((photo, i) => <li key={photo.url + i}><img src={cdnImage(photo.url, { width: 320, fit: 'fill' })} alt={photo.alt} className="aspect-square w-full rounded-[12px] object-cover" /></li>)}
        </ul>
      )}
      {facts.length > 0 && (
        <dl className="m-0 grid gap-1 text-[14px]">
          {facts.map(([label, value]) => <div key={label} className="flex flex-wrap gap-2"><dt className="font-bold text-ink">{label}:</dt><dd className="m-0 text-[#53645c]">{value}</dd></div>)}
        </dl>
      )}
      <div className="flex flex-wrap gap-4 text-[14px] font-bold">
        {pub.link && <a className="text-river no-underline hover:underline" href={pub.link} target="_blank" rel="noopener noreferrer">Enlace externo <span className="sr-only">(se abre en una pestaña nueva)</span></a>}
        <a className="text-river no-underline hover:underline" href={`#publicacion/${pub.id}`} target="_blank" rel="noopener noreferrer">Abrir página <span className="sr-only">(se abre en una pestaña nueva)</span></a>
      </div>
    </div>
  );
}

function ReviewItem({ publication, onDone }) {
  const { showToast } = useToast();
  const [reading, setReading] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function act(action, note) {
    setBusy(true);
    setError('');
    try {
      await moderatePublication(publication.id, action, note);
      showToast(MODERATION_TOASTS[action]);
      onDone();
    } catch (actionError) {
      setError(actionError.message);
      setBusy(false);
    }
  }

  return (
    <li className="rounded-[16px] border border-line bg-[rgba(212,168,67,0.08)] p-5 max600:p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 basis-[280px]">
          <p className="m-0 mb-1 text-[12px] font-bold uppercase tracking-[.08em] text-muted">
            {KIND_LABELS[publication.kind] || publication.kind} · enviada el {formatDateShort(publication.updated_at)}
          </p>
          <h3 className="m-0 font-sans text-[19px] font-bold leading-[1.25] tracking-[-0.02em] text-ink [overflow-wrap:anywhere]">{publication.title}</h3>
          <p className="mt-1 mb-0 text-[14px] text-[#53645c]">Por <strong className="text-ink">{publication.author}</strong></p>
        </div>
        <div className="flex flex-wrap items-center gap-2 max480:w-full">
          <button type="button" className={BTN_GHOST} aria-expanded={reading} onClick={() => setReading(!reading)} aria-label={`${reading ? 'Ocultar' : 'Leer'} la publicación ${publication.title}`}>
            <Icon name="book" className="size-3.5" /> {reading ? 'Ocultar' : 'Leer'}
          </button>
          <ModerationButtons title={publication.title} busy={busy} rejecting={rejecting} onApprove={() => act('approve')} onToggleReject={() => setRejecting(!rejecting)} />
        </div>
      </div>
      {reading && <Detail id={publication.id} />}
      {rejecting && <RejectForm busy={busy} onSubmit={(note) => act('reject', note)} onCancel={() => setRejecting(false)} />}
      {error && <p className={ALERT} role="alert">{error}</p>}
    </li>
  );
}

export default function ReviewQueuePanel({ queue, branchLabel, onChanged }) {
  return (
    <section className={PANEL} aria-labelledby="por-revisar">
      <h2 id="por-revisar" className={`${PANEL_TITLE} flex items-center gap-3`}><Icon name="seal" className="size-6 text-river" /> Por revisar</h2>
      <p className="mt-2 mb-0 text-[14px] text-[#53645c]">Lo que la gente de {branchLabel} envió a revisión, del más antiguo al más reciente. Lo que apruebes se publica de una vez.</p>
      {queue.length ? (
        <ul className="mt-5 mb-0 grid list-none gap-3 p-0">
          {queue.map((publication) => <ReviewItem key={publication.id} publication={publication} onDone={onChanged} />)}
        </ul>
      ) : (
        <div className="mt-6"><EmptyNote icon="seal" title="Todo al día" text={`Cuando alguien de ${branchLabel} envíe una publicación a revisión, aparecerá aquí para que la leas.`} /></div>
      )}
    </section>
  );
}
