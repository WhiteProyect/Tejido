import { useEffect, useId, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import './map/map.css';
import { FORM_INPUT, FORM_LABEL } from './uiStyles.js';
import { BAJO_CAUCA_BOX, BOX_BOUNDS, MUNICIPALITY_ZOOM, TILE_ATTRIBUTION, TILE_URL, inBox, loadLeaflet, moveMap, pinIcon } from '../utils/mapConfig.js';
import { municipalityCenter } from '../utils/municipalities.js';

// Selector del punto exacto (PublicationForm hoy; la entidad Lugar en la entrega B). Mapa pequeño con
// pin arrastrable: clic en el mapa lo coloca y arrastrarlo lo mueve; campos de Latitud y Longitud
// (Enter o "Aplicar" mueven el pin: alternativa con teclado); "Usar mi ubicacion" (geolocalizacion, solo
// en contexto seguro) y busqueda por direccion (Nominatim de OpenStreetMap: una peticion por clic en
// "Buscar", acotada a Colombia y a la caja del Bajo Cauca, como mucho una por segundo). No hay punto
// por defecto: existe solo cuando la persona lo coloca o confirma un resultado. value: { lat, lng } o
// null; onChange(value). Si `placeEmpty` y la busqueda trae un nombre, ofrece usarlo como "Lugar".
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const MIN_GAP_MS = 1000;
const round = (n) => Math.round(n * 1e6) / 1e6;
const BTN = 'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border-2 border-[#173f36] bg-white px-4 font-sans text-[15px] font-bold text-[#173f36] hover:bg-[#f3e4c8] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173f36]';
const BTN_SOLID = 'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border-0 bg-[#173f36] px-5 font-sans text-[15px] font-bold text-[#fff9ec] hover:bg-[#2d5a3d] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173f36]';
const GEO_ERRORS = {
  1: 'No diste permiso para usar tu ubicación. Puedes marcar el punto en el mapa o buscar la dirección.',
  2: 'No pudimos saber dónde estás. Intenta de nuevo o marca el punto en el mapa.',
  3: 'Se agotó el tiempo para encontrar tu ubicación. Intenta de nuevo.',
};

export default function LocationPicker({ id, label = 'Punto exacto en el mapa', value, onChange, municipality, error, disabled = false, placeEmpty = false, onUsePlace, placeNoun = 'lugar' }) {
  const auto = useId().replace(/:/g, '');
  const baseId = id || auto;
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const LRef = useRef(null);
  const lastSearch = useRef(0);
  const [ready, setReady] = useState(false);
  const [lat, setLat] = useState(value ? String(value.lat) : '');
  const [lng, setLng] = useState(value ? String(value.lng) : '');
  const [note, setNote] = useState(null); // { tone: 'info' | 'warn', text }
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const [locating, setLocating] = useState(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const describedBy = [`${baseId}-ayuda`, error ? `${baseId}-error` : null].filter(Boolean).join(' ');

  function place(point, { recenter = false } = {}) {
    if (!inBox(point.lat, point.lng)) {
      setNote({ tone: 'warn', text: 'El punto debe estar dentro del Bajo Cauca.' });
      return false;
    }
    const next = { lat: round(point.lat), lng: round(point.lng) };
    setLat(String(next.lat));
    setLng(String(next.lng));
    onChangeRef.current(next);
    if (recenter && mapRef.current) moveMap(mapRef.current, [next.lat, next.lng], Math.max(mapRef.current.getZoom(), 16));
    return true;
  }

  // Mapa (una vez).
  useEffect(() => {
    let alive = true;
    loadLeaflet().then((L) => {
      if (!alive || !mapEl.current || mapRef.current) return;
      LRef.current = L;
      const start = value ? [value.lat, value.lng] : municipalityCenter(municipality);
      const map = L.map(mapEl.current, {
        center: start, zoom: value ? 16 : MUNICIPALITY_ZOOM, minZoom: 8, maxZoom: 18, scrollWheelZoom: false,
        maxBounds: L.latLngBounds(BOX_BOUNDS).pad(0.1), maxBoundsViscosity: 0.9,
      });
      map.attributionControl.setPrefix(false);
      L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map);
      map.on('focus click', () => map.scrollWheelZoom.enable());
      map.on('blur mouseout', () => map.scrollWheelZoom.disable());
      map.on('click', (event) => { if (!disabled) place({ lat: event.latlng.lat, lng: event.latlng.lng }); });
      mapRef.current = map;
      setReady(true);
    });
    return () => { alive = false; mapRef.current?.remove(); mapRef.current = null; markerRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pin: sigue al valor (arrastrable); sin valor, no hay pin.
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;
    if (!value) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (!markerRef.current) {
      const marker = L.marker([value.lat, value.lng], { icon: pinIcon(L, 'PUNTO'), draggable: !disabled, keyboard: false }).addTo(map);
      marker.on('dragend', () => {
        const at = marker.getLatLng();
        if (!place({ lat: at.lat, lng: at.lng })) marker.setLatLng([Number(lat) || at.lat, Number(lng) || at.lng]);
      });
      markerRef.current = marker;
    } else {
      markerRef.current.setLatLng([value.lat, value.lng]);
    }
    markerRef.current.getElement()?.setAttribute('aria-hidden', 'true');
  }, [ready, value?.lat, value?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sin punto, el mapa se centra en el municipio elegido.
  useEffect(() => {
    if (ready && !value && mapRef.current) moveMap(mapRef.current, municipalityCenter(municipality), MUNICIPALITY_ZOOM);
  }, [municipality, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!value) { setLat(''); setLng(''); return; }
    setLat(String(value.lat));
    setLng(String(value.lng));
  }, [value?.lat, value?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  function applyFields() {
    const latNum = Number(String(lat).replace(',', '.'));
    const lngNum = Number(String(lng).replace(',', '.'));
    if (!String(lat).trim() || !String(lng).trim() || !Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      setNote({ tone: 'warn', text: 'Escribe la latitud y la longitud como números (por ejemplo 7.9847 y -75.1953).' });
      return;
    }
    if (place({ lat: latNum, lng: lngNum }, { recenter: true })) setNote({ tone: 'info', text: 'Punto actualizado.' });
  }

  function useMyLocation() {
    if (!('geolocation' in navigator)) { setNote({ tone: 'warn', text: 'Tu navegador no permite usar la ubicación. Marca el punto en el mapa.' }); return; }
    if (!window.isSecureContext) { setNote({ tone: 'warn', text: 'La ubicación solo funciona en una conexión segura (https). Marca el punto en el mapa.' }); return; }
    setLocating(true);
    setNote({ tone: 'info', text: 'Buscando tu ubicación...' });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const { latitude, longitude } = position.coords;
        if (!inBox(latitude, longitude)) { setNote({ tone: 'warn', text: 'Tu ubicación está fuera del Bajo Cauca: marca el punto en el mapa.' }); return; }
        if (place({ lat: latitude, lng: longitude }, { recenter: true })) setNote({ tone: 'info', text: 'Usamos tu ubicación. Ajusta el pin si hace falta.' });
      },
      (geoError) => {
        setLocating(false);
        setNote({ tone: 'warn', text: GEO_ERRORS[geoError.code] || GEO_ERRORS[2] });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  async function search(event) {
    event?.preventDefault();
    const text = query.trim();
    if (!text || searching) return;
    const wait = MIN_GAP_MS - (Date.now() - lastSearch.current);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastSearch.current = Date.now();
    setSearching(true);
    setResults(null);
    setSuggestion('');
    const { west, north, east, south } = BAJO_CAUCA_BOX;
    const params = new URLSearchParams({ q: text, format: 'jsonv2', countrycodes: 'co', viewbox: `${west},${north},${east},${south}`, bounded: '1', limit: '6', 'accept-language': 'es' });
    try {
      // El navegador manda el Referer del sitio (Nominatim pide identificar la app; no se puede fijar User-Agent).
      const response = await fetch(`${NOMINATIM}?${params}`, { referrerPolicy: 'strict-origin-when-cross-origin' });
      if (!response.ok) throw new Error(String(response.status));
      const data = await response.json();
      const found = (Array.isArray(data) ? data : []).map((item) => ({
        id: item.place_id, lat: Number(item.lat), lng: Number(item.lon), label: item.display_name, name: item.name || String(item.display_name || '').split(',')[0],
      })).filter((item) => inBox(item.lat, item.lng));
      setResults(found);
      setNote(found.length ? { tone: 'info', text: `${found.length} ${found.length === 1 ? 'resultado' : 'resultados'}. Elige uno para poner el pin.` }
        : { tone: 'warn', text: 'No encontramos esa dirección en el Bajo Cauca. Prueba con otra referencia o marca el punto en el mapa.' });
    } catch {
      setNote({ tone: 'warn', text: 'No pudimos buscar la dirección ahora. Intenta de nuevo en un momento o marca el punto en el mapa.' });
    } finally {
      setSearching(false);
    }
  }

  function chooseResult(item) {
    if (place({ lat: item.lat, lng: item.lng }, { recenter: true })) {
      setResults(null);
      setNote({ tone: 'info', text: 'Pin puesto en el resultado. Ajústalo si hace falta.' });
      if (placeEmpty && item.name) setSuggestion(item.name.slice(0, 180));
    }
  }

  function clearPoint() {
    onChangeRef.current(null);
    setSuggestion('');
    setNote({ tone: 'info', text: 'Quitaste el punto. Marca uno nuevo para poder guardar.' });
  }

  return (
    <div className="grid content-start gap-2" data-selector-punto>
      <span id={`${baseId}-etiqueta`} className={FORM_LABEL}>{label}</span>
      <p id={`${baseId}-ayuda`} className="m-0 text-[15px] text-[#53645c]">Haz clic en el mapa o arrastra el pin hasta el lugar exacto. También puedes buscar la dirección, usar tu ubicación o escribir las coordenadas.</p>
      {/* Sin <form>: va dentro del formulario de la publicacion (Enter busca sin enviarlo). */}
      <div className="flex flex-wrap gap-2" role="search" aria-label="Buscar una dirección">
        <label htmlFor={`${baseId}-buscar`} className="sr-only">Buscar una dirección o un sitio en el Bajo Cauca</label>
        <input id={`${baseId}-buscar`} className={`${FORM_INPUT} min-w-[180px] flex-1`} value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Dirección o sitio, p. ej. Parque de las Banderas" disabled={disabled} maxLength={160}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } }} />
        <button type="button" className={BTN_SOLID} onClick={search} disabled={disabled || searching || !query.trim()}>{searching ? 'Buscando...' : 'Buscar'}</button>
      </div>
      {results && results.length > 0 && (
        <ul className="m-0 grid list-none gap-1.5 p-0" aria-label="Resultados de la búsqueda" data-resultados>
          {results.map((item) => (
            <li key={item.id}>
              <button type="button" className="w-full min-h-11 cursor-pointer rounded-[12px] border border-[#ddd5c7] bg-white px-3.5 py-2 text-left font-sans text-[15px] text-[#173f36] hover:border-[#173f36] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173f36]"
                onClick={() => chooseResult(item)}>{item.label}</button>
            </li>
          ))}
        </ul>
      )}
      <div ref={mapEl} className="tejido-map h-[300px] w-full overflow-hidden rounded-[16px] border border-[#ddd5c7] max-[767px]:h-[260px]"
        role="region" aria-label="Mapa para marcar el punto" data-mapa-punto />
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2 max-[480px]:grid-cols-2">
        <label className="grid gap-1 text-[15px] font-semibold text-[#173f36]" htmlFor={`${baseId}-lat`}>Latitud
          <input id={`${baseId}-lat`} className={`${FORM_INPUT} ${error ? 'border-[#b3442b]' : ''}`} inputMode="decimal" value={lat} disabled={disabled}
            onChange={(e) => setLat(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyFields(); } }}
            aria-invalid={error ? true : undefined} aria-describedby={describedBy} placeholder="7.9847" />
        </label>
        <label className="grid gap-1 text-[15px] font-semibold text-[#173f36]" htmlFor={`${baseId}-lng`}>Longitud
          <input id={`${baseId}-lng`} className={`${FORM_INPUT} ${error ? 'border-[#b3442b]' : ''}`} inputMode="decimal" value={lng} disabled={disabled}
            onChange={(e) => setLng(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyFields(); } }}
            aria-invalid={error ? true : undefined} aria-describedby={describedBy} placeholder="-75.1953" />
        </label>
        <button type="button" className={`${BTN} max-[480px]:col-span-2`} onClick={applyFields} disabled={disabled}>Aplicar</button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={BTN} onClick={useMyLocation} disabled={disabled || locating}><Icon name="pin" className="size-4" /> {locating ? 'Buscando...' : 'Usar mi ubicación'}</button>
        <button type="button" className={`${BTN} border-[#b3442b] text-[#b3442b]`} onClick={clearPoint} disabled={disabled || !value}>Quitar punto</button>
      </div>
      <p className={`m-0 text-[15px] ${note?.tone === 'warn' ? 'font-semibold text-[#8a3a1c]' : 'text-[#3f514a]'}`} role="status" aria-live="polite" data-nota-punto>
        {note?.text || (value ? `Punto marcado: ${value.lat}, ${value.lng}` : 'Aún no marcas el punto.')}
      </p>
      {suggestion && onUsePlace && (
        <p className="m-0 flex flex-wrap items-center gap-2 rounded-[12px] bg-[#f3e4c8] px-3.5 py-2.5 text-[15px] text-[#173f36]" data-sugerencia-lugar>
          ¿Usar «{suggestion}» como {placeNoun}?
          <button type="button" className={BTN} onClick={() => { onUsePlace(suggestion); setSuggestion(''); }}>Usar como {placeNoun}</button>
          <button type="button" className={BTN} onClick={() => setSuggestion('')}>No, gracias</button>
        </p>
      )}
      {error && <p id={`${baseId}-error`} className="m-0 text-[15px] font-semibold text-[#b3442b]">{error}</p>}
    </div>
  );
}
