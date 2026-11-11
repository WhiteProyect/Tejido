// Configuracion comun de los mapas reales (Mapa vivo y selector de punto). Leaflet 1.9.4 se carga de
// forma perezosa (loadLeaflet), asi no entra al paquete del inicio; su CSS viene con el. El Mapa vivo pide
// ademas Leaflet.markercluster 1.5.3 (loadLeaflet({ cluster: true })), tambien perezoso.
// Teselas raster de OpenStreetMap por ahora: se cambia de proveedor al desplegar (TILE_URL y
// TILE_ATTRIBUTION; tile.openstreetmap.org no es para produccion). El tono calido de papel es un filtro
// CSS sobre las teselas (map.css); un estilo propio (rio Cauca destacado, paleta TEJIDO en calles y
// nombres) depende del proveedor que se elija: con teselas vectoriales o un estilo alojado se haria alli.
import { MUNICIPALITY_LIST } from './municipalities.js';
import { placeIconPath } from './placeIcons.js';
import { placeColors } from '../components/uiStyles.js';

export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">colaboradores de OpenStreetMap</a>';

// Caja del Bajo Cauca con margen (la misma de la API: services/publications.py::BAJO_CAUCA_BOX).
export const BAJO_CAUCA_BOX = { south: 6.8, north: 8.8, west: -76.0, east: -74.0 };
export const BOX_BOUNDS = [[BAJO_CAUCA_BOX.south, BAJO_CAUCA_BOX.west], [BAJO_CAUCA_BOX.north, BAJO_CAUCA_BOX.east]];
export const inBox = (lat, lng) => lat >= BAJO_CAUCA_BOX.south && lat <= BAJO_CAUCA_BOX.north && lng >= BAJO_CAUCA_BOX.west && lng <= BAJO_CAUCA_BOX.east;
export const MUNICIPALITY_ZOOM = 14;
export const REGION_ZOOM = 9;
export const POINT_ZOOM = 16;

let leafletPromise = null;
let clusterPromise = null;
export function loadLeaflet({ cluster = false } = {}) {
  if (!leafletPromise) {
    leafletPromise = Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]).then(([mod]) => mod.default || mod);
  }
  if (!cluster) return leafletPromise;
  if (!clusterPromise) {
    // El plugin (UMD de 2021) se cuelga de la variable global L. Leaflet ya la publica al cargarse; se
    // fija de nuevo aqui, antes de importarlo, para no depender de ese efecto lateral.
    clusterPromise = leafletPromise.then(async (L) => {
      window.L = L;
      await Promise.all([import('leaflet.markercluster'), import('leaflet.markercluster/dist/MarkerCluster.css')]);
      return L;
    });
  }
  return clusterPromise;
}

export const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Mover el mapa: vuelo suave, o salto directo con movimiento reducido.
export function moveMap(map, center, zoom) {
  if (prefersReducedMotion()) map.setView(center, zoom, { animate: false });
  else map.flyTo(center, zoom, { duration: 0.8 });
}

// Ubicacion del navegador (Mapa vivo y selector de punto): solo en contexto seguro y tras un clic. Resuelve
// { lat, lng }; rechaza con un Error cuyo mensaje ya es el texto para la persona. Quien llama decide que
// hacer si cae fuera del Bajo Cauca (inBox).
export const GEO_ERRORS = {
  1: 'No diste permiso para usar tu ubicación.',
  2: 'No pudimos saber dónde estás. Intenta de nuevo.',
  3: 'Se agotó el tiempo para encontrar tu ubicación. Intenta de nuevo.',
  unsupported: 'Tu navegador no permite usar la ubicación.',
  insecure: 'La ubicación solo funciona en una conexión segura (https).',
};
export function locateUser() {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) { reject(new Error(GEO_ERRORS.unsupported)); return; }
    if (!window.isSecureContext) { reject(new Error(GEO_ERRORS.insecure)); return; }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      (error) => reject(new Error(GEO_ERRORS[error.code] || GEO_ERRORS[2])),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  });
}

// Pines propios (DivIcon con SVG; los iconos de imagen por defecto de Leaflet se rompen con Vite): gota
// solida anclada en la punta, 40 px visibles dentro de una caja de 44 px de ancho (area tactil), borde de
// 2 px y sin sombra. EVENTO: ocre con calendario y borde papel. LUGAR: el color de su categoria con su
// icono y borde tinta (un lugar sin categoria usa el generico crema). PUNTO: el del selector, ocre con un
// punto papel. Seleccionado (todos): 48 px, borde tinta de 3 px y anillo interior dorado.
const EVENT_GLYPH = '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4m8-4v4"/>';
const DROP = 'M20 48C20 48 37 31.2 37 19A17 17 0 0 0 3 19C3 31.2 20 48 20 48Z';

export function pinColors(type, category) {
  if (type === 'LUGAR') {
    const colors = placeColors(category?.color);
    return { fill: colors.bg, border: '#173f36', glyphColor: colors.text, glyph: placeIconPath(category?.icon) };
  }
  if (type === 'PUNTO') return { fill: '#b8502b', border: '#fff9ec', glyphColor: '#fff9ec', glyph: '' };
  return { fill: '#b8502b', border: '#fff9ec', glyphColor: '#fff9ec', glyph: EVENT_GLYPH };
}

