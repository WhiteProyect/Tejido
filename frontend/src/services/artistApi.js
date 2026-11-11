import { apiRequest } from '../utils/api.js';

const API = '/api';

async function getJson(url) {
  const token = localStorage.getItem('tejido_token');
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error('Error al cargar datos');
  return res.json();
}

async function sendJson(url, method, body) {
  const token = localStorage.getItem('tejido_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Error en la solicitud');
  return data;
}

export function fetchArtists() {
  return getJson(`${API}/artists`);
}

export function fetchArtistProfile(slug) {
  return getJson(`${API}/artists/${slug}`);
}

export function fetchArtistMusic(slug) {
  return getJson(`${API}/artists/${slug}/music`);
}

export function fetchArtistTimeline(slug) {
  return getJson(`${API}/artists/${slug}/timeline`);
}

export function fetchArtistMedia(slug, tipo) {
  const qs = tipo ? `?tipo=${tipo}` : '';
  return getJson(`${API}/artists/${slug}/media${qs}`);
}

export function fetchArtistSocial(slug) {
  return getJson(`${API}/artists/${slug}/social`);
}

export function fetchArtistConnections(slug) {
  return getJson(`${API}/artists/${slug}/connections`);
}

export function fetchArtistDashboard(artistId) {
  return getJson(`${API}/artists/${artistId}/dashboard`);
}

export function fetchMediaKit(slug) {
  return getJson(`${API}/artists/${slug}/media-kit`);
}

export function updateArtist(artistId, data) {
  return sendJson(`${API}/artists/${artistId}`, 'PUT', data);
}

export function createTimelineEntry(artistId, data) {
  return sendJson(`${API}/artists/${artistId}/timeline`, 'POST', data);
}

export function updateTimelineEntry(artistId, entryId, data) {
  return sendJson(`${API}/artists/${artistId}/timeline/${entryId}`, 'PUT', data);
}

export function deleteTimelineEntry(artistId, entryId) {
  return sendJson(`${API}/artists/${artistId}/timeline/${entryId}`, 'DELETE');
}

export function createMediaItem(artistId, data) {
  return sendJson(`${API}/artists/${artistId}/media`, 'POST', data);
}

export function updateMediaItem(artistId, mediaId, data) {
  return sendJson(`${API}/artists/${artistId}/media/${mediaId}`, 'PUT', data);
}

export function deleteMediaItem(artistId, mediaId) {
  return sendJson(`${API}/artists/${artistId}/media/${mediaId}`, 'DELETE');
}

export function createSocialLink(artistId, data) {
  return sendJson(`${API}/artists/${artistId}/social`, 'POST', data);
}

export function deleteSocialLink(artistId, linkId) {
  return sendJson(`${API}/artists/${artistId}/social/${linkId}`, 'DELETE');
}

export function createConnection(artistId, data) {
  return sendJson(`${API}/artists/${artistId}/connections`, 'POST', data);
}

export function deleteConnection(artistId, connectionId) {
  return sendJson(`${API}/artists/${artistId}/connections/${connectionId}`, 'DELETE');
}

export function createMetric(artistId, data) {
  return sendJson(`${API}/artists/${artistId}/metrics`, 'POST', data);
}

// ───────────────────────── panel de admin (CRUD completo) ─────────────────────────
// Todo lo nuevo pasa por apiRequest (utils/api.js), que tolera respuestas sin cuerpo y devuelve
// el mensaje del backend en el Error. Las funciones de arriba (sendJson) quedan para ArtistDashboard.

// Detalle para el editor: activo o archivado, canciones en borrador incluidas, cada fila con su id.
export function fetchAdminArtist(artistId) {
  return apiRequest(`${API}/admin/artists/${artistId}`);
}

// CRUD de una seccion del artista: /api/artists/{id}/<path>[/{rowId}].
function section(path) {
  return {
    create: (artistId, data) => apiRequest(`${API}/artists/${artistId}/${path}`, { method: 'POST', body: data }),
    update: (artistId, rowId, data) => apiRequest(`${API}/artists/${artistId}/${path}/${rowId}`, { method: 'PUT', body: data }),
    remove: (artistId, rowId) => apiRequest(`${API}/artists/${artistId}/${path}/${rowId}`, { method: 'DELETE' }),
  };
}

// Lista publica (solo activos y publicados). params: { sello: 'tejido' | 'moneystack', municipality, genre, q }.
export function fetchPublicArtists(params = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value)).toString();
  return apiRequest(`${API}/artists${query ? `?${query}` : ''}`);
}

// Lider de la rama Musica: los artistas que cargo (con estado y nota) y el reenvio de un rechazado.
// Crear y editar usan las mismas rutas que el admin (adminArtistApi.create / update).
export const leaderArtistApi = {
  mine: () => apiRequest(`${API}/artists/mine`),
  submit: (artistId) => apiRequest(`${API}/artists/${artistId}/submit`, { method: 'POST' }),
};

export const adminArtistApi = {
  list: (status) => apiRequest(`${API}/admin/artists${status ? `?status=${status}` : ''}`),
  review: (artistId, action, note) => apiRequest(`${API}/artists/${artistId}/review`, { method: 'POST', body: { action, note: note || null } }),
  detail: fetchAdminArtist,
  create: (data) => apiRequest(`${API}/artists`, { method: 'POST', body: data }),
  update: (artistId, data) => apiRequest(`${API}/artists/${artistId}`, { method: 'PUT', body: data }),
  archive: (artistId) => apiRequest(`${API}/artists/${artistId}`, { method: 'DELETE' }),
  restore: (artistId) => apiRequest(`${API}/artists/${artistId}/restore`, { method: 'POST' }),
  tracks: section('tracks'),
  media: section('media'),
  timeline: section('timeline'),
  social: section('social'),
  connections: section('connections'),
  metrics: {
    ...section('metrics'),
    list: (artistId) => apiRequest(`${API}/artists/${artistId}/metrics`),
  },
};
