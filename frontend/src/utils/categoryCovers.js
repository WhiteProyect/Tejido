import { useEffect, useState } from 'react';
import { cdnImage } from './cloudinaryUrl.js';

// Portadas de las categorias culturales (GET /api/cultural-categories/covers -> {CLAVE: url}).
// Se piden UNA vez por carga de la app (promesa de modulo compartida por todas las tarjetas).
// Si la peticion falla, el mapa queda vacio y todo cae a la ruta estatica.
// Quien edita una portada (CategoryCoverEditor) llama a setCategoryCovers con el mapa que devuelve
// el PUT/DELETE: todas las tarjetas montadas se actualizan al instante, y la cache HTTP del GET
// (5 minutos) se renueva para las proximas cargas de este navegador.
let request = null;
const listeners = new Set();

function loadCovers() {
  if (!request) {
    request = fetch('/api/cultural-categories/covers')
      .then((response) => (response.ok ? response.json() : {}))
      .catch(() => ({}));
  }
  return request;
}

export function setCategoryCovers(covers) {
  request = Promise.resolve(covers || {});
  listeners.forEach((listener) => listener(covers || {}));
  // Renueva la copia en cache del navegador para no ver la portada vieja al recargar.
  fetch('/api/cultural-categories/covers', { cache: 'reload' }).catch(() => {});
}

// null mientras llega la respuesta; despues, el mapa (vacio si fallo).
export function useCategoryCovers() {
  const [covers, setCovers] = useState(null);
  useEffect(() => {
    let alive = true;
    loadCovers().then((data) => alive && setCovers(data || {}));
    const listener = (data) => alive && setCovers(data);
    listeners.add(listener);
    return () => {
      alive = false;
      listeners.delete(listener);
    };
  }, []);
  return covers;
}

// Fuentes en orden de preferencia: la de la base (optimizada) y la estatica de respaldo.
export function coverSources(covers, key, slug, cdnOptions) {
  if (covers === null) return [];
  const sources = [];
  if (covers[key]) sources.push(cdnImage(covers[key], cdnOptions));
  if (slug) sources.push(`/images/categorias/${slug}.jpg`);
  return sources;
}
