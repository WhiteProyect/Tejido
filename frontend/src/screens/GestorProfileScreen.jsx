import { useEffect, useState } from 'react';
import EmptyNote from '../components/EmptyNote.jsx';
import Icon from '../components/Icon.jsx';
import Lightbox from '../components/Lightbox.jsx';
import ParticipateBlock from '../components/branch/ParticipateBlock.jsx';
import GestorHeader from '../components/gestor/GestorHeader.jsx';
import {
  AboutSection, AchievementsSection, BranchSection, ContactSection, GallerySection, HighlightsSection,
  PublicationsSection, VenueSection,
} from '../components/gestor/GestorSections.jsx';
import { BTN_INK_OUTLINE_MD, SECTION } from '../components/uiStyles.js';
import { apiRequest } from '../utils/api.js';

// Perfil publico de un gestor, lider o participante (#gestor/<slug>; GET /api/gestores/{slug}).
// Orden: cabecera, Sobre nosotros, Lo que hacemos, Galeria, Donde encontrarnos, Contacto y
// redes, Reconocimientos, Publicaciones y la rama (equipo si es lider; su lider si participa).
// Cada seccion se omite si no tiene contenido; un perfil solo con nombre se ve completo con una
// nota suave. La edicion llega en la Entrega 3: aqui no hay nada editable.

function Unavailable() {
  return (
    <section className={`${SECTION} min-h-[62vh]`}>
      <div className="mx-auto max-w-[640px]">
        <EmptyNote
          icon="people"
          title="Este perfil no está disponible"
          text="Puede que el enlace haya cambiado o que el perfil todavía no sea público."
          action={<a className={BTN_INK_OUTLINE_MD} href="#explorar">Ir a Explorar <Icon name="arrow-right" className="size-4" /></a>}
        />
      </div>
    </section>
  );
}

export default function GestorProfileScreen({ slug, user }) {
  const [state, setState] = useState({ loading: true, profile: null, unavailable: false, error: '' });
  const [viewer, setViewer] = useState(null); // { photos, index }

  useEffect(() => {
    let alive = true;
    setState({ loading: true, profile: null, unavailable: false, error: '' });
    apiRequest(`/api/gestores/${encodeURIComponent(slug || '')}`)
      .then((profile) => alive && setState({ loading: false, profile, unavailable: false, error: '' }))
      .catch((error) => alive && setState({
        loading: false, profile: null, unavailable: error.status === 404, error: error.status === 404 ? '' : error.message,
      }));
    return () => { alive = false; };
  }, [slug]);

  // Titulo de la pestana mientras se ve; al salir vuelve el anterior.
  useEffect(() => {
    const previous = document.title;
    return () => { document.title = previous; };
  }, []);
  useEffect(() => {
    if (state.profile?.name) document.title = `${state.profile.name} · TEJIDO`;
  }, [state.profile?.name]);

  if (state.loading) return <section className={`${SECTION} min-h-[62vh]`} aria-busy="true"><p className="m-0 text-[14px] text-muted">Cargando...</p></section>;
  if (state.unavailable || !slug) return <Unavailable />;
  if (state.error) {
    return (
      <section className={`${SECTION} min-h-[62vh]`}>
        <p className="m-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[14px] text-[#b3442b]" role="alert">{state.error}</p>
      </section>
    );
  }

  const profile = state.profile;
  const contact = profile.contact || {};
  const open = (photos, index) => setViewer({ photos, index });
  const move = (delta) => setViewer((current) => ({ ...current, index: (current.index + delta + current.photos.length) % current.photos.length }));
  const sections = [
    profile.description && <AboutSection key="about" description={profile.description} />,
    profile.highlights.length > 0 && <HighlightsSection key="highlights" highlights={profile.highlights} name={profile.name} onOpen={open} />,
    profile.gallery.length > 0 && <GallerySection key="gallery" gallery={profile.gallery} name={profile.name} onOpen={open} />,
    profile.has_venue && (profile.address || profile.opening_hours || profile.map_url) && <VenueSection key="venue" profile={profile} />,
    (contact.whatsapp || contact.public_email || contact.website || profile.social_links.length > 0) && (
      <ContactSection key="contact" contact={contact} socialLinks={profile.social_links} />
    ),
    profile.achievements.length > 0 && <AchievementsSection key="achievements" achievements={profile.achievements} />,
    profile.publications.length > 0 && <PublicationsSection key="publications" publications={profile.publications} />,
    profile.branch_label && (profile.is_leader || profile.leader) && (
      <BranchSection
        key="branch"
        profile={profile}
        participate={profile.is_leader && (!user || user.role === 'CIUDADANO') && (
          <ParticipateBlock user={user} branch={profile.branch} hasLeader returnTo={`gestor/${profile.slug}`} />
        )}
      />
    ),
  ].filter(Boolean);

  return (
    <article className={`${SECTION} min-h-[62vh] pt-[60px] max800:pt-[40px]`}>
      <div className="mx-auto grid max-w-[1100px] gap-12 max600:gap-10">
        <GestorHeader profile={profile} />
        {sections.length > 0 ? (
          <div className="grid gap-12 max600:gap-10">{sections}</div>
        ) : (
          <p className="m-0 rounded-[20px] border border-dashed border-[#d9cfbe] py-8 px-6 text-center text-[15px] text-[#53645c]">
            Este gestor está preparando su perfil. Vuelve pronto para conocer lo que hace en {profile.branch_label || 'Caucasia'}.
          </p>
        )}
      </div>
      {viewer && <Lightbox photos={viewer.photos} index={viewer.index} onClose={() => setViewer(null)} onMove={move} />}
    </article>
  );
}
