// Hitos de "El hilo del tiempo" (TimelineSection, landing). Contenido fijo: se edita aqui, no
// viene de la base. Se muestran ordenados por fecha, sin importar el orden de esta lista.
//
// Cada hito:
//   id       unico (cualquier texto o numero)
//   date     fecha ISO 'AAAA-MM-DD' (de ahi salen el anio grande y "dia mes")
//   kind     EVENTO | HISTORIA | TALENTO | OPORTUNIDAD | INICIATIVA (define icono y etiqueta)
//   title    titulo del hito
//   summary  texto corto (se corta a 3 lineas)
//   location lugar (si se deja vacio sale "Caucasia")
export const TIMELINE_ITEMS = [
  {
    id: 'INFIERNO-HOUSE',
    date: '2023-03-23',
    kind: 'EVENTO',
    title: 'INFIERNO HOUSE',
    summary: 'Primer golpe de money stack en caucasia.',
    location: 'Containers / caucasia - antioquia',
  },
  {
    id: 'Bajo-cauca-fest',
    date: '2022-12-02',
    kind: 'EVENTO',
    title: 'BAJO CAUCA FEST',
    summary: 'Primer festival de Rock en el bajo cauca.',
    location: 'Parque de la ceiba',
  },
  {
    id: 'festival-rio-y-sabana-2026',
    date: '2026-07-18',
    kind: 'EVENTO',
    title: 'Festival Río y Sabana 2026',
    summary: 'Música, gastronomía y emprendimiento junto al río Cauca.',
    location: 'Malecón de Caucasia',
  },
];