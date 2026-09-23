// Sistema de iconos del landing: SVG inline propios, sin libreria.
//
// Reglas (ver MANUAL_ESENCIA_TEJIDO.md y frontend/README.md):
// - Reticula 24x24, trazo fino (1.5), extremos y uniones redondeados, sin rellenos.
// - El color sale de `currentColor`: el contenedor decide (text-ink, text-gold...).
// - Los iconos NO se animan. El movimiento pertenece a la linea de tiempo, a las
//   transiciones de interfaz o a los estados de interaccion del contenedor.
// - Hilo, logos, mapas e ilustraciones territoriales no son iconos: no van aqui.
//
// Uso: <Icon name="book" className="size-6 text-ink" />. Decorativo por defecto
// (aria-hidden); con `title` se anuncia a lectores de pantalla.

const PATHS = {
  // Navegacion y controles
  'arrow-left': <path d="M19 12H5m6-6-6 6 6 6" />,
  'arrow-right': <path d="M5 12h14m-6-6 6 6-6 6" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  search: <><circle cx="11" cy="11" r="6" /><path d="m20 20-4.5-4.5" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  circle: <circle cx="12" cy="12" r="6" />,
  pin: <><path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z" /><circle cx="12" cy="11" r="2" /></>,
  play: <path d="M8 5v14l11-7z" />,
  share: <><circle cx="17.5" cy="5.5" r="2.5" /><circle cx="6.5" cy="12" r="2.5" /><circle cx="17.5" cy="18.5" r="2.5" /><path d="m8.7 13.3 6.6 3.9m0-10.4-6.6 3.9" /></>,

  // Temas y tipos de contenido
  book: <><path d="M12 6.5C10.5 5.3 8.3 4.8 4 5v13c4.3-.2 6.5.3 8 1.5 1.5-1.2 3.7-1.7 8-1.5V5c-4.3-.2-6.5.3-8 1.5z" /><path d="M12 6.5v13" /></>,
  people: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5" /><circle cx="16.5" cy="9" r="2.5" /><path d="M15.8 14.6c2.5-.2 4.2 1.2 4.7 3.9" /></>,
  music: <><path d="M9 18V6l10-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="16.5" cy="16" r="2.5" /></>,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></>,
  palette: <><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.8 1.8-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8z" /><circle cx="7.5" cy="11.5" r=".8" /><circle cx="10" cy="7.5" r=".8" /><circle cx="14.5" cy="7.5" r=".8" /></>,
  drum: <><ellipse cx="12" cy="8" rx="7" ry="2.5" /><path d="M5 8v8c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V8M8 2.5l3 4M16 2.5l-3 4" /></>,
  thread: <path d="M6 4h12M6 20h12M8 4v16m8-16v16M8 7.5l8 2.5M8 11.5l8 2.5M8 15.5l8 2.5m0 0c2 .2 3 1 3 2.5" />,
  calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M8 3v4m8-4v4" /></>,
  sprout: <><path d="M12 21v-9" /><path d="M12 12c0-4 3-6 7-6 0 4-3 6-7 6zm0 2c0-3-2.5-5-6-5 0 3 2.5 5 6 5z" /></>,
  bookmark: <path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1z" />,
  inbox: <><path d="M4 13.5 6.5 5h11l2.5 8.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5.5z" /><path d="M4 13.5h4.5l1.5 2.5h4l1.5-2.5H20" /></>,
  pen: <path d="M4.5 19.5 5.5 15 15.8 4.7a1.8 1.8 0 0 1 2.5 0l1 1a1.8 1.8 0 0 1 0 2.5L9 18.5l-4.5 1zM14 6.5l3.5 3.5" />,
  send: <path d="M20.5 3.5 10 14M20.5 3.5 14 20.5l-4-6.5-6.5-4 17-6.5z" />,
  logout: <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10" />,
  compass: <><circle cx="12" cy="12" r="8.5" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2z" /></>,
  seal: <><circle cx="12" cy="9" r="5.5" /><path d="M8.6 13.4 7 21l5-2.5 5 2.5-1.6-7.6" /></>,

  // Municipios del Bajo Cauca
  confluence: <path d="M4 4c0 5 4 6.5 8 9m8-9c0 5-4 6.5-8 9m0 0v7" />,
  columns: <path d="M4 9l8-5 8 5H4zm1 11h14M5 17h14M7.5 9v8m4.5-8v8m4.5-8v8" />,
  coffee: <><path d="M5 10h11v4a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5v-4zm11 1h1.5a2.5 2.5 0 0 1 0 5H16" /><path d="M9 4.5c0 1 1 1.5 1 2.5m2.5-2.5c0 1 1 1.5 1 2.5" /></>,
  waves: <path d="M3 10c2 0 2-1.5 4.5-1.5S9.5 10 12 10s2-1.5 4.5-1.5S19 10 21 10M3 15.5c2 0 2-1.5 4.5-1.5s2 1.5 4.5 1.5 2-1.5 4.5-1.5 2.5 1.5 4.5 1.5" />,
  gem: <path d="M6.5 4h11L21 9l-9 11L3 9l3.5-5zM3 9h18M9 4l-.5 5L12 20l3.5-11L15 4" />,
  anchor: <><circle cx="12" cy="5" r="2" /><path d="M12 7v13m-4-10h8M5 13a7 7 0 0 0 14 0" /></>,

  // Redes (version de trazo, no logos oficiales)
  instagram: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><path d="M17.5 6.5h.01" /></>,
  youtube: <><rect x="2.5" y="5.5" width="19" height="13" rx="4" /><path d="M10 9.5v5l4.5-2.5-4.5-2.5z" /></>,
  spotify: <><circle cx="12" cy="12" r="9" /><path d="M7.5 9.5c3-1 6.5-.8 9 .7M8 12.8c2.4-.7 5-.5 7 .6m-6.3 2.4c1.8-.4 3.6-.3 5 .5" /></>,
};

export default function Icon({ name, className = 'size-6', strokeWidth = 1.5, title }) {
  const shape = PATHS[name];
  if (!shape) return null;
  return (
    <svg
      className={`shrink-0 ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : undefined}
      focusable="false"
    >
      {title && <title>{title}</title>}
      {shape}
    </svg>
  );
}
