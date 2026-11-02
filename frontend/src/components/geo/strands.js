// Hebras del mapa del inicio: una por municipio, del nudo maestro (junto a Hilo) a su nudo. Cada hebra
// es una curva cubica de Bezier; la ondulacion en reposo mueve sus puntos de control en la normal de la
// cuerda (`wave`), asi la misma funcion sirve con el origen de escritorio y con el de movil.
export const STRAND_TERRACOTTA = '#a55a38';
export const STRAND_GOLD = '#d4a843';
export const STRAND_CREAM = '#f3e4c8';
export const STRAND_HIGHLIGHT = '#f4b942';

// bend: cuanto se arquea (unidades del viewBox; negativo, hacia arriba en escritorio).
// period (s) y phase: ondulacion propia de cada hebra.
export const STRANDS = [
  { slug: 'nechi', color: STRAND_TERRACOTTA, bend: -70, period: 5.6, phase: 0.2 },
  { slug: 'caucasia', color: STRAND_GOLD, bend: -34, period: 6.4, phase: 1.9 },
  { slug: 'caceres', color: STRAND_GOLD, bend: 18, period: 4.8, phase: 3.1 },
  { slug: 'taraza', color: STRAND_TERRACOTTA, bend: 44, period: 5.2, phase: 4.4 },
  { slug: 'elbagre', color: STRAND_GOLD, bend: 34, period: 6, phase: 0.9 },
  { slug: 'zaragoza', color: STRAND_TERRACOTTA, bend: 62, period: 4.4, phase: 2.6 },
];

const r1 = (value) => Math.round(value * 10) / 10;

export function strandPath(from, to, bend, wave = 0) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  const c1x = from.x + dx * 0.3 + nx * (bend + wave);
  const c1y = from.y + dy * 0.3 + ny * (bend + wave);
  const c2x = from.x + dx * 0.72 + nx * (bend * 0.55 - wave * 0.6);
  const c2y = from.y + dy * 0.72 + ny * (bend * 0.55 - wave * 0.6);
  return `M${r1(from.x)} ${r1(from.y)}C${r1(c1x)} ${r1(c1y)} ${r1(c2x)} ${r1(c2y)} ${r1(to.x)} ${r1(to.y)}`;
}
