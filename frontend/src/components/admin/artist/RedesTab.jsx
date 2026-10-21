import EmptyNote from '../../EmptyNote.jsx';
import Icon from '../../Icon.jsx';
import { BTN_GHOST, FORM_INPUT } from '../../uiStyles.js';
import { useToast } from '../../../context/ToastContext.jsx';
import { adminArtistApi } from '../../../services/artistApi.js';
import { SOCIAL_PLATFORMS } from '../../../utils/artistOptions.js';
import {
  ConfirmButton, ErrorAlert, Field, InlineForm, LINK_PATTERN, SectionHeader, TAG, buildPayload, sortByOrden, useAction, useEditing, useFormValues,
} from './common.jsx';

// Pestana "Redes" (tabla artist_social_links): POST/PUT/DELETE /api/artists/{id}/social[/{link_id}].
// La cabecera del perfil pinta el icono de la plataforma y el usuario (o el nombre de la red); el
// Media Kit, plataforma y usuario en texto. `icon` se guarda igual a la plataforma: no se pide.

const PLATFORM_LABELS = Object.fromEntries(SOCIAL_PLATFORMS);
const ICONS = new Set(['spotify', 'youtube', 'instagram']); // los que tiene components/Icon.jsx

function valuesFrom(link, nextOrden) {
  if (!link) return { platform: SOCIAL_PLATFORMS[0][0], url: '', username: '', orden: String(nextOrden) };
  return { platform: link.platform, url: link.url, username: link.username ?? '', orden: String(link.orden) };
}

