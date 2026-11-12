// Tarjetas del Pulso del dashboard del admin. Los ids (y la clave de GET /api/admin/stats de cada una) los
// define el backend (services/admin_pulso.py::CATALOG); aqui solo etiqueta, icono, enlace y como se lee su
// valor. La unida "revision_talento_artistas" suma talento y artistas y enlaza a la pestaña con mas pendientes.
const INBOX = '#admin-dashboard/bandeja';
const USERS = '#admin-dashboard/usuarios';
const ARTISTS = '#admin-dashboard/artistas';

const simple = (key) => (stats) => ({ value: stats?.[key] ?? null });

export const PULSO_CARDS = {
  publicadas: { label: 'Publicadas', icon: 'book', read: simple('published') },
  en_revision: { label: 'En revisión', icon: 'pen', read: simple('pending') },
  gestores_activos: { label: 'Gestores activos', icon: 'people', read: simple('gestores_activos') },
  usuarios_activos: { label: 'Usuarios activos', icon: 'id-card', read: simple('users'), href: USERS },
  reportes: { label: 'Reportes abiertos', icon: 'flag', read: simple('reports'), href: INBOX },
  mensajes: { label: 'Mensajes nuevos', icon: 'inbox', read: simple('suggestions'), href: INBOX },
  solicitudes_ingreso: { label: 'Solicitudes de ingreso', icon: 'send', read: simple('join_requests'), href: INBOX },
  revision_talento_artistas: {
    label: 'Talento y artistas por revisar', icon: 'mic',
    read: (stats) => {
      const talent = stats?.talent_review;
      const artists = stats?.artists_review;
      if (talent == null && artists == null) return { value: null };
      const t = talent || 0;
      const a = artists || 0;
      return {
        value: t + a,
        detail: `${t} talento · ${a} ${a === 1 ? 'artista' : 'artistas'}`,
        href: a > t ? ARTISTS : '#admin-dashboard/talento',
        linkLabel: `Talento y artistas por revisar: ${t} de talento y ${a} ${a === 1 ? 'artista' : 'artistas'}`,
      };
    },
  },
  borradores: { label: 'Borradores', icon: 'pen', read: simple('borradores'), href: '#admin-dashboard/publicaciones' },
  eventos_proximos: { label: 'Eventos próximos', icon: 'calendar', read: simple('eventos_proximos'), href: '#agenda' },
  oportunidades_abiertas: { label: 'Oportunidades abiertas', icon: 'compass', read: simple('oportunidades_abiertas'), href: '#oportunidades' },
  lugares_publicados: { label: 'Lugares publicados', icon: 'pin', read: simple('lugares_publicados'), href: '#mapa?tipo=lugares' },
  talento_publicado: { label: 'Talento publicado', icon: 'mic', read: simple('talento_publicado'), href: '#talento' },
  artistas_tejido: { label: 'Artistas de TEJIDO', icon: 'music', read: simple('artistas_tejido'), href: ARTISTS },
  artistas_moneystack: { label: 'Artistas de Moneystack', icon: 'music', read: simple('artistas_moneystack'), href: ARTISTS },
  ciudadanos_nuevos_7d: { label: 'Ciudadanos nuevos (7 días)', icon: 'sprout', read: simple('ciudadanos_nuevos_7d'), href: USERS },
  usuarios_inactivos_o_invitados: { label: 'Inactivos o invitados', icon: 'lock', read: simple('usuarios_inactivos_o_invitados'), href: USERS },
  talento_por_revisar: { label: 'Talento por revisar', icon: 'mic', read: simple('talent_review'), href: '#admin-dashboard/talento' },
  artistas_por_revisar: { label: 'Artistas por revisar', icon: 'music', read: simple('artists_review'), href: ARTISTS },
};

// Mismo orden y mismos ids que el backend (si el GET falla, el frontend usa esto).
export const PULSO_CATALOG = Object.keys(PULSO_CARDS);
export const PULSO_DEFAULT = ['publicadas', 'en_revision', 'gestores_activos', 'usuarios_activos', 'reportes', 'mensajes', 'solicitudes_ingreso', 'revision_talento_artistas'];
export const PULSO_MAX = 12;

// El lapiz del header (solo admin, solo en el dashboard) pide abrir el modo edicion: un evento de ventana
// que escucha el dashboard. Simple y sin estado global.
export const PULSO_EDIT_EVENT = 'tejido:personalizar-pulso';
export const requestPulsoEdit = () => window.dispatchEvent(new CustomEvent(PULSO_EDIT_EVENT));
