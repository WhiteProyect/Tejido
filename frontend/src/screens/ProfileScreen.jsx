import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import EmptyNote from '../components/EmptyNote.jsx';
import Icon from '../components/Icon.jsx';
import ProfileHeader from '../components/ProfileHeader.jsx';
import ParticipateCard from '../components/branch/ParticipateCard.jsx';
import ProfilePreviewPanel from '../components/gestor/edit/ProfilePreviewPanel.jsx';
import { BTN_INK_MD, BTN_INK_OUTLINE_MD, EYEBROW, PANEL, PANEL_TITLE, SECTION } from '../components/uiStyles.js';
import { formatDateShort } from '../utils/dateUtils.js';
import { KIND_COLORS, KIND_LABELS } from '../utils/constants.js';
import { STATUS_LABELS } from '../utils/publicationStatus.js';

// Perfil privado: UNA pantalla con cabecera comun y un modulo por rol (user.role).
// Cada modulo solo usa endpoints existentes; no hay datos simulados:
// - ADMIN: el acceso a #admin-dashboard y un resumen de la bandeja (GET /api/admin/stats:
//   mensajes nuevos y reportes abiertos); la bandeja en si vive en #admin-dashboard/bandeja.
// - GESTOR: arriba lo administrativo (acceso a #gestor-dashboard, GET /api/publications?mine=1 y su
//   artista asociado por user_id en GET /api/artists); debajo "Tu perfil publico", la vista previa
//   editable de #gestor/<slug> (components/gestor/edit/ProfilePreviewPanel.jsx).
// - CIUDADANO: "Participa en una rama" (components/branch/ParticipateCard.jsx: su solicitud para
//   unirse a una rama) y GET /api/publications con sesion (campo `favorite`): sus guardados.
// La cabecera (nombre y foto editables, PATCH /api/me) es components/ProfileHeader.jsx.

const ROLES = {
  ADMIN: { label: 'Administración', mark: 'bg-ink text-paper', intro: 'Tu acceso al centro de la red y lo que la comunidad le está diciendo al equipo.' },
  GESTOR: { label: 'Gestor cultural', mark: 'bg-river text-white', intro: 'Tus publicaciones y las herramientas de tu espacio en TEJIDO.' },
  CIUDADANO: { label: 'Ciudadanía', mark: 'bg-orange text-white', intro: 'Lo que guardas para volver a ello y, si haces cultura, tu puerta para participar en una rama.' },
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
// El pulso, los gestores, la moderacion y la bandeja viven en #admin-dashboard
// (screens/AdminDashboard.jsx); aqui quedan la tarjeta de acceso y el resumen de la bandeja.
function AdminModule({ user }) {
  const state = useProfileData(() => getJson('/api/admin/stats'));
  const messages = state.data?.suggestions || 0;
  const reports = state.data?.reports || 0;
  const requests = state.data?.join_requests || 0;
  const parts = [
    messages && `${messages} ${messages === 1 ? 'mensaje nuevo' : 'mensajes nuevos'}`,
    reports && `${reports} ${reports === 1 ? 'reporte abierto' : 'reportes abiertos'}`,
    requests && `${requests} ${requests === 1 ? 'solicitud de ingreso' : 'solicitudes de ingreso'}`,
  ].filter(Boolean);
  return (
    <>
      <DashboardCard
        href="#admin-dashboard"
        eyebrow="Centro de la red"
        title={`${user.name}, el pulso de TEJIDO está en tus manos`}
        text="Modera publicaciones, acompaña a los gestores y revisa cómo va la plataforma."
        cta="Abrir Dashboard de Admin"
      />
      <section className={`${PANEL} flex flex-wrap items-center justify-between gap-6`} aria-labelledby="admin-bandeja">
        <div className="min-w-0">
          <h2 id="admin-bandeja" className={`${H2} flex items-center gap-3`}><Icon name="inbox" className="size-6 text-river" /> Bandeja</h2>
          <StateNote state={state}>
            <p className="mt-2 mb-0 text-[15px] text-[#53645c]">
              {parts.length ? `Tienes ${parts.length > 1 ? `${parts.slice(0, -1).join(', ')} y ${parts.at(-1)}` : parts[0]} por atender.` : 'Nada por atender: mensajes, reportes y solicitudes al día.'}
            </p>
          </StateNote>
        </div>
        <a className={BTN_INK_OUTLINE_MD} href="#admin-dashboard/bandeja">Abrir la bandeja <Icon name="arrow-right" className="size-4" /></a>
      </section>
    </>
  );
}

// ── GESTOR ───────────────────────────────────────────────────────────────────
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
      <ProfilePreviewPanel />
      {!state.loading && !state.error && artist && (
        <section className={`${PANEL} flex flex-wrap items-center justify-between gap-6`} aria-labelledby="gestor-artista">
          <div>
            <p className={EYEBROW}>Tu espacio de artista</p>
            <h2 id="gestor-artista" className={H2}>{artist.stage_name || artist.name}</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <a className={BTN_INK_OUTLINE_MD} href={`#artista/${artist.slug}`}>Ver perfil público</a>
            <a className={BTN_INK_MD} href={`#artista/${artist.slug}/dashboard`}>Abrir panel del artista <Icon name="arrow-right" className="size-4" /></a>
          </div>
        </section>
      )}
    </>
  );
}

// ── CIUDADANO ────────────────────────────────────────────────────────────────
function CitizenModule({ user, onUserUpdate }) {
  const state = useProfileData(() => getJson('/api/publications'));
  const saved = (state.data || []).filter((item) => item.favorite);
  return (
    <>
      <ParticipateCard user={user} onUserUpdate={onUserUpdate} />
      <section className={PANEL} aria-labelledby="ciudadano-guardados">
        <h2 id="ciudadano-guardados" className={`${H2} flex items-center gap-3`}><Icon name="bookmark" className="size-6 text-river" /> Tus guardados</h2>
        <StateNote state={state}>
          {saved.length === 0 ? (
            <div className="mt-6">
              <EmptyNote
                icon="bookmark"
                title="Sin guardados aún"
                text="Guarda sabores locales desde Explorar."
                action={<a className={BTN_INK_OUTLINE_MD} href="#explorar">Explorar publicaciones <Icon name="arrow-right" className="size-4" /></a>}
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
        <Module user={user} onUserUpdate={onUserUpdate} />
      </motion.div>
    </section>
  );
}
