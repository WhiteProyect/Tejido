// Artistas en la web publica: sellos, filtros de #artistas en el hash y su aplicacion en el cliente (la
// pantalla carga todos los de TEJIDO de una vez: son pocos).
import { MUNICIPALITY_LIST } from './municipalities.js';

// Sello de un artista (artists.moneystack). La etiqueta va siempre en texto (el color no es la unica senal).
export const SELLOS = {
  tejido: { label: 'TEJIDO', href: '#artistas' },
  moneystack: { label: 'Moneystack', href: '#moneystack' },
};
export const selloOf = (artist) => (artist?.moneystack ? 'moneystack' : 'tejido');

const MUNICIPALITY_SLUGS = new Set(MUNICIPALITY_LIST.map(({ slug }) => slug));
export const MUNICIPALITY_NAMES = Object.fromEntries(MUNICIPALITY_LIST.map(({ slug, name }) => [slug, name]));
export const EMPTY_ARTIST_FILTERS = { mun: '', genero: '', q: '' };

// #artistas?mun=<slug>&genero=<texto>&q=<texto>
export function parseArtistFilters(hash = window.location.hash) {
  const raw = hash.replace(/^#/, '');
  const params = new URLSearchParams(raw.startsWith('artistas?') ? raw.slice('artistas?'.length) : '');
  const mun = params.get('mun') || '';
  return { mun: MUNICIPALITY_SLUGS.has(mun) ? mun : '', genero: (params.get('genero') || '').slice(0, 80), q: (params.get('q') || '').slice(0, 80) };
}

export function artistsHash(filters) {
  const params = new URLSearchParams();
  if (filters.mun) params.set('mun', filters.mun);
  if (filters.genero) params.set('genero', filters.genero);
  if (filters.q.trim()) params.set('q', filters.q.trim());
  const query = params.toString();
  return `#artistas${query ? `?${query}` : ''}`;
}

export const sameArtistFilters = (a, b) => a.mun === b.mun && a.genero === b.genero && a.q === b.q;

const fold = (text) => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('es').trim();

// Generos presentes en la lista (el genero es texto libre: se ofrecen los que existen, sin repetir por
// mayusculas o tildes), en orden alfabetico.
export function genreOptions(artists) {
  const seen = new Map();
  artists.forEach(({ genre }) => {
    const key = fold(genre);
    if (key && !seen.has(key)) seen.set(key, genre.trim());
  });
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'es')).map((genre) => [genre, genre]);
}

// Municipio, genero (sin distinguir mayusculas ni tildes) y nombre (contiene). El orden del servidor
// (destacados primero) se conserva.
export function filterArtists(artists, filters) {
  const term = fold(filters.q);
  const genre = fold(filters.genero);
  return artists.filter((artist) => (!filters.mun || artist.municipality === filters.mun)
    && (!genre || fold(artist.genre) === genre)
    && (!term || fold(artist.stage_name).includes(term) || fold(artist.name).includes(term)));
}
