import EmptyNote from '../../EmptyNote.jsx';
import ImageField from '../../ImageField.jsx';
import Icon from '../../Icon.jsx';
import { BTN_GHOST, FORM_INPUT } from '../../uiStyles.js';
import { useToast } from '../../../context/ToastContext.jsx';
import { adminArtistApi } from '../../../services/artistApi.js';
import { ConfirmButton, ErrorAlert, Field, FULL, HELP, InlineForm, LINK_PATTERN, SectionHeader, TAG, buildPayload, useAction, useEditing, useFormValues } from './common.jsx';
import { cdnImage } from '../../../utils/cloudinaryUrl.js';

// Pestana "Musica" (tabla tracks): POST/PUT/DELETE /api/artists/{id}/tracks[/{track_id}].
// El perfil publico solo muestra las publicadas, con la destacada (una por artista) primero y en
// "Escuchar ahora"; marcar una desmarca las demas (lo hace el backend en la misma transaccion).

const ALBUM_TYPES = ['Single', 'EP', 'Álbum', 'Set', 'Mix'];
// Mismo formato que DURATION_RE de backend/service/schemas/artists.py.
const DURATION_PATTERN = String.raw`\d{1,3}:[0-5]\d|\d{1,2}:[0-5]\d:[0-5]\d`;
const LINKS = [
  ['spotify_url', 'Spotify'],
  ['youtube_url', 'YouTube'],
  ['apple_music_url', 'Apple Music'],
  ['amazon_music_url', 'Amazon Music'],
];
const EMPTY = {
  title: '', album: '', genre: '', duration: '', release_date: '', description: '', cover_image: '',
  spotify_url: '', youtube_url: '', apple_music_url: '', amazon_music_url: '', status: 'published', featured: false,
};

const valuesFrom = (track) => (track ? Object.fromEntries(Object.entries(EMPTY).map(([key, empty]) => [key, track[key] ?? empty])) : EMPTY);

function TrackForm({ artistId, track, otherFeatured, onDone, onCancel }) {
  const isEdit = Boolean(track);
  const form = useFormValues(valuesFrom(track));
  const { values, bind, set } = form;
  const save = useAction();
  const formId = `track-form-${track?.id ?? 'nueva'}`;

  async function handleSubmit() {
    const body = buildPayload(form, isEdit, { dates: ['release_date'] });
    if (isEdit && Object.keys(body).length === 0) {
      save.setError('No hay cambios para guardar.');
      return;
    }
    const ok = await save.run(() => (isEdit
      ? adminArtistApi.tracks.update(artistId, track.id, body)
      : adminArtistApi.tracks.create(artistId, body)));
    if (ok) await onDone(isEdit, values);
  }

  return (
    <InlineForm id={formId} title={isEdit ? `Editar «${track.title}»` : 'Nueva canción'} onSubmit={handleSubmit} onCancel={onCancel} busy={save.busy} error={save.error} submitLabel={isEdit ? 'Guardar cambios' : 'Agregar canción'}>
      <Field label="Título *">
        <input className={FORM_INPUT} {...bind('title')} required maxLength={180} autoFocus />
      </Field>
      <Field label="Tipo" hint="Single, EP, Álbum, Set, Mix... o escribe otro.">
        <input className={FORM_INPUT} {...bind('album')} maxLength={120} list={`${formId}-tipos`} />
        <datalist id={`${formId}-tipos`}>{ALBUM_TYPES.map((type) => <option key={type} value={type} />)}</datalist>
      </Field>
      <Field label="Género">
        <input className={FORM_INPUT} {...bind('genre')} maxLength={120} placeholder="House" />
      </Field>
      <Field label="Duración" hint="mm:ss o h:mm:ss, por ejemplo 3:40 o 1:05:30.">
        <input className={FORM_INPUT} {...bind('duration')} pattern={DURATION_PATTERN} title="Formato mm:ss o h:mm:ss (por ejemplo 3:40)" maxLength={10} placeholder="3:40" />
      </Field>
      <Field label="Fecha de lanzamiento">
        <input type="date" className={FORM_INPUT} {...bind('release_date')} />
      </Field>
      <Field label="Estado" hint="Un borrador no se ve en el perfil público.">
        <select className={FORM_INPUT} {...bind('status')}>
          <option value="published">Publicada</option>
          <option value="draft">Borrador</option>
        </select>
      </Field>
      <Field label="Descripción" className={FULL}>
        <textarea className={`${FORM_INPUT} min-h-[90px] resize-y leading-[1.55]`} {...bind('description')} maxLength={2000} />
      </Field>
      <ImageField id={`${formId}-portada`} label="Portada" value={values.cover_image} onChange={(value) => set('cover_image', value)} scope="artist" scopeRef={artistId} className={FULL} />
      {LINKS.map(([key, label]) => (
        <Field key={key} label={label}>
          <input type="url" className={FORM_INPUT} {...bind(key)} pattern={LINK_PATTERN} title="Un enlace que empiece por https://" maxLength={500} placeholder="https://" />
        </Field>
      ))}
      <p className={`${HELP} ${FULL}`}>Sin ningún enlace, la canción aparece en el perfil como «Próximamente».</p>
      <div className={`${FULL} grid gap-1.5`}>
        <label className="flex cursor-pointer items-center gap-3 text-[15px] font-semibold text-ink">
          <input type="checkbox" className="size-5 cursor-pointer accent-ink" checked={values.featured} onChange={(event) => set('featured', event.target.checked)} />
          Canción destacada
        </label>
        <p className={HELP} role={values.featured && otherFeatured ? 'status' : undefined}>
          {values.featured && otherFeatured
            ? <>Al guardar, <strong className="text-ink">«{otherFeatured.title}»</strong> deja de ser la destacada: el perfil muestra solo una.</>
            : 'Solo una por artista: va primero en la discografía y en el botón «Escuchar ahora» del perfil.'}
        </p>
      </div>
    </InlineForm>
  );
}

