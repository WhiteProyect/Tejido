// Iconos de las categorias de lugar (conjunto cerrado; backend: schemas/places.py::PLACE_ICONS). Una sola
// fuente de trazos para la interfaz (components/PlaceIcon.jsx) y para los pines del mapa (mapConfig.js,
// que los incrusta en el HTML del marcador). Reticula 24x24, trazo 1.5, sin rellenos (como Icon.jsx).
export const PLACE_ICON_PATHS = {
  utensils: '<path d="M7 3v5a2 2 0 0 0 4 0V3M9 3v18M17 21V3c-2.2 1.3-3 3.8-3 7.5V13h3"/>',
  bed: '<path d="M3 6v13M3 15h18v4M21 15v-3a3 3 0 0 0-3-3h-7v6"/><circle cx="7" cy="11.5" r="1.8"/>',
  binoculars: '<circle cx="6.5" cy="16" r="3.5"/><circle cx="17.5" cy="16" r="3.5"/><path d="M10 16h4M4 13.5 6 5h3.5l.5 8M20 13.5 18 5h-3.5l-.5 8"/>',
  tree: '<path d="M12 21v-5M12 3 6.5 10.5H9L5.5 16h13L15 10.5h2.5z"/>',
  ball: '<circle cx="12" cy="12" r="8.5"/><path d="m12 8.2 3.2 2.3-1.2 3.8h-4l-1.2-3.8zM12 8.2V3.5m3.2 7 4.3-1.4M14 14.3l2.6 3.6M10 14.3l-2.6 3.6m1.4-7.4L4.5 9.1"/>',
  store: '<path d="M4 9.5 5.5 4h13L20 9.5M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0M5.5 12.5V20h13v-7.5M10 20v-4.5h4V20"/>',
  landmark: '<path d="M3 21h18M5 18h14M4 9.5h16L12 4zM6.5 9.5V18m3.8-8.5V18m3.4-8.5V18m3.8-8.5V18"/>',
  pin: '<path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z"/><circle cx="12" cy="11" r="2"/>',
  coffee: '<path d="M5 10h11v4a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5v-4zm11 1h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M9 4.5c0 1 1 1.5 1 2.5m2.5-2.5c0 1 1 1.5 1 2.5"/>',
  waves: '<path d="M3 10c2 0 2-1.5 4.5-1.5S9.5 10 12 10s2-1.5 4.5-1.5S19 10 21 10M3 15.5c2 0 2-1.5 4.5-1.5s2 1.5 4.5 1.5 2-1.5 4.5-1.5 2.5 1.5 4.5 1.5"/>',
};

// Nombre de cada icono para el selector del panel de categorias.
export const PLACE_ICON_LABELS = {
  utensils: 'Cubiertos', bed: 'Cama', binoculars: 'Binoculares', tree: 'Árbol', ball: 'Balón', store: 'Tienda',
  landmark: 'Edificio patrimonial', pin: 'Marcador', coffee: 'Taza', waves: 'Olas',
};

export const PLACE_ICON_KEYS = Object.keys(PLACE_ICON_PATHS);
export const placeIconPath = (icon) => PLACE_ICON_PATHS[icon] || PLACE_ICON_PATHS.pin;
