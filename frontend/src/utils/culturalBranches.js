import { useEffect, useSyncExternalStore } from 'react';

// Ramas de cultura (el publico las llama "categorias"). La fuente es la tabla cultural_branches:
// GET /api/cultural-branches da las ACTIVAS en orden ({key, label, slug, image_url}). Se piden UNA vez
// por carga de la app; mientras llegan (o si la peticion falla) se usan las 10 iniciales de abajo.
// El panel Ramas del admin llama a setAdminBranches con su lista completa: todo lo montado se
// actualiza al instante y las desactivadas conservan su nombre para lo que ya las usa.

// Las 10 ramas iniciales: respaldo sin red y las unicas con portada estatica (/images/categorias/<slug>.jpg).
export const STATIC_BRANCHES = [
  { key: 'MUSICA', label: 'Música', slug: 'musica' },
  { key: 'CINE_AUDIOVISUAL', label: 'Cine y audiovisual', slug: 'cine-audiovisual' },
  { key: 'DANZA', label: 'Danza', slug: 'danza' },
  { key: 'TEATRO', label: 'Teatro', slug: 'teatro' },
  { key: 'ARTES_VISUALES', label: 'Artes visuales', slug: 'artes-visuales' },
  { key: 'LITERATURA', label: 'Literatura', slug: 'literatura' },
  { key: 'ARTESANIAS', label: 'Artesanías', slug: 'artesanias' },
  { key: 'PATRIMONIO_MEMORIA', label: 'Patrimonio y memoria', slug: 'patrimonio-memoria' },
  { key: 'GASTRONOMIA_CULTURAL', label: 'Gastronomía cultural', slug: 'gastronomia-cultural' },
  { key: 'EMPRENDIMIENTO_CULTURAL', label: 'Emprendimiento cultural', slug: 'emprendimiento-cultural' },
].map((branch) => ({ ...branch, image_url: null, active: true }));

const STATIC_KEYS = new Set(STATIC_BRANCHES.map(({ key }) => key));

function build(list, ready, extra = []) {
  const all = new Map();
  for (const branch of [...STATIC_BRANCHES, ...extra, ...list]) all.set(branch.key, branch);
  return {
    list,
    ready,
    byKey: Object.fromEntries(all),
    bySlug: Object.fromEntries(list.map((branch) => [branch.slug, branch])),
  };
}

let state = build(STATIC_BRANCHES, false);
let request = null;
const listeners = new Set();

function emit(next) {
  state = next;
  listeners.forEach((listener) => listener());
}

function normalize(rows) {
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => row && row.key && row.slug)
    .map(({ key, label, slug, image_url: imageUrl, active = true }) => ({ key, label: label || key, slug, image_url: imageUrl || null, active }));
}

export function loadCulturalBranches({ reload = false } = {}) {
  if (!request || reload) {
    request = fetch('/api/cultural-branches', reload ? { cache: 'reload' } : undefined)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((rows) => {
        const list = normalize(rows);
        emit(build(list.length ? list : STATIC_BRANCHES, true, Object.values(state.byKey)));
      })
      .catch(() => emit(build(state.list, true, Object.values(state.byKey))));
  }
  return request;
}

// Lista completa del admin (activas y desactivadas): las activas pasan a ser la lista publica.
export function setAdminBranches(rows) {
  const all = normalize(rows);
  emit(build(all.filter((branch) => branch.active), true, all));
  // Renueva la copia en cache del navegador para no ver la lista vieja al recargar.
  fetch('/api/cultural-branches', { cache: 'reload' }).catch(() => {});
}

// Portadas {CLAVE: url} que devuelve el PUT/DELETE de /api/cultural-categories/<clave>/cover.
export function setBranchCovers(covers) {
  const map = covers || {};
  const patch = (branch) => ({ ...branch, image_url: map[branch.key] || null });
  emit(build(state.list.map(patch), state.ready, Object.values(state.byKey).map(patch)));
  fetch('/api/cultural-branches', { cache: 'reload' }).catch(() => {});
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => state;

// { list (activas, en orden), ready, byKey, bySlug }. Dispara la carga la primera vez.
export function useCulturalBranches() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    loadCulturalBranches();
  }, []);
  return snapshot;
}

// Lecturas sincronas del estado actual (utilidades fuera de React; los componentes usan el hook
// para volver a pintar cuando llega la lista).
export const activeBranches = () => state.list;
export const branchesReady = () => state.ready;
export const branchBySlug = (slug) => state.bySlug[String(slug || '').toLowerCase()] || null;
export const isActiveSlug = (slug) => Boolean(branchBySlug(slug));
export const isActiveKey = (key) => state.list.some((branch) => branch.key === key);

function humanize(key) {
  const text = String(key || '').replace(/_/g, ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Nombre de cualquier rama conocida (tambien desactivadas); si no se conoce, la clave legible.
export function branchLabel(key) {
  if (!key) return '';
  return state.byKey[key]?.label || humanize(key);
}

export function branchSlug(key) {
  return state.byKey[key]?.slug || String(key || '').toLowerCase().replace(/_/g, '-');
}

export const hasStaticCover = (key) => STATIC_KEYS.has(key);

// [slug, etiqueta] de las activas (selects de filtros por slug).
export const slugOptions = (list = state.list) => list.map(({ slug, label }) => [slug, label]);
// [clave, etiqueta] de las activas; incluye `keep` (la rama que el registro ya tenia) aunque este desactivada.
export function keyOptions(list = state.list, keep = null) {
  const options = list.map(({ key, label }) => [key, label]);
  if (keep && !options.some(([key]) => key === keep)) options.push([keep, `${branchLabel(keep)} (desactivada)`]);
  return options;
}
