import { useState } from 'react';
import Icon from '../Icon.jsx';
import ShareMenu from '../ShareMenu.jsx';
import { cdnImage } from '../../utils/cloudinaryUrl.js';
import { CULTURAL_CATEGORIES } from '../../utils/constants.js';
import { getInitials } from '../../utils/initials.js';

// Cabecera del perfil de un gestor (#gestor/<slug>): portada ancha con degradado de lectura (o
// fondo tintado de la rama), foto, nombre, rama, insignia de lider, lema, municipio, trayectoria,
// compartir y el contacto principal visible.
const SLUG_BY_KEY = Object.fromEntries(CULTURAL_CATEGORIES.map(([key, , slug]) => [key, slug]));
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';
export const PRIMARY_LINK = `inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-ink px-4 text-[14px] font-bold text-white no-underline transition-colors duration-200 hover:bg-[color-mix(in_srgb,var(--ink)_85%,white)] ${FOCUS}`;

// Contacto principal del perfil: WhatsApp, si no correo, si no sitio web (solo los visibles).
export function primaryContact(contact) {
  if (contact?.whatsapp) return { href: `https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`, label: 'Escribir por WhatsApp', icon: 'send', external: true };
  if (contact?.public_email) return { href: `mailto:${contact.public_email}`, label: 'Escribir un correo', icon: 'send', external: false };
  if (contact?.website) return { href: contact.website, label: 'Visitar sitio web', icon: 'arrow-right', external: true };
  return null;
}

export function LeaderBadge({ branchLabel, small = false }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border border-[rgba(212,168,67,0.55)] bg-[rgba(212,168,67,0.18)] font-bold text-[#6b500f] ${small ? 'py-0.5 px-2 text-[11px]' : 'py-1 px-3 text-[13px]'}`}>
      <Icon name="seal" className={small ? 'size-3' : 'size-3.5'} />
      {branchLabel ? `Líder de ${branchLabel}` : 'Líder'}
    </span>
  );
}

// titleAs: etiqueta del nombre (h1 en la pagina publica; h2 dentro del editor del perfil).
export default function GestorHeader({ profile, titleAs: Title = 'h1' }) {
  const [coverFailed, setCoverFailed] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const branchSlug = SLUG_BY_KEY[profile.branch];
  const contact = primaryContact(profile.contact);
  const hasCover = profile.cover_url && !coverFailed;
  const facts = [
    profile.municipality && { icon: 'pin', text: profile.municipality },
    profile.years_active !== null && profile.years_active !== undefined && {
      icon: 'calendar',
      text: profile.years_active < 1 ? `Desde ${profile.founded_year}` : `${profile.years_active} ${profile.years_active === 1 ? 'año' : 'años'} de trayectoria`,
    },
  ].filter(Boolean);

  return (
    <header>
      <div className="relative h-[300px] overflow-hidden rounded-[32px] bg-[color-mix(in_srgb,var(--river)_16%,#f3ece0)] max800:h-[200px] max600:rounded-[24px]">
        {hasCover && (
          <>
            <img src={cdnImage(profile.cover_url, { width: 1600 })} alt="" className="absolute inset-0 size-full object-cover" onError={() => setCoverFailed(true)} />
            <span className="absolute inset-0 bg-[linear-gradient(to_top,rgba(12,36,30,.55)_0%,rgba(12,36,30,.08)_60%,transparent_100%)]" aria-hidden="true" />
          </>
        )}
      </div>

      {/* Solo la foto se monta sobre la portada; el nombre queda debajo, sobre el fondo claro. */}
      <div className="relative flex flex-wrap items-end gap-6 px-8 max600:gap-4 max600:px-4">
        <span className="-mt-16 grid size-32 shrink-0 place-items-center max600:-mt-12 overflow-hidden rounded-full border-4 border-paper bg-cream text-[36px] font-extrabold text-ink shadow-[0_8px_24px_rgba(12,36,30,.12)] max600:size-24 max600:text-[28px]" aria-hidden={!profile.photo_url || photoFailed}>
          {profile.photo_url && !photoFailed
            ? <img src={cdnImage(profile.photo_url, { width: 320, fit: 'fill', face: true })} alt={`Foto de ${profile.name}`} className="size-full object-cover" onError={() => setPhotoFailed(true)} />
            : getInitials(profile.name)}
        </span>
        <div className="min-w-0 flex-1 basis-[280px] pt-4 pb-1">
          <Title className="m-0 font-sans text-[length:clamp(32px,4.4vw,52px)] font-extrabold leading-[1.05] tracking-[-.04em] text-ink [overflow-wrap:anywhere]">{profile.name}</Title>
          <p className="mt-1.5 mb-0 text-[15px] text-[#53645c]">por <strong className="text-ink">{profile.gestor_name}</strong></p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 px-8 max600:px-4">
        <div className="flex flex-wrap items-center gap-2">
          {profile.branch_label && (branchSlug ? (
            <a href={`#categoria/${branchSlug}`} className={`inline-flex items-center rounded-full bg-[rgba(29,143,163,0.1)] py-1 px-3 text-[13px] font-bold text-[#146f80] no-underline hover:underline ${FOCUS}`}>{profile.branch_label}</a>
          ) : <span className="rounded-full bg-[rgba(29,143,163,0.1)] py-1 px-3 text-[13px] font-bold text-[#146f80]">{profile.branch_label}</span>)}
          {profile.is_leader && <LeaderBadge branchLabel={profile.branch_label} />}
        </div>
        {profile.tagline && <p className="font-display m-0 max-w-[760px] text-[length:clamp(19px,2.2vw,24px)] font-bold italic leading-[1.4] text-[#2d5a3d]">{profile.tagline}</p>}
        {facts.length > 0 && (
          <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-[14px] text-[#53645c]">
            {facts.map((fact) => <li key={fact.text} className="inline-flex items-center gap-1.5"><Icon name={fact.icon} className="size-4 text-muted" />{fact.text}</li>)}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-3">
          {contact && (
            <a className={PRIMARY_LINK} href={contact.href} {...(contact.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
              <Icon name={contact.icon} className="size-4" /> {contact.label}
            </a>
          )}
          <ShareMenu url={`${window.location.origin}/#gestor/${profile.slug}`} text={`${profile.name} - TEJIDO Bajo Cauca`} withLabels menuUp={false} menuAlign="left" />
        </div>
      </div>
    </header>
  );
}
