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
    id: 'biblioteca-al-parque',
    date: '2026-07-04',
    kind: 'INICIATIVA',
    title: 'Biblioteca al parque',
    summary: 'Lecturas, juegos y conversación cada sábado.',
    location: 'Parques de Caucasia',
  },
  {
    id: 'mercado-hecho-en-caucasia',
    date: '2026-07-11',
    kind: 'EVENTO',
    title: 'Mercado Hecho en Caucasia',
    summary: 'Emprendimientos locales, música y cocina en un solo lugar.',
    location: 'Parque de las Banderas',
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
