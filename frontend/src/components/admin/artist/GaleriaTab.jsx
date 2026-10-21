import { useRef, useState } from 'react';
import EmptyNote from '../../EmptyNote.jsx';
import ImageField from '../../ImageField.jsx';
import Icon from '../../Icon.jsx';
import { BTN_GHOST, BTN_INK_OUTLINE_MD, FORM_INPUT } from '../../uiStyles.js';
import { useToast } from '../../../context/ToastContext.jsx';
import { adminArtistApi } from '../../../services/artistApi.js';
import {
  ConfirmButton, ErrorAlert, Field, FULL, HELP, InlineForm, LINK_PATTERN, ReorderButtons, SectionHeader, TAG,
  buildPayload, sortByOrden, useAction, useEditing, useFormValues, useReorder,
} from './common.jsx';
import { BulkUploadPanel, MAX_BATCH, useBulkUpload } from './BulkUpload.jsx';
import { cdnImage } from '../../../utils/cloudinaryUrl.js';
import { ACCEPTED_IMAGE_TYPES } from '../../../utils/uploadImage.js';

// Pestana "Galeria" (tabla artist_media): POST/PUT/DELETE /api/artists/{id}/media[/{media_id}].
// El mosaico publico (components/artist/ArtistMedia.jsx) ordena por `orden` y pinta fotos y videos;
// `destacado` hace que el elemento ocupe 2x2. Los videos de YouTube se incrustan; otro enlace se
// muestra como "Ver video". "Subir varias fotos" (o soltar archivos sobre la pestana) sube una tanda
// con BulkUpload.jsx; luego cada foto se ajusta con el formulario de siempre.

// Misma expresion que getYoutubeId de components/artist/ArtistMedia.jsx.
const YOUTUBE_RE = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/;
const youtubeId = (url) => (url ? url.match(YOUTUBE_RE)?.[1] ?? null : null);
const TYPE_LABELS = { image: 'Foto', video: 'Video' };

function valuesFrom(item, nextOrden) {
  if (!item) return { tipo: 'image', url: '', titulo: '', descripcion: '', fecha: '', orden: String(nextOrden), destacado: false };
  return {
    tipo: item.tipo, url: item.url, titulo: item.titulo ?? '', descripcion: item.descripcion ?? '',
    fecha: item.fecha ?? '', orden: String(item.orden), destacado: Boolean(item.destacado),
  };
}

function VideoUrlField({ value, onChange, id }) {
  const videoId = youtubeId(value);
  return (
    <div className={`${FULL} grid gap-1.5`}>
      <label className="grid gap-1.5 text-[12px] font-bold uppercase tracking-[.12em] text-muted" htmlFor={id}>URL del video *</label>
      <input id={id} type="url" className={FORM_INPUT} value={value} onChange={(event) => onChange(event.target.value)} required pattern={LINK_PATTERN} title="Un enlace que empiece por https://" maxLength={500} placeholder="https://www.youtube.com/watch?v=..." aria-describedby={`${id}-estado`} />
      <p id={`${id}-estado`} className={HELP} role="status">
        {!value && 'Pega el enlace de YouTube (youtube.com/watch?v=, youtu.be/ o /embed/).'}
        {value && videoId && <span className="font-semibold text-[#146f80]">Video de YouTube detectado (ID {videoId}): se verá incrustado en el perfil.</span>}
        {value && !videoId && <span className="font-semibold text-[#7a5c12]">No es un enlace de YouTube: en el perfil se mostrará como un enlace «Ver video».</span>}
      </p>
    </div>
  );
}

