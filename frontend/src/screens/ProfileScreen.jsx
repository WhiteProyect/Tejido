import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import EmptyNote from '../components/EmptyNote.jsx';
import Icon from '../components/Icon.jsx';
import ImageUrlField from '../components/ImageUrlField.jsx';
import ProfileHeader from '../components/ProfileHeader.jsx';
import { EYEBROW, FORM_INPUT, FORM_LABEL, LINK_BTN, LINK_BTN_SOLID, PANEL, PANEL_TITLE, SECTION } from '../components/uiStyles.js';
import { useToast } from '../context/ToastContext.jsx';
import { apiRequest } from '../utils/api.js';
import { formatDateShort } from '../utils/dateUtils.js';
import { KIND_COLORS, KIND_LABELS } from '../utils/constants.js';
import { STATUS_LABELS } from '../utils/publicationStatus.js';

// Perfil privado: UNA pantalla con cabecera comun y un modulo por rol (user.role).
// Cada modulo solo usa endpoints existentes; no hay datos simulados:
// - ADMIN: GET /api/admin/suggestions (mensajes de Nosotros) y el acceso a #admin-dashboard
//   (pulso, gestores y moderacion de publicaciones).
// - GESTOR: GET /api/publications?mine=1, GET /api/artists (artista asociado por user_id), su
//   biografia publica (GET/PATCH /api/me/organization) y el acceso a #gestor-dashboard.
// - CIUDADANO: GET /api/publications con sesion (campo `favorite`): sus guardados.
// La cabecera (nombre y foto editables, PATCH /api/me) es components/ProfileHeader.jsx.

const ROLES = {
  ADMIN: { label: 'Administración', mark: 'bg-ink text-paper', intro: 'Tu acceso al centro de la red y lo que la comunidad le está diciendo al equipo.' },
  GESTOR: { label: 'Gestor cultural', mark: 'bg-river text-white', intro: 'Tus publicaciones y las herramientas de tu espacio en TEJIDO.' },
  CIUDADANO: { label: 'Ciudadanía', mark: 'bg-orange text-white', intro: 'Lo que guardas para volver a ello cuando quieras.' },
};

const H2 = PANEL_TITLE;

async function getJson(url) {
  const token = localStorage.getItem('tejido_token');
  const response = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'No fue posible cargar esta información');
  return data;
}

