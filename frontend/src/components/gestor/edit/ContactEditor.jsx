import { useState } from 'react';
import { BTN_GHOST, BTN_INK_SM, BTN_QUIET_SM, FORM_INPUT } from '../../uiStyles.js';
import { apiRequest } from '../../../utils/api.js';
import { LINK_PATTERN } from '../../../utils/urlPatterns.js';
import { EditorShell, HINT, LIMITS, SOCIAL_PLATFORMS, Switch, TextField, WHATSAPP_OK, isBlank, normalizeWhatsapp } from './common.jsx';
import useEditorForm from './useEditorForm.js';

// Contacto y redes. Cada dato publico (WhatsApp, correo, sitio web) tiene su interruptor "Mostrar
// en mi perfil", apagado por defecto: al escribir uno nuevo se ofrece encenderlo. El contacto para
// el equipo (organizations.contact) es privado y va por PATCH /api/me/organization como siempre.
// Guardar hace tres llamadas en orden; si una falla se dice cual y el formulario sigue abierto.
const FIELDS = [
  ['whatsapp', 'show_whatsapp', 'WhatsApp'],
  ['public_email', 'show_public_email', 'Correo público'],
  ['website', 'show_website', 'Sitio web'],
];
const EMAIL_OK = (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
const HTTPS_OK = (value) => !value || /^https:\/\/\S+$/i.test(value.trim());
const orNull = (value) => (isBlank(value) ? null : String(value).trim());

function OfferToShow({ label, onAccept, onDismiss }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[12px] bg-[rgba(212,168,67,0.12)] py-2 px-3 text-[13px] text-[#5f4a10]" role="status">
      <span>¿Mostrar tu {label.toLowerCase()} en tu perfil? Lo podrá ver cualquier persona.</span>
      <button type="button" className={BTN_INK_SM} onClick={onAccept}>Sí, mostrarlo</button>
      <button type="button" className={BTN_QUIET_SM} onClick={onDismiss}>Ahora no</button>
    </div>
  );
}

function SocialLinksList({ links, onChange }) {
  const update = (index, changes) => onChange(links.map((link, i) => (i === index ? { ...link, ...changes } : link)));
  const move = (index, delta) => {
    const next = [...links];
    const [link] = next.splice(index, 1);
    next.splice(index + delta, 0, link);
    onChange(next);
  };
  return (
    <fieldset className="m-0 grid gap-3 border-0 p-0">
      <legend className="mb-1.5 p-0 text-[12px] font-bold uppercase tracking-[.12em] text-muted">Redes ({links.length} de {LIMITS.socialLinks})</legend>
      {links.length === 0 && <p className={HINT}>Aún no agregas redes.</p>}
      <ol className="m-0 grid list-none gap-3 p-0">
        {links.map((link, index) => (
          <li key={link.key} className="grid gap-3 rounded-[16px] border border-line bg-paper p-3">
            <div className="grid grid-cols-[180px_minmax(0,1fr)] gap-3 max600:grid-cols-1">
              <label className="grid gap-1 text-[12px] font-bold uppercase tracking-[.1em] text-muted">
                Red
                <select className={FORM_INPUT} value={link.platform} onChange={(event) => update(index, { platform: event.target.value })}>
                  {SOCIAL_PLATFORMS.map(([value, name]) => <option key={value} value={value}>{name}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-[12px] font-bold uppercase tracking-[.1em] text-muted">
                Enlace (https://)
                <input className={FORM_INPUT} value={link.url} onChange={(event) => update(index, { url: event.target.value })}
                  type="url" inputMode="url" pattern={LINK_PATTERN} placeholder="https://instagram.com/tu-cuenta" />
              </label>
            </div>
            {link.platform === 'otro' && (
              <label className="grid gap-1 text-[12px] font-bold uppercase tracking-[.1em] text-muted">
                Nombre que se muestra
                <input className={FORM_INPUT} value={link.label || ''} maxLength={LIMITS.socialLabel} onChange={(event) => update(index, { label: event.target.value })} placeholder="Ejemplo: Bandcamp" />
              </label>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" className={BTN_QUIET_SM} disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Subir la red ${index + 1}`}>↑ Subir</button>
              <button type="button" className={BTN_QUIET_SM} disabled={index === links.length - 1} onClick={() => move(index, 1)} aria-label={`Bajar la red ${index + 1}`}>↓ Bajar</button>
              <button type="button" className={BTN_GHOST} onClick={() => onChange(links.filter((_, i) => i !== index))} aria-label={`Quitar la red ${index + 1}`}>Quitar</button>
            </div>
          </li>
        ))}
      </ol>
      <div>
        <button type="button" className={`${BTN_GHOST} max480:w-full`} disabled={links.length >= LIMITS.socialLinks}
          onClick={() => onChange([...links, { key: `n${Date.now()}`, platform: 'instagram', url: '', label: '' }])}>
          {links.length >= LIMITS.socialLinks ? `Llegaste al máximo de ${LIMITS.socialLinks} redes` : '+ Agregar red'}
        </button>
      </div>
    </fieldset>
  );
}

function validate(values) {
  if (!WHATSAPP_OK(values.whatsapp)) return 'El WhatsApp debe tener solo números (y un + al inicio si quieres), entre 7 y 19 dígitos.';
  if (!EMAIL_OK(values.public_email)) return 'Escribe un correo público válido.';
  if (!HTTPS_OK(values.website)) return 'El sitio web debe empezar por https://';
  for (const [index, link] of values.links.entries()) {
    if (!HTTPS_OK(link.url) || isBlank(link.url)) return `La red ${index + 1} necesita un enlace que empiece por https://`;
  }
  return '';
}

export default function ContactEditor({ profile, privateContact, onSaved, onCancel, onDirtyChange }) {
  const form = useEditorForm({
    whatsapp: profile.whatsapp || '', public_email: profile.public_email || '', website: profile.website || '',
    show_whatsapp: profile.show_whatsapp, show_public_email: profile.show_public_email, show_website: profile.show_website,
    contact: privateContact || '',
    links: profile.social_links.map((link, i) => ({ key: `s${i}`, platform: link.platform, url: link.url, label: link.label || '' })),
  }, { onDirtyChange, onSaved });
  const { values, set } = form;
  const [dismissed, setDismissed] = useState({});
  const startedEmpty = { whatsapp: !profile.whatsapp, public_email: !profile.public_email, website: !profile.website };

  async function persist() {
    const done = [];
    const step = async (name, call) => {
      try {
        await call();
        done.push(name);
      } catch (error) {
        throw new Error(done.length
          ? `Se guardó ${done.join(' y ')}, pero no ${name}: ${error.message}`
          : `No se guardó ${name}: ${error.message}`);
      }
    };
    await step('el contacto público', () => apiRequest('/api/me/profile', { method: 'PATCH', body: {
      whatsapp: orNull(values.whatsapp), public_email: orNull(values.public_email), website: orNull(values.website),
      show_whatsapp: values.show_whatsapp, show_public_email: values.show_public_email, show_website: values.show_website,
    } }));
    await step('el contacto para el equipo', () => apiRequest('/api/me/organization', { method: 'PATCH', body: { contact: orNull(values.contact) } }));
    await step('las redes', () => apiRequest('/api/me/profile/social-links', { method: 'PUT', body: {
      links: values.links.map((link) => ({ platform: link.platform, url: link.url.trim(), label: link.platform === 'otro' ? orNull(link.label) : null })),
    } }));
  }

  function submit() {
    const problem = validate(values);
    if (problem) { form.setError(problem); return; }
    form.save(persist);
  }

  return (
    <EditorShell title="Contacto y redes" onSubmit={submit} onCancel={onCancel} saving={form.saving} error={form.error}>
      {FIELDS.map(([field, showKey, label]) => {
        const offer = startedEmpty[field] && !isBlank(values[field]) && !values[showKey] && !dismissed[field];
        return (
          <div key={field} className="grid gap-3 rounded-[16px] border border-line bg-paper p-4">
            <TextField label={label} value={values[field]} onChange={set(field)}
              max={field === 'whatsapp' ? undefined : field === 'public_email' ? LIMITS.public_email : undefined}
              type={field === 'public_email' ? 'email' : field === 'website' ? 'url' : 'tel'}
              hint={field === 'whatsapp'
                ? (values.whatsapp ? `Se guarda así: ${normalizeWhatsapp(values.whatsapp)}` : 'Con indicativo si quieres, por ejemplo +57 300 123 4567.')
                : field === 'website' ? 'Debe empezar por https://' : undefined}
              inputProps={field === 'website' ? { pattern: LINK_PATTERN, inputMode: 'url' } : {}} />
            <Switch checked={values[showKey]} onChange={set(showKey)} label="Mostrar en mi perfil"
              description={values[showKey] ? 'Visible para cualquier persona.' : 'Oculto: solo tú lo ves aquí.'} />
            {offer && <OfferToShow label={label} onAccept={() => set(showKey)(true)} onDismiss={() => setDismissed((d) => ({ ...d, [field]: true }))} />}
          </div>
        );
      })}
      <SocialLinksList links={values.links} onChange={set('links')} />
      <TextField label="Contacto para el equipo" value={values.contact} onChange={set('contact')} max={LIMITS.contact} counter
        hint="Solo lo ve el equipo de TEJIDO, no se publica." />
    </EditorShell>
  );
}
