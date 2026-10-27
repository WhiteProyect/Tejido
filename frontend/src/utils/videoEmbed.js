// Convierte el enlace de un video a lo que se reproduce DENTRO de la pagina:
// - YouTube (watch, youtu.be, shorts, embed) -> iframe de youtube-nocookie.com con autoplay.
// - Vimeo (vimeo.com/<id>, player.vimeo.com/video/<id>) -> iframe del reproductor con autoplay.
// - Archivo directo .mp4 / .webm / .ogg -> <video controls>.
// Cualquier otro host devuelve null: quien lo usa muestra el enlace como ultimo recurso.

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d{6,12}$/;

function youtubeId(url) {
  const host = url.hostname.replace(/^(www\.|m\.)/, '');
  if (host === 'youtu.be') return url.pathname.slice(1).split('/')[0];
  if (host !== 'youtube.com' && host !== 'youtube-nocookie.com') return null;
  if (url.pathname === '/watch') return url.searchParams.get('v');
  const [, kind, id] = url.pathname.split('/');
  return ['embed', 'shorts', 'live'].includes(kind) ? id : null;
}

function vimeoId(url) {
  const host = url.hostname.replace(/^www\./, '');
  const parts = url.pathname.split('/').filter(Boolean);
  if (host === 'vimeo.com') return parts.find((part) => VIMEO_ID.test(part)) || null;
  if (host === 'player.vimeo.com' && parts[0] === 'video') return parts[1];
  return null;
}

export function videoEmbed(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  const yt = youtubeId(url);
  if (yt && YOUTUBE_ID.test(yt)) {
    return { kind: 'iframe', provider: 'YouTube', src: `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0&playsinline=1` };
  }
  const vimeo = vimeoId(url);
  if (vimeo && VIMEO_ID.test(vimeo)) {
    return { kind: 'iframe', provider: 'Vimeo', src: `https://player.vimeo.com/video/${vimeo}?autoplay=1&dnt=1` };
  }
  if (/\.(mp4|webm|ogg)$/i.test(url.pathname)) {
    return { kind: 'video', provider: 'archivo', src: url.href };
  }
  return null;
}

export function videoHost(rawUrl) {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, '');
  } catch {
    return 'otro sitio';
  }
}