function MediaForm({ artistId, item, nextOrden, onDone, onCancel }) {
  const isEdit = Boolean(item);
  const form = useFormValues(valuesFrom(item, nextOrden));
  const { values, bind, set } = form;
  const save = useAction();
  const formId = `media-form-${item?.id ?? 'nueva'}`;

  async function handleSubmit() {
    const body = buildPayload(form, isEdit, { dates: ['fecha'], numbers: ['orden'] });
    if (isEdit && Object.keys(body).length === 0) {
      save.setError('No hay cambios para guardar.');
      return;
    }
    const ok = await save.run(() => (isEdit
      ? adminArtistApi.media.update(artistId, item.id, body)
      : adminArtistApi.media.create(artistId, body)));
    if (ok) await onDone(isEdit, values);
  }

  return (
    <InlineForm id={formId} title={isEdit ? 'Editar elemento de la galería' : 'Nuevo elemento de la galería'} onSubmit={handleSubmit} onCancel={onCancel} busy={save.busy} error={save.error} submitLabel={isEdit ? 'Guardar cambios' : 'Agregar a la galería'}>
      <Field label="Tipo" hint="El mosaico del perfil muestra fotos y videos.">
        <select className={FORM_INPUT} {...bind('tipo')} autoFocus>
          <option value="image">Foto</option>
          <option value="video">Video</option>
        </select>
      </Field>
      <Field label="Orden" hint="Menor va primero. También puedes moverlo con las flechas.">
        <input type="number" min={0} step={1} className={FORM_INPUT} {...bind('orden')} />
      </Field>
      {values.tipo === 'video'
        ? <VideoUrlField id={`${formId}-url`} value={values.url} onChange={(value) => set('url', value)} />
        : <ImageField id={`${formId}-url`} label="Foto" value={values.url} onChange={(value) => set('url', value)} scope="artist" scopeRef={artistId} required className={FULL} />}
      <Field label="Título" hint="Se ve como pie de foto en el mosaico.">
        <input className={FORM_INPUT} {...bind('titulo')} maxLength={180} />
      </Field>
      <Field label="Fecha">
        <input type="date" className={FORM_INPUT} {...bind('fecha')} />
      </Field>
      <Field label="Descripción" className={FULL}>
        <textarea className={`${FORM_INPUT} min-h-[80px] resize-y leading-[1.55]`} {...bind('descripcion')} maxLength={2000} />
      </Field>
      <label className={`${FULL} flex cursor-pointer items-center gap-3 text-[15px] font-semibold text-ink`}>
        <input type="checkbox" className="size-5 cursor-pointer accent-ink" checked={values.destacado} onChange={(event) => set('destacado', event.target.checked)} />
        Destacada: ocupa 2x2 en el mosaico
      </label>
    </InlineForm>
  );
}

function Thumbnail({ item }) {
  const [failed, setFailed] = useState(false);
  const videoId = item.tipo === 'video' ? youtubeId(item.url) : null;
  const src = item.tipo === 'image' ? cdnImage(item.url, { width: 640 }) : videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
  return (
    <div className="relative aspect-[4/3] overflow-hidden bg-[#1c2a26]">
      {src && !failed
        ? <img src={src} alt="" className="size-full object-cover" loading="lazy" decoding="async" onError={() => setFailed(true)} />
        : <span className="flex size-full items-center justify-center text-white/80" aria-hidden="true"><Icon name={item.tipo === 'video' ? 'play' : 'palette'} className="size-9" /></span>}
      {item.tipo === 'video' && src && !failed && (
        <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <span className="flex size-12 items-center justify-center rounded-full bg-black/55 text-white"><Icon name="play" className="size-6" /></span>
        </span>
      )}
      <span className="absolute top-2 left-2 flex flex-wrap gap-1.5">
        <span className={`${TAG.river} bg-white! text-[#146f80]!`}>{TYPE_LABELS[item.tipo] || item.tipo}</span>
        {item.destacado && <span className={`${TAG.gold} bg-[#fff4d6]!`}>Grande</span>}
      </span>
    </div>
  );
}

function MediaCard({ item, index, total, readOnly, reorderBusy, onMove, onEdit, onDelete }) {
  const remove = useAction();
  const name = item.titulo || `${TYPE_LABELS[item.tipo] || 'elemento'} ${index + 1}`;
  return (
    <li className="flex min-w-0 flex-col overflow-hidden rounded-[18px] border border-line bg-white/70">
      <Thumbnail item={item} />
      <div className="grid gap-2 p-4">
        <p className="m-0 text-[15px] font-bold leading-[1.3] text-ink [overflow-wrap:anywhere]">{item.titulo || <span className="font-semibold text-muted">Sin título</span>}</p>
        <p className="m-0 text-[13px] text-muted">Orden {item.orden}{item.fecha && ` · ${item.fecha}`}</p>
        {!readOnly && (
          <div className="flex flex-wrap items-center gap-2">
            <ReorderButtons idPrefix={`media-${item.id}`} itemName={name} isFirst={index === 0} isLast={index === total - 1} busy={reorderBusy || remove.busy} onMove={(delta) => onMove(item, delta)} />
            <button type="button" className={BTN_GHOST} onClick={() => onEdit(item)} disabled={remove.busy} aria-label={`Editar ${name}`}><Icon name="pen" className="size-3.5" /> Editar</button>
            <ConfirmButton itemName={name} busy={remove.busy} onConfirm={() => remove.run(() => onDelete(item))} />
            <ErrorAlert className="w-full">{remove.error}</ErrorAlert>
          </div>
        )}
      </div>
    </li>
  );
}