export function pinIcon(L, type = 'EVENTO', { selected = false, category = null } = {}) {
  const { fill, border, glyphColor, glyph } = pinColors(type, category);
  const width = selected ? 48 : 40;
  const height = selected ? 60 : 50;
  const boxW = width + 4;
  const boxH = height + 2;
  // El trazo va centrado en el borde: en unidades del viewBox (40 de ancho) equivale a 2 o 3 px reales.
  const stroke = selected ? (3 * 40) / 48 : 2;
  const icon = glyph
    ? `<g transform="translate(${selected ? 12.5 : 11} ${selected ? 11.5 : 10}) scale(${selected ? 0.625 : 0.75})" fill="none" stroke="${glyphColor}" stroke-width="${selected ? 2.6 : 2.2}" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>`
    : `<circle cx="20" cy="19" r="${selected ? 4.5 : 5.5}" fill="${glyphColor}"/>`;
  const ring = selected ? '<circle cx="20" cy="19" r="13.4" fill="none" stroke="#d4a843" stroke-width="2.2"/>' : '';
  return L.divIcon({
    className: `tejido-pin${selected ? ' tejido-pin--activo' : ''}`,
    iconSize: [boxW, boxH],
    iconAnchor: [boxW / 2, boxH],
    popupAnchor: [0, -height - 4],
    html: `<svg viewBox="0 0 40 50" width="${width}" height="${height}" aria-hidden="true" focusable="false">
      <path d="${DROP}" fill="${fill}" stroke="${selected ? '#173f36' : border}" stroke-width="${stroke}"/>${ring}${icon}</svg>`,
  });
}

// Grupo de puntos (Leaflet.markercluster): circulo tinta de 48 px con doble anillo solido (dorado y crema)
// y el numero entero en papel. Un solo tamaño; la caja mide 54 px (area tactil >= 44).
export function clusterIcon(L, count) {
  const size = count >= 1000 ? 'tejido-cluster--mil' : count >= 100 ? 'tejido-cluster--cien' : '';
  return L.divIcon({
    className: `tejido-cluster ${size}`.trim(),
    iconSize: [54, 54],
    iconAnchor: [27, 27],
    html: `<span aria-hidden="true">${count}</span>`,
  });
}

// "Tu ubicacion": circulo tinta con aro crema, sin interaccion.
export const userIcon = (L) => L.divIcon({ className: 'tejido-yo', iconSize: [26, 26], iconAnchor: [13, 13], html: '<span aria-hidden="true"></span>' });

// Etiqueta de un municipio en el modo ligero (sin teselas): punto y nombre sobre el lienzo papel.
export const townIcon = (L, name) => L.divIcon({ className: 'tejido-pueblo', iconSize: [0, 0], iconAnchor: [0, 0], html: `<span aria-hidden="true">${name}</span>` });

// "Como llegar": direcciones de Google Maps hasta las coordenadas (abre la app en el movil).
export const directionsUrl = (lat, lng) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

// Deep link del Mapa vivo: #mapa?evento=<id> o #mapa?lugar=<id> abren ese punto; #mapa?municipio=<slug>
// centra alli; tipo y categoria son los filtros (utils/mapFilters.js los valida).
const MUNICIPALITY_SLUGS = new Set(MUNICIPALITY_LIST.map(({ slug }) => slug));
const toId = (value) => (/^\d+$/.test(value || '') ? Number(value) : null);
export function parseMapHash(hash = window.location.hash) {
  const raw = hash.replace(/^#/, '');
  const params = new URLSearchParams(raw.startsWith('mapa?') ? raw.slice('mapa?'.length) : '');
  const municipio = params.get('municipio') || '';
  return { evento: toId(params.get('evento')), lugar: toId(params.get('lugar')), municipio: MUNICIPALITY_SLUGS.has(municipio) ? municipio : '' };
}
export function mapHash({ evento = null, lugar = null, municipio = '', tipo = '', categorias = [] } = {}) {
  const parts = [];
  if (municipio) parts.push(`municipio=${encodeURIComponent(municipio)}`);
  if (tipo) parts.push(`tipo=${encodeURIComponent(tipo)}`);
  if (tipo && categorias.length) parts.push(`categoria=${categorias.map(encodeURIComponent).join(',')}`);
  if (evento) parts.push(`evento=${evento}`);
  if (lugar) parts.push(`lugar=${lugar}`);
  return `#mapa${parts.length ? `?${parts.join('&')}` : ''}`;
}
export const eventMapHref = (id) => mapHash({ evento: id });
export const placeMapHref = (id) => mapHash({ lugar: id });
// Clave del punto pedido por el deep link (evento-<id> o lugar-<id>), o ''.
export const linkedKey = ({ evento, lugar }) => (evento ? `evento-${evento}` : lugar ? `lugar-${lugar}` : '');

// Enlaces de contacto de un lugar: tel: con solo digitos y "+", y WhatsApp (la API ya guarda los digitos con indicativo).
export const telHref = (phone) => `tel:${String(phone || '').replace(/[^\d+]/g, '')}`;
export const whatsappHref = (digits) => `https://wa.me/${String(digits || '').replace(/\D/g, '')}`;
