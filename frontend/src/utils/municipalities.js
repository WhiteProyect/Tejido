// ─── Municipios del Bajo Cauca: fuente única ───────────────────────────────────────────────
// Editable a mano (como timelineItems.js). De aquí salen la lista de municipios de los
// formularios, el mapa del inicio (HomeMapSection), las tarjetas del hero (utils/heroCards.js), el
// pasaporte y las pantallas #municipios y #municipio/<slug>. utils/constants.js reexporta las
// formas antiguas (MUNICIPALITIES, MUNICIPALITY_LOCATION_MAP) a partir de esta lista.
//
// Campos:
// - slug, name, emoji, color (el de siempre: pasaporte), theme.
// - icon: icono de components/Icon.jsx en las tarjetas del hero del inicio (sub-escena Historias del río).
// - accent: acento del diseño de las pantallas de municipio. Solo decorativo (bordes, puntos,
//   líneas): como texto no siempre llega a 4.5:1, por eso cada uno trae sus tonos de texto:
//   · accentText: texto sobre papel (#fff9ec) o blanco, ≥ 4.5:1.
//   · accentOnInk: texto sobre tinta (#173f36), ≥ 4.5:1.
// - phrase: frase poética de la portada territorial.
// - title, description, tags, image: los del mapa del inicio (sin cambios).
// - tagline: leyenda corta bajo el nombre en el mapa del inicio (se muestra en mayúsculas). Su punto
//   en el mapa vive en utils/geoMap.js (MUNICIPALITY_KNOTS).
// - locationKeywords: palabras para deducir el municipio de un lugar escrito a mano (las mismas
//   de backend/service/schemas/municipalities.py::MUNICIPALITY_KEYWORDS).
// - mapCaption: subtítulo del mini mapa (dónde queda el municipio en la subregión).
// - memory { title (subtítulo de la tarjeta), text, quote } y facts { location, altitudeClimate,
//   population, founded }: opcionales; lo que venga vacío no se muestra.
//
// - center: [lat, lng] de la cabecera, para el Mapa vivo y el selector de punto (PROVISIONAL: coinciden
//   con las cabeceras conocidas, sin verificar contra el DANE).
//
// PROVISIONAL: los textos de memory y casi todos los facts son de relleno, verosímiles pero NO
// verificados. Cada campo provisional lleva el comentario PROVISIONAL; reemplázalos por los
// datos reales (fuente: DANE, alcaldías) y borra el comentario.