function SocialForm({ artistId, link, nextOrden, onDone, onCancel }) {
  const isEdit = Boolean(link);
  const form = useFormValues(valuesFrom(link, nextOrden));
  const { values, bind } = form;
  const save = useAction();
  const formId = `social-form-${link?.id ?? 'nueva'}`;
  // Una red guardada con una plataforma sin icono (de antes del editor) sigue disponible en el selector.
  const legacy = link && !PLATFORM_LABELS[link.platform] ? link.platform : null;

  async function handleSubmit() {
    const body = buildPayload(form, isEdit, { numbers: ['orden'] });
    if (body.platform) body.icon = body.platform;
    if (isEdit && Object.keys(body).length === 0) {
      save.setError('No hay cambios para guardar.');
      return;
    }
    const ok = await save.run(() => (isEdit
      ? adminArtistApi.social.update(artistId, link.id, body)
      : adminArtistApi.social.create(artistId, body)));
    if (ok) await onDone(isEdit, values);
  }

  return (
    <InlineForm id={formId} title={isEdit ? `Editar ${PLATFORM_LABELS[link.platform] || link.platform}` : 'Nueva red'} onSubmit={handleSubmit} onCancel={onCancel} busy={save.busy} error={save.error} submitLabel={isEdit ? 'Guardar cambios' : 'Agregar red'}>
      <Field label="Plataforma" hint="Solo las que tienen icono en el perfil.">
        <select className={FORM_INPUT} {...bind('platform')} autoFocus>
          {SOCIAL_PLATFORMS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          {legacy && <option value={legacy}>{legacy} (sin icono)</option>}
        </select>
      </Field>
      <Field label="URL *" hint="La página del artista en esa red, empezando por https://.">
        <input type="url" className={FORM_INPUT} {...bind('url')} required pattern={LINK_PATTERN} title="Un enlace que empiece por https://" maxLength={500} placeholder="https://www.instagram.com/..." />
      </Field>
      <Field label="Usuario visible" hint="Lo que se lee junto al icono, por ejemplo @djapolo.">
        <input className={FORM_INPUT} {...bind('username')} maxLength={120} placeholder="@usuario" />
      </Field>
      <Field label="Orden" hint="Menor va primero.">
        <input type="number" min={0} step={1} className={FORM_INPUT} {...bind('orden')} />
      </Field>
    </InlineForm>
  );
}

function SocialRow({ link, readOnly, onEdit, onDelete }) {
  const remove = useAction();
  const label = PLATFORM_LABELS[link.platform] || link.platform;
  return (
    <li className="flex items-center justify-between gap-4 border-b border-b-line py-4 last:border-b-0 max600:flex-col max600:items-stretch">
      <div className="flex min-w-0 items-center gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[rgba(29,143,163,0.14)] text-[#146f80]" aria-hidden="true">
          {ICONS.has(link.platform) ? <Icon name={link.platform} className="size-5" /> : <span className="text-[16px] font-extrabold">{label.charAt(0).toUpperCase()}</span>}
        </span>
        <div className="min-w-0">
          <h3 className="m-0 flex flex-wrap items-center gap-2 font-sans text-[17px] font-bold text-ink">
            {label} {link.username && <span className="text-[15px] font-semibold text-[#53645c]">{link.username}</span>}
            {!PLATFORM_LABELS[link.platform] && <span className={TAG.grey}>Sin icono</span>}
          </h3>
          <p className="mt-1 mb-0 text-[13px] text-muted [overflow-wrap:anywhere]">{link.url} · orden {link.orden}</p>
        </div>
      </div>
      {!readOnly && (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 max600:justify-start">
          <button type="button" className={BTN_GHOST} onClick={() => onEdit(link)} disabled={remove.busy}><Icon name="pen" className="size-3.5" /> Editar</button>
          <ConfirmButton itemName={label} busy={remove.busy} onConfirm={() => remove.run(() => onDelete(link))} />
          <ErrorAlert className="w-full">{remove.error}</ErrorAlert>
        </div>
      )}
    </li>
  );
}

export default function RedesTab({ artist, socialLinks, readOnly, onChanged }) {
  const { showToast } = useToast();
  const { editing, open, close } = useEditing('social-form');
  const links = sortByOrden(socialLinks);

  async function handleDone(isEdit, values) {
    close();
    const label = PLATFORM_LABELS[values.platform] || values.platform;
    showToast(isEdit
      ? { tone: 'menta', eyebrow: 'Redes', title: 'Red actualizada', text: `Guardamos los cambios de ${label}.` }
      : { tone: 'menta', eyebrow: 'Redes', title: 'Red agregada', text: `${label} ya aparece en el perfil de ${artist.stage_name}.` });
    await onChanged();
  }

  async function handleDelete(link) {
    await adminArtistApi.social.remove(artist.id, link.id);
    showToast({ tone: 'menta', eyebrow: 'Redes', title: 'Red eliminada', text: `${PLATFORM_LABELS[link.platform] || link.platform} ya no aparece en el perfil.` });
    await onChanged();
  }

  const nextOrden = links.length ? Math.max(...links.map((link) => link.orden)) + 1 : 1;
  const formFor = (link) => <SocialForm key={link?.id ?? 'nueva'} artistId={artist.id} link={link} nextOrden={nextOrden} onDone={handleDone} onCancel={close} />;

  return (
    <div>
      <SectionHeader title="Redes" count={links.length} actionLabel="Agregar red" onAction={() => open('nueva')} showAction={!readOnly && editing !== 'nueva'} />
      {editing === 'nueva' && formFor(null)}
      {links.length ? (
        <ul className="mt-4 mb-0 grid list-none gap-1 p-0">
          {links.map((link) => (editing === link.id
            ? <li key={link.id}>{formFor(link)}</li>
            : <SocialRow key={link.id} link={link} readOnly={readOnly} onEdit={(item) => open(item.id)} onDelete={handleDelete} />))}
        </ul>
      ) : editing !== 'nueva' && (
        <div className="mt-6"><EmptyNote icon="share" title="Aún no hay redes" text="Agrega Spotify, YouTube, Instagram o TikTok: se verán con su icono en el perfil." /></div>
      )}
    </div>
  );
}
