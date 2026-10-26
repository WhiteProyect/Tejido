import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '../../Icon.jsx';
import Lightbox from '../../Lightbox.jsx';
import { BTN_INK_MD, BTN_INK_OUTLINE_MD, PANEL, PANEL_TITLE } from '../../uiStyles.js';
import { apiRequest } from '../../../utils/api.js';
import { useUnsavedChanges } from '../../admin/artist/unsavedChanges.js';
import GestorHeader from '../GestorHeader.jsx';
import {
  AboutSection, AchievementsSection, BranchSection, ContactSection, GallerySection, HighlightsSection,
  PublicationsSection, VenueSection,
} from '../GestorSections.jsx';
import ContactEditor from './ContactEditor.jsx';
import EditableFrame from './EditableFrame.jsx';
import HighlightsEditor from './HighlightsEditor.jsx';
import { AboutEditor, AchievementsEditor, GalleryEditor, HeaderEditor, SeekingEditor, VenueEditor } from './SimpleEditors.jsx';
import { ConfirmDialog } from './common.jsx';

// "Tu perfil publico" dentro del perfil del gestor (ProfileScreen > GestorModule). Muestra el perfil
// con los MISMOS componentes de la pagina publica (#gestor/<slug>), alimentados con
// GET /api/me/profile/preview (lo mismo que ve la gente, aunque el admin lo haya ocultado), y cada
// seccion en un EditableFrame con su lapiz. Los formularios usan GET /api/me/profile (valores
// crudos, incluidos los no publicos) y el contacto privado de GET /api/me/organization.
// Una seccion en edicion a la vez: cambiar con cambios sin guardar pide confirmacion; cerrar o
// recargar la pagina tambien (beforeunload). Al cerrar un editor el foco vuelve a su lapiz.
// Los cambios se publican al guardar.

const SECTION_NAMES = {
  header: 'la cabecera', about: 'Sobre nosotros', highlights: 'Lo que hacemos', gallery: 'la galería',
  venue: 'Dónde encontrarnos', contact: 'Contacto y redes', achievements: 'Reconocimientos y alianzas', branch: 'A quién buscamos',
};

async function loadAll() {
  const [preview, own, organization] = await Promise.all([
    apiRequest('/api/me/profile/preview'), apiRequest('/api/me/profile'), apiRequest('/api/me/organization'),
  ]);
  return { preview, own, privateContact: organization.contact };
}

