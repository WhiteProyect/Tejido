import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import Icon from '../components/Icon.jsx';
import { EYEBROW, SECTION } from '../components/uiStyles.js';
import { formatDateShort } from '../utils/dateUtils.js';
import { KIND_COLORS, KIND_LABELS } from '../utils/constants.js';
import { getInitials } from '../utils/initials.js';
import { getPassportProgress } from '../utils/passportUtils.js';

// Perfil privado: UNA pantalla con cabecera comun y un modulo por rol (user.role).
// Cada modulo solo usa endpoints existentes; no hay datos simulados:
// - ADMIN: GET /api/admin/stats y GET /api/admin/suggestions (mensajes de Nosotros).
// - GESTOR: GET /api/publications?mine=1 y GET /api/artists (artista asociado por user_id).
// - CIUDADANO: GET /api/publications con sesion (campo `favorite`) y el pasaporte local.

const ROLES = {
  ADMIN: { label: 'Administración', mark: 'bg-ink text-paper', intro: 'El pulso de la plataforma y lo que la comunidad le está diciendo al equipo.' },
  GESTOR: { label: 'Gestor cultural', mark: 'bg-river text-white', intro: 'Tus publicaciones y las herramientas de tu espacio en TEJIDO.' },
  CIUDADANO: { label: 'Ciudadanía', mark: 'bg-orange text-white', intro: 'Lo que guardas, lo que has recorrido y cómo participar.' },
};

const STATUS_LABELS = {
  PUBLISHED: ['Publicada', 'bg-[rgba(29,143,163,0.1)] text-[#146f80]'],
  REVIEW: ['En revisión', 'bg-[rgba(212,168,67,0.18)] text-[#7a5c12]'],
  DRAFT: ['Borrador', 'bg-[rgba(102,116,111,0.12)] text-[#4d5a55]'],
  REJECTED: ['Rechazada', 'bg-[rgba(216,91,54,0.12)] text-[#a8431f]'],
};

const H2 = 'm-0 font-sans text-[26px] font-extrabold tracking-[-0.03em] text-ink';
const PANEL = 'min-w-0 rounded-[28px] border border-[#e2d9ca] bg-[#fffaf2] p-8 max600:p-6';
// Botones-enlace: base sin fondo ni color de texto; cada variante pone los suyos (README, patron 15).
const LINK_BTN_BASE = 'inline-flex items-center gap-2 rounded-full border border-ink py-2.5 px-5 text-[14px] font-bold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';
const LINK_BTN = `${LINK_BTN_BASE} bg-transparent text-ink hover:bg-ink hover:text-paper`;
const LINK_BTN_SOLID = `${LINK_BTN_BASE} bg-ink text-paper hover:bg-ink-deep`;

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

