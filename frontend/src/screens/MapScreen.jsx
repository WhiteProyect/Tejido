/**
 * MAPSCREEN.JSX — Mapa Interactivo del Bajo Cauca
 *
 * Pantalla que muestra un mapa real de OpenStreetMap con:
 * - Filtros por tipo de publicación (Eventos, Historias, Talento, etc.)
 * - Sidebar con lista de publicaciones filtradas
 * - Tarjeta de detalle al seleccionar un punto
 * - Coordenadas reales de lugares conocidos de Caucasia
 *
 * Basado en el módulo legacy map.js del frontend vanilla JS.
 * Portado a React como parte de la FASE 1 del plan de magia.
 */

import { useState, useMemo } from 'react';
import ScreenIntro from '../components/ScreenIntro.jsx';
import { SCREEN_SECTION } from '../components/uiStyles.js';
import { KIND_COLORS, KIND_LABELS, normalizeText } from '../utils/constants.js';

const KNOWN_PLACES = [
  { name: 'malecón de caucasia', coords: [7.9892, -75.1987] },
  { name: 'el pando', coords: [7.9768, -75.2052] },
  { name: 'parque de las banderas', coords: [7.9828, -75.1998] },
  { name: 'parques de caucasia', coords: [7.9817, -75.1879] },
];

const CAUCASIA_CENTER = [7.9865, -75.1935];

const MAP_FILTERS = [
  { key: 'TODOS', label: 'Todo' },
  { key: 'HISTORIA', label: 'Historias' },
  { key: 'EVENTO', label: 'Eventos' },
  { key: 'OPORTUNIDAD', label: 'Oportunidades' },
  { key: 'TALENTO', label: 'Talento' },
  { key: 'INICIATIVA', label: 'Iniciativas' },
];

/**
 * Obtiene coordenadas GPS para una publicación basándose en su campo location.
 * Busca coincidencias parciales en los lugares conocidos.
 * Si no hay coincidencia, retorna el centro de Caucasia.
 */
function getPublicationCoords(pub) {
  const location = normalizeText(pub.location || 'Caucasia');
  const match = KNOWN_PLACES.find((place) =>
    location.includes(normalizeText(place.name))
  );
  return match ? match.coords : CAUCASIA_CENTER;
}

/**
 * Genera la URL del embed de OpenStreetMap.
 * Calcula un bounding box alrededor de las coordenadas para encuadre óptimo.
 */
function getMapEmbedUrl(coords = CAUCASIA_CENTER) {
  const [lat, lon] = coords;
  // Bounding box: ±0.008 grados de longitud, ±0.005 de latitud
  const bbox = [lon - 0.008, lat - 0.005, lon + 0.008, lat + 0.005].join(',');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${lat},${lon}`)}`;
}

/**
 * Genera la URL para abrir la ubicación en OpenStreetMap (nueva pestaña).
 */
