import EmptyNote from '../../EmptyNote.jsx';
import ImageField from '../../ImageField.jsx';
import Icon from '../../Icon.jsx';
import { BTN_GHOST, FORM_INPUT } from '../../uiStyles.js';
import { useToast } from '../../../context/ToastContext.jsx';
import { adminArtistApi } from '../../../services/artistApi.js';
import { CONNECTION_TYPES } from '../../../utils/artistOptions.js';
import {
  ConfirmButton, ErrorAlert, Field, FULL, IMAGE_PATTERN, InlineForm, SectionHeader, TAG,
  buildPayload, sortByOrden, useAction, useEditing, useFormValues,
} from './common.jsx';
import { cdnImage } from '../../../utils/cloudinaryUrl.js';

// Pestana "Conexiones" (tabla artist_connections): POST/PUT/DELETE /api/artists/{id}/connections[/{id}].
// "Desde el territorio" del perfil (components/artist/ArtistInfo.jsx) pinta tipo (etiqueta y color),
// titulo, descripcion, imagen y "Conocer mas" si hay enlace. entity_id no se expone.

const TYPE_OPTIONS = Object.entries(CONNECTION_TYPES);

function valuesFrom(connection, nextOrden) {
  if (!connection) return { entity_type: 'place', titulo: '', descripcion: '', imagen_url: '', url: '', orden: String(nextOrden) };
  return {
    entity_type: connection.entity_type, titulo: connection.titulo, descripcion: connection.descripcion ?? '',
    imagen_url: connection.imagen_url ?? '', url: connection.url ?? '', orden: String(connection.orden),
  };
}

function ConnectionForm({ artistId, connection, nextOrden, onDone, onCancel }) {
  const isEdit = Boolean(connection);
  const form = useFormValues(valuesFrom(connection, nextOrden));
  const { values, bind, set } = form;
  const save = useAction();
  const formId = `connection-form-${connection?.id ?? 'nueva'}`;
  const legacy = connection && !CONNECTION_TYPES[connection.entity_type] ? connection.entity_type : null;

  async function handleSubmit() {
    const body = buildPayload(form, isEdit, { numbers: ['orden'] });
    if (isEdit && Object.keys(body).length === 0) {
      save.setError('No hay cambios para guardar.');
      return;
    }
    const ok = await save.run(() => (isEdit
      ? adminArtistApi.connections.update(artistId, connection.id, body)
      : adminArtistApi.connections.create(artistId, body)));
    if (ok) await onDone(isEdit, values);
  }

  return (
    <InlineForm id={formId} title={isEdit ? `Editar «${connection.titulo}»` : 'Nueva conexión'} onSubmit={handleSubmit} onCancel={onCancel} busy={save.busy} error={save.error} submitLabel={isEdit ? 'Guardar cambios' : 'Agregar conexión'}>
      <Field label="Tipo" hint="Define la etiqueta y el color en «Desde el territorio».">
        <select className={FORM_INPUT} {...bind('entity_type')} autoFocus>
          {TYPE_OPTIONS.map(([value, [label]]) => <option key={value} value={value}>{label}</option>)}
          {legacy && <option value={legacy}>{legacy} (sin etiqueta)</option>}
        </select>
      </Field>
      <Field label="Título *">
        <input className={FORM_INPUT} {...bind('titulo')} required maxLength={180} />
      </Field>
      <Field label="Descripción" className={FULL}>
        <textarea className={`${FORM_INPUT} min-h-[80px] resize-y leading-[1.55]`} {...bind('descripcion')} maxLength={2000} />
      </Field>
      <ImageField id={`${formId}-imagen`} label="Imagen" value={values.imagen_url} onChange={(value) => set('imagen_url', value)} scope="artist" scopeRef={artistId} />
      <Field label="Enlace" hint="«Conocer más»: https://... o una página de TEJIDO como /#agenda.">
        <input className={FORM_INPUT} inputMode="url" {...bind('url')} pattern={IMAGE_PATTERN} title="Un enlace que empiece por https:// o una ruta del sitio que empiece por /" maxLength={500} placeholder="https://" />
      </Field>
      <Field label="Orden" hint="Menor va primero.">
        <input type="number" min={0} step={1} className={FORM_INPUT} {...bind('orden')} />
      </Field>
    </InlineForm>
  );
}