export default function GaleriaTab({ artist, media, readOnly, onChanged }) {
  const { showToast } = useToast();
  const { editing, open, close } = useEditing('media-form');
  const items = sortByOrden(media);
  const reorder = useReorder({
    rows: media,
    idPrefix: 'media',
    saveOrden: (item, orden) => adminArtistApi.media.update(artist.id, item.id, { orden }),
    onChanged,
    nameOf: (item) => item.titulo || 'Elemento',
  });
  const nextOrden = items.length ? Math.max(...items.map((item) => item.orden)) + 1 : 1;
  const bulk = useBulkUpload({ artistId: artist.id, nextOrden, onChanged });
  const filesRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  // Soltar fotos en cualquier parte de la pestana; el campo de imagen del formulario atiende las suyas
  // (marca el evento con preventDefault y aqui se ignora).
  function handleDrop(event) {
    setDragging(false);
    if (event.defaultPrevented || readOnly || bulk.active) return;
    event.preventDefault();
    if (event.dataTransfer.files?.length) bulk.start(event.dataTransfer.files);
  }

  async function handleDone(isEdit, values) {
    close();
    const kind = values.tipo === 'video' ? 'Video' : 'Foto';
    showToast(isEdit
      ? { tone: 'menta', eyebrow: 'Galería', title: 'Galería actualizada', text: 'Guardamos los cambios del elemento.' }
      : { tone: 'menta', eyebrow: 'Galería', title: `${kind} ${kind === 'Video' ? 'agregado' : 'agregada'}`, text: `Ya aparece en el mosaico de ${artist.stage_name}.` });
    await onChanged();
  }

  async function handleDelete(item) {
    await adminArtistApi.media.remove(artist.id, item.id);
    showToast({ tone: 'menta', eyebrow: 'Galería', title: 'Eliminado de la galería', text: item.titulo ? `«${item.titulo}» ya no está en el mosaico.` : 'El elemento ya no está en el mosaico.' });
    await onChanged();
  }

  const editingItem = typeof editing === 'number' ? items.find((item) => item.id === editing) : null;

  return (
    <div
      className={`rounded-[20px] transition-[outline-color] duration-200 ${dragging ? 'outline-2 outline-offset-8 outline-dashed outline-ink' : 'outline-transparent'}`}
      onDragOver={(event) => { if (!readOnly && !bulk.active) { event.preventDefault(); setDragging(true); } }}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
      onDrop={handleDrop}
    >
      <SectionHeader title="Galería" count={items.length} actionLabel="Agregar foto o video" onAction={() => open('nueva')} showAction={!readOnly && editing === null}>
        {!readOnly && (
          <>
            <button type="button" className={BTN_INK_OUTLINE_MD} disabled={bulk.active} onClick={() => filesRef.current?.click()}>
              <Icon name="arrow-left" className="size-4 rotate-90" /> Subir varias fotos
            </button>
            <input
              ref={filesRef}
              type="file"
              multiple
              accept={ACCEPTED_IMAGE_TYPES.join(',')}
              className="hidden"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(event) => { bulk.start(event.target.files); event.target.value = ''; }}
            />
          </>
        )}
      </SectionHeader>
      {!readOnly && (
        <p className="mt-2 mb-0 text-[13px] text-muted">
          También puedes soltar las fotos aquí. Hasta {MAX_BATCH} por tanda, JPG, PNG o WebP de hasta 10 MB.
        </p>
      )}
      <BulkUploadPanel bulk={bulk} />
      {editing !== null && (
        <MediaForm
          key={editing}
          artistId={artist.id}
          item={editingItem}
          nextOrden={nextOrden}
          onDone={handleDone}
          onCancel={close}
        />
      )}
      <ErrorAlert className="mt-4">{reorder.error}</ErrorAlert>
      <p className="sr-only" role="status">{reorder.announcement}</p>
      {items.length ? (
        <ul className="mt-6 mb-0 grid list-none grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4 p-0 max480:grid-cols-[1fr]">
          {items.map((item, index) => (
            <MediaCard
              key={item.id}
              item={item}
              index={index}
              total={items.length}
              readOnly={readOnly}
              reorderBusy={reorder.busy}
              onMove={reorder.move}
              onEdit={(entry) => open(entry.id)}
              onDelete={handleDelete}
            />
          ))}
        </ul>
      ) : editing !== 'nueva' && (
        <div className="mt-6"><EmptyNote icon="palette" title="La galería está vacía" text="Agrega fotos y videos: se verán en el mosaico del perfil. Marca alguna como destacada para que ocupe 2x2." /></div>
      )}
    </div>
  );
}