function TrackRow({ track, readOnly, onEdit, onDelete }) {
  const remove = useAction();
  const year = track.release_date ? String(track.release_date).slice(0, 4) : '';
  const meta = [track.album, track.duration, year].filter(Boolean).join(' · ');
  const links = LINKS.filter(([key]) => track[key]).map(([, label]) => label);
  return (
    <li className="flex items-center justify-between gap-4 border-b border-b-line py-4 last:border-b-0 max600:flex-col max600:items-stretch">
      <div className="flex min-w-0 items-center gap-4">
        {track.cover_image
          ? <img src={cdnImage(track.cover_image, { width: 160 })} alt="" loading="lazy" decoding="async" className="size-12 shrink-0 rounded-[10px] object-cover" />
          : <span className="flex size-12 shrink-0 items-center justify-center rounded-[10px] bg-[rgba(29,143,163,0.14)] text-[#146f80]" aria-hidden="true"><Icon name="music" className="size-5" /></span>}
        <div className="min-w-0">
          <h3 className="m-0 flex flex-wrap items-center gap-2 font-sans text-[17px] font-bold leading-[1.25] text-ink">
            {track.title}
            {track.featured && <span className={TAG.gold}>Destacada</span>}
            {track.status === 'draft' && <span className={TAG.grey}>Borrador</span>}
          </h3>
          {meta && <p className="mt-1 mb-0 text-[14px] text-[#53645c]">{meta}</p>}
          <p className="mt-0.5 mb-0 text-[13px] text-muted">{links.length ? links.join(' · ') : 'Sin enlaces: en el perfil se ve «Próximamente»'}</p>
        </div>
      </div>
      {!readOnly && (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 max600:justify-start">
          <button type="button" className={BTN_GHOST} onClick={() => onEdit(track)} disabled={remove.busy}><Icon name="pen" className="size-3.5" /> Editar</button>
          <ConfirmButton itemName={track.title} busy={remove.busy} onConfirm={() => remove.run(() => onDelete(track))} />
          <ErrorAlert className="w-full">{remove.error}</ErrorAlert>
        </div>
      )}
    </li>
  );
}

export default function MusicaTab({ artist, tracks, readOnly, onChanged }) {
  const { showToast } = useToast();
  const { editing, open, close } = useEditing('track-form');

  async function handleDone(isEdit, values) {
    const title = values.title.trim();
    close();
    showToast(isEdit
      ? { tone: 'menta', eyebrow: 'Discografía', title: 'Canción actualizada', text: `Guardamos los cambios de «${title}».` }
      : { tone: 'menta', eyebrow: 'Discografía', title: 'Canción agregada', text: values.status === 'draft' ? `«${title}» quedó como borrador: aún no se ve en el perfil.` : `«${title}» ya suena en el perfil de ${artist.stage_name}.` });
    await onChanged();
  }

  async function handleDelete(track) {
    await adminArtistApi.tracks.remove(artist.id, track.id);
    showToast({ tone: 'menta', eyebrow: 'Discografía', title: 'Canción eliminada', text: `«${track.title}» ya no está en la discografía.` });
    await onChanged();
  }

  const featured = tracks.find((track) => track.featured);
  const formFor = (track) => (
    <TrackForm
      artistId={artist.id}
      track={track}
      otherFeatured={featured && featured.id !== track?.id ? featured : null}
      onDone={handleDone}
      onCancel={close}
    />
  );

  return (
    <div>
      <SectionHeader title="Música" count={tracks.length} actionLabel="Agregar canción" onAction={() => open('nueva')} showAction={!readOnly && editing !== 'nueva'} />
      {editing === 'nueva' && formFor(null)}
      {tracks.length ? (
        <ul className="mt-4 mb-0 grid list-none gap-1 p-0">
          {tracks.map((track) => (editing === track.id
            ? <li key={track.id}>{formFor(track)}</li>
            : <TrackRow key={track.id} track={track} readOnly={readOnly} onEdit={(item) => open(item.id)} onDelete={handleDelete} />))}
        </ul>
      ) : editing !== 'nueva' && (
        <div className="mt-6"><EmptyNote icon="music" title="Aún no hay canciones" text="Sin canciones, el perfil muestra «Próximamente habrá música aquí». Agrega la primera." /></div>
      )}
    </div>
  );
}
