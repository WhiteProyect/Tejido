// Configuracion comun de los mapas reales (Mapa vivo y selector de punto). Leaflet 1.9.4 se carga de
// forma perezosa (loadLeaflet), asi no entra al paquete del inicio; su CSS viene con el. Teselas raster
// de OpenStreetMap por ahora (se cambia de proveedor al desplegar: TILE_URL y TILE_ATTRIBUTION).
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

let leafletPromise = null;
export function loadLeaflet() {
  if (!leafletPromise) {
    leafletPromise = Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]).then(([mod]) => mod.default || mod);
  }
  return leafletPromise;
}

export const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Mover el mapa: vuelo suave, o salto directo con movimiento reducido.
export function moveMap(map, center, zoom) {
  if (prefersReducedMotion()) map.setView(center, zoom, { animate: false });
  else map.flyTo(center, zoom, { duration: 0.8 });
}

// Pines propios (DivIcon con SVG; los iconos de imagen por defecto de Leaflet se rompen con Vite).
// EVENTO: tinta con aro dorado y calendario. LUGAR: el color de su categoria de lugar con su icono (trazo
// del color de texto de esa categoria) y aro tinta, que lo separa del mapa claro aunque el relleno sea
// crema o amarillo. Un lugar antiguo sin categoria usa el marcador generico en crema. PUNTO: el del selector.
export const PIN_STYLES = {
  EVENTO: { fill: '#173f36', ring: '#d4a843', glyph: 'M9 10h6M9 13h4M8 6V4m8 2V4M6 6h12v12H6z' },
  PUNTO: { fill: '#b8502b', ring: '#fff9ec', glyph: '' },
};

export function pinIcon(L, type = 'EVENTO', { selected = false, category = null } = {}) {
  const size = selected ? 46 : 38;
  let fill;
  let ring;
  let glyph;
  if (type === 'LUGAR') {
    const colors = placeColors(category?.color);
    fill = colors.bg;
    ring = '#173f36';
    glyph = `<g transform="translate(6.6 4.6) scale(.45)" fill="none" stroke="${colors.text}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${placeIconPath(category?.icon)}</g>`;
  } else {
    const style = PIN_STYLES[type] || PIN_STYLES.EVENTO;
    fill = style.fill;
    ring = style.ring;
    glyph = style.glyph
      ? `<path d="${style.glyph}" transform="translate(6 4) scale(.5)" fill="none" stroke="#fff9ec" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`
      : '<circle cx="12" cy="10" r="3.4" fill="#fff9ec"/>';
  }
  return L.divIcon({
    className: `tejido-pin${selected ? ' tejido-pin--activo' : ''}`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size + 4],
    html: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false">
      <path d="M12 23s7.5-7.6 7.5-13A7.5 7.5 0 0 0 4.5 10c0 5.4 7.5 13 7.5 13z" fill="${fill}" stroke="${ring}" stroke-width="1.6"/>
      ${glyph}</svg>`,
  });
}

// "Como llegar": direcciones de Google Maps hasta las coordenadas (abre la app en el movil).
export const directionsUrl = (lat, lng) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

// Deep link del Mapa vivo: #mapa?evento=<id> o #mapa?lugar=<id> abren ese punto; #mapa?municipio=<slug>
// centra alli.
const MUNICIPALITY_SLUGS = new Set(MUNICIPALITY_LIST.map(({ slug }) => slug));
const toId = (value) => (/^\d+$/.test(value || '') ? Number(value) : null);
export function parseMapHash(hash = window.location.hash) {
  const raw = hash.replace(/^#/, '');
  const params = new URLSearchParams(raw.startsWith('mapa?') ? raw.slice('mapa?'.length) : '');
  const municipio = params.get('municipio') || '';
  return { evento: toId(params.get('evento')), lugar: toId(params.get('lugar')), municipio: MUNICIPALITY_SLUGS.has(municipio) ? municipio : '' };
}
export function mapHash({ evento = null, lugar = null, municipio = '' } = {}) {
  const params = new URLSearchParams();
  if (municipio) params.set('municipio', municipio);
  if (evento) params.set('evento', String(evento));
  if (lugar) params.set('lugar', String(lugar));
  const query = params.toString();
  return `#mapa${query ? `?${query}` : ''}`;
}
export const eventMapHref = (id) => mapHash({ evento: id });
export const placeMapHref = (id) => mapHash({ lugar: id });
// Deep link de un punto del mapa segun su tipo.
export const pointHash = (point) => (point.type === 'LUGAR' ? mapHash({ lugar: point.id }) : mapHash({ evento: point.id }));
// Clave del punto pedido por el deep link (evento-<id> o lugar-<id>), o ''.
export const linkedKey = ({ evento, lugar }) => (evento ? `evento-${evento}` : lugar ? `lugar-${lugar}` : '');

// Enlaces de contacto de un lugar: tel: con solo digitos y "+", y WhatsApp (la API ya guarda los digitos con indicativo).
export const telHref = (phone) => `tel:${String(phone || '').replace(/[^\d+]/g, '')}`;
export const whatsappHref = (digits) => `https://wa.me/${String(digits || '').replace(/\D/g, '')}`;