// Carga los datos de un modulo una vez: { loading, data, error }.
function useProfileData(load) {
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  useEffect(() => {
    let alive = true;
    load()
      .then((data) => alive && setState({ loading: false, data, error: '' }))
      .catch((error) => alive && setState({ loading: false, data: null, error: error.message }));
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}

function StateNote({ state, children }) {
  if (state.loading) return <p className="m-0 py-6 text-[14px] text-muted" aria-busy="true">Cargando...</p>;
  if (state.error) return <p className="m-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[14px] text-[#b3442b]" role="alert">{state.error}</p>;
  return children;
}

function PublicationRow({ publication, showStatus }) {
  const [statusLabel, statusTone] = STATUS_LABELS[publication.status] || [publication.status, STATUS_LABELS.DRAFT[1]];
  const date = formatDateShort(publication.start_date || publication.created_at);
  return (
    <li className="flex items-center gap-4 border-b border-b-line py-4 last:border-b-0">
      <span className="size-2.5 shrink-0 rounded-full" style={{ background: KIND_COLORS[publication.kind] || 'var(--river)' }} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="m-0 truncate text-[16px] font-bold text-ink">{publication.title}</p>
        <p className="mt-0.5 mb-0 text-[12px] text-muted">{KIND_LABELS[publication.kind] || publication.kind}{date && ` · ${date}`}{publication.location && ` · ${publication.location}`}</p>
      </div>
      {showStatus && <span className={`shrink-0 rounded-full py-1 px-3 text-[12px] font-bold ${statusTone}`}>{statusLabel}</span>}
    </li>
  );
}

// ── ADMIN ────────────────────────────────────────────────────────────────────
// El pulso, los gestores y la moderacion viven en #admin-dashboard (screens/AdminDashboard.jsx);
// aqui quedan la tarjeta de acceso y los mensajes de Nosotros.
function AdminModule({ user }) {
  const state = useProfileData(() => getJson('/api/admin/suggestions'));
  const messages = state.data || [];
  return (
    <>
      <DashboardCard
        href="#admin-dashboard"
        eyebrow="Centro de la red"
        title={`${user.name}, el pulso de TEJIDO está en tus manos`}
        text="Modera publicaciones, acompaña a los gestores y revisa cómo va la plataforma."
        cta="Abrir Dashboard de Admin"
      />
      <section className={PANEL} aria-labelledby="admin-mensajes">
        <h2 id="admin-mensajes" className={`${H2} flex items-center gap-3`}><Icon name="inbox" className="size-6 text-river" /> Mensajes recientes</h2>
        <p className="mt-2 mb-0 text-[14px] text-muted">Lo que llega desde el formulario de Nosotros.</p>
        <StateNote state={state}>
          {messages.length === 0 ? (
            <div className="mt-6"><EmptyNote icon="inbox" title="No hay mensajes todavía" text="Cuando alguien escriba desde Nosotros, su mensaje aparecerá aquí." /></div>
          ) : (
            <ul className="mt-4 mb-0 list-none p-0">
              {messages.slice(0, 6).map((item) => (
                <li key={item.id} className="border-b border-b-line py-4 last:border-b-0">
                  <p className="m-0 flex flex-wrap items-center gap-x-2 text-[12px] text-muted">
                    <strong className="text-ink">{item.user_name || 'Visitante'}</strong>
                    {item.user_email && <span>{item.user_email}</span>}
                    <span>· {formatDateShort(item.created_at)}</span>
                    {item.status === 'NEW' && <span className="rounded-full bg-[rgba(212,168,67,0.18)] py-0.5 px-2 font-bold text-[#7a5c12]">Nuevo</span>}
                  </p>
                  <p className="mt-1.5 mb-0 line-clamp-3 whitespace-pre-line text-[15px] leading-[1.5] text-[#44564f]">{item.message}</p>
                </li>
              ))}
            </ul>
          )}
        </StateNote>
      </section>
    </>
  );
}

// ── GESTOR ───────────────────────────────────────────────────────────────────
const BIO_FIELDS = ['name', 'description', 'photo_url', 'contact'];

// Biografia publica de la organizacion del gestor. La rama cultural no aparece: la decide el admin.
function GestorBio() {
  const { showToast } = useToast();
  const [state, setState] = useState({ loading: true, error: '' });
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    let alive = true;
    apiRequest('/api/me/organization')
      .then((org) => {
        if (!alive) return;
        setForm(Object.fromEntries(BIO_FIELDS.map((key) => [key, org[key] || ''])));
        setState({ loading: false, error: '' });
      })
      .catch((error) => alive && setState({ loading: false, error: error.message }));
    return () => { alive = false; };
  }, []);

  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setSaveError('');
    try {
      const org = await apiRequest('/api/me/organization', { method: 'PATCH', body: form });
      setForm(Object.fromEntries(BIO_FIELDS.map((key) => [key, org[key] || ''])));
      showToast({ tone: 'menta', eyebrow: 'Hilo actualizado', title: 'Biografía guardada', text: 'Así te verán en tu categoría.' });
    } catch (error) {
      setSaveError(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={PANEL} aria-labelledby="gestor-bio">
      <h2 id="gestor-bio" className={`${H2} flex items-center gap-3`}><Icon name="people" className="size-6 text-river" /> Biografía pública</h2>
      <p className="mt-3 mb-0 max-w-[620px] text-[15px] leading-[1.55] text-[#53645c]">Lo que la gente ve de tu organización en TEJIDO. Tu rama cultural la asigna el equipo.</p>
      <StateNote state={state}>
        {form && (
          <form className="mt-6 grid max-w-[720px] gap-5" onSubmit={handleSubmit}>
            <label className={FORM_LABEL}>Nombre de la organización
              <input className={FORM_INPUT} value={form.name} onChange={(event) => set('name')(event.target.value)} maxLength={120} required disabled={saving} />
            </label>
            <label className={FORM_LABEL}>Biografía
              <textarea className={`${FORM_INPUT} min-h-[140px] resize-y leading-[1.55]`} value={form.description} onChange={(event) => set('description')(event.target.value)} maxLength={2000} placeholder="Qué hacen, desde cuándo, dónde los encuentran..." disabled={saving} />
            </label>
            <ImageUrlField label="Foto (enlace)" value={form.photo_url} onChange={set('photo_url')} disabled={saving} round hint="Pega el enlace de una imagen; aparece en la página de tu categoría." />
            <label className={FORM_LABEL}>Contacto (opcional)
              <input className={FORM_INPUT} value={form.contact} onChange={(event) => set('contact')(event.target.value)} maxLength={200} placeholder="Correo, teléfono o red social" disabled={saving} />
            </label>
            {saveError && <p className="m-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[14px] text-[#b3442b]" role="alert">{saveError}</p>}
            <div><button type="submit" className={LINK_BTN_SOLID} disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios de biografía'}</button></div>
          </form>
        )}
      </StateNote>
    </section>
  );
}

// Tarjeta oscura de acceso a un dashboard (gestor y admin).
function DashboardCard({ href, eyebrow, title, text, cta }) {
  return (
    <a href={href} className="group flex flex-wrap items-center justify-between gap-6 rounded-[28px] bg-ink p-8 text-paper no-underline transition-colors duration-200 hover:bg-ink-deep focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink max600:p-6">
      <span className="min-w-0">
        <span className="mb-2 block text-[11px] font-extrabold uppercase tracking-[.18em] text-mint">{eyebrow}</span>
        <span className="block font-sans text-[26px] font-extrabold tracking-[-0.03em] [overflow-wrap:anywhere]">{title}</span>
        {text && <span className="mt-2 block text-[15px] leading-[1.5] text-paper/80">{text}</span>}
      </span>
      <span className="inline-flex items-center gap-2 rounded-full bg-paper py-3 px-5 text-[15px] font-bold text-ink">
        {cta} <Icon name="arrow-right" className="size-4 transition-transform duration-200 motion-safe:group-hover:translate-x-1" />
      </span>
    </a>
  );
}

function GestorModule({ user }) {
  const state = useProfileData(() => Promise.all([getJson('/api/publications?mine=1'), getJson('/api/artists')]));
  const [publications, artists] = state.data || [[], []];
  const artist = artists.find((item) => item.user_id === user.id);
  const counts = publications.reduce((acc, item) => ({ ...acc, [item.status]: (acc[item.status] || 0) + 1 }), {});
  return (
    <>
      <DashboardCard href="#gestor-dashboard" eyebrow="Taller de Eventos y Cultura" title="Crea, corrige y envía tus publicaciones" cta="Ir al Dashboard de Gestor" />
      <section className={PANEL} aria-labelledby="gestor-publicaciones">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="gestor-publicaciones" className={`${H2} flex items-center gap-3`}><Icon name="pen" className="size-6 text-river" /> Tus publicaciones</h2>
          <StateNote state={{ ...state, error: '' }}>
            <p className="m-0 flex flex-wrap gap-2 text-[12px] font-bold">
              {Object.entries(STATUS_LABELS).filter(([key]) => counts[key]).map(([key, [label, tone]]) => (
                <span key={key} className={`rounded-full py-1 px-3 ${tone}`}>{label} · {counts[key]}</span>
              ))}
            </p>
          </StateNote>
        </div>
        <StateNote state={state}>
          {publications.length === 0 ? (
            <div className="mt-6"><EmptyNote icon="pen" title="Aún no tienes publicaciones" text="Cuando publiques historias, eventos u oportunidades aparecerán aquí con su estado." /></div>
          ) : (
            <ul className="mt-3 mb-0 list-none p-0">
              {publications.map((item) => <PublicationRow key={item.id} publication={item} showStatus />)}
            </ul>
          )}
        </StateNote>
      </section>
      <GestorBio />
      {!state.loading && !state.error && artist && (
        <section className={`${PANEL} flex flex-wrap items-center justify-between gap-6`} aria-labelledby="gestor-artista">
          <div>
            <p className={EYEBROW}>Tu espacio de artista</p>
            <h2 id="gestor-artista" className={H2}>{artist.stage_name || artist.name}</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <a className={LINK_BTN} href={`#artista/${artist.slug}`}>Ver perfil público</a>
            <a className={LINK_BTN_SOLID} href={`#artista/${artist.slug}/dashboard`}>Abrir panel del artista <Icon name="arrow-right" className="size-4" /></a>
          </div>
        </section>
      )}
    </>
  );
}

// ── CIUDADANO ────────────────────────────────────────────────────────────────
function CitizenModule() {
  const state = useProfileData(() => getJson('/api/publications'));
  const saved = (state.data || []).filter((item) => item.favorite);
  return (
    <>
      <section className={PANEL} aria-labelledby="ciudadano-guardados">
        <h2 id="ciudadano-guardados" className={`${H2} flex items-center gap-3`}><Icon name="bookmark" className="size-6 text-river" /> Tus guardados</h2>
        <StateNote state={state}>
          {saved.length === 0 ? (
            <div className="mt-6">
              <EmptyNote
                icon="bookmark"
                title="Sin guardados aún"
                text="Guarda sabores locales desde Explorar."
                action={<a className={LINK_BTN} href="#explorar">Explorar publicaciones <Icon name="arrow-right" className="size-4" /></a>}
              />
            </div>
          ) : (
            <ul className="mt-3 mb-0 list-none p-0">
              {saved.map((item) => <PublicationRow key={item.id} publication={item} />)}
            </ul>
          )}
        </StateNote>
      </section>
    </>
  );
}

export default function ProfileScreen({ user, onLogout, onUserUpdate }) {
  const reduceMotion = useReducedMotion();
  const role = ROLES[user.role] || ROLES.CIUDADANO;
  const Module = user.role === 'ADMIN' ? AdminModule : user.role === 'GESTOR' ? GestorModule : CitizenModule;

  return (
    <section className={`${SECTION} min-h-[62vh]`}>
      <ProfileHeader user={user} roleLabel={role.label} markClass={role.mark} onUserUpdate={onUserUpdate} onLogout={onLogout} />

      <p className="mt-0 mb-8 max-w-[640px] text-[18px] leading-[1.6] text-[#53645c]">{role.intro}</p>

      {/* Unica transicion de la pantalla: el modulo del rol aparece una vez. */}
      <motion.div
        className="grid grid-cols-[minmax(0,1fr)] gap-6"
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <Module user={user} />
      </motion.div>
    </section>
  );
}
