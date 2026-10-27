import { useId, useState } from 'react';
import ImageField from '../../ImageField.jsx';
import { useUnsavedChanges } from '../../admin/artist/unsavedChanges.js';
import MultiImageField from '../../gestor/edit/MultiImageField.jsx';
import { CharCount, HINT } from '../../gestor/edit/common.jsx';
import { BTN_GHOST, BTN_INK_OUTLINE_MD, BTN_QUIET_SM, FORM_INPUT, FORM_LABEL } from '../../uiStyles.js';
import EmptyNote from '../../EmptyNote.jsx';
import { VideoTile } from '../Portfolio.jsx';
import { cdnImage } from '../../../utils/cloudinaryUrl.js';
import { videoEmbed } from '../../../utils/videoEmbed.js';
import { ALERT, LIMITS, SaveBar, talentApi } from './common.jsx';

// Pestaña Portafolio: hasta 16 piezas en UNA lista ordenada (fotos y videos mezclados, como en el
// perfil). Fotos: subida multiple con MultiImageField (scope "talent"; aqui solo sube y entrega,
// cada foto se edita en la lista). Videos: enlace https de YouTube, Vimeo o un archivo .mp4/.webm,
// con titulo y miniatura opcional; se prueban aqui mismo con el mismo reproductor del perfil.
// Guardar reemplaza la lista (PUT /api/talent/{id}/media).
const EMPTY_VIDEO = { url: '', title: '', thumbnail_url: '' };

