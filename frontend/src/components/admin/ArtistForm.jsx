import { useState } from 'react';
import ImageField from '../ImageField.jsx';
import { FORM_INPUT, FORM_LABEL } from '../uiStyles.js';
import { adminArtistApi } from '../../services/artistApi.js';
import { FULL, HELP, InlineForm, buildPayload, useFormValues } from './artist/common.jsx';

// Datos basicos de un artista: alta (ArtistasPanel, artist = null) y pestana "Datos" del editor.
// POST /api/artists al crear; PUT /api/artists/{id} solo con lo que cambio. Los campos siguen
// ArtistCreateInput / ArtistUpdateInput (backend/service/schemas/artists.py). readOnly: artista
// archivado (se ve, no se edita).

const MAX_BIO = 5000;
const FIELDS = ['stage_name', 'real_name', 'genre', 'city', 'region', 'slug', 'image', 'hero_image', 'bio'];

function initialValues(artist) {
  if (!artist) {
    return { stage_name: '', real_name: '', genre: '', city: 'Caucasia', region: 'Bajo Cauca, Antioquia', slug: '', image: '', hero_image: '', bio: '', featured: false };
  }
  return { ...Object.fromEntries(FIELDS.map((field) => [field, artist[field] ?? ''])), featured: Boolean(artist.featured) };
}

// Vista aproximada del slug que generara el backend (services/artists.py::slugify).
function slugPreview(text) {
  return text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export default function ArtistForm({ artist, onSaved, onCancel, readOnly = false }) {
  const isEdit = Boolean(artist);
  const form = useFormValues(initialValues(artist));
  const { values, initialValues: initial, bind, set } = form;
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const disabled = saving || readOnly;

  async function handleSubmit() {
    setError('');
    const body = buildPayload(form, isEdit);
    if (isEdit && Object.keys(body).length === 0) {
      setError('No hay cambios para guardar.');
      return;
    }
    setSaving(true);
    try {
      const result = isEdit ? await adminArtistApi.update(artist.id, body) : await adminArtistApi.create(body);
      setSaving(false);
      onSaved({ id: isEdit ? artist.id : result.id, slug: result.slug ?? body.slug ?? artist.slug, stage_name: values.stage_name.trim() });
    } catch (saveError) {
      setError(saveError.message);
      setSaving(false);
    }
  }

  const preview = values.slug.trim() || slugPreview(values.stage_name) || 'nombre-del-artista';
  const id = (name) => `artist-form-${name}`;

  const fields = (
    <>
      <label className={FORM_LABEL}>Nombre artístico *
        <input className={FORM_INPUT} {...bind('stage_name')} required minLength={2} maxLength={120} disabled={disabled} autoFocus={!isEdit} />
      </label>
      <label className={FORM_LABEL}>Nombre real
        <input className={FORM_INPUT} {...bind('real_name')} maxLength={120} disabled={disabled} />
      </label>
      <label className={FORM_LABEL}>Género
        <input className={FORM_INPUT} {...bind('genre')} maxLength={120} placeholder="DJ / Electrónica / House" disabled={disabled} />
      </label>
      <label className={FORM_LABEL}>Ciudad
        <input className={FORM_INPUT} {...bind('city')} maxLength={120} disabled={disabled} />
      </label>
      <label className={FORM_LABEL}>Región
        <input className={FORM_INPUT} {...bind('region')} maxLength={120} disabled={disabled} />
      </label>

      <div className="grid gap-1.5">
        <label className={FORM_LABEL} htmlFor={id('slug')}>Slug {isEdit ? '*' : '(opcional)'}</label>
        <input id={id('slug')} className={FORM_INPUT} {...bind('slug')} required={isEdit} maxLength={80} placeholder={isEdit ? undefined : preview} aria-describedby={id('slug-ayuda')} disabled={disabled} />
        <p id={id('slug-ayuda')} className={HELP}>
          {isEdit
            ? <>Cambiarlo cambia la dirección <strong className="text-ink">/artistas/{initial.slug}</strong>: los enlaces que ya se compartieron dejarán de funcionar.</>
            : <>Se genera del nombre artístico; la URL será <strong className="text-ink">/artistas/{preview}</strong>.</>}
        </p>
      </div>

      <ImageField id={id('image')} label="Imagen de perfil" value={values.image} onChange={(value) => set('image', value)} scope="artist" scopeRef={artist?.id} disabled={disabled} />
      <ImageField id={id('hero')} label="Imagen de portada" value={values.hero_image} onChange={(value) => set('hero_image', value)} scope="artist" scopeRef={artist?.id} disabled={disabled} />

      <div className={`${FULL} grid gap-1.5`}>
        <label className={FORM_LABEL} htmlFor={id('bio')}>Biografía</label>
        <textarea id={id('bio')} className={`${FORM_INPUT} min-h-[140px] resize-y leading-[1.55]`} {...bind('bio')} maxLength={MAX_BIO} aria-describedby={id('bio-contador')} disabled={disabled} />
        <p id={id('bio-contador')} className="m-0 text-right text-[12px] text-muted">{values.bio.length} / {MAX_BIO}</p>
      </div>

      <label className={`${FULL} flex cursor-pointer items-center gap-3 text-[15px] font-semibold text-ink`}>
        <input type="checkbox" className="size-5 cursor-pointer accent-ink" checked={values.featured} onChange={(event) => set('featured', event.target.checked)} disabled={disabled} />
        Destacado en Moneystack
      </label>
    </>
  );

  if (readOnly) {
    return <div className="mt-6 grid grid-cols-[1fr_1fr] gap-4 rounded-[20px] border border-line bg-white/60 p-5 max600:grid-cols-[1fr]">{fields}</div>;
  }
  return (
    <InlineForm
      title={isEdit ? 'Datos del artista' : 'Nuevo artista'}
      onSubmit={handleSubmit}
      onCancel={onCancel}
      busy={saving}
      error={error}
      submitLabel={isEdit ? 'Guardar cambios' : 'Crear artista'}
    >
      {fields}
    </InlineForm>
  );
}