export default function ProfilePreviewPanel() {
  const [state, setState] = useState({ loading: true, error: '', missing: false, data: null });
  const [editing, setEditing] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(null); // seccion a la que se quiere pasar con cambios sin guardar
  const [viewer, setViewer] = useState(null);
  const buttons = useRef({});
  const lastClosed = useRef(null);
  useUnsavedChanges(dirty);

  const load = useCallback(async () => {
    try {
      const data = await loadAll();
      setState({ loading: false, error: '', missing: false, data });
    } catch (error) {
      // 404: el gestor aun no tiene organizacion (mensaje del backend, el de siempre).
      setState((current) => ({ ...current, loading: false, error: error.message, missing: error.status === 404 }));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Al cerrar un editor, el foco vuelve a su lapiz (o al boton de agregar).
  useEffect(() => {
    if (editing || !lastClosed.current) return;
    const key = lastClosed.current;
    lastClosed.current = null;
    requestAnimationFrame(() => buttons.current[key]?.focus());
  }, [editing, state.data]);

  function requestEdit(key) {
    if (editing === key) return;
    if (editing && dirty) { setPending(key); return; }
    setEditing(key);
  }

  function close() {
    lastClosed.current = editing;
    setDirty(false);
    setEditing(null);
  }

  function saved() {
    close();
    load();
  }

  if (state.loading) return <section className={PANEL} aria-busy="true"><p className="m-0 text-[14px] text-muted">Cargando tu perfil público...</p></section>;
  if (!state.data) {
    return (
      <section className={PANEL} aria-labelledby="perfil-publico">
        <h2 id="perfil-publico" className={PANEL_TITLE}>Tu perfil público</h2>
        <p className="mt-4 mb-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[14px] text-[#b3442b]" role="alert">{state.error}</p>
        {!state.missing && <button type="button" className={`${BTN_INK_OUTLINE_MD} mt-4`} onClick={() => { setState((s) => ({ ...s, loading: true })); load(); }}>Reintentar</button>}
      </section>
    );
  }

  const { preview, own, privateContact } = state.data;
  const contact = preview.contact || {};
  const open = (photos, index) => setViewer({ photos, index });
  const move = (delta) => setViewer((current) => ({ ...current, index: (current.index + delta + current.photos.length) % current.photos.length }));
  const editorProps = { profile: own, onCancel: close, onSaved: saved, onDirtyChange: setDirty };
  const frame = (key, extra) => ({
    label: SECTION_NAMES[key], onEdit: () => requestEdit(key), buttonRef: (node) => { buttons.current[key] = node; }, ...extra,
  });

  const sections = [
    ['header', editing === 'header' ? <HeaderEditor {...editorProps} /> : (
      <EditableFrame {...frame('header')}><GestorHeader profile={preview} titleAs="h2" /></EditableFrame>
    )],
    ['about', editing === 'about' ? <AboutEditor {...editorProps} /> : (
      <EditableFrame {...frame('about', { title: 'Sobre nosotros', empty: !preview.description, emptyText: 'Cuéntale a la gente quién eres: qué hacen, desde cuándo y por qué.', addLabel: 'Escribir la biografía' })}>
        <AboutSection description={preview.description} />
      </EditableFrame>
    )],
    ['highlights', editing === 'highlights' ? <HighlightsEditor profile={own} onChanged={load} onClose={close} onDirtyChange={setDirty} /> : (
      <EditableFrame {...frame('highlights', { title: 'Lo que hacemos', empty: preview.highlights.length === 0, emptyText: 'Agrega tu primera manifestación cultural: un festival, un taller, una tradición que mantienen viva.', addLabel: 'Agregar manifestación' })}>
        <HighlightsSection highlights={preview.highlights} name={preview.name} onOpen={open} />
      </EditableFrame>
    )],
    ['gallery', editing === 'gallery' ? <GalleryEditor {...editorProps} /> : (
      <EditableFrame {...frame('gallery', { title: 'Galería', empty: preview.gallery.length === 0, emptyText: 'Sube fotos de lo que hacen. Hasta 12, con su descripción.', addLabel: 'Agregar fotos' })}>
        <GallerySection gallery={preview.gallery} name={preview.name} onOpen={open} />
      </EditableFrame>
    )],
    ['venue', editing === 'venue' ? <VenueEditor {...editorProps} /> : (
      <EditableFrame {...frame('venue', { title: 'Dónde encontrarnos', empty: !(preview.has_venue && (preview.address || preview.opening_hours || preview.map_url)), emptyText: '¿Tienen un lugar donde recibir a la gente? Agrega la dirección, el horario y cómo llegar.', addLabel: 'Agregar lugar' })}>
        <VenueSection profile={preview} />
      </EditableFrame>
    )],
    ['contact', editing === 'contact' ? <ContactEditor {...editorProps} privateContact={privateContact} /> : (
      <EditableFrame {...frame('contact', { title: 'Contacto y redes', empty: !(contact.whatsapp || contact.public_email || contact.website || preview.social_links.length), emptyText: 'Dile a la gente cómo escribirte y dónde seguirte. Tú eliges qué se muestra.', addLabel: 'Agregar contacto' })}>
        <ContactSection contact={contact} socialLinks={preview.social_links} />
      </EditableFrame>
    )],
    ['achievements', editing === 'achievements' ? <AchievementsEditor {...editorProps} /> : (
      <EditableFrame {...frame('achievements', { title: 'Reconocimientos y alianzas', empty: preview.achievements.length === 0, emptyText: 'Premios, becas o alianzas que respaldan su trabajo, uno por línea.', addLabel: 'Agregar reconocimientos' })}>
        <AchievementsSection achievements={preview.achievements} />
      </EditableFrame>
    )],
    ['publications', (
      preview.publications.length > 0 ? (
        <EditableFrame readOnly label="Publicaciones">
          <PublicationsSection publications={preview.publications} />
          <a className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-bold text-river no-underline hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink" href="#gestor-dashboard">
            Gestionar en mi dashboard <Icon name="arrow-right" className="size-4" />
          </a>
        </EditableFrame>
      ) : (
        <EditableFrame empty title="Publicaciones" emptyText="Aquí aparecerán tus últimas publicaciones cuando el equipo las apruebe."
          action={<a className={`${BTN_INK_OUTLINE_MD} max480:w-full`} href="#gestor-dashboard">Gestionar en mi dashboard</a>} />
      )
    )],
    ['branch', preview.is_leader ? (editing === 'branch' ? <SeekingEditor {...editorProps} /> : (
      <EditableFrame {...frame('branch')}><BranchSection profile={preview} /></EditableFrame>
    )) : preview.leader ? (
      <EditableFrame readOnly label="Rama"><BranchSection profile={preview} /></EditableFrame>
    ) : null],
  ];

  return (
    <section className={PANEL} aria-labelledby="perfil-publico">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-[620px]">
          <h2 id="perfil-publico" className={`${PANEL_TITLE} flex items-center gap-3`}><Icon name="people" className="size-6 text-river" /> Tu perfil público</h2>
          <p className="mt-2 mb-0 text-[15px] leading-[1.55] text-[#53645c]">Así te ve la gente. Los cambios se publican al guardar.</p>
        </div>
        <a className={`${BTN_INK_MD} max480:w-full`} href={`#gestor/${preview.slug}`} target="_blank" rel="noopener noreferrer">
          Ver mi perfil público <Icon name="arrow-right" className="size-4" /><span className="sr-only"> (se abre en una pestaña nueva)</span>
        </a>
      </div>
      {preview.profile_hidden && (
        <p className="mt-5 mb-0 flex items-start gap-3 rounded-[16px] border border-[rgba(212,168,67,0.5)] bg-[rgba(212,168,67,0.14)] py-3 px-4 text-[14px] leading-[1.5] text-[#5f4a10]" role="status">
          <Icon name="seal" className="mt-0.5 size-4 shrink-0" />
          <span><strong>El equipo de TEJIDO ocultó tu perfil público.</strong> Por ahora nadie más lo ve. Puedes seguir editándolo; si tienes dudas, escríbenos desde Nosotros.</span>
        </p>
      )}
      <div className="mt-8 grid gap-6 [&_section]:scroll-mt-24">
        {sections.filter(([, node]) => node).map(([key, node]) => <div key={key}>{node}</div>)}
      </div>
      {pending && (
        <ConfirmDialog
          title="Tienes cambios sin guardar"
          text={`Si pasas a editar ${SECTION_NAMES[pending] || 'otra sección'}, se descartan los cambios de ${SECTION_NAMES[editing]}.`}
          confirmLabel="Descartar y continuar"
          onConfirm={() => { setDirty(false); setEditing(pending); setPending(null); }}
          onCancel={() => setPending(null)}
        />
      )}
      {viewer && <Lightbox photos={viewer.photos} index={viewer.index} onClose={() => setViewer(null)} onMove={move} />}
    </section>
  );
}
