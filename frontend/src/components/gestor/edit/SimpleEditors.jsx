import { useState } from 'react';
import ImageField from '../../ImageField.jsx';
import { apiRequest } from '../../../utils/api.js';
import { LINK_PATTERN } from '../../../utils/urlPatterns.js';
import MultiImageField from './MultiImageField.jsx';
import { EditorShell, HINT, LIMITS, Switch, TextField, isBlank } from './common.jsx';
import useEditorForm from './useEditorForm.js';

// Editores de una sola llamada (PATCH /api/me/profile o PUT de la galeria). Todos reciben
// { profile, onSaved, onCancel, onDirtyChange }; profile es GET /api/me/profile (valores crudos).
const patchProfile = (body) => apiRequest('/api/me/profile', { method: 'PATCH', body });
const textOrNull = (value) => (isBlank(value) ? null : String(value).trim());
const THIS_YEAR = new Date().getFullYear();

export function HeaderEditor({ profile, onSaved, onCancel, onDirtyChange }) {
  const form = useEditorForm({
    name: profile.name || '', photo_url: profile.photo_url || '', cover_url: profile.cover_url || '',
    tagline: profile.tagline || '', municipality: profile.municipality || '',
    founded_year: profile.founded_year ? String(profile.founded_year) : '',
  }, { onDirtyChange, onSaved });
  const { values, set } = form;

  function submit() {
    if (isBlank(values.name)) { form.setError('El nombre de la organización es requerido.'); return; }
    const year = values.founded_year.trim();
    if (year && (!/^\d{4}$/.test(year) || Number(year) < 1900 || Number(year) > THIS_YEAR)) {
      form.setError(`El año de fundación debe estar entre 1900 y ${THIS_YEAR}.`);
      return;
    }
    form.save(() => patchProfile({
      name: values.name.trim(), photo_url: textOrNull(values.photo_url), cover_url: textOrNull(values.cover_url),
      tagline: textOrNull(values.tagline), municipality: textOrNull(values.municipality), founded_year: year ? Number(year) : null,
    }));
  }

  return (
    <EditorShell title="Cabecera" onSubmit={submit} onCancel={onCancel} saving={form.saving} error={form.error}>
      <div className="grid grid-cols-2 gap-5 max800:grid-cols-1">
        <TextField label="Nombre de la organización" value={values.name} onChange={set('name')} max={LIMITS.name} counter
          hint="Tu nombre personal se cambia más arriba en tu perfil." inputProps={{ required: true }} />
        <TextField label="Municipio" value={values.municipality} onChange={set('municipality')} max={LIMITS.municipality} hint="Por ejemplo: Caucasia." />
      </div>
      <TextField label="Lema" value={values.tagline} onChange={set('tagline')} max={LIMITS.tagline} counter hint="Una frase corta que diga qué los mueve." />
      <TextField label="Año de fundación" value={values.founded_year} onChange={set('founded_year')} type="text"
        hint={`Con él mostramos los años de trayectoria. Entre 1900 y ${THIS_YEAR}.`}
        inputProps={{ inputMode: 'numeric', pattern: '[0-9]{4}', maxLength: 4 }} />
      <div className="grid grid-cols-2 gap-5 max800:grid-cols-1">
        <ImageField label="Foto" value={values.photo_url} onChange={set('photo_url')} scope="organization" round disabled={form.saving}
          hint="Cuadrada, se ve en un círculo." />
        <ImageField label="Portada" value={values.cover_url} onChange={set('cover_url')} scope="organization" disabled={form.saving}
          hint="Horizontal, de 1600 × 600 px o más." />
      </div>
    </EditorShell>
  );
}

export function AboutEditor({ profile, onSaved, onCancel, onDirtyChange }) {
  const form = useEditorForm({ description: profile.description || '' }, { onDirtyChange, onSaved });
  return (
    <EditorShell title="Sobre nosotros" onSubmit={() => form.save(() => patchProfile({ description: textOrNull(form.values.description) }))}
      onCancel={onCancel} saving={form.saving} error={form.error}>
      <TextField label="Biografía" multiline rows={8} value={form.values.description} onChange={form.set('description')}
        max={LIMITS.description} counter hint="Quiénes son, qué hacen, desde cuándo y dónde los encuentran. Los saltos de línea se respetan." />
    </EditorShell>
  );
}

