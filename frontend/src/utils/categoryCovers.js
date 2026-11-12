import { cdnImage } from './cloudinaryUrl.js';
import { hasStaticCover, setBranchCovers, useCulturalBranches } from './culturalBranches.js';

// Portadas de las ramas: viven en la lista de ramas (image_url de GET /api/cultural-branches,
// utils/culturalBranches.js). Quien edita una portada (CategoryCoverEditor) llama a setCategoryCovers
// con el mapa que devuelve el PUT/DELETE y todas las tarjetas montadas se actualizan al instante.
export const setCategoryCovers = setBranchCovers;

// null mientras llega la lista; despues, {CLAVE: url} (vacio si fallo).
export function useCategoryCovers() {
  const { ready, byKey } = useCulturalBranches();
  if (!ready) return null;
  return Object.fromEntries(Object.values(byKey).filter((branch) => branch.image_url).map((branch) => [branch.key, branch.image_url]));
}

// Fuentes en orden de preferencia: la de la base (optimizada) y la estatica de respaldo (solo las 10 iniciales).
export function coverSources(covers, key, slug, cdnOptions) {
  if (covers === null) return [];
  const sources = [];
  if (covers[key]) sources.push(cdnImage(covers[key], cdnOptions));
  if (slug && hasStaticCover(key)) sources.push(`/images/categorias/${slug}.jpg`);
  return sources;
}
