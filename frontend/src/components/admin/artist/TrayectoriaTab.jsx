import EmptyNote from '../../EmptyNote.jsx';
import ImageField from '../../ImageField.jsx';
import Icon from '../../Icon.jsx';
import { BTN_GHOST, FORM_INPUT } from '../../uiStyles.js';
import { useToast } from '../../../context/ToastContext.jsx';
import { adminArtistApi } from '../../../services/artistApi.js';
import {
  ConfirmButton, ErrorAlert, Field, FULL, InlineForm, LINK_PATTERN, ReorderButtons, SectionHeader,
  buildPayload, sortByOrden, useAction, useEditing, useFormValues, useReorder,
} from './common.jsx';

// Pestana "Trayectoria" (tabla artist_timeline): POST/PUT/DELETE /api/artists/{id}/timeline[/{entry_id}].
// El perfil (components/artist/ArtistInfo.jsx) la pinta como linea de tiempo por `orden`, con el ano
// de `fecha`, la imagen y un enlace "Ver video" si hay `video_url`.

function valuesFrom(entry, nextOrden) {
  if (!entry) return { titulo: '', descripcion: '', fecha: '', imagen_url: '', video_url: '', orden: String(nextOrden) };
  return {
    titulo: entry.titulo, descripcion: entry.descripcion ?? '', fecha: entry.fecha ?? '', imagen_url: entry.imagen_url ?? '',
    video_url: entry.video_url ?? '', orden: String(entry.orden),
  };
}

function TimelineForm({ artistId, entry, nextOrden, onDone, onCancel }) {
  const isEdit = Boolean(entry);
  const form = useFormValues(valuesFrom(entry, nextOrden));
  const { values, bind, set } = form;
  const save = useAction();
  const formId = `timeline-form-${entry?.id ?? 'nueva'}`;

  async function handleSubmit() {
    const body = buildPayload(form, isEdit, { dates: ['fecha'], numbers: ['orden'] });
    if (isEdit && Object.keys(body).length === 0) {
      save.setError('No hay cambios para guardar.');
      return;
    }
    const ok = await save.run(() => (isEdit
      ? adminArtistApi.timeline.update(artistId, entry.id, body)
      : adminArtistApi.timeline.create(artistId, body)));
    if (ok) await onDone(isEdit, values);
  }

  return (
    <InlineForm id={formId} title={isEdit ? `Editar «${entry.titulo}»` : 'Nuevo hito'} onSubmit={handleSubmit} onCancel={onCancel} busy={save.busy} error={save.error} submitLabel={isEdit ? 'Guardar cambios' : 'Agregar hito'}>
      <Field label="Título *">
        <input className={FORM_INPUT} {...bind('titulo')} required maxLength={180} autoFocus />
      </Field>
      <Field label="Fecha" hint="En el perfil se muestra el año.">
        <input type="date" className={FORM_INPUT} {...bind('fecha')} />
      </Field>
      <Field label="Descripción" className={FULL}>
        <textarea className={`${FORM_INPUT} min-h-[90px] resize-y leading-[1.55]`} {...bind('descripcion')} maxLength={2000} />
      </Field>
      <ImageField id={`${formId}-imagen`} label="Imagen" value={values.imagen_url} onChange={(value) => set('imagen_url', value)} scope="artist" scopeRef={artistId} className={FULL} />
      <Field label="Video" hint="Enlace que se abre desde el hito («Ver video»).">
        <input type="url" className={FORM_INPUT} {...bind('video_url')} pattern={LINK_PATTERN} title="Un enlace que empiece por https://" maxLength={500} placeholder="https://" />
      </Field>
      <Field label="Orden" hint="Menor va primero. También puedes moverlo con las flechas.">
        <input type="number" min={0} step={1} className={FORM_INPUT} {...bind('orden')} />
      </Field>
    </InlineForm>
  );
}

