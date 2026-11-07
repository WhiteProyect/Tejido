import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../components/Icon.jsx';
import PlaceIcon from '../components/PlaceIcon.jsx';
import MapCard from '../components/map/MapCard.jsx';
import '../components/map/map.css';
import { TS } from '../components/territory/territoryStyles.js';
import { apiRequest } from '../utils/api.js';
import { dateLine } from '../utils/agenda.js';
import {
  BOX_BOUNDS, MUNICIPALITY_ZOOM, TILE_ATTRIBUTION, TILE_URL, linkedKey, loadLeaflet, mapHash, moveMap, parseMapHash, pinIcon, pointHash,
} from '../utils/mapConfig.js';
import { DEFAULT_MAP_CENTER, MUNICIPALITY_LIST, municipalityCenter } from '../utils/municipalities.js';

// Mapa vivo (#mapa): mapa real (Leaflet + teselas de OpenStreetMap, cargados de forma perezosa) con los
// puntos de GET /api/map/points: eventos vigentes y lugares del directorio con punto exacto. Los lugares
// llevan el icono y el color de su categoria de lugar (sin filtros ni agrupacion todavia). Vista inicial
// en Caucasia; #mapa?municipio=<slug> centra alli y #mapa?evento=<id> o #mapa?lugar=<id> abren ese
// punto. Clic o Enter en un marcador abre su tarjeta (popup anclado en
// escritorio, panel inferior en movil); Esc y Cerrar la cierran y el foco vuelve al marcador. "Ver como
// lista" es la alternativa accesible. Gestos: la rueda del raton solo hace zoom despues de hacer clic o
// enfocar el mapa (asi la pagina se desplaza al pasar por encima); en movil el mapa ocupa el 62 % del
// alto y deja franjas arriba y abajo para desplazar la pagina. El contenedor aisla los z-index de
// Leaflet (map.css) para que nunca tapen el header ni el menu.
const POINT_ZOOM = 16;

function useSheet() {
  const query = '(max-width: 767px)';
  const [sheet, setSheet] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setSheet(list.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, []);
  return sheet;
}

const TYPE_NOUN = { EVENTO: 'Evento', LUGAR: 'Lugar' };

function decorate(marker, point, selected) {
  const el = marker.getElement();
  if (!el) return;
  const details = [point.place_category?.label, point.municipality_label].filter(Boolean).join(', ');
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', `${TYPE_NOUN[point.type] || 'Punto'}: ${point.title}${details ? `, ${details}` : ''}. Abrir tarjeta`);
  el.setAttribute('aria-expanded', selected ? 'true' : 'false');
  el.dataset.punto = point.key;
}