export function AchievementsEditor({ profile, onSaved, onCancel, onDirtyChange }) {
  const form = useEditorForm({ achievements: profile.achievements_text || '' }, { onDirtyChange, onSaved });
  return (
    <EditorShell title="Reconocimientos y alianzas" onSubmit={() => form.save(() => patchProfile({ achievements: textOrNull(form.values.achievements) }))}
      onCancel={onCancel} saving={form.saving} error={form.error}>
      <TextField label="Uno por línea" multiline rows={6} value={form.values.achievements} onChange={form.set('achievements')}
        max={LIMITS.achievements} counter
        hint="Ejemplo: “Premio departamental de gastronomía 2024” en una línea y “Alianza con la Casa de la Cultura” en la siguiente." />
    </EditorShell>
  );
}

export function SeekingEditor({ profile, onSaved, onCancel, onDirtyChange }) {
  const form = useEditorForm({ seeking_text: profile.seeking_text || '' }, { onDirtyChange, onSaved });
  return (
    <EditorShell title="A quién buscamos en tu rama" onSubmit={() => form.save(() => patchProfile({ seeking_text: textOrNull(form.values.seeking_text) }))}
      onCancel={onCancel} saving={form.saving} error={form.error}>
      <TextField label="Lo que buscamos" multiline rows={4} value={form.values.seeking_text} onChange={form.set('seeking_text')}
        max={LIMITS.seeking_text} counter hint="Cuéntale a la gente qué perfiles quieres sumar a tu rama. Solo lo ve quien visita el perfil de un líder." />
    </EditorShell>
  );
}

export function VenueEditor({ profile, onSaved, onCancel, onDirtyChange }) {
  const form = useEditorForm({
    has_venue: Boolean(profile.has_venue), address: profile.address || '', opening_hours: profile.opening_hours || '', map_url: profile.map_url || '',
  }, { onDirtyChange, onSaved });
  const { values, set } = form;

  function submit() {
    const map = values.map_url.trim();
    if (values.has_venue && map && !/^https:\/\/\S+$/i.test(map)) { form.setError('El enlace del mapa debe empezar por https://'); return; }
    form.save(() => patchProfile({
      has_venue: values.has_venue, address: textOrNull(values.address), opening_hours: textOrNull(values.opening_hours), map_url: textOrNull(map),
    }));
  }

  return (
    <EditorShell title="Dónde encontrarnos" onSubmit={submit} onCancel={onCancel} saving={form.saving} error={form.error}>
      <Switch checked={values.has_venue} onChange={set('has_venue')} label="Tengo un lugar físico"
        description="Si lo apagas, esta sección no aparece en tu perfil público (los datos se conservan)." />
      {values.has_venue && (
        <>
          <TextField label="Dirección" value={values.address} onChange={set('address')} max={LIMITS.address} counter />
          <TextField label="Horario" multiline rows={3} value={values.opening_hours} onChange={set('opening_hours')} max={LIMITS.opening_hours} counter
            hint="Ejemplo: Viernes y sábados de 5:00 p. m. a 11:00 p. m." />
          <TextField label="Enlace de Google Maps" value={values.map_url} onChange={set('map_url')} type="url"
            hint="En Google Maps busca tu lugar, toca “Compartir” y luego “Copiar vínculo”. Debe empezar por https://"
            inputProps={{ pattern: LINK_PATTERN, inputMode: 'url' }} />
        </>
      )}
    </EditorShell>
  );
}

export function GalleryEditor({ profile, onSaved, onCancel, onDirtyChange }) {
  const form = useEditorForm({ images: profile.gallery.map(({ url, alt_text, caption }) => ({ url, alt_text: alt_text || '', caption: caption || '' })) },
    { onDirtyChange, onSaved });
  const [busy, setBusy] = useState(false);
  const submit = () => form.save(() => apiRequest('/api/me/profile/gallery', {
    method: 'PUT',
    body: { images: form.values.images.map((image) => ({ url: image.url, alt_text: textOrNull(image.alt_text), caption: textOrNull(image.caption) })) },
  }));
  return (
    <EditorShell title="Galería" onSubmit={submit} onCancel={onCancel} saving={form.saving} error={form.error} busyText={busy ? 'Esperando las subidas...' : ''}>
      <MultiImageField label="Fotos de la galería" value={form.values.images} onChange={form.set('images')} max={LIMITS.gallery} withCaption onBusyChange={setBusy} />
      <p className={HINT}>Las fotos se publican al guardar. Si una subida falla, puedes guardar las demás.</p>
    </EditorShell>
  );
}