export const MUNICIPALITY_LIST = [
  {
    slug: 'caucasia',
    icon: 'confluence',
    center: [7.9847, -75.1953], // PROVISIONAL: cabecera aproximada (lat, lng) para el Mapa vivo
    name: 'Caucasia',
    emoji: '🏰',
    color: '#d4a843',
    theme: 'Capital',
    accent: '#1d8fa3',
    accentText: '#1a7e8f',
    accentOnInk: '#5aadbc',
    phrase: 'Donde el río abraza la sabana y la cultura se encuentra.',
    title: 'Capital del Bajo Cauca',
    description: 'Centro comercial y administrativo de la región, ubicada en la confluencia de los ríos Cauca y Nechí. Capital del Bajo Cauca, fundada en 1866.',
    tags: ['Capital', 'Confluencia', 'Comercio'],
    image: '/images/municipios/caucasia/portada.jpg',
    tagline: 'Capital',
    mapCaption: 'Norte de la subregión', // PROVISIONAL
    locationKeywords: ['caucasia', 'malecón', 'parque de las banderas', 'parques de caucasia', 'pando'],
    memory: {
      title: 'Un puerto que se volvió encuentro', // PROVISIONAL
      // PROVISIONAL
      text: 'Caucasia creció al ritmo del río: primero como puerto de paso para canoas y champanes, después como cruce de caminos entre la sabana y la montaña. Sus barrios guardan la memoria de quienes llegaron de todas partes a quedarse junto al Cauca.',
      // PROVISIONAL
      quote: '“Aquí el río no divide: junta a los que llegan con los que siempre estuvieron.”',
    },
    facts: {
      location: 'Margen izquierda del río Cauca', // PROVISIONAL
      altitudeClimate: '50 m s. n. m. · 28 °C', // PROVISIONAL
      population: '≈ 120.000 habitantes', // PROVISIONAL
      founded: '1866', // el que ya usa el sitio (el diseño dice 12 de abril de 1886: por confirmar)
    },
  },
  {
    slug: 'caceres',
    icon: 'columns',
    center: [7.5782, -75.3514], // PROVISIONAL: cabecera aproximada (lat, lng) para el Mapa vivo
    name: 'Cáceres',
    emoji: '🏛',
    color: '#1d8fa3',
    theme: 'Historia',
    accent: '#9b72a6',
    accentText: '#8a6594',
    accentOnInk: '#b597bd',
    phrase: 'Siglos de historia ribereña escritos a la orilla del Cauca.',
    title: 'Historia y Tradición',
    description: 'Fundado en 1576. Uno de los pueblos más antiguos de Antioquia con rica historia minera y tradición colonial que se respira en sus calles empedradas.',
    tags: ['Colonial', 'Minería', 'Historia'],
    image: '/images/municipios/caceres/portada.jpg',
    tagline: 'Historia',
    mapCaption: 'Occidente, sobre el río Cauca', // PROVISIONAL
    locationKeywords: ['cáceres', 'caceres'],
    memory: {
      title: 'Piedra, río y memoria colonial', // PROVISIONAL
      // PROVISIONAL
      text: 'Entre las piedras de sus calles y los recodos del río, Cáceres guarda relatos de mineros, bogas y familias que han hecho del oficio y la fiesta una forma de recordar.',
      // PROVISIONAL
      quote: '“Cada calle empedrada tiene un abuelo que la cuenta.”',
    },
    facts: {
      location: 'Orilla derecha del río Cauca', // PROVISIONAL
      altitudeClimate: '100 m s. n. m. · 28 °C', // PROVISIONAL
      population: '≈ 38.000 habitantes', // PROVISIONAL
      founded: '1576', // del sitio
    },
  },
  {
    slug: 'taraza',
    icon: 'coffee',
    center: [7.5758, -75.4003], // PROVISIONAL: cabecera aproximada (lat, lng) para el Mapa vivo
    name: 'Tarazá',
    emoji: '☕',
    color: '#75b79b',
    theme: 'Café',
    accent: '#88c5a4',
    accentText: '#547a66',
    accentOnInk: '#88c5a4',
    phrase: 'Puerta verde donde la montaña baja a conversar con el río.',
    title: 'Tierra de Café',
    description: 'Tierra de cafetaleros y tradición campesina. Conocido por su calidez humana, producción agrícola y los paisajes verdes de sus montañas.',
    tags: ['Café', 'Agricultura', 'Campesinos'],
    image: '/images/municipios/taraza/portada.jpg',
    tagline: 'Café',
    mapCaption: 'Suroccidente, puerta de la montaña', // PROVISIONAL
    locationKeywords: ['tarazá', 'taraza'],
    memory: {
      title: 'Donde la montaña baja al río', // PROVISIONAL
      // PROVISIONAL
      text: 'En Tarazá la montaña empieza a volverse llanura. Sus veredas cafeteras y sus mercados campesinos hablan de manos que siembran, cosechan y comparten la mesa.',
      // PROVISIONAL
      quote: '“El café de aquí sabe a madrugada y a monte.”',
    },
    facts: {
      location: 'Piedemonte de la cordillera Central', // PROVISIONAL
      altitudeClimate: '125 m s. n. m. · 27 °C', // PROVISIONAL
      population: '≈ 32.000 habitantes', // PROVISIONAL
      founded: '1953', // PROVISIONAL
    },
  },
  {
    slug: 'nechi',
    icon: 'waves',
    center: [8.0941, -74.7788], // PROVISIONAL: cabecera aproximada (lat, lng) para el Mapa vivo
    name: 'Nechí',
    emoji: '🌊',
    color: '#1d8fa3',
    theme: 'Río',
    accent: '#1d8fa3',
    accentText: '#1a7e8f',
    accentOnInk: '#5aadbc',
    phrase: 'Encuentro de dos aguas y memoria ancestral que canta.',
    title: 'Río y Tradición Minera',
    description: 'Fundado en 1636 como campamento minero. Hogar de comunidades afrocolombianas que mantienen vivas las tradiciones ancestrales del río.',
    tags: ['Minería', 'Afrocolombiano', 'Río'],
    image: '/images/municipios/nechi/portada.jpg',
    tagline: 'Río',
    mapCaption: 'Nororiente, donde confluyen el Nechí y el Cauca', // PROVISIONAL
    locationKeywords: ['nechí', 'nechi'],
    memory: {
      title: 'Cantos de dos aguas', // PROVISIONAL
      // PROVISIONAL
      text: 'Donde el Nechí se encuentra con el Cauca, las comunidades afrodescendientes han tejido cantos, bailes y oficios del río que pasan de generación en generación.',
      // PROVISIONAL
      quote: '“El río nos enseñó a cantar mientras trabajamos.”',
    },
    facts: {
      location: 'Confluencia de los ríos Nechí y Cauca', // PROVISIONAL
      altitudeClimate: '30 m s. n. m. · 28 °C', // PROVISIONAL
      population: '≈ 29.000 habitantes', // PROVISIONAL
      founded: '1636', // del sitio
    },
  },
  {
    slug: 'elbagre',
    icon: 'gem',
    center: [7.5973, -74.8120], // PROVISIONAL: cabecera aproximada (lat, lng) para el Mapa vivo
    name: 'El Bagre',
    emoji: '⭐',
    color: '#d4a843',
    theme: 'Oro',
    accent: '#d4a843',
    accentText: '#8c6f2c',
    accentOnInk: '#d4a843',
    phrase: 'Brillo de río, herencia aurífera y ritmo que nace del monte.',
    title: 'Cuna de Artistas',
    description: 'Primer productor de oro de Antioquia. Tierra de artistas y músicos que enamoran con su folklore y la alegría de su gente.',
    tags: ['Oro', 'Folklore', 'Música'],
    image: '/images/municipios/elbagre/portada.jpg',
    tagline: 'Oro',
    mapCaption: 'Oriente, en la ribera del Nechí', // PROVISIONAL
    locationKeywords: ['el bagre', 'bagre'],
    memory: {
      title: 'Oro, fiesta y música', // PROVISIONAL
      // PROVISIONAL
      text: 'El Bagre lleva el oro en su historia y la música en su gente. Sus fiestas, sus bandas y sus cantadoras convierten la memoria minera en ritmo.',
      // PROVISIONAL
      quote: '“Aquí el oro brilla, pero la fiesta brilla más.”',
    },
    facts: {
      location: 'Ribera del río Nechí', // PROVISIONAL
      altitudeClimate: '50 m s. n. m. · 28 °C', // PROVISIONAL
      population: '≈ 50.000 habitantes', // PROVISIONAL
      founded: '1675', // PROVISIONAL
    },
  },
  {
    slug: 'zaragoza',
    icon: 'anchor',
    center: [7.4889, -74.8667], // PROVISIONAL: cabecera aproximada (lat, lng) para el Mapa vivo
    name: 'Zaragoza',
    emoji: '⚓',
    color: '#8a4f7d',
    theme: 'Fundación',
    accent: '#c85a32',
    accentText: '#ba542e',
    accentOnInk: '#da8f74',
    phrase: 'Caminos de historia colonial entre quebradas y selva viva.',
    title: 'Municipio Fundado',
    description: 'Fundado en 1581. Pueblo con historia minera milenaria y paisajes naturales impresionantes donde el río Cauca narra historias.',
    tags: ['Fundación', 'Naturaleza', 'Minería'],
    image: '/images/municipios/zaragoza/portada.jpg',
    tagline: 'Fundación',
    mapCaption: 'Suroriente de la subregión', // PROVISIONAL
    locationKeywords: ['zaragoza'],
    memory: {
      title: 'Caminos que vuelven a casa', // PROVISIONAL
      // PROVISIONAL
      text: 'Zaragoza fue de los primeros asentamientos mineros de la región. Entre quebradas y selva, sus caminos antiguos todavía cuentan la historia de quienes buscaron oro y se quedaron por la tierra.',
      // PROVISIONAL
      quote: '“Los caminos viejos siguen llevando a casa.”',
    },
    facts: {
      location: 'Valle del río Nechí, al sur del Bajo Cauca', // PROVISIONAL
      altitudeClimate: '50 m s. n. m. · 27 °C', // PROVISIONAL
      population: '≈ 31.000 habitantes', // PROVISIONAL
      founded: '1581', // del sitio
    },
  },
];

export const MUNICIPALITY_BY_SLUG = Object.fromEntries(MUNICIPALITY_LIST.map((municipality) => [municipality.slug, municipality]));

export function getMunicipality(slug) {
  return MUNICIPALITY_BY_SLUG[slug] || null;
}

// Centro de un municipio para los mapas reales (Leaflet); Caucasia si no hay o no existe.
export const DEFAULT_MAP_CENTER = MUNICIPALITY_BY_SLUG.caucasia.center;
export const municipalityCenter = (slug) => MUNICIPALITY_BY_SLUG[slug]?.center || DEFAULT_MAP_CENTER;
