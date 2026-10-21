// Entrega optimizada de imagenes de Cloudinary. En la base se guarda el secure_url limpio
// (.../image/upload/v<version>/tejido/...); aqui, solo al pintar, se le inserta una transformacion
// justo despues de /upload/: formato y calidad automaticos (WebP/AVIF segun el navegador) y un
// ancho de un conjunto FIJO. Cada combinacion distinta es una variante que Cloudinary genera y
// cobra de la cuota: por eso el ancho pedido se redondea siempre hacia arriba a CDN_WIDTHS.
// Cualquier otra URL (rutas /assets/..., /images/..., enlaces externos, null) se devuelve intacta.

// Bandera unica: si la cuenta activa "Strict transformations" (Cloudinary > Settings > Security),
// las URLs transformadas responden 401 y hay que ponerla en false (o permitir estas transformaciones).
export const CDN_TRANSFORMS_ENABLED = true;
export const CDN_WIDTHS = [160, 320, 640, 960, 1600];

const UPLOAD_RE = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/;
// Segmento de transformacion: parametros "x_valor" separados por comas (w_640, c_limit, f_auto...).
const TRANSFORMATION_RE = /^[a-z]{1,3}_[^/,]+(,[a-z]{1,3}_[^/,]+)*$/;

function parse(url) {
  if (!CDN_TRANSFORMS_ENABLED || typeof url !== 'string') return null;
  const match = url.match(UPLOAD_RE);
  if (!match) return null;
  const [, base, rest] = match;
  const first = rest.split('/')[0];
  // Ya trae transformacion (la URL no es la limpia): no se duplica.
  if (!/^v\d+$/.test(first) && TRANSFORMATION_RE.test(first)) return null;
  return { base, rest };
}

export function roundWidth(width) {
  return CDN_WIDTHS.find((candidate) => candidate >= width) ?? CDN_WIDTHS[CDN_WIDTHS.length - 1];
}

// fit "limit": no recorta ni agranda (el recorte visible lo sigue haciendo object-cover).
// fit "fill": recorte cuadrado (o con la proporcion de height) centrado en lo importante
// (g_auto; g_face con face), para avatares.
export function cdnImage(url, { width = 960, height, fit = 'limit', face = false } = {}) {
  const parsed = parse(url);
  if (!parsed) return url;
  const w = roundWidth(width);
  const parts = ['f_auto', 'q_auto'];
  if (fit === 'fill') {
    const h = height ? Math.round((w * height) / width) : w;
    parts.push('c_fill', face ? 'g_face' : 'g_auto', `w_${w}`, `h_${h}`);
  } else {
    parts.push('c_limit', `w_${w}`);
  }
  return `${parsed.base}${parts.join(',')}/${parsed.rest}`;
}

// srcSet con anchos del conjunto fijo; undefined si la URL no se puede transformar (el <img> se
// queda solo con src).
export function cdnSrcSet(url, widths = CDN_WIDTHS) {
  if (!parse(url)) return undefined;
  const unique = [...new Set(widths.map(roundWidth))].sort((a, b) => a - b);
  return unique.map((w) => `${cdnImage(url, { width: w })} ${w}w`).join(', ');
}
