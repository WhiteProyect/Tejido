import { useState } from 'react';
import Icon from '../Icon.jsx';
import { BTN_INK_OUTLINE_MD } from '../uiStyles.js';
import { cdnImage } from '../../utils/cloudinaryUrl.js';
import { KIND_COLORS, KIND_LABELS } from '../../utils/constants.js';
import { formatDateShort } from '../../utils/dateUtils.js';
import { getInitials } from '../../utils/initials.js';

// Secciones del perfil del gestor (GestorProfileScreen). Cada una la decide la pantalla: si no
// tiene contenido, no se pinta. onOpen(photos, index) abre la vista ampliada compartida.
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';
const TEXT = 'text-[16px] leading-[1.7] text-[#3f514a]';
const LINK = `font-bold text-river no-underline [overflow-wrap:anywhere] hover:underline ${FOCUS}`;
const SOCIAL_ICONS = { instagram: 'instagram', youtube: 'youtube', spotify: 'spotify' };
const SOCIAL_NAMES = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', youtube: 'YouTube', spotify: 'Spotify', x: 'X', linkedin: 'LinkedIn', otro: 'Enlace' };

const isRealImage = (url) => Boolean(url) && !url.startsWith('linear-gradient(');
export const toPhotos = (images, fallbackAlt) => images.map((image) => ({ url: image.url, alt: image.alt_text || fallbackAlt, caption: image.caption || '' }));

export function Section({ id, title, children }) {
  return (
    <section aria-labelledby={id} className="border-t border-t-line pt-10 max600:pt-8">
      <h2 id={id} className="m-0 mb-5 font-sans text-[26px] font-extrabold tracking-[-0.03em] text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Thumb({ photo, label, onClick, size = 'md' }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className={`block w-full cursor-zoom-in overflow-hidden rounded-[16px] border-0 bg-[#f3ece0] p-0 ${FOCUS}`}>
      <img src={cdnImage(photo.url, { width: size === 'lg' ? 640 : 320, fit: 'fill' })} alt={photo.alt} loading="lazy"
        className="block aspect-square w-full object-cover transition-[scale] duration-300 motion-safe:hover:scale-[1.04]" />
    </button>
  );
}

export function AboutSection({ description }) {
  return (
    <Section id="gestor-sobre" title="Sobre nosotros">
      <p className={`m-0 max-w-[760px] whitespace-pre-line ${TEXT} [overflow-wrap:anywhere]`}>{description}</p>
    </Section>
  );
}