function ConnectionRow({ connection, readOnly, onEdit, onDelete }) {
  const remove = useAction();
  const [label, color] = CONNECTION_TYPES[connection.entity_type] || [connection.entity_type, '#66746f'];
  return (
    <li className="flex items-center justify-between gap-4 border-b border-b-line py-4 last:border-b-0 max600:flex-col max600:items-stretch">
      <div className="flex min-w-0 items-center gap-4">
        {connection.imagen_url
          ? <img src={cdnImage(connection.imagen_url, { width: 160 })} alt="" loading="lazy" decoding="async" className="size-11 shrink-0 rounded-[10px] object-cover" />
          : <span className="size-11 shrink-0 rounded-[10px]" style={{ background: `${color}26` }} aria-hidden="true" />}
        <div className="min-w-0">
          <p className="m-0 flex flex-wrap items-center gap-2">
            <span className={TAG.grey}>{label}</span>
            <span className="text-[13px] text-muted">orden {connection.orden}</span>
          </p>
          <h3 className="mt-1 mb-0 font-sans text-[17px] font-bold text-ink">{connection.titulo}</h3>
          {connection.descripcion && <p className="mt-1 mb-0 line-clamp-2 text-[14px] leading-[1.5] text-[#53645c]">{connection.descripcion}</p>}
          {connection.url && <p className="mt-1 mb-0 text-[13px] text-muted [overflow-wrap:anywhere]">Enlace: {connection.url}</p>}
        </div>
      </div>
      {!readOnly && (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 max600:justify-start">
          <button type="button" className={BTN_GHOST} onClick={() => onEdit(connection)} disabled={remove.busy}><Icon name="pen" className="size-3.5" /> Editar</button>
          <ConfirmButton itemName={connection.titulo} busy={remove.busy} onConfirm={() => remove.run(() => onDelete(connection))} />
          <ErrorAlert className="w-full">{remove.error}</ErrorAlert>
        </div>
      )}
    </li>
  );
}

export default function ConexionesTab({ artist, connections, readOnly, onChanged }) {
  const { showToast } = useToast();
  const { editing, open, close } = useEditing('connection-form');
  const rows = sortByOrden(connections);

  async function handleDone(isEdit, values) {
    close();
    const titulo = values.titulo.trim();
    showToast(isEdit
      ? { tone: 'menta', eyebrow: 'Territorio', title: 'Conexión actualizada', text: `Guardamos los cambios de «${titulo}».` }
      : { tone: 'menta', eyebrow: 'Territorio', title: 'Conexión agregada', text: `«${titulo}» ya aparece en «Desde el territorio».` });
    await onChanged();
  }

  async function handleDelete(connection) {
    await adminArtistApi.connections.remove(artist.id, connection.id);
    showToast({ tone: 'menta', eyebrow: 'Territorio', title: 'Conexión eliminada', text: `«${connection.titulo}» ya no aparece en el perfil.` });
    await onChanged();
  }

  const nextOrden = rows.length ? Math.max(...rows.map((row) => row.orden)) + 1 : 1;
  const formFor = (connection) => <ConnectionForm key={connection?.id ?? 'nueva'} artistId={artist.id} connection={connection} nextOrden={nextOrden} onDone={handleDone} onCancel={close} />;

  return (
    <div>
      <SectionHeader title="Conexiones" count={rows.length} actionLabel="Agregar conexión" onAction={() => open('nueva')} showAction={!readOnly && editing !== 'nueva'} />
      {editing === 'nueva' && formFor(null)}
      {rows.length ? (
        <ul className="mt-4 mb-0 grid list-none gap-1 p-0">
          {rows.map((connection) => (editing === connection.id
            ? <li key={connection.id}>{formFor(connection)}</li>
            : <ConnectionRow key={connection.id} connection={connection} readOnly={readOnly} onEdit={(item) => open(item.id)} onDelete={handleDelete} />))}
        </ul>
      ) : editing !== 'nueva' && (
        <div className="mt-6"><EmptyNote icon="confluence" title="Aún no hay conexiones" text="Une al artista con colectivos, lugares, eventos e historias del Bajo Cauca: sin conexiones, la sección no aparece en el perfil." /></div>
      )}
    </div>
  );
}
