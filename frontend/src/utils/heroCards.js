// Tarjetas del hero del inicio (HeroInteractive): la navegacion rapida de TEJIDO. Una sola fuente.
// - Cinco van directo a su pantalla (href). Sus rutas y textos salen de las pestañas del header
//   (NAV_LINKS / NAV_DESCRIPTIONS, utils/navSections.js): renombrar una pestaña no rompe el hero.
// - Dos abren una sub-escena (scene): Historias del rio (los 6 municipios, de utils/municipalities.js)
//   y Artistas (dos caminos).
// Colores de la paleta de TEJIDO (HERO_COLORS), sin repetir vecinos. Dorado y menta van en su tono
// oscuro: los claros (#d4a843, #75b79b) dan ~2:1 como icono sobre su fondo tintado. Cifras del icono
// sobre el tinte (12 % de su color sobre la tarjeta): rio 4,66; dorado 4,98; bosque 6,25; ocre 4,02;
// morado 4,82; menta 4,05; tinta 8,93.
import { MUNICIPALITY_LIST } from './municipalities.js';
import { NAV_DESCRIPTIONS, NAV_LINKS } from './navSections.js';

export const HERO_COLORS = {
  tinta: '#173f36', rio: '#146f80', dorado: '#7a5c12', menta: '#2e7d5b', morado: '#8a4f7d', ocre: '#b8502b', bosque: '#2d5a3d',
};

// Destino de "Artistas de TEJIDO": la pantalla de artistas (screens/ArtistsScreen.jsx).
export const ARTISTS_TEJIDO_ROUTE = '#artistas';

const NAV = Object.fromEntries(NAV_LINKS);
// Ruta de una pestaña del header por su clave (la clave es la ruta; la etiqueta puede cambiar).
const navHref = (key) => `#${key}`;
function navCard(key, { id = key, label = NAV[key], sub = NAV_DESCRIPTIONS[key], icon, color }) {
  return { id, label, sub, icon, color, href: navHref(key) };
}

export const HERO_CARDS = [
  { id: 'historias', label: 'Historias del río', sub: 'Lo que el Cauca cuenta', icon: 'book', color: HERO_COLORS.rio, scene: 'historias',
    action: 'Historias del río: ver municipios' },
  navCard('explorar', { label: 'Ramas de cultura', sub: 'Categorías', icon: 'palette', color: HERO_COLORS.dorado }),
  navCard('mapa', { icon: 'map', color: HERO_COLORS.bosque }),
  navCard('agenda', { icon: 'calendar', color: HERO_COLORS.ocre }),
  navCard('oportunidades', { icon: 'door', color: HERO_COLORS.morado }),
  navCard('talento', { icon: 'mic', color: HERO_COLORS.menta }),
  { id: 'artistas', label: 'Artistas', sub: 'Las voces del Bajo Cauca', icon: 'music', color: HERO_COLORS.tinta, scene: 'artistas',
    action: 'Artistas: ver caminos' },
];

// Sub-escenas: pose y fondo de Hilo, su mensaje y las opciones (todas enlaces). En los municipios el
// subtexto es su `title` de utils/municipalities.js (sin años ni datos provisionales) y el color, su
// `accentText` (texto >= 4,5:1 sobre papel; ~3,9:1 como icono sobre el tinte).
export const HERO_SCENES = {
  historias: {
    pose: 'hilo-senala.png',
    background: 'river',
    message: 'Las historias nacen del río. Cada piedra guarda un secreto. ¿De cuál municipio quieres saber?',
    options: MUNICIPALITY_LIST.map(({ slug, name, title, icon, accentText }) => ({
      id: slug, label: name, sub: title, icon, color: accentText, href: `#municipio/${slug}`,
    })),
    more: { label: 'Ver todos los municipios', href: navHref('municipios') },
  },
  artistas: {
    pose: 'hilo-descubre.png',
    background: 'music',
    message: 'Los artistas del Bajo Cauca cuentan historias que el río guarda. ¿Qué camino quieres recorrer?',
    options: [
      { id: 'artistas-tejido', label: 'Artistas de TEJIDO', sub: 'Música y más del territorio', icon: 'mic', color: HERO_COLORS.morado, href: ARTISTS_TEJIDO_ROUTE },
      navCard('moneystack', { id: 'moneystack', label: 'Sello Moneystack', sub: 'El sello del territorio', icon: 'music', color: HERO_COLORS.tinta }),
    ],
  },
};
