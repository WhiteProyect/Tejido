import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../components/Icon.jsx';
import MapCard from '../components/map/MapCard.jsx';
import MapList from '../components/map/MapList.jsx';
import { MapEmpty, MapError, MapLoading, MapUnavailable } from '../components/map/MapStates.jsx';
import { CategoryRow, CounterPill, ListToggle, MunicipalityJump, TypeFilters } from '../components/map/MapToolbar.jsx';
import '../components/map/map.css';
import { TS } from '../components/territory/territoryStyles.js';
import { apiRequest } from '../utils/api.js';
import {
  BOX_BOUNDS, MUNICIPALITY_ZOOM, POINT_ZOOM, TILE_ATTRIBUTION, TILE_URL, clusterIcon, inBox, linkedKey, loadLeaflet, locateUser, mapHash,
  moveMap, parseMapHash, pinIcon, prefersReducedMotion, townIcon, userIcon,
} from '../utils/mapConfig.js';
import {
  EMPTY_FILTERS, activeFilterCount, countPoints, counterText, filterPoints, isFiltered, matchesFilters, parseMapFilters, pointAriaLabel,
  sameFilters, sanitizeFilters, toggleCategory,
} from '../utils/mapFilters.js';
import { DEFAULT_MAP_CENTER, MUNICIPALITY_LIST, municipalityCenter } from '../utils/municipalities.js';

// Mapa vivo (#mapa): Leaflet + teselas de OpenStreetMap + Leaflet.markercluster (todo perezoso) con los
// puntos de GET /api/map/points (eventos vigentes y lugares del directorio con punto exacto).
// - Ocupa el alto bajo el header: calc(100dvh - var(--header-height)); SiteHeader publica esa variable.
//   Las barras y los controles viven dentro del contenedor (nunca tapan el header ni el menu).
// - Filtros (utils/mapFilters.js): Todos / Solo eventos / Solo lugares y, con lugares, subcategorias de
//   seleccion multiple. Filtrar agrega o quita marcadores del grupo sin recrear el mapa ni mover la vista.
// - URL: #mapa?municipio=&tipo=&categoria=&evento=|lugar= (replaceState). Un deep link a un punto agrupado
//   lo abre (zoomToShowLayer); si el filtro lo excluye, el filtro se limpia.
// - Tarjeta: popup anclado (340 px; 320 en tablet) o panel inferior en movil (arrastrar hacia abajo,
//   tocar el mapa, Cerrar o Esc). Al cerrar, el foco vuelve al pin o a su grupo.
// - "Ver como lista" oculta el mapa (display: none) sin destruirlo: vista, filtros, seleccion y grupos
//   siguen en la instancia de Leaflet y al volver solo se llama invalidateSize().
// - Movimiento reducido: sin vuelos (setView), sin animaciones de zoom ni de grupos.
const MIN_MAP = 340;
const STRIP = 48;
const CONTROL = `inline-flex size-11 cursor-pointer items-center justify-center rounded-[12px] border-2 border-[#173f36] bg-[#f3e4c8] text-[#173f36] hover:bg-[#ead7b3] disabled:cursor-not-allowed disabled:opacity-50 ${TS.focus}`;
const BAR = 'pointer-events-auto flex max-w-full min-w-0 items-center gap-2 rounded-[24px] border-2 border-[#173f36] bg-[#fff9ec] p-1.5';
const NOTE = 'pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-[16px] border-2 border-[#173f36] bg-[#fff9ec] px-4 py-1.5 text-center text-[15px] font-semibold text-[#173f36]';
const NOTE_BTN = `inline-flex min-h-11 cursor-pointer items-center rounded-full border-0 bg-transparent px-2 font-sans text-[15px] font-bold text-[#173f36] underline decoration-2 underline-offset-4 ${TS.focus}`;

