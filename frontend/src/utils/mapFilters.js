// Logica pura de los filtros del Mapa vivo: tipo (eventos o lugares; nunca historias, no llevan punto) y,
// con lugares, subcategorias de lugar (seleccion multiple; ninguna = todos los lugares). Los conteos se
// sacan de todos los datos (no de lo filtrado) y las subcategorias salen de los puntos que trae la API:
// solo las que tienen al menos un punto, mas "Otros lugares" para los lugares sin categoria si los hay.
// Estado en la URL: #mapa?tipo=eventos|lugares&categoria=<slug>[,<slug>] (con municipio, evento o lugar);
// los valores invalidos se ignoran.

export const TIPOS = { eventos: 'EVENTO', lugares: 'LUGAR' };
export const OTHER_PLACES = 'otros';
export const OTHER_PLACES_LABEL = 'Otros lugares';
export const EMPTY_FILTERS = Object.freeze({ tipo: '', categorias: [] });
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_CATEGORIES = 20;

export function parseMapFilters(hash = typeof window !== 'undefined' ? window.location.hash : '') {
  const raw = String(hash || '').replace(/^#/, '');
  const params = new URLSearchParams(raw.startsWith('mapa?') ? raw.slice('mapa?'.length) : '');
  const tipoRaw = params.get('tipo') || '';
  const tipo = Object.prototype.hasOwnProperty.call(TIPOS, tipoRaw) ? tipoRaw : '';
  if (tipo !== 'lugares') return { tipo, categorias: [] };
  const categorias = [];
  for (const piece of (params.get('categoria') || '').split(',')) {
    const slug = piece.trim().toLowerCase();
    if (SLUG.test(slug) && !categorias.includes(slug)) categorias.push(slug);
    if (categorias.length >= MAX_CATEGORIES) break;
  }
  return { tipo, categorias };
}

export const isFiltered = (filters) => Boolean(filters.tipo);
export const activeFilterCount = (filters) => (filters.tipo ? 1 : 0) + filters.categorias.length;
export const sameFilters = (a, b) => a.tipo === b.tipo && a.categorias.length === b.categorias.length && a.categorias.every((slug, i) => slug === b.categorias[i]);
export const placeCategoryKey = (point) => point.place_category?.slug || OTHER_PLACES;

export function matchesFilters(point, filters) {
  if (filters.tipo === 'eventos') return point.type === 'EVENTO';
  if (filters.tipo === 'lugares') {
    return point.type === 'LUGAR' && (!filters.categorias.length || filters.categorias.includes(placeCategoryKey(point)));
  }
  return point.type === 'EVENTO' || point.type === 'LUGAR';
}

export const filterPoints = (points, filters) => points.filter((point) => matchesFilters(point, filters));

// Conteos sobre todos los datos: { all, events, places, categories: [{ slug, label, icon, color, count }],
// other }. Las categorias van por nombre; "Otros lugares" no esta en la lista (es `other`).
export function countPoints(points) {
  let events = 0;
  let places = 0;
  let other = 0;
  const bySlug = new Map();
  for (const point of points) {
    if (point.type === 'EVENTO') events += 1;
    else if (point.type === 'LUGAR') {
      places += 1;
      const category = point.place_category;
      if (!category?.slug) { other += 1; continue; }
      const entry = bySlug.get(category.slug);
      if (entry) entry.count += 1;
      else bySlug.set(category.slug, { slug: category.slug, label: category.label || category.slug, icon: category.icon, color: category.color, count: 1 });
    }
  }
  const categories = [...bySlug.values()].sort((a, b) => a.label.localeCompare(b.label, 'es'));
  return { all: events + places, events, places, categories, other };
}

// Quita las subcategorias que no existen en los datos (o "otros" si no hay lugares sin categoria).
export function sanitizeFilters(filters, counts) {
  if (filters.tipo !== 'lugares' || !filters.categorias.length) return filters;
  const known = new Set(counts.categories.map(({ slug }) => slug));
  if (counts.other) known.add(OTHER_PLACES);
  const categorias = filters.categorias.filter((slug) => known.has(slug));
  return categorias.length === filters.categorias.length ? filters : { ...filters, categorias };
}

export function toggleCategory(filters, slug) {
  const categorias = filters.categorias.includes(slug) ? filters.categorias.filter((item) => item !== slug) : [...filters.categorias, slug];
  return { tipo: 'lugares', categorias };
}

const NOUNS = { eventos: ['evento', 'eventos'], lugares: ['lugar', 'lugares'], '': ['punto', 'puntos'] };
export function counterText(count, tipo = '') {
  const [one, many] = NOUNS[tipo] || NOUNS[''];
  return `${count} ${count === 1 ? one : many} en el mapa`;
}

// Tipo legible de un punto: "Evento · Música", "Evento", la categoria del lugar o "Lugar".
export function pointTypeLabel(point) {
  if (point.type === 'LUGAR') return point.place_category?.label || 'Lugar';
  return point.category_label ? `Evento · ${point.category_label}` : 'Evento';
}

// «[Título], [Tipo] en [Municipio]» para el pin.
export function pointAriaLabel(point) {
  const where = point.municipality_label ? ` en ${point.municipality_label}` : '';
  return `${point.title}, ${pointTypeLabel(point)}${where}`;
}

// Dias de calendario entre dos fechas YYYY-MM-DD (b - a).
const dayNumber = (iso) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000 : null;
};
const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// Un evento de tradicion sin fecha por venir muestra su texto de tradicion, sin cuenta regresiva.
export function isTraditionPoint(point, today) {
  if (point.type !== 'EVENTO' || !point.tradition_text) return false;
  const end = dayNumber(point.end_date || point.start_date);
  const now = dayNumber(today || localToday());
  return end === null || end < now;
}

// Aviso de dias de un evento contra el "hoy" de Bogota que manda la API: "Es hoy", "Falta 1 día",
// "Faltan N días" o "En curso"; null en lugares, tradiciones y eventos sin fecha o ya terminados.
export function pointNotice(point, today) {
  if (point.type !== 'EVENTO' || isTraditionPoint(point, today)) return null;
  const start = dayNumber(point.start_date || point.end_date);
  const end = dayNumber(point.end_date || point.start_date);
  const now = dayNumber(today || localToday());
  if (start === null || now === null || end < now) return null;
  if (start === now) return { text: 'Es hoy', kind: 'today' };
  if (start > now) {
    const days = start - now;
    return { text: days === 1 ? 'Falta 1 día' : `Faltan ${days} días`, kind: 'days' };
  }
  return { text: 'En curso', kind: 'ongoing' };
}