function EmptyNote({ icon, title, text, action }) {
  return (
    <div className="rounded-[20px] border border-dashed border-[#d9cfbe] py-10 px-6 text-center">
      <Icon name={icon} className="mx-auto size-8 text-[#8a948f]" />
      <p className="mt-3 mb-1 text-[17px] font-bold text-ink">{title}</p>
      <p className="mx-auto mt-0 mb-0 max-w-[420px] text-[14px] leading-[1.55] text-muted">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
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
function AdminModule() {
  const state = useProfileData(() => Promise.all([getJson('/api/admin/stats'), getJson('/api/admin/suggestions')]));
  const [stats, messages] = state.data || [{}, []];
  const tiles = [
    ['Publicadas', stats.published],
    ['En revisión', stats.pending],
    ['Usuarios activos', stats.users],
    ['Reportes abiertos', stats.reports],
    ['Mensajes nuevos', stats.suggestions],
  ];
  return (
    <>
      <section className={PANEL} aria-labelledby="admin-pulso">
        <h2 id="admin-pulso" className={H2}>Pulso de la plataforma</h2>
        <StateNote state={state}>
          <dl className="mt-6 mb-0 grid grid-cols-[repeat(5,1fr)] gap-4 max1024:grid-cols-[repeat(3,1fr)] max600:grid-cols-[repeat(2,1fr)]">
            {tiles.map(([label, value]) => (
              <div key={label} className="flex flex-col-reverse border-l-2 border-l-[rgba(29,143,163,0.35)] pl-4">
                <dt className="mt-2 text-[12px] font-bold uppercase tracking-[.1em] text-muted">{label}</dt>
                <dd className="m-0 text-[40px] font-extrabold leading-none tracking-[-0.04em] text-ink">{value ?? '–'}</dd>
              </div>
            ))}
          </dl>
        </StateNote>
      </section>
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
function GestorModule({ user }) {
  const state = useProfileData(() => Promise.all([getJson('/api/publications?mine=1'), getJson('/api/artists')]));
  const [publications, artists] = state.data || [[], []];
  const artist = artists.find((item) => item.user_id === user.id);
  const counts = publications.reduce((acc, item) => ({ ...acc, [item.status]: (acc[item.status] || 0) + 1 }), {});
  return (
    <>
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
  const passport = getPassportProgress();
  return (
    <>
      <section className={PANEL} aria-labelledby="ciudadano-guardados">
        <h2 id="ciudadano-guardados" className={`${H2} flex items-center gap-3`}><Icon name="bookmark" className="size-6 text-river" /> Tus guardados</h2>
        <StateNote state={state}>
          {saved.length === 0 ? (
            <div className="mt-6">
              <EmptyNote
                icon="bookmark"
                title="Todavía no tienes publicaciones guardadas"
                text="Las historias, eventos y oportunidades que guardes aparecerán aquí para volver a ellas."
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
      <div className="grid grid-cols-[1fr_1fr] gap-6 max800:grid-cols-[1fr]">
        <section className={PANEL} aria-labelledby="ciudadano-recorrido">
          <h2 id="ciudadano-recorrido" className={`${H2} flex items-center gap-3`}><Icon name="compass" className="size-6 text-river" /> Tu recorrido</h2>
          <p className="mt-3 mb-4 text-[15px] leading-[1.55] text-[#53645c]">Municipios que has descubierto explorando contenido en este dispositivo.</p>
          <div className="h-2 overflow-hidden rounded-full bg-[rgba(23,63,54,0.08)]" role="progressbar" aria-valuemin={0} aria-valuemax={passport.total} aria-valuenow={passport.collected} aria-label="Municipios descubiertos">
            <div className="h-full rounded-full bg-river" style={{ width: `${passport.percentage}%` }} />
          </div>
          <p className="mt-2 mb-5 text-[13px] font-bold text-ink">{passport.collected} de {passport.total} municipios</p>
          <a className={LINK_BTN} href="#mapa">Ver el mapa vivo</a>
        </section>
        <section className={PANEL} aria-labelledby="ciudadano-participa">
          <h2 id="ciudadano-participa" className={`${H2} flex items-center gap-3`}><Icon name="send" className="size-6 text-river" /> Participa</h2>
          <p className="mt-3 mb-5 text-[15px] leading-[1.55] text-[#53645c]">¿Conoces una historia, un evento o una iniciativa que debería estar en TEJIDO? Cuéntanos.</p>
          <a className={LINK_BTN} href="#nosotros">Escribir al equipo</a>
        </section>
      </div>
    </>
  );
}

export default function ProfileScreen({ user, onLogout }) {
  const reduceMotion = useReducedMotion();
  const role = ROLES[user.role] || ROLES.CIUDADANO;
  const Module = user.role === 'ADMIN' ? AdminModule : user.role === 'GESTOR' ? GestorModule : CitizenModule;

  return (
    <section className={`${SECTION} min-h-[62vh]`}>
      {/* Cabecera comun: identidad por iniciales (sin fotos) con el aro de la marca. */}
      <header className="mb-12 flex flex-wrap items-center gap-7 max600:gap-5">
        <div className="relative size-[92px] shrink-0 max600:size-[72px]" aria-hidden="true">
          <span className="absolute -right-2.5 -bottom-2 size-full rounded-full border-2 border-ink/15" />
          <span className={`relative flex size-full items-center justify-center rounded-full text-[30px] font-extrabold max600:text-[24px] ${role.mark}`}>{getInitials(user.name)}</span>
        </div>
        {/* En movil el nombre ocupa el ancho junto al avatar (72 + 20 de gap) y el boton baja. */}
        <div className="min-w-0 flex-1 max600:basis-[calc(100%-92px)]">
          <p className={`${EYEBROW} mb-2`}>Mi perfil · {role.label}</p>
          <h1 className="m-0 font-sans text-[length:clamp(34px,4.4vw,58px)] font-extrabold leading-[1] tracking-[-0.045em] text-ink">{user.name}</h1>
          <p className="mt-2 mb-0 text-[15px] text-muted">{user.email}</p>
        </div>
        <button type="button" onClick={onLogout} className="max600:ml-[92px] inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#d9cfbe] bg-transparent py-2.5 px-4 text-[14px] font-semibold text-ink transition-colors duration-200 hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
          <Icon name="logout" className="size-[18px]" /> Cerrar sesión
        </button>
      </header>

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