function MediaRow({ item, index, total, category, playing, onPlay, onStop, onChange, onMove, onRemove, prefix }) {
  const label = `${item.type === 'video' ? 'video' : 'foto'} ${index + 1}${item.title ? `: ${item.title}` : ''}`;
  return (
    <li className="grid grid-cols-[200px_minmax(0,1fr)] gap-4 rounded-[18px] border border-line bg-white/70 p-4 max600:grid-cols-[minmax(0,1fr)]">
      <div className="relative aspect-[16/10] overflow-hidden rounded-[12px] bg-cream">
        {item.type === 'video'
          ? <VideoTile item={item} category={category} playing={playing} onPlay={onPlay} onStop={onStop} />
          : <img src={cdnImage(item.url, { width: 320, fit: 'fill' })} alt="" className="size-full object-cover" />}
      </div>
      <div className="grid min-w-0 gap-3">
        <p className="m-0 text-[13px] font-extrabold uppercase tracking-[.1em] text-[#53645c]">{item.type === 'video' ? 'Video' : 'Foto'} {index + 1}</p>
        {item.type === 'video' && (
          <label className={FORM_LABEL}>Enlace del video
            <input className={FORM_INPUT} type="url" value={item.url} onChange={(event) => onChange({ url: event.target.value })} placeholder="https://www.youtube.com/watch?v=..." />
          </label>
        )}
        <label className={`${FORM_LABEL} flex-wrap`}>
          <span className="flex items-end justify-between gap-3">{item.type === 'video' ? 'Título' : 'Título o texto alternativo'} <CharCount value={item.title} max={LIMITS.mediaTitle} /></span>
          <input className={FORM_INPUT} value={item.title} maxLength={LIMITS.mediaTitle} onChange={(event) => onChange({ title: event.target.value })}
            placeholder={item.type === 'video' ? 'En vivo en el río' : 'Qué se ve en la foto'} />
        </label>
        <label className={FORM_LABEL}>
          <span className="flex items-end justify-between gap-3">Pie (opcional) <CharCount value={item.caption} max={LIMITS.mediaCaption} /></span>
          <input className={FORM_INPUT} value={item.caption} maxLength={LIMITS.mediaCaption} onChange={(event) => onChange({ caption: event.target.value })} placeholder="2025 · Cáceres" />
        </label>
        {item.type === 'video' && (
          <ImageField label="Miniatura (opcional)" value={item.thumbnail_url} onChange={(value) => onChange({ thumbnail_url: value })} scope="talent" id={`${prefix}-thumb-${index}`} />
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={BTN_QUIET_SM} disabled={index === 0} onClick={() => onMove(-1)} aria-label={`Subir ${label}`}>↑ Subir</button>
          <button type="button" className={BTN_QUIET_SM} disabled={index === total - 1} onClick={() => onMove(1)} aria-label={`Bajar ${label}`}>↓ Bajar</button>
          <button type="button" className={BTN_GHOST} onClick={onRemove} aria-label={`Quitar ${label}`}>Quitar</button>
        </div>
      </div>
    </li>
  );
}

function fromItem(item) {
  return { type: item.type, url: item.url, thumbnail_url: item.thumbnail_url || '', title: item.title || '', caption: item.caption || '' };
}

function toItem(item) {
  const blank = (value) => (String(value || '').trim() === '' ? null : String(value).trim());
  return { type: item.type, url: item.url.trim(), thumbnail_url: item.type === 'video' ? blank(item.thumbnail_url) : null, title: blank(item.title), caption: blank(item.caption) };
}

export default function PortfolioTab({ detail, onSaved }) {
  const prefix = useId().replace(/:/g, '');
  const [initial] = useState(() => detail.media.map(fromItem));
  const [items, setItems] = useState(initial);
  const [video, setVideo] = useState(EMPTY_VIDEO);
  const [videoError, setVideoError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [playing, setPlaying] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dirty = JSON.stringify(items) !== JSON.stringify(initial);
  useUnsavedChanges(dirty || Boolean(video.url));
  const free = LIMITS.media - items.length;

  const update = (index, changes) => setItems((current) => current.map((item, i) => (i === index ? { ...item, ...changes } : item)));
  function move(index, delta) {
    const next = [...items];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    setPlaying(null);
    setItems(next);
  }

  function addVideo() {
    const url = video.url.trim();
    if (!/^https:\/\//i.test(url)) { setVideoError('El enlace del video debe empezar por https://'); return; }
    if (!videoEmbed(url)) { setVideoError('Usa un enlace de YouTube, de Vimeo o de un archivo de video (.mp4, .webm).'); return; }
    setItems([...items, { type: 'video', url, title: video.title, thumbnail_url: video.thumbnail_url, caption: '' }]);
    setVideo(EMPTY_VIDEO);
    setVideoError('');
  }

  async function save(event) {
    event.preventDefault();
    const broken = items.findIndex((item) => item.type === 'video' && (!/^https:\/\//i.test(item.url.trim()) || !videoEmbed(item.url.trim())));
    if (broken >= 0) { setError(`El enlace del video ${broken + 1} no es válido: usa https de YouTube, Vimeo o un archivo .mp4/.webm.`); return; }
    setBusy(true);
    setError('');
    try {
      await talentApi.putList(detail.id, 'media', items.map(toItem));
      await onSaved({ title: 'Portafolio guardado', reviewNote: true });
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} noValidate aria-labelledby={`${prefix}-title`}>
      <h3 id={`${prefix}-title`} className="m-0 font-sans text-[22px] font-extrabold tracking-[-0.03em] text-ink">
        Portafolio <span className="text-[16px] font-bold text-muted">({items.length} de {LIMITS.media})</span>
      </h3>
      <p className={`${HINT} mt-2 max-w-[680px]`}>Fotos y videos en el orden en que se verán. La primera pieza sale más grande en el perfil.</p>

      {items.length === 0 ? (
        <div className="mt-5"><EmptyNote icon="palette" title="Sin piezas todavía" text="Sube fotos o agrega el enlace de un video." /></div>
      ) : (
        <ol className="mt-5 mb-0 grid list-none gap-4 p-0">
          {items.map((item, index) => (
            <MediaRow key={`${item.url}-${index}`} item={item} index={index} total={items.length} category={detail.category} prefix={prefix}
              playing={playing === index} onPlay={() => setPlaying(index)} onStop={() => setPlaying((current) => (current === index ? null : current))}
              onChange={(changes) => update(index, changes)} onMove={(delta) => move(index, delta)}
              onRemove={() => { setPlaying(null); setItems(items.filter((_, i) => i !== index)); }} />
          ))}
        </ol>
      )}

      {free > 0 ? (
        <div className="mt-6 grid grid-cols-[1fr_1fr] gap-5 max800:grid-cols-[1fr]">
          <MultiImageField label="Agregar fotos" value={[]} max={free} scope="talent" onBusyChange={setUploading}
            onChange={(photos) => setItems((current) => [...current, ...photos.map((photo) => ({ type: 'image', url: photo.url, thumbnail_url: '', title: '', caption: '' }))])} />
          <fieldset className="m-0 grid content-start gap-3 rounded-[16px] border border-line bg-white/70 p-4">
            <legend className="px-1 text-[12px] font-bold uppercase tracking-[.12em] text-muted">Agregar un video</legend>
            <label className={FORM_LABEL}>Enlace (https)
              <input className={FORM_INPUT} type="url" value={video.url} onChange={(event) => setVideo({ ...video, url: event.target.value })} placeholder="https://www.youtube.com/watch?v=..." />
            </label>
            <label className={FORM_LABEL}>Título (opcional)
              <input className={FORM_INPUT} value={video.title} maxLength={LIMITS.mediaTitle} onChange={(event) => setVideo({ ...video, title: event.target.value })} />
            </label>
            <ImageField label="Miniatura (opcional)" value={video.thumbnail_url} onChange={(value) => setVideo({ ...video, thumbnail_url: value })} scope="talent" id={`${prefix}-new-thumb`} />
            <p className={HINT}>YouTube, Vimeo o un enlace directo a un archivo de video. Se reproduce dentro del perfil.</p>
            {videoError && <p className={ALERT} role="alert">{videoError}</p>}
            <div><button type="button" className={BTN_INK_OUTLINE_MD} onClick={addVideo} disabled={!video.url.trim()}>Agregar video</button></div>
          </fieldset>
        </div>
      ) : (
        <p className={`${HINT} mt-4`}>Llegaste al máximo de {LIMITS.media} piezas. Quita una para agregar otra.</p>
      )}

      {error && <p className={`${ALERT} mt-5`} role="alert">{error}</p>}
      <SaveBar busy={busy} dirty={dirty} label="Guardar portafolio" disabledText={uploading ? 'Esperando las fotos...' : ''} />
    </form>
  );
}