export function HighlightsSection({ highlights, name, onOpen }) {
  return (
    <Section id="gestor-hacemos" title="Lo que hacemos">
      <ul className="m-0 grid list-none grid-cols-2 gap-5 p-0 max800:grid-cols-1">
        {highlights.map((highlight) => {
          const photos = toPhotos(highlight.images, `${highlight.title} - ${name}`);
          return (
            <li key={highlight.id} className="flex min-w-0 flex-col gap-3 rounded-[24px] border border-[#e2d9ca] bg-[#fffaf2] p-6 max600:p-5">
              {highlight.when_text && <p className="m-0 text-[12px] font-bold uppercase tracking-[.12em] text-[#7a5c12]">{highlight.when_text}</p>}
              <h3 className="m-0 font-sans text-[21px] font-bold leading-[1.25] tracking-[-.02em] text-ink [overflow-wrap:anywhere]">{highlight.title}</h3>
              {highlight.description && <p className={`m-0 whitespace-pre-line ${TEXT} text-[15px] [overflow-wrap:anywhere]`}>{highlight.description}</p>}
              {photos.length > 0 && (
                <ul className="mt-1 mb-0 grid list-none grid-cols-4 gap-2 p-0 max480:grid-cols-2" aria-label={`Fotos de ${highlight.title}`}>
                  {photos.map((photo, i) => (
                    <li key={highlight.images[i].id}><Thumb photo={photo} label={`Ampliar foto ${i + 1} de ${photos.length}: ${highlight.title}`} onClick={() => onOpen(photos, i)} /></li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

export function GallerySection({ gallery, name, onOpen }) {
  const photos = toPhotos(gallery, name);
  return (
    <Section id="gestor-galeria" title="Galería">
      <ul className="m-0 grid list-none grid-cols-4 gap-3 p-0 max800:grid-cols-3 max480:grid-cols-2">
        {photos.map((photo, i) => (
          <li key={gallery[i].id}><Thumb photo={photo} size="lg" label={`Ampliar foto ${i + 1} de ${photos.length}`} onClick={() => onOpen(photos, i)} /></li>
        ))}
      </ul>
    </Section>
  );
}

export function VenueSection({ profile }) {
  return (
    <Section id="gestor-donde" title="Dónde encontrarnos">
      <div className="grid max-w-[640px] gap-3 rounded-[24px] border border-[#e2d9ca] bg-[#fffaf2] p-6 max600:p-5">
        {profile.address && <p className="m-0 inline-flex items-start gap-2 text-[16px] text-ink"><Icon name="pin" className="mt-1 size-4 shrink-0 text-muted" />{profile.address}</p>}
        {profile.opening_hours && <p className="m-0 whitespace-pre-line text-[15px] leading-[1.6] text-[#53645c]"><strong className="text-ink">Horario:</strong> {profile.opening_hours}</p>}
        {profile.map_url && (
          <div><a className={BTN_INK_OUTLINE_MD} href={profile.map_url} target="_blank" rel="noopener noreferrer">Cómo llegar <Icon name="arrow-right" className="size-4" /><span className="sr-only"> (se abre en una pestaña nueva)</span></a></div>
        )}
      </div>
    </Section>
  );
}

export function ContactSection({ contact, socialLinks }) {
  const rows = [];
  if (contact?.whatsapp) rows.push({ key: 'wa', icon: 'send', label: 'WhatsApp', text: contact.whatsapp, href: `https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`, external: true });
  if (contact?.public_email) rows.push({ key: 'mail', icon: 'send', label: 'Correo', text: contact.public_email, href: `mailto:${contact.public_email}` });
  if (contact?.website) rows.push({ key: 'web', icon: 'compass', label: 'Sitio web', text: contact.website.replace(/^https?:\/\//, '').replace(/\/$/, ''), href: contact.website, external: true });
  socialLinks.forEach((link, i) => rows.push({
    key: `s${i}`, icon: SOCIAL_ICONS[link.platform] || 'share', label: link.platform === 'otro' ? (link.label || 'Enlace') : SOCIAL_NAMES[link.platform],
    text: link.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''), href: link.url, external: true,
  }));
  return (
    <Section id="gestor-contacto" title="Contacto y redes">
      <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 max800:grid-cols-1">
        {rows.map((row) => (
          <li key={row.key}>
            <a href={row.href} {...(row.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className={`flex min-w-0 items-center gap-3 rounded-[18px] border border-[#e2d9ca] bg-[#fffaf2] p-4 no-underline transition-colors duration-200 hover:border-ink ${FOCUS}`}>
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[rgba(29,143,163,0.12)] text-[#146f80]"><Icon name={row.icon} className="size-4" /></span>
              <span className="min-w-0">
                <span className="block text-[12px] font-bold uppercase tracking-[.1em] text-muted">{row.label}</span>
                <span className="block truncate text-[15px] font-bold text-ink">{row.text}</span>
              </span>
              {row.external && <span className="sr-only"> (se abre en una pestaña nueva)</span>}
            </a>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function AchievementsSection({ achievements }) {
  return (
    <Section id="gestor-logros" title="Reconocimientos y alianzas">
      <ul className="m-0 grid max-w-[760px] list-none gap-2 p-0">
        {achievements.map((item) => (
          <li key={item} className="flex items-start gap-3 text-[16px] leading-[1.5] text-[#3f514a]">
            <Icon name="seal" className="mt-1 size-4 shrink-0 text-gold" /><span className="[overflow-wrap:anywhere]">{item}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function PublicationTile({ publication }) {
  const [failed, setFailed] = useState(false);
  const image = isRealImage(publication.image) && !failed;
  const date = formatDateShort(publication.start_date);
  return (
    <a href={`#publicacion/${publication.id}`} style={{ '--kind': KIND_COLORS[publication.kind] || 'var(--river)' }}
      className={`group flex h-full min-w-0 flex-col overflow-hidden rounded-[20px] border border-[#e2d9ca] bg-[#fffaf2] no-underline transition-colors duration-200 hover:border-[color-mix(in_srgb,var(--kind)_45%,#e2d9ca)] ${FOCUS}`}>
      <span className="relative block aspect-[16/10] overflow-hidden bg-[color-mix(in_srgb,var(--kind)_12%,#f3ece0)]">
        {image && <img src={cdnImage(publication.image, { width: 640 })} alt="" loading="lazy" onError={() => setFailed(true)} className="size-full object-cover transition-[scale] duration-300 motion-safe:group-hover:scale-[1.04]" />}
      </span>
      <span className="flex flex-1 flex-col gap-1.5 p-4">
        <span className="text-[11px] font-bold uppercase tracking-[.1em] text-[#53645c]">{KIND_LABELS[publication.kind] || publication.kind}{date && ` · ${date}`}</span>
        <span className="text-[17px] font-bold leading-[1.3] text-ink [overflow-wrap:anywhere]">{publication.title}</span>
        {publication.summary && <span className="line-clamp-2 text-[14px] leading-[1.5] text-[#53645c]">{publication.summary}</span>}
      </span>
    </a>
  );
}

export function PublicationsSection({ publications }) {
  return (
    <Section id="gestor-publicaciones" title="Publicaciones de este gestor">
      <ul className="m-0 grid list-none grid-cols-3 gap-4 p-0 max1024:grid-cols-2 max600:grid-cols-1">
        {publications.map((publication) => <li key={publication.id}><PublicationTile publication={publication} /></li>)}
      </ul>
    </Section>
  );
}

function MemberLink({ member }) {
  const [failed, setFailed] = useState(false);
  return (
    <a href={`#gestor/${member.slug}`} aria-label={`Ver el perfil de ${member.name}`}
      className={`flex w-[104px] flex-col items-center gap-2 rounded-[16px] p-1 text-center no-underline ${FOCUS}`}>
      <span className="grid size-[68px] place-items-center overflow-hidden rounded-full border-2 border-[#e2d9ca] bg-cream text-[20px] font-extrabold text-ink" aria-hidden="true">
        {member.photo_url && !failed
          ? <img src={cdnImage(member.photo_url, { width: 160, fit: 'fill' })} alt="" className="size-full object-cover" onError={() => setFailed(true)} />
          : getInitials(member.name)}
      </span>
      <span className="text-[13px] font-bold leading-[1.25] text-ink [overflow-wrap:anywhere]">{member.name}</span>
    </a>
  );
}

// participate: el bloque "Quiero participar" bajo lo que busca el lider (solo en la pagina publica).
export function BranchSection({ profile, participate = null }) {
  if (profile.is_leader) {
    return (
      <Section id="gestor-rama" title="Equipo de la rama">
        {profile.team?.length > 0 ? (
          <>
            <p className="mt-0 mb-4 text-[15px] text-[#53645c]">
              {profile.team_count === 1 ? 'Una persona participa' : `${profile.team_count} personas participan`} en {profile.branch_label} junto a {profile.name}.
            </p>
            <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
              {profile.team.map((member) => <li key={member.slug}><MemberLink member={member} /></li>)}
            </ul>
          </>
        ) : <p className="m-0 text-[15px] text-[#53645c]">{profile.name} lidera la rama {profile.branch_label}.</p>}
        {profile.seeking_text && (
          <div className="mt-6 max-w-[760px] rounded-[20px] border border-[rgba(212,168,67,0.45)] bg-[rgba(212,168,67,0.1)] p-5">
            <p className="m-0 text-[12px] font-bold uppercase tracking-[.12em] text-[#6b500f]">Lo que buscamos</p>
            <p className="mt-2 mb-0 whitespace-pre-line text-[16px] leading-[1.6] text-ink">{profile.seeking_text}</p>
          </div>
        )}
        {participate && <div className="mt-5">{participate}</div>}
      </Section>
    );
  }
  const leader = profile.leader;
  return (
    <Section id="gestor-rama" title={`Parte de ${profile.branch_label}`}>
      <p className="m-0 max-w-[760px] text-[16px] leading-[1.6] text-[#3f514a]">
        {profile.name} es parte de la rama {profile.branch_label}, liderada por{' '}
        {leader.slug ? <a className={LINK} href={`#gestor/${leader.slug}`}>{leader.name}</a> : <strong>{leader.name}</strong>}.
      </p>
    </Section>
  );
}
