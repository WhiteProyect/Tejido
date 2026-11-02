/**
 * CONSTANTS.JS — Constantes compartidas de TEJIDO
 *
 * Colores, etiquetas, ubicaciones y utilidades usadas
 * en múltiples pantallas y componentes.
 */

import { MUNICIPALITY_LIST } from './municipalities.js';

// ─── Colores por tipo de publicación ───────────────────────
export const KIND_COLORS = {
  EVENTO: '#d85b36',
  HISTORIA: '#f4b942',
  TALENTO: '#173f36',
  OPORTUNIDAD: '#8a4f7d',
  INICIATIVA: '#3b82f6',
  LUGAR: '#1d8fa3',
};

// ─── Etiquetas legibles por tipo ───────────────────────────
export const KIND_LABELS = {
  EVENTO: 'Evento',
  HISTORIA: 'Historia',
  TALENTO: 'Talento',
  OPORTUNIDAD: 'Oportunidad',
  INICIATIVA: 'Iniciativa',
  LUGAR: 'Lugar',
};

// ─── Categorias culturales ─────────────────────────────────
// Una sola lista para la rama del gestor y la categoria de cada publicacion.
// Mismas claves que backend/service/schemas/cultural_categories.py.
// [clave, etiqueta, slug]: el slug es el nombre de la portada (/images/categorias/<slug>.jpg)
// y el segmento de la URL (#categoria/<slug>).
export const CULTURAL_CATEGORIES = [
  ['MUSICA', 'Música', 'musica'],
  ['CINE_AUDIOVISUAL', 'Cine y audiovisual', 'cine-audiovisual'],
  ['DANZA', 'Danza', 'danza'],
  ['TEATRO', 'Teatro', 'teatro'],
  ['ARTES_VISUALES', 'Artes visuales', 'artes-visuales'],
  ['LITERATURA', 'Literatura', 'literatura'],
  ['ARTESANIAS', 'Artesanías', 'artesanias'],
  ['PATRIMONIO_MEMORIA', 'Patrimonio y memoria', 'patrimonio-memoria'],
  ['GASTRONOMIA_CULTURAL', 'Gastronomía cultural', 'gastronomia-cultural'],
  ['EMPRENDIMIENTO_CULTURAL', 'Emprendimiento cultural', 'emprendimiento-cultural'],
];

// Ramas de los gestores: las mismas categorias, por clave (selects del panel de admin).
export const BRANCH_LABELS = Object.fromEntries(CULTURAL_CATEGORIES.map(([key, label]) => [key, label]));
// Orden de presentacion (selects y filtros).
export const CULTURAL_BRANCHES = CULTURAL_CATEGORIES.map(([key]) => key);

// ─── Municipios del Bajo Cauca ─────────────────────────────
// La fuente única es utils/municipalities.js. Estas formas se derivan de ella (mismas claves y
// mismo orden de antes) para los que ya las usan: formularios, pasaporte, hero.
export const MUNICIPALITIES = MUNICIPALITY_LIST.map(({ slug, name, emoji, color, theme }) => ({ id: slug, name, emoji, color, theme }));

// ─── Palabras clave para agrupar publicaciones por municipio ─
export const MUNICIPALITY_LOCATION_MAP = Object.fromEntries(MUNICIPALITY_LIST.map(({ slug, locationKeywords }) => [slug, locationKeywords]));

// ─── Utilidad: normalizar texto para comparación ────────────
export function normalizeText(text = '') {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

// Tonos de los avisos (toasts) del "Modelo de Alertas TEJIDO". El color va solo en el icono y
// los acentos, nunca de fondo. Iconos de components/Icon.jsx.
export const TOAST_TONES = {
  rio: { color: '#1d8fa3', icon: 'waves' },       // Guia de Hilo: orientacion neutra (login, logout)
  menta: { color: '#276749', icon: 'sprout' },    // Tejido Exitoso: confirmaciones (guardar, mensajes)
  dorado: { color: '#d4a843', icon: 'compass' },  // Sello Territorial: hitos (cuenta creada, cuenta activada)
  naranja: { color: '#dd6b20', icon: 'flame' },   // Pulso Cultural: reservado para alertas de eventos; 'flame' aun no existe en Icon.jsx
  morado: { color: 'var(--purple)' },             // Memoria Vacia: estados vacios (EmptyNote usa text-purple, la misma variable), no para toasts
};
