// Piezas compartidas del panel Carrusel (components/admin/carousel/): estados con su color, la clave de
// cada elemento y el calculo de "Fuera del limite" sobre la lista sin guardar (el mismo criterio del
// backend, services/home_carousel.py: lo visible cuenta en orden hasta el limite; los artistas, por sello).

export const STATES = {
  VISIBLE: { label: 'Visible', tone: 'bg-[#dcefe5] text-[#245a43]' },
  FUERA_DE_VIGENCIA: { label: 'Fuera de vigencia', tone: 'bg-[#f6ebcc] text-[#6b500f]' },
  NO_PUBLICADO: { label: 'No publicado', tone: 'bg-[#ece7df] text-[#3f4a46]' },
  RAMA_DESACTIVADA: { label: 'Rama desactivada', tone: 'bg-[#ece7df] text-[#3f4a46]' },
  SIN_IMAGEN: { label: 'Sin imagen', tone: 'bg-[#fbe4d9] text-[#9a3a1b]' },
  FUERA_DEL_LIMITE: { label: 'Fuera del límite', tone: 'bg-[#f6ebcc] text-[#6b500f]' },
};

export const SELLO_LABELS = { MONEYSTACK: 'Moneystack', TEJIDO: 'TEJIDO' };
export const LIMIT_KEYS = ['content_limit', 'moneystack_limit', 'tejido_limit'];

export const itemKey = (item) => `${item.type}-${item.id}`;

// Elemento tal como llega de la API, con su estado "de base" (sin contar el limite, que depende del orden
// y de las cantidades que el admin este editando).
export function fromServer(item) {
  const overLimit = item.status === 'FUERA_DEL_LIMITE';
  return { ...item, base: overLimit ? 'VISIBLE' : item.status, baseReason: overLimit ? 'Sale en el carrusel' : item.reason };
}

function limitReason(kind, limit) {
  return {
    content: `Pasa del límite de contenido (${limit})`,
    MONEYSTACK: `Pasa del límite de artistas de Moneystack (${limit})`,
    TEJIDO: `Pasa del límite de artistas de TEJIDO (${limit})`,
  }[kind];
}

export function withLimits(content, artists, settings) {
  let shown = 0;
  const contentOut = content.map((item) => {
    if (item.base !== 'VISIBLE') return { ...item, status: item.base, reason: item.baseReason };
    if (shown >= settings.content_limit) return { ...item, status: 'FUERA_DEL_LIMITE', reason: limitReason('content', settings.content_limit) };
    shown += 1;
    return { ...item, status: 'VISIBLE', reason: item.baseReason };
  });
  const quota = { MONEYSTACK: settings.moneystack_limit, TEJIDO: settings.tejido_limit };
  const used = { MONEYSTACK: 0, TEJIDO: 0 };
  const artistsOut = artists.map((item) => {
    if (item.base !== 'VISIBLE') return { ...item, status: item.base, reason: item.baseReason };
    if (used[item.sello] >= quota[item.sello]) return { ...item, status: 'FUERA_DEL_LIMITE', reason: limitReason(item.sello, quota[item.sello]) };
    used[item.sello] += 1;
    return { ...item, status: 'VISIBLE', reason: item.baseReason };
  });
  return { content: contentOut, artists: artistsOut };
}

export function sameDraft(a, b) {
  if (!a || !b) return true;
  return LIMIT_KEYS.every((key) => a.settings[key] === b.settings[key])
    && a.content.map(itemKey).join() === b.content.map(itemKey).join()
    && a.artists.map(itemKey).join() === b.artists.map(itemKey).join();
}

export function meta(item) {
  if (item.type === 'ARTIST') return [SELLO_LABELS[item.sello], item.genre].filter(Boolean).join(' · ');
  return [item.kind_label, item.branch_label].filter(Boolean).join(' · ');
}