function TimelineRow({ entry, index, total, readOnly, reorder, onEdit, onDelete }) {
  const remove = useAction();
  const year = entry.fecha ? String(entry.fecha).slice(0, 4) : '';
  return (
    <li className="flex items-start justify-between gap-4 border-b border-b-line py-4 last:border-b-0 max600:flex-col max600:items-stretch">
      <div className="flex min-w-0 items-start gap-4">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-[rgba(212,168,67,0.18)] text-[14px] font-extrabold text-[#7a5c12]" aria-hidden="true">{index + 1}</span>
        <div className="min-w-0">
          <h3 className="m-0 font-sans text-[17px] font-bold leading-[1.3] text-ink">{entry.titulo}</h3>
          <p className="mt-1 mb-0 text-[13px] text-muted">
            {[year || 'Sin fecha', `orden ${entry.orden}`, entry.imagen_url && 'con imagen', entry.video_url && 'con video'].filter(Boolean).join(' · ')}
          </p>
          {entry.descripcion && <p className="mt-1.5 mb-0 line-clamp-2 text-[14px] leading-[1.5] text-[#53645c]">{entry.descripcion}</p>}
        </div>
      </div>
      {!readOnly && (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 max600:justify-start">
          <ReorderButtons idPrefix={`timeline-${entry.id}`} itemName={entry.titulo} isFirst={index === 0} isLast={index === total - 1} busy={reorder.busy || remove.busy} onMove={(delta) => reorder.move(entry, delta)} />
          <button type="button" className={BTN_GHOST} onClick={() => onEdit(entry)} disabled={remove.busy}><Icon name="pen" className="size-3.5" /> Editar</button>
          <ConfirmButton itemName={entry.titulo} busy={remove.busy} onConfirm={() => remove.run(() => onDelete(entry))} />
          <ErrorAlert className="w-full">{remove.error}</ErrorAlert>
        </div>
      )}
    </li>
  );
}

export default function TrayectoriaTab({ artist, timeline, readOnly, onChanged }) {
  const { showToast } = useToast();
  const { editing, open, close } = useEditing('timeline-form');
  const entries = sortByOrden(timeline);
  const reorder = useReorder({
    rows: timeline,
    idPrefix: 'timeline',
    saveOrden: (entry, orden) => adminArtistApi.timeline.update(artist.id, entry.id, { orden }),
    onChanged,
    nameOf: (entry) => entry.titulo,
  });

  async function handleDone(isEdit, values) {
    close();
    const titulo = values.titulo.trim();
    showToast(isEdit
      ? { tone: 'menta', eyebrow: 'Trayectoria', title: 'Hito actualizado', text: `Guardamos los cambios de «${titulo}».` }
      : { tone: 'menta', eyebrow: 'Trayectoria', title: 'Hito agregado', text: `«${titulo}» ya es parte de la historia de ${artist.stage_name}.` });
    await onChanged();
  }

  async function handleDelete(entry) {
    await adminArtistApi.timeline.remove(artist.id, entry.id);
    showToast({ tone: 'menta', eyebrow: 'Trayectoria', title: 'Hito eliminado', text: `«${entry.titulo}» ya no está en la trayectoria.` });
    await onChanged();
  }

  const nextOrden = entries.length ? Math.max(...entries.map((entry) => entry.orden)) + 1 : 1;
  const formFor = (entry) => <TimelineForm key={entry?.id ?? 'nueva'} artistId={artist.id} entry={entry} nextOrden={nextOrden} onDone={handleDone} onCancel={close} />;

  return (
    <div>
      <SectionHeader title="Trayectoria" count={entries.length} actionLabel="Agregar hito" onAction={() => open('nueva')} showAction={!readOnly && editing !== 'nueva'} />
      {editing === 'nueva' && formFor(null)}
      <ErrorAlert className="mt-4">{reorder.error}</ErrorAlert>
      <p className="sr-only" role="status">{reorder.announcement}</p>
      {entries.length ? (
        <ol className="mt-4 mb-0 grid list-none gap-1 p-0">
          {entries.map((entry, index) => (editing === entry.id
            ? <li key={entry.id}>{formFor(entry)}</li>
            : <TimelineRow key={entry.id} entry={entry} index={index} total={entries.length} readOnly={readOnly} reorder={reorder} onEdit={(item) => open(item.id)} onDelete={handleDelete} />))}
        </ol>
      ) : editing !== 'nueva' && (
        <div className="mt-6"><EmptyNote icon="sprout" title="Aún no hay hitos" text="Cuenta la historia del artista paso a paso: sin hitos, la sección no aparece en el perfil." /></div>
      )}
    </div>
  );
}