function useMedia(query) {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

export default function MapScreen() {
  const initial = useRef(null);
  if (!initial.current) initial.current = parseMapHash();
  const [data, setData] = useState({ loading: true, error: '', points: [], today: '', loadedOnce: false });
  const [filters, setFilters] = useState(() => parseMapFilters());
  const [municipio, setMunicipio] = useState(initial.current.municipio);
  const [selected, setSelected] = useState(null);
  const [listOpen, setListOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [tiles, setTiles] = useState('ok');
  const [markersVersion, setMarkersVersion] = useState(0);
  const [outside, setOutside] = useState(0);
  const [zoom, setZoom] = useState({ canIn: true, canOut: true });
  const [geo, setGeo] = useState({ busy: false, note: '' });
  const [compact, setCompact] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const sheet = useMedia('(max-width: 767px)');
  const wide = useMedia('(min-width: 1024px)');
  const oneRow = useMedia('(min-width: 1200px)');
  const titleId = useId();
  const listId = `${titleId}-lista`.replace(/:/g, '');
  const panelId = `${titleId}-filtros`.replace(/:/g, '');

  const mapEl = useRef(null);
  const marcoRef = useRef(null);
  const barsRef = useRef(null);
  const floatRef = useRef(null);
  const sheetRef = useRef(null);
  const mapRef = useRef(null);
  const LRef = useRef(null);
  const groupRef = useRef(null);
  const tilesRef = useRef(null);
  const townsRef = useRef(null);
  const userRef = useRef(null);
  const markers = useRef(new Map());
  const inGroup = useRef(new Set());
  const ranks = useRef(new Map());
  const pointsRef = useRef(new Map());
  const visibleRef = useRef([]);
  const selectedRef = useRef(null);
  const sheetMode = useRef(sheet);
  const popupRef = useRef(null);
  const prevSelected = useRef(null);
  const focusAfter = useRef(null);
  const pendingLink = useRef(linkedKey(initial.current));
  const fullBars = useRef(0);
  const reorderQueued = useRef(false);
  const drag = useRef(null);
  const [popupNode] = useState(() => (typeof document !== 'undefined' ? document.createElement('div') : null));

  const counts = useMemo(() => countPoints(data.points), [data.points]);
  const visible = useMemo(() => filterPoints(data.points, filters), [data.points, filters]);
  const byKey = useMemo(() => new Map(data.points.map((p) => [p.key, p])), [data.points]);
  const point = selected ? byKey.get(selected) : null;
  const filtered = isFiltered(filters);
  pointsRef.current = byKey;
  visibleRef.current = visible;
  selectedRef.current = selected;
  sheetMode.current = sheet;

  useEffect(() => { document.title = 'Mapa vivo del Bajo Cauca · TEJIDO'; }, []);

  const load = useCallback(async () => {
    setData((current) => ({ ...current, loading: true, error: '' }));
    try {
      const response = await apiRequest('/api/map/points');
      const points = (Array.isArray(response?.points) ? response.points : []).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
      setData({ loading: false, error: '', points, today: response?.today || '', loadedOnce: true });
      setFilters((current) => sanitizeFilters(current, countPoints(points)));
    } catch (error) {
      setData((current) => ({ ...current, loading: false, error: error.message || 'No pudimos cargar los puntos del mapa.' }));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // --- Accesibilidad de los pines y orden de tabulacion -------------------------------------------
  const decorateMarker = useCallback((marker) => {
    const el = marker.getElement();
    const p = pointsRef.current.get(marker.tejidoKey);
    if (!el || !p) return;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', pointAriaLabel(p));
    el.setAttribute('aria-expanded', selectedRef.current === p.key ? 'true' : 'false');
    el.dataset.punto = p.key;
    el.tejidoLayer = marker;
    // Leaflet solo abre con Enter los popups propios (bindPopup): Enter (al bajar) y Espacio (al soltar,
    // como un boton nativo) los maneja la pantalla.
    el.onkeydown = (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      if (event.key === 'Enter') setSelected(p.key);
    };
    el.onkeyup = (event) => { if (event.key === ' ') setSelected(p.key); };
  }, []);

  const decorateCluster = useCallback((cluster) => {
    const el = cluster.getElement();
    if (!el) return;
    const n = cluster.getChildCount();
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', `Grupo de ${n} ubicaciones, presiona Enter para acercar`);
    el.dataset.grupo = String(n);
    el.tejidoLayer = cluster;
    // Enter ya lo atiende el plugin (clusterkeypress); Espacio hace lo mismo al soltarse, como un boton.
    el.onkeydown = (event) => { if (event.key === ' ') event.preventDefault(); };
    el.onkeyup = (event) => {
      if (event.key !== ' ') return;
      event.preventDefault();
      // El fire del grupo antepone "cluster" al tipo cuando la capa es un grupo: llega como clusterkeypress.
      groupRef.current?.fire('keypress', { layer: cluster, originalEvent: { keyCode: 13 } });
    };
  }, []);

  // El orden de tabulacion de los pines sigue el de la lista (eventos por fecha, lugares por titulo):
  // se reordenan los nodos del panel de marcadores (cada uno lleva su z-index, el dibujo no cambia).
  const reorderPane = useCallback(() => {
    reorderQueued.current = false;
    const map = mapRef.current;
    if (!map) return;
    const pane = map.getPane('markerPane');
    const items = [...pane.children];
    const rankOf = (el) => {
      const layer = el.tejidoLayer;
      if (!layer) return Number.MAX_SAFE_INTEGER;
      if (layer.tejidoKey) return ranks.current.get(layer.tejidoKey) ?? Number.MAX_SAFE_INTEGER;
      if (typeof layer.getAllChildMarkers === 'function') {
        let best = Number.MAX_SAFE_INTEGER;
        for (const child of layer.getAllChildMarkers()) best = Math.min(best, ranks.current.get(child.tejidoKey) ?? best);
        return best;
      }
      return Number.MAX_SAFE_INTEGER;
    };
    const ranked = items.map((el) => [rankOf(el), el]).sort((a, b) => a[0] - b[0]);
    if (ranked.every(([, el], i) => el === items[i])) return;
    const active = document.activeElement;
    const inside = pane.contains(active);
    ranked.forEach(([, el]) => pane.appendChild(el));
    if (inside && document.activeElement !== active) active.focus({ preventScroll: true });
  }, []);

  const scheduleReorder = useCallback(() => {
    if (reorderQueued.current) return;
    reorderQueued.current = true;
    requestAnimationFrame(reorderPane);
  }, [reorderPane]);

  // Resultados fuera de la vista: si hay puntos filtrados pero ninguno en pantalla, se ofrece verlos.
  const computeOutside = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.getSize().x) return;
    const bounds = map.getBounds();
    const list = visibleRef.current;
    setOutside(list.length && !list.some((p) => bounds.contains([p.lat, p.lng])) ? list.length : 0);
  }, []);

  // --- Mapa (una vez) ------------------------------------------------------------------------------
  useEffect(() => {
    let alive = true;
    loadLeaflet({ cluster: true }).then((L) => {
      if (!alive || !mapEl.current || mapRef.current) return;
      LRef.current = L;
      const reduced = prefersReducedMotion();
      const start = initial.current.municipio ? municipalityCenter(initial.current.municipio) : DEFAULT_MAP_CENTER;
      const map = L.map(mapEl.current, {
        center: start, zoom: MUNICIPALITY_ZOOM, minZoom: 8, maxZoom: 18, zoomControl: false,
        maxBounds: L.latLngBounds(BOX_BOUNDS).pad(0.15), maxBoundsViscosity: 0.9,
        scrollWheelZoom: false, zoomAnimation: !reduced, fadeAnimation: !reduced, markerZoomAnimation: !reduced,
      });
      map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener noreferrer">Leaflet</a>');
      const layer = L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 });
      let ok = 0;
      let failed = 0;
      layer.on('loading', () => { ok = 0; failed = 0; });
      layer.on('tileload', () => { ok += 1; });
      layer.on('tileerror', () => { failed += 1; });
      // Solo si no carga ninguna tesela del lote pasa al modo ligero (huecos sueltos se quedan en papel).
      layer.on('load', () => { if (failed && !ok) setTiles('ligero'); });
      layer.addTo(map);
      tilesRef.current = layer;

      const group = L.markerClusterGroup({
        chunkedLoading: true,
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        zoomToBoundsOnClick: true,
        removeOutsideVisibleBounds: true,
        animate: !reduced,
        animateAddingMarkers: false,
        // Radio en px: 40 desde el zoom de municipio (un pin mide 40: solo se agrupan los que se tapan) y
        // 60 mas lejos.
        maxClusterRadius: (z) => (z >= MUNICIPALITY_ZOOM ? 40 : 60),
        spiderLegPolylineOptions: { weight: 2, color: '#173f36', opacity: 0.9 },
        iconCreateFunction: (cluster) => clusterIcon(L, cluster.getChildCount()),
      });
      group.addTo(map);
      group.on('animationend spiderfied unspiderfied', scheduleReorder);
      groupRef.current = group;

      map.on('layeradd', (event) => {
        const added = event.layer;
        if (added.tejidoKey) decorateMarker(added);
        else if (added instanceof L.MarkerCluster) decorateCluster(added);
        else return;
        scheduleReorder();
      });
      const syncZoom = () => setZoom({ canIn: map.getZoom() < map.getMaxZoom(), canOut: map.getZoom() > map.getMinZoom() });
      map.on('zoomend', syncZoom);
      map.on('moveend', () => { computeOutside(); scheduleReorder(); });
      map.on('focus click', () => map.scrollWheelZoom.enable());
      map.on('blur mouseout', () => map.scrollWheelZoom.disable());
      // Movil: tocar el mapa fuera del panel lo cierra (en escritorio Leaflet ya cierra el popup).
      map.on('click', () => { if (sheetMode.current && selectedRef.current) setSelected(null); });
      mapRef.current = map;
      syncZoom();
      setReady(true);
    }).catch(() => { if (alive) setMapError(true); });
    return () => {
      alive = false;
      mapRef.current?.remove();
      mapRef.current = null;
      groupRef.current = null;
    };
  }, [computeOutside, decorateCluster, decorateMarker, scheduleReorder]);

  // --- Marcadores (al llegar los datos) --------------------------------------------------------------
  useEffect(() => {
    if (!ready) return;
    const L = LRef.current;
    const group = groupRef.current;
    group.clearLayers();
    markers.current.clear();
    inGroup.current.clear();
    data.points.forEach((p) => {
      const marker = L.marker([p.lat, p.lng], { icon: pinIcon(L, p.type, { category: p.place_category }), keyboard: true });
      marker.tejidoKey = p.key;
      marker.on('click', () => setSelected(p.key));
      markers.current.set(p.key, marker);
    });
    setMarkersVersion((v) => v + 1);
  }, [ready, data.points]);

  // Deep link: abre el punto pedido (aunque este dentro de un grupo); si el filtro lo excluye, se limpia.
  const openLinked = useCallback(() => {
    const key = pendingLink.current;
    if (!key || !data.loadedOnce) return;
    const target = pointsRef.current.get(key);
    const marker = markers.current.get(key);
    if (!target || !marker) { pendingLink.current = ''; return; }
    if (!matchesFilters(target, filters)) { setFilters(EMPTY_FILTERS); return; }
    pendingLink.current = '';
    mapRef.current.setView([target.lat, target.lng], POINT_ZOOM, { animate: false });
    groupRef.current.zoomToShowLayer(marker, () => setSelected(key));
  }, [data.loadedOnce, filters]);

  // --- Filtros: sincroniza el grupo con los puntos visibles (sin mover la vista) ----------------------
  useEffect(() => {
    if (!ready || !markersVersion) return;
    const group = groupRef.current;
    const want = new Set(visible.map((p) => p.key));
    ranks.current = new Map(visible.map((p, i) => [p.key, i]));
    const add = [];
    const remove = [];
    markers.current.forEach((marker, key) => {
      const has = inGroup.current.has(key);
      if (want.has(key) && !has) { add.push(marker); inGroup.current.add(key); }
      else if (!want.has(key) && has) { remove.push(marker); inGroup.current.delete(key); }
    });
    if (remove.length) group.removeLayers(remove);
    if (add.length) group.addLayers(add);
    // Una tarjeta abierta que queda fuera del filtro se cierra; si el foco estaba en ella, pasa al mapa.
    if (selectedRef.current && !want.has(selectedRef.current)) {
      if (document.activeElement?.closest?.('[data-tarjeta-mapa]')) mapEl.current?.focus({ preventScroll: true });
      setSelected(null);
    }
    computeOutside();
    scheduleReorder();
    openLinked();
  }, [ready, markersVersion, visible, computeOutside, scheduleReorder, openLinked]);

  // --- Seleccion: pin destacado, popup (escritorio) o panel (movil) --------------------------------
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L) return;
    const previous = prevSelected.current;
    const changed = previous !== selected;
    prevSelected.current = selected;
    [previous, selected].forEach((key) => {
      if (!key || !changed) return;
      const marker = markers.current.get(key);
      const p = byKey.get(key);
      if (!marker || !p) return;
      const on = key === selected;
      marker.setIcon(pinIcon(L, p.type, { selected: on, category: p.place_category }));
      marker.setZIndexOffset(on ? 1000 : 0);
      decorateMarker(marker);
    });
    const old = popupRef.current;
    popupRef.current = null;
    old?.remove();
    const p = selected ? byKey.get(selected) : null;
    if (!p || listOpen) return;
    if (!sheet) {
      const marker = markers.current.get(p.key);
      const width = wide ? 340 : 320;
      const top = (floatRef.current?.offsetHeight || 0) + 28;
      const popup = L.popup({
        closeButton: false, autoPan: true, autoPanPaddingTopLeft: [16, top], autoPanPaddingBottomRight: [76, 24],
        // El popup va a la latitud del pin (su punta): se sube el alto del pin seleccionado (60 px).
        maxWidth: width, minWidth: width, className: 'tejido-popup', offset: [0, -58],
      }).setLatLng(marker ? marker.getLatLng() : [p.lat, p.lng]).setContent(popupNode).openOn(map);
      popup.on('remove', () => { if (popupRef.current === popup) setSelected(null); });
      popupRef.current = popup;
      requestAnimationFrame(() => popup.update());
    }
    // Al abrir otra tarjeta el foco entra en ella (su boton Cerrar) para el teclado y el lector.
    if (changed) requestAnimationFrame(() => document.querySelector(`[data-tarjeta-mapa="${p.key}"] [data-cerrar-tarjeta]`)?.focus({ preventScroll: true }));
  }, [selected, sheet, wide, byKey, popupNode, listOpen, decorateMarker]);

  const close = useCallback(() => {
    focusAfter.current = selectedRef.current;
    setSelected(null);
  }, []);

  // Tras cerrar con Cerrar o Esc, el foco vuelve al pin (o al grupo que lo contiene).
  useEffect(() => {
    if (selected || !focusAfter.current) return;
    const marker = markers.current.get(focusAfter.current);
    focusAfter.current = null;
    const parent = marker && groupRef.current?.getVisibleParent(marker);
    requestAnimationFrame(() => (parent?.getElement?.() || mapEl.current)?.focus({ preventScroll: true }));
  }, [selected]);

  useEffect(() => {
    if (!selected && !panelOpen) return undefined;
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (selectedRef.current) close();
      else setPanelOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selected, panelOpen, close]);

  // Panel inferior abierto: reserva su alto y lo publica para que el lanzador de Hilo suba.
  useEffect(() => {
    if (!sheet || !point || listOpen || !sheetRef.current) return undefined;
    const apply = () => {
      const height = `${sheetRef.current?.offsetHeight || 0}px`;
      document.body.style.paddingBottom = height;
      document.documentElement.style.setProperty('--barra-inferior', height);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(sheetRef.current);
    return () => {
      observer.disconnect();
      document.body.style.paddingBottom = '';
      document.documentElement.style.removeProperty('--barra-inferior');
    };
  }, [sheet, point, listOpen]);

  // --- URL compartible -----------------------------------------------------------------------------
  useEffect(() => {
    if (!data.loadedOnce) return;
    const current = window.location.hash;
    if (!current.startsWith('#mapa')) return;
    const p = selected ? byKey.get(selected) : null;
    const next = mapHash({
      municipio, tipo: filters.tipo, categorias: filters.categorias,
      evento: p?.type === 'EVENTO' ? p.id : null, lugar: p?.type === 'LUGAR' ? p.id : null,
    });
    if (current !== next) window.history.replaceState(window.history.state, '', next);
  }, [data.loadedOnce, selected, byKey, municipio, filters]);

  // --- Modo ligero (sin teselas): municipios rotulados sobre papel -----------------------------------
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L) return;
    if (tiles === 'ligero' && !townsRef.current) {
      townsRef.current = L.layerGroup(MUNICIPALITY_LIST.map(({ center, name }) => L.marker(center, { icon: townIcon(L, name), interactive: false, keyboard: false }))).addTo(map);
    } else if (tiles !== 'ligero' && townsRef.current) {
      townsRef.current.remove();
      townsRef.current = null;
    }
  }, [tiles, ready]);

  // --- Vuelta de la lista: Leaflet recalcula su tamaño (la instancia nunca se destruyo) -------------
  useEffect(() => {
    if (listOpen || !mapRef.current) return;
    mapRef.current.invalidateSize({ animate: false });
    computeOutside();
  }, [listOpen, computeOutside]);

  // --- Movil compacto: si el mapa quedaria bajo 340 px, las filas pasan a un boton "Filtros" ------------
  useLayoutEffect(() => {
    if (!sheet || listOpen) { setCompact(false); setPanelOpen(false); return undefined; }
    const check = () => {
      const marco = marcoRef.current;
      const bars = barsRef.current;
      if (!marco || !bars) return;
      if (!compact) fullBars.current = bars.offsetHeight;
      const next = marco.clientHeight - fullBars.current - STRIP < MIN_MAP;
      if (next !== compact) setCompact(next);
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(marcoRef.current);
    if (barsRef.current) observer.observe(barsRef.current);
    return () => observer.disconnect();
  }, [sheet, listOpen, compact, filters.tipo]);

  useEffect(() => {
    if (ready && mapRef.current) mapRef.current.invalidateSize({ animate: false });
  }, [compact, sheet, ready, filters.tipo]);

  // --- Acciones ------------------------------------------------------------------------------------
  function changeFilters(next) {
    setFilters((current) => (sameFilters(current, next) ? current : next));
  }
  const setType = (tipo) => changeFilters({ tipo, categorias: [] });
  const toggleCat = (slug) => changeFilters(toggleCategory(filters, slug));
  const clearFilters = () => changeFilters(EMPTY_FILTERS);

  function goMunicipality(slug) {
    setSelected(null);
    setMunicipio(slug);
    setPanelOpen(false);
    if (listOpen) setListOpen(false);
    const map = mapRef.current;
    if (!map) return;
    if (listOpen) requestAnimationFrame(() => { map.invalidateSize({ animate: false }); moveMap(map, municipalityCenter(slug), MUNICIPALITY_ZOOM); });
    else moveMap(map, municipalityCenter(slug), MUNICIPALITY_ZOOM);
  }

  function showAll() {
    const map = mapRef.current;
    const list = visibleRef.current;
    if (!map || !list.length) return;
    const animate = !prefersReducedMotion();
    if (list.length === 1) { map.setView([list[0].lat, list[0].lng], POINT_ZOOM, { animate }); return; }
    const top = sheet ? 24 : (floatRef.current?.offsetHeight || 0) + 32;
    map.fitBounds(list.map((p) => [p.lat, p.lng]), { paddingTopLeft: [32, top], paddingBottomRight: [sheet ? 32 : 84, 40], animate, maxZoom: POINT_ZOOM });
  }

  function showRegion() {
    mapRef.current?.fitBounds(BOX_BOUNDS, { animate: !prefersReducedMotion() });
  }

  function zoomBy(delta) {
    const map = mapRef.current;
    if (!map) return;
    if (delta > 0) map.zoomIn(1, { animate: !prefersReducedMotion() });
    else map.zoomOut(1, { animate: !prefersReducedMotion() });
  }

  async function locate() {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L || geo.busy) return;
    setGeo({ busy: true, note: 'Buscando tu ubicación…' });
    try {
      const { lat, lng } = await locateUser();
      if (!inBox(lat, lng)) { setGeo({ busy: false, note: 'Tu ubicación está fuera del Bajo Cauca, así que el mapa se queda donde está.' }); return; }
      if (!userRef.current) userRef.current = L.marker([lat, lng], { icon: userIcon(L), interactive: false, keyboard: false, zIndexOffset: 900 }).addTo(map);
      else userRef.current.setLatLng([lat, lng]);
      moveMap(map, [lat, lng], Math.max(map.getZoom(), 15));
      setGeo({ busy: false, note: 'Te mostramos dónde estás (punto tinta).' });
    } catch (error) {
      setGeo({ busy: false, note: `${error.message} Puedes moverte por el mapa o saltar a un municipio.` });
    }
  }

  function retryTiles() {
    setTiles('ok');
    tilesRef.current?.redraw();
  }

  function toggleList() {
    setPanelOpen(false);
    setListOpen((open) => !open);
  }

  // Panel inferior: deslizar hacia abajo desde el asa lo cierra (umbral de 80 px).
  const sheetHandlers = {
    onPointerDown: (event) => {
      drag.current = { y: event.clientY, dy: 0 };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    onPointerMove: (event) => {
      if (!drag.current || !sheetRef.current) return;
      drag.current.dy = Math.max(0, event.clientY - drag.current.y);
      sheetRef.current.style.transform = `translateY(${drag.current.dy}px)`;
    },
    onPointerUp: () => {
      const dy = drag.current?.dy || 0;
      drag.current = null;
      if (dy > 80) { setSelected(null); return; }
      if (sheetRef.current) sheetRef.current.style.transform = '';
    },
    onPointerCancel: () => {
      drag.current = null;
      if (sheetRef.current) sheetRef.current.style.transform = '';
    },
  };

  // --- Vista -----------------------------------------------------------------------------------------
  const loadingPoints = data.loading && !data.loadedOnce;
  const countText = loadingPoints ? 'Cargando puntos…' : counterText(visible.length, filters.tipo);
  const showLoading = !mapError && (loadingPoints || !ready);
  const showError = Boolean(data.error) && !data.loading;
  const showEmpty = ready && !data.loading && !data.error && data.loadedOnce && visible.length === 0;
  const listAction = data.points.length ? () => { setListOpen(true); } : null;
  const toolbarProps = { filters, counts: data.loadedOnce ? counts : null };
  const categoryRow = (scroll, className) => (
    <CategoryRow {...toolbarProps} onToggle={toggleCat} onClear={clearFilters} scroll={scroll} className={className} />
  );
  const typeRow = (scroll) => <TypeFilters {...toolbarProps} onType={setType} onClear={clearFilters} scroll={scroll} />;
  const listToggle = <ListToggle listOpen={listOpen} onToggle={toggleList} controls={listId} />;
  const activeCount = activeFilterCount(filters);

  // Barras fijas (movil y vista de lista): filas apiladas con desplazamiento horizontal tactil.
  const staticBars = (
    <div ref={barsRef} className={`border-b border-[#ddd5c7] bg-[#fff9ec] ${listOpen ? 'pt-4 pb-3' : 'py-2'}`} data-barras-mapa>
      <div className={`grid gap-2 ${listOpen ? 'mx-auto w-full max-w-[1300px] px-10 max-[1023px]:px-6 max-[767px]:px-3' : 'px-3'}`}>
        <div className={`flex items-center gap-2 ${compact ? 'flex-nowrap' : 'flex-wrap'}`}>
          <CounterPill text={countText} className={`max-[767px]:px-3 max-[767px]:text-[14px] ${compact ? 'min-w-0 !shrink overflow-hidden text-ellipsis' : ''}`} />
          {compact && (
            <button type="button" className={`inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border-2 border-[#173f36] px-3 font-sans text-[15px] font-bold ${panelOpen ? 'bg-[#173f36] text-[#fff9ec]' : 'bg-white text-[#173f36]'} ${TS.focus}`}
              aria-expanded={panelOpen} aria-controls={panelId} onClick={() => setPanelOpen((open) => !open)} data-boton-filtros>
              <Icon name="sliders" className="size-4" strokeWidth={2.2} /> Filtros{activeCount ? <span className="sr-only">, {activeCount} activos</span> : null}
              {activeCount > 0 && <span aria-hidden="true" className="inline-flex min-w-6 items-center justify-center rounded-full bg-[#f4b942] px-1.5 py-0.5 text-[13px] font-extrabold text-[#173f36]">{activeCount}</span>}
            </button>
          )}
          {compact ? (
            <button type="button" className={`inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-[#173f36] bg-white text-[#173f36] ${TS.focus}`}
              aria-label="Ver como lista" title="Ver como lista" aria-controls={listId} onClick={toggleList} data-ver-lista="cerrada">
              <Icon name="list" className="size-5" strokeWidth={2} />
            </button>
          ) : <div className={listOpen ? 'ml-auto' : 'max-[767px]:contents'}>{listToggle}</div>}
        </div>
        {!compact && (
          <>
            <MunicipalityJump onJump={goMunicipality} scroll={sheet} />
            {typeRow(sheet)}
            {categoryRow(sheet, '')}
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="relative" data-mapa-pagina>
      <h1 className="sr-only">Mapa vivo del Bajo Cauca</h1>
      <div ref={marcoRef} className={listOpen ? '' : 'flex h-[calc(100dvh-var(--header-height,88px))] min-h-[420px] flex-col'} data-mapa-marco>
        {(sheet || listOpen) && staticBars}
        <div className={`relative min-h-0 flex-1 ${listOpen ? 'hidden' : ''}`} data-mapa-area>
          <div className={`tejido-map absolute inset-0 overflow-hidden ${tiles === 'ligero' ? 'tejido-map--ligero' : ''}`} data-mapa-vivo data-teselas-modo={tiles}>
            <div ref={mapEl} className="size-full" role="region" aria-label="Mapa de eventos y lugares del Bajo Cauca" />

            {!sheet && (
              <div ref={floatRef} className="pointer-events-none absolute top-4 right-[76px] left-4 z-[1000] flex flex-col items-start gap-2" data-barras-mapa data-barras-flotantes>
                {oneRow ? (
                  <div className={BAR}>
                    <CounterPill text={countText} />
                    <MunicipalityJump onJump={goMunicipality} />
                    {listToggle}
                  </div>
                ) : (
                  <>
                    <div className={BAR}><CounterPill text={countText} />{listToggle}</div>
                    <div className={`${BAR} overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}><MunicipalityJump onJump={goMunicipality} /></div>
                  </>
                )}
                <div className={`${BAR} overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>{typeRow(false)}</div>
                {categoryRow(false, `${BAR} flex-wrap`)}
              </div>
            )}

            {compact && panelOpen && (
              <div id={panelId} className="absolute inset-x-0 top-0 z-[1002] grid gap-2 border-b-2 border-[#173f36] bg-[#fff9ec] p-3" data-panel-filtros>
                <MunicipalityJump onJump={goMunicipality} scroll />
                {typeRow(true)}
                {categoryRow(true, '')}
                <button type="button" className={`${TS.btnSolid} !min-h-11`} onClick={() => setPanelOpen(false)}>Listo</button>
              </div>
            )}

            <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2" role="group" aria-label="Controles del mapa" data-controles-mapa>
              <button type="button" className={CONTROL} onClick={() => zoomBy(1)} disabled={!ready || !zoom.canIn} aria-label="Acercar" title="Acercar" data-zoom="mas">
                <Icon name="plus" className="size-5" strokeWidth={2.4} />
              </button>
              <button type="button" className={CONTROL} onClick={() => zoomBy(-1)} disabled={!ready || !zoom.canOut} aria-label="Alejar" title="Alejar" data-zoom="menos">
                <Icon name="minus" className="size-5" strokeWidth={2.4} />
              </button>
              <button type="button" className={CONTROL} onClick={locate} disabled={!ready || geo.busy} aria-label="Mi ubicación" title="Mi ubicación" data-mi-ubicacion>
                <Icon name="locate" className="size-5" strokeWidth={2} />
              </button>
            </div>

            <div className="pointer-events-none absolute right-4 bottom-8 left-4 z-[1000] flex flex-col items-center gap-2" data-avisos-mapa>
              {outside > 0 && !showEmpty && (
                <p className={`${NOTE} m-0`} data-fuera-de-vista>
                  Hay {outside} {outside === 1 ? 'resultado' : 'resultados'} fuera de esta vista
                  <span aria-hidden="true">·</span>
                  <button type="button" className={NOTE_BTN} onClick={showAll}>Ver todos</button>
                </p>
              )}
              <div role="status" aria-live="polite" className="contents">
                {geo.note && (
                  <p className={`${NOTE} m-0`} data-aviso-ubicacion>
                    {geo.note}
                    {!geo.busy && <button type="button" className={NOTE_BTN} onClick={() => setGeo({ busy: false, note: '' })}>Entendido</button>}
                  </p>
                )}
              </div>
              {tiles === 'ligero' && (
                <p className={`${NOTE} m-0`} role="status" data-teselas>
                  Mapa base en modo ligero por conexión lenta
                  <span aria-hidden="true">·</span>
                  <button type="button" className={NOTE_BTN} onClick={retryTiles}>Reintentar teselas</button>
                  {data.points.length > 0 && <button type="button" className={NOTE_BTN} onClick={() => setListOpen(true)}>Ver como lista</button>}
                </p>
              )}
            </div>

            {showLoading && <MapLoading />}
            {mapError && <MapUnavailable onRetry={() => window.location.reload()} onList={listAction} />}
            {showError && <MapError onRetry={load} onList={listAction} />}
            {showEmpty && <MapEmpty filtered={filtered} onClear={clearFilters} onRegion={showRegion} />}
          </div>
        </div>
        {sheet && !listOpen && (
          <p className="m-0 flex h-12 shrink-0 items-center justify-center bg-[#f3e4c8] px-4 text-center text-[14px] font-semibold text-[#3f514a]" data-franja-pagina>
            Desliza aquí para seguir bajando por la página
          </p>
        )}
      </div>

      {listOpen && (
        <MapList id={listId} points={visible} today={data.today}
          empty={data.loadedOnce ? <MapEmpty inline filtered={filtered} onClear={clearFilters} /> : null} />
      )}

      {point && sheet && !listOpen && (
        // Panel inferior fijo, fuera del contenedor aislado del mapa: queda bajo el header y el menu (z 60
        // contra 90+) y nunca sube por encima del header (alto maximo).
        <div ref={sheetRef} className="fixed inset-x-0 bottom-0 z-[60] max-h-[min(70svh,calc(100dvh-var(--header-height,88px)-16px))] overflow-y-auto rounded-t-[20px] border-x-2 border-t-2 border-[#173f36] bg-white pb-[env(safe-area-inset-bottom)]"
          data-panel-mapa>
          <div className="flex h-8 cursor-grab touch-none items-center justify-center bg-white" aria-hidden="true" data-asa-panel {...sheetHandlers}>
            <span className="block h-1.5 w-12 rounded-full bg-[#4d5a55]" />
          </div>
          <MapCard key={point.key} point={point} today={data.today} titleId={titleId} onClose={close} sheet />
        </div>
      )}
      {point && !sheet && !listOpen && popupNode && createPortal(
        <MapCard key={point.key} point={point} today={data.today} titleId={titleId} onClose={close} width={wide ? 340 : 320} />, popupNode,
      )}
    </div>
  );
}