export default function MapScreen() {
  const [state, setState] = useState({ loading: true, error: '', points: [] });
  const [selected, setSelected] = useState(null);
  const [listOpen, setListOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [tileError, setTileError] = useState(false);
  const sheet = useSheet();
  const titleId = useId();
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const LRef = useRef(null);
  const markers = useRef(new Map());
  const popupRef = useRef(null);
  const [popupNode] = useState(() => (typeof document !== 'undefined' ? document.createElement('div') : null));
  const initial = useRef(parseMapHash());
  const deepLinked = useRef(false);
  const focusAfter = useRef(null);
  const sheetRef = useRef(null);

  const byKey = useMemo(() => new Map(state.points.map((p) => [p.key, p])), [state.points]);
  const point = selected ? byKey.get(selected) : null;

  useEffect(() => { document.title = 'Mapa vivo del Bajo Cauca · TEJIDO'; }, []);

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const data = await apiRequest('/api/map/points');
      setState({ loading: false, error: '', points: Array.isArray(data.points) ? data.points : [] });
    } catch (error) {
      setState({ loading: false, error: error.message || 'No pudimos cargar los puntos del mapa.', points: [] });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Mapa (una vez).
  useEffect(() => {
    let alive = true;
    loadLeaflet().then((L) => {
      if (!alive || !mapEl.current || mapRef.current) return;
      LRef.current = L;
      const start = initial.current.municipio ? municipalityCenter(initial.current.municipio) : DEFAULT_MAP_CENTER;
      const map = L.map(mapEl.current, {
        center: start, zoom: MUNICIPALITY_ZOOM, minZoom: 8, maxZoom: 18,
        maxBounds: L.latLngBounds(BOX_BOUNDS).pad(0.15), maxBoundsViscosity: 0.9,
        scrollWheelZoom: false, zoomAnimation: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      });
      map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener noreferrer">Leaflet</a>');
      L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).on('tileerror', () => setTileError(true)).addTo(map);
      map.on('focus click', () => map.scrollWheelZoom.enable());
      map.on('blur mouseout', () => map.scrollWheelZoom.disable());
      mapRef.current = map;
      setReady(true);
    }).catch(() => { if (alive) setMapError(true); });
    return () => {
      alive = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Marcadores.
  useEffect(() => {
    if (!ready) return;
    const L = LRef.current;
    const map = mapRef.current;
    markers.current.forEach((marker) => marker.remove());
    markers.current.clear();
    state.points.forEach((p) => {
      const marker = L.marker([p.lat, p.lng], { icon: pinIcon(L, p.type, { category: p.place_category }), keyboard: true, riseOnHover: true }).addTo(map);
      marker.on('click', () => setSelected(p.key));
      // Leaflet solo abre con Enter los popups propios (bindPopup); este lo maneja la pantalla.
      marker.on('keypress', (event) => {
        const { key } = event.originalEvent;
        if (key === 'Enter' || key === ' ') { event.originalEvent.preventDefault(); setSelected(p.key); }
      });
      decorate(marker, p, false);
      markers.current.set(p.key, marker);
    });
    const wanted = linkedKey(initial.current);
    if (!deepLinked.current && wanted && state.points.length) {
      deepLinked.current = true;
      const target = state.points.find((p) => p.key === wanted);
      if (target) {
        map.setView([target.lat, target.lng], POINT_ZOOM, { animate: false });
        setSelected(target.key);
      }
    }
  }, [ready, state.points]);

  // Seleccion: pin destacado, popup (escritorio) o panel (movil) y la URL compartible.
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L) return;
    markers.current.forEach((marker, key) => {
      const p = byKey.get(key);
      if (!p) return;
      marker.setIcon(pinIcon(L, p.type, { selected: key === selected, category: p.place_category }));
      decorate(marker, p, key === selected);
    });
    popupRef.current?.remove();
    popupRef.current = null;
    const current = window.location.hash;
    const next = selected && byKey.get(selected) ? pointHash(byKey.get(selected)) : mapHash({ municipio: parseMapHash().municipio });
    if (current.startsWith('#mapa') && current !== next) window.history.replaceState(window.history.state, '', next);
    if (!selected || !byKey.get(selected)) return;
    const p = byKey.get(selected);
    if (!sheet) {
      const popup = L.popup({ closeButton: false, autoPan: true, autoPanPadding: [24, 24], maxWidth: 320, minWidth: 300, className: 'tejido-popup' })
        .setLatLng([p.lat, p.lng]).setContent(popupNode).openOn(map);
      popup.on('remove', () => setSelected((cur) => (cur === p.key && popupRef.current === popup ? null : cur)));
      popupRef.current = popup;
      requestAnimationFrame(() => popup.update());
    }
    // El foco entra a la tarjeta (su boton Cerrar) para que el teclado y el lector la encuentren.
    requestAnimationFrame(() => document.querySelector(`[data-tarjeta-mapa="${p.key}"] button`)?.focus({ preventScroll: true }));
  }, [selected, sheet, byKey, popupNode]);

  const close = useCallback(() => {
    const key = selected;
    focusAfter.current = key;
    setSelected(null);
  }, [selected]);

  // Tras cerrar, el foco vuelve al marcador.
  useEffect(() => {
    if (selected || !focusAfter.current) return;
    const marker = markers.current.get(focusAfter.current);
    focusAfter.current = null;
    requestAnimationFrame(() => marker?.getElement()?.focus({ preventScroll: true }));
  }, [selected]);

  // Panel inferior abierto: reserva su alto y lo publica para que el lanzador de Hilo suba.
  useEffect(() => {
    if (!sheet || !selected || !sheetRef.current) return undefined;
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
  }, [sheet, selected]);

  useEffect(() => {
    if (!selected) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') { event.preventDefault(); close(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selected, close]);

  function goMunicipality(slug) {
    setSelected(null);
    if (mapRef.current) moveMap(mapRef.current, municipalityCenter(slug), MUNICIPALITY_ZOOM);
    window.history.replaceState(window.history.state, '', mapHash({ municipio: slug }));
  }

  function choose(p) {
    if (mapRef.current) moveMap(mapRef.current, [p.lat, p.lng], POINT_ZOOM);
    setSelected(p.key);
  }

  const count = state.points.length;
  const countText = state.loading || state.error ? '' : `${count} ${count === 1 ? 'punto' : 'puntos'} en el mapa`;
  const listId = `${titleId}-lista`;
  const overlay = 'absolute inset-x-4 top-4 z-[500] mx-auto max-w-[420px] rounded-[16px] border border-[#ddd5c7] bg-[#fff9ec] p-4 text-center text-[15px] text-[#173f36] [box-shadow:0_8px_24px_rgba(12,36,30,.18)]';

  return (
    <div className={`${TS.page} !pt-8`}>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className={TS.kicker}>Mapa vivo · Bajo Cauca</p>
          <h1 className="mt-2 mb-0 font-sans text-[32px] font-extrabold leading-[1.1] tracking-[-0.03em] text-[#173f36] max-[767px]:text-[26px]">
            Lo que pasa en <span className={TS.heroItalic}>el territorio</span>
          </h1>
        </div>
        <p className="m-0 text-[15px] font-semibold text-[#3f514a]" aria-live="polite" data-contador>{countText}</p>
      </header>

      <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]" role="group" aria-label="Ir a un municipio">
        {MUNICIPALITY_LIST.map(({ slug, name }) => (
          <button key={slug} type="button" className={`${TS.togglePill} ${TS.togglePillOff}`} onClick={() => goMunicipality(slug)} data-ir-municipio={slug}>
            {name}
          </button>
        ))}
        <button type="button" className={`${TS.togglePill} ${listOpen ? TS.togglePillOn : TS.togglePillOff} ml-auto`} aria-expanded={listOpen} aria-controls={listId}
          onClick={() => setListOpen((open) => !open)}>
          <Icon name="book" className="size-4" /> {listOpen ? 'Ocultar lista' : 'Ver como lista'}
        </button>
      </div>

      <div className="tejido-map relative mt-4 h-[calc(100svh-250px)] min-h-[460px] overflow-hidden rounded-[20px] border border-[#ddd5c7] max-[767px]:h-[62svh] max-[767px]:min-h-[340px]" data-mapa-vivo>
        <div ref={mapEl} className="size-full" role="region" aria-label="Mapa de eventos y lugares del Bajo Cauca" />
        {(state.loading || (!ready && !mapError)) && <p className={overlay} role="status" data-estado-mapa="cargando">Cargando el mapa...</p>}
        {mapError && <p className={overlay} role="alert">No pudimos cargar el mapa. Revisa tu conexión y recarga la página.</p>}
        {state.error && (
          <div className={`${overlay} border-2 border-[#d85b36]`} role="alert" data-estado-mapa="error">
            <p className="m-0 font-bold">Se nos enredó un hilo al cargar los puntos del mapa</p>
            <button type="button" className={`${TS.btnSolid} mt-3`} onClick={load}>Reintentar</button>
          </div>
        )}
        {!state.loading && !state.error && count === 0 && ready && (
          <p className={overlay} role="status" data-estado-mapa="vacio">Aún no hay eventos ni lugares con ubicación</p>
        )}
        {tileError && (
          <p className="absolute bottom-8 left-3 z-[500] m-0 max-w-[calc(100%-24px)] rounded-[10px] bg-[#fff9ec] px-3 py-2 text-[14px] text-[#3f514a] [box-shadow:0_4px_12px_rgba(12,36,30,.15)]" role="status" data-teselas>
            No pudimos cargar parte del mapa base. Los puntos siguen disponibles.
          </p>
        )}
      </div>
      {point && sheet && (
        // Panel inferior fijo, fuera del contenedor aislado del mapa: queda bajo el header y el menu (z 60
        // contra 90+) y el lanzador de Hilo sube sobre el (--barra-inferior), sin taparle los botones.
        <div ref={sheetRef} className="fixed inset-x-0 bottom-0 z-[60] max-h-[70svh] overflow-y-auto rounded-t-[20px] border-t-2 border-[#173f36] bg-[#fff9ec] pb-[env(safe-area-inset-bottom)]" data-panel-mapa>
          <MapCard key={point.key} point={point} titleId={titleId} onClose={close} sheet />
        </div>
      )}
      <p className="mt-2 mb-0 text-[14px] text-[#53645c] max-[767px]:hidden">Haz clic en el mapa para acercarte con la rueda del ratón. Los marcadores también se abren con Tab y Enter.</p>
      {point && !sheet && popupNode && createPortal(<MapCard key={point.key} point={point} titleId={titleId} onClose={close} />, popupNode)}

      {listOpen && (
        <section id={listId} className="mt-6" aria-labelledby={`${listId}-titulo`}>
          <h2 id={`${listId}-titulo`} className="m-0 font-sans text-[22px] font-extrabold text-[#173f36]">Puntos en el mapa</h2>
          {count ? (
            <ul className="mt-3 mb-0 grid list-none gap-2 p-0">
              {state.points.map((p) => (
                <li key={p.key}>
                  <button type="button" onClick={() => choose(p)} aria-current={selected === p.key ? 'true' : undefined}
                    className={`flex w-full min-h-12 cursor-pointer flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-[14px] border border-[#ddd5c7] bg-white px-4 py-3 text-left font-sans text-[16px] text-[#173f36] hover:border-[#173f36] ${TS.focus}`}>
                    <strong className="flex min-w-0 items-center gap-2 [overflow-wrap:anywhere]">
                      {p.type === 'LUGAR' ? <PlaceIcon icon={p.place_category?.icon} className="size-5" /> : <Icon name="calendar" className="size-5" />}
                      <span className="sr-only">{TYPE_NOUN[p.type]}: </span>{p.title}
                    </strong>
                    <span className="text-[15px] text-[#3f514a]">
                      {(p.type === 'LUGAR'
                        ? [p.place_category?.label || 'Lugar', p.municipality_label]
                        : [p.municipality_label, p.tradition_text && !p.start_date ? p.tradition_text : dateLine(p.start_date, p.end_date)]).filter(Boolean).join(' · ')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 mb-0 text-[15px] text-[#3f514a]">Aún no hay eventos ni lugares con ubicación.</p>}
        </section>
      )}
    </div>
  );
}
