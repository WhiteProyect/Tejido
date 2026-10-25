import { useEffect, useState } from 'react';
import { cdnImage } from './cloudinaryUrl.js';

// Portadas de las categorias culturales (GET /api/cultural-categories/covers -> {CLAVE: url}).
// Se piden UNA vez por carga de la app (promesa de modulo compartida por todas las tarjetas).
// Si la peticion falla, el mapa queda vacio y todo cae a la ruta estatica.
let request = null;

function loadCovers() {
  if (!request) {
    request = fetch('/api/cultural-categories/covers')
      .then((response) => (response.ok ? response.json() : {}))
      .catch(() => ({}));
  }
  return request;
}

// null mientras llega la respuesta; despues, el mapa (vacio si fallo).
export function useCategoryCovers() {
  const [covers, setCovers] = useState(null);
  useEffect(() => {
    let alive = true;
    loadCovers().then((data) => alive && setCovers(data || {}));
    return () => { alive = false; };
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