function getOsmUrl(coords = CAUCASIA_CENTER) {
  const [lat, lon] = coords;
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`;
}

/**
 * Genera la URL del embed por defecto (vista general de Caucasia).
 */
function getDefaultEmbedUrl() {
  return 'https://www.openstreetmap.org/export/embed.html?bbox=-75.222%2C7.964%2C-75.166%2C8.006&layer=mapnik';
}

// Chip de filtro y fila del sidebar: base + estado excluyente. En el legado `:hover` y
// `.active` compartian regla, asi que el hover va en la base.
const CHIP = 'border border-[rgba(23,58,49,0.25)] rounded-[999px] cursor-pointer text-[12px] font-extrabold py-[9px] px-[15px] transition-[background,color] duration-150 ease-[ease] hover:bg-ink hover:text-white max600:whitespace-nowrap';
const ITEM = 'items-start border rounded-[14px] cursor-pointer flex gap-2.5 py-3 px-3.5 transition-[background,border-color] duration-150 ease-[ease] text-left hover:bg-[#eef6f0] hover:border-[rgba(23,58,49,0.12)] max600:py-2.5 max600:px-3';
// Parrafos del detalle. En el legado `.map-detail-card p` (0,1,1) le ganaba a
// `.map-detail-meta` (0,1,0): la linea de metadatos tambien sale a 14 px y con este margen.
const DETAIL_P = 'text-muted text-[14px] leading-[1.5] mt-0 mx-0 mb-3';

export default function MapScreen({ publications = [] }) {
  /** Filtro activo: 'TODOS' por defecto, o el kind seleccionado */
  const [activeFilter, setActiveFilter] = useState('TODOS');

  /** ID de la publicación seleccionada en el sidebar */
  const [selectedId, setSelectedId] = useState(null);

  /**
   * Publicaciones filtradas según el filtro activo.
   * Se recalcula solo cuando cambia publications o activeFilter.
   */
  const filteredPubs = useMemo(() => {
    if (activeFilter === 'TODOS') return publications;
    return publications.filter((p) => p.kind === activeFilter);
  }, [publications, activeFilter]);

  /**
   * Publicación actualmente seleccionada.
   * Se busca por ID para obtener sus datos completos.
   */
  const selectedPub = useMemo(() => {
    if (!selectedId) return null;
    return publications.find((p) => p.id === selectedId) || null;
  }, [publications, selectedId]);

  /**
   * URL del iframe del mapa.
   * Si hay una publicación seleccionada, centra en sus coordenadas.
   * Si no, muestra la vista general de Caucasia.
   */
  const mapUrl = selectedPub
    ? getMapEmbedUrl(getPublicationCoords(selectedPub))
    : getDefaultEmbedUrl();

  /**
   * Maneja el clic en una publicación del sidebar.
   * Actualiza la selección y centra el mapa en esa ubicación.
   */
  function handleSelectPub(id) {
    setSelectedId(id === selectedId ? null : id);
  }

  return (
    <section className={SCREEN_SECTION}>
      {/* Encabezado de la pantalla */}
      <ScreenIntro
        eyebrow="Memoria, río y comunidad"
        title="Mapa vivo"
        description="Descubre dónde nacen las historias, eventos y talentos de Caucasia y el Bajo Cauca."
      />

      {/* Barra de filtros por tipo de publicación */}
      <div className="flex flex-wrap gap-2 mb-6 max600:flex-nowrap max600:overflow-x-auto max600:pb-[5px] max600:[scrollbar-width:none] max600:[&::-webkit-scrollbar]:hidden">
        {MAP_FILTERS.map((filter) => (
          <button
            key={filter.key}
            className={`${CHIP} ${activeFilter === filter.key ? 'bg-ink text-white' : 'bg-[rgba(255,255,255,0.65)] text-ink'}`}
            onClick={() => {
              setActiveFilter(filter.key);
              setSelectedId(null); // Limpiar selección al cambiar filtro
            }}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Layout principal: mapa + sidebar */}
      <div className="grid gap-[22px] grid-cols-[minmax(0,1.65fr)_minmax(280px,0.6fr)] max900:grid-cols-[1fr]">
        {/* Mapa de OpenStreetMap embebido */}
        <div className="min-h-[540px] rounded-[30px] relative overflow-hidden bg-[#d6e7d4] [box-shadow:inset_0_0_0_1px_rgba(23,58,49,0.1)] max900:min-h-[470px] max600:rounded-[22px] max600:min-h-[400px]">
          <iframe
            className="w-full h-full min-h-[540px] border-0 block max900:min-h-[470px] max600:min-h-[400px] max600:rounded-[22px]"
            src={mapUrl}
            title="Mapa interactivo de Caucasia"
            loading="lazy"
          />

          {/* Leyenda de colores del mapa */}
          <div className="absolute z-10 right-3.5 bottom-3.5 flex gap-2.5 py-2.5 px-3.5 bg-[rgba(255,253,248,0.94)] backdrop-blur-[8px] rounded-[14px] [box-shadow:0_5px_14px_rgba(23,58,49,0.12)] text-[10px] font-bold">
            {Object.entries(KIND_COLORS).map(([kind, color]) => (
              <div key={kind} className="flex items-center gap-[5px] whitespace-nowrap">
                <span className="w-2.5 h-2.5 rounded-[50%] shrink-0" style={{ background: color }} />
                <span>{KIND_LABELS[kind]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar con lista de publicaciones filtradas */}
        <aside className="bg-[rgba(255,255,255,0.95)] backdrop-blur-[16px] border border-[rgba(23,58,49,0.06)] rounded-[20px] [box-shadow:0_12px_40px_rgba(18,60,52,0.14)] flex flex-col max-h-[600px] overflow-hidden p-6 max900:max-h-[40vh] max600:rounded-[16px] max600:max-h-[35vh] max600:p-3.5">
          <div className="border-b border-b-[rgba(23,58,49,0.08)] mb-[18px] pb-3.5">
            <p className="text-[#6a7c75] text-[10px] font-extrabold tracking-[.18em] mt-0 mx-0 mb-1 uppercase">Puntos del territorio</p>
            <h2 className="font-sans text-[22px] tracking-[-0.03em] leading-[1.15] mt-0 mx-0 mb-1.5 max900:text-[18px] max600:text-[16px]">{filteredPubs.length} lugar{filteredPubs.length !== 1 ? 'es' : ''}</h2>
            <p className="text-muted text-[13px] leading-[1.4] m-0">
              {activeFilter === 'TODOS'
                ? 'Todos los contenidos publicados'
                : `Filtrado por ${KIND_LABELS[activeFilter] || activeFilter}`}
            </p>
          </div>

          {/* Lista scrolleable de publicaciones */}
          <div className="grid gap-2 overflow-y-auto [scrollbar-width:thin]">
            {filteredPubs.length === 0 && (
              <div className="py-[30px] px-5 text-center text-muted">
                <p>No hay publicaciones en esta categoría.</p>
              </div>
            )}

            {filteredPubs.map((pub) => (
              <button
                key={pub.id}
                className={`${ITEM} ${selectedId === pub.id ? 'bg-[#eef6f0] border-[rgba(23,58,49,0.12)]' : 'bg-white border-[rgba(23,58,49,0.06)]'}`}
                onClick={() => handleSelectPub(pub.id)}
              >
                {/* Punto de color según el tipo */}
                <span
                  className="rounded-[50%] shrink-0 h-2.5 mt-1 w-2.5"
                  style={{ background: KIND_COLORS[pub.kind] || '#8a4f7d' }}
                />
                <div>
                  <b className="block text-[13px] leading-[1.25] text-ink max600:text-[12px]">{pub.title}</b>
                  <small className="text-muted text-[11px]">{pub.location || 'Caucasia'}</small>
                </div>
              </button>
            ))}
          </div>
        </aside>
      </div>

      {/* Tarjeta de detalle: aparece cuando se selecciona una publicación */}
      {selectedPub && (
        <div className="bg-[rgba(255,255,255,0.95)] backdrop-blur-[14px] border border-[rgba(23,58,49,0.06)] rounded-[18px] [box-shadow:0_12px_36px_rgba(18,60,52,0.15)] mt-[22px] max-w-[480px] p-6 max600:rounded-[14px] max600:p-[18px]" role="complementary">
          <span className="inline-block text-[18px] mb-2">{'\u2316'}</span>
          <p className={`${DETAIL_P} font-extrabold tracking-[0.08em] uppercase`}>
            {KIND_LABELS[selectedPub.kind] || selectedPub.kind} ·{' '}
            {selectedPub.location || 'Caucasia'}
          </p>
          <h3 className="font-sans tracking-[-.055em] text-[18px] leading-[1.2] mt-0 mx-0 mb-2">{selectedPub.title}</h3>
          <p className={DETAIL_P}>{selectedPub.summary}</p>
          <a
            className="text-river text-[12px] font-semibold underline underline-offset-2"
            href={getOsmUrl(getPublicationCoords(selectedPub))}
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir ubicación en OpenStreetMap
          </a>
        </div>
      )}
    </section>
  );
}
