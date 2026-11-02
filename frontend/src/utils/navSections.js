// Pestañas del header, en orden, compartidas por SiteHeader (tab bar y menu movil) y App (direccion
// del deslizamiento del contenido). "Municipios" va junto a Explorar: las dos son puertas de entrada
// al territorio (por tema y por lugar).
export const NAV_LINKS = [
  ['inicio', 'Inicio'],
  ['explorar', 'Explorar'],
  ['municipios', 'Municipios'],
  ['mapa', 'Mapa vivo'],
  ['agenda', 'Agenda'],
  ['oportunidades', 'Oportunidades'],
  ['talento', 'Talento'],
  ['nosotros', 'Nosotros'],
  ['moneystack', 'Moneystack'],
];

// Micro-descripciones del menu movil (components/MobileMenu.jsx), editables. Municipios no va como
// fila: lo cubre el bloque de territorios del menu.
export const NAV_DESCRIPTIONS = {
  inicio: 'Portada',
  explorar: 'Categorías',
  mapa: 'Lugares',
  agenda: 'Eventos',
  oportunidades: 'Convocatorias',
  talento: 'Creadores',
  nosotros: 'El proyecto',
  moneystack: 'Sello Musical',
};

// Por debajo de este ancho las pestañas no caben centradas entre el logo y el acceso: menu hamburguesa
// (el mismo corte que la variante `navcompact` de styles/tailwind.css).
export const NAV_COMPACT_QUERY = '(max-width: 1279px)';

// Pantallas hijas (route.screen de App) que cuentan para una pestaña.
const PARENT = {
  municipio: 'municipios',
  categoria: 'explorar',
  'talento-perfil': 'talento',
  'talento-vista-previa': 'talento',
};

// Pestaña activa de una pantalla (route.screen), o null si no pertenece a ninguna (perfil, login...).
export function activeSection(screen) {
  const key = PARENT[screen] || screen;
  return NAV_LINKS.some(([link]) => link === key) ? key : null;
}

// Posicion de la pestaña de una pantalla, o null.
export function navIndex(screen) {
  const key = activeSection(screen);
  return key ? NAV_LINKS.findIndex(([link]) => link === key) : null;
}
