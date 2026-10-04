import { useState } from 'react';
import Icon from './Icon.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { KIND_COLORS, KIND_LABELS } from '../utils/constants.js';

// Tarjeta de publicacion de Explorar (unico consumidor: ExploreSection).
//
// Formato horizontal (imagen a la izquierda, contenido a la derecha) definido por el dueño
// del proyecto el 2026-09-27 para el pivote de portal cultural/turistico. Reemplaza el
// formato vertical anterior. Sin gradientes: cuando no hay foto real (o la publicacion trae
// el gradiente placeholder heredado de datos viejos), se muestra un fondo solido de marca
// con la ilustracion de Hilo en vez de un color decorativo.
const SHARE_ITEM = 'block w-full py-2.5 px-4 border-none bg-transparent text-left text-[13px] cursor-pointer transition-[background] duration-200 ease-[ease] hover:bg-cream';
const EASE = 'ease-[cubic-bezier(.22,1,.36,1)]';
const ICON_BUTTON = 'inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-white text-ink transition-colors duration-200 ease-[ease] hover:bg-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

export default function PublicationCard({ publication, user }) {
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [shareStatus, setShareStatus] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const { showToast } = useToast();
  const [favorite, setFavorite] = useState(!!publication.favorite);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const image = publication.image || '';
  const hasRealImage = Boolean(image) && !image.startsWith('linear-gradient(');

  const shareUrl = `${window.location.origin}/#publicacion/${publication.id}`;

  async function handleShare(platform) {
    let url = '';
    const text = `${publication.title} - TEJIDO Bajo Cauca`;

    if (platform === 'whatsapp') {
      url = `https://wa.me/?text=${encodeURIComponent(text + ' ' + shareUrl)}`;
    } else if (platform === 'facebook') {
      url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    } else if (platform === 'copy') {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setShareStatus('copied');
        setTimeout(() => setShareStatus(null), 2000);
      } catch {
        setShareStatus('error');
      }
      setShowShareMenu(false);
      return;
    }

    if (url) window.open(url, '_blank');
    setShowShareMenu(false);

    if (user) {
      try {
        await fetch('/api/collaborators/share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publication_id: publication.id }),
        });
        setShareStatus('points');
        setTimeout(() => setShareStatus(null), 2000);
      } catch {}
    }
  }

  async function handleToggleFavorite() {
    if (favoriteBusy) return;
    if (!user) {
      sessionStorage.setItem('tejido_return_to', 'explorar');
      window.location.hash = 'login';
      return;
    }
    const next = !favorite;
    setFavorite(next);
    setFavoriteBusy(true);
    try {
      const token = localStorage.getItem('tejido_token');
      const response = await fetch(`/api/publications/${publication.id}/favorite`, {
        method: next ? 'POST' : 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('favorite request failed');
      showToast(next
        ? { tone: 'menta', eyebrow: 'Hilo guardado', title: 'Sumaste este hilo a tu ruta', text: 'Ya puedes verlo en tus guardados.' }
        : { tone: 'menta', title: 'Hilo quitado de tu ruta' });
    } catch {
      setFavorite(!next);
    } finally {
      setFavoriteBusy(false);
    }
  }

  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-[24px] border border-[#e2d9ca] bg-[#fffaf2] transition-[border-color,translate] duration-300 ${EASE} hover:border-[color-mix(in_srgb,var(--kind)_40%,#e2d9ca)] focus-within:border-[color-mix(in_srgb,var(--kind)_40%,#e2d9ca)] motion-safe:hover:-translate-y-0.5 md:flex-row`}
      style={{ '--kind': KIND_COLORS[publication.kind] || 'var(--river)' }}
    >
      {/* Etiqueta de tipo en la esquina superior derecha de toda la tarjeta. En horizontal cae
          sobre la columna de texto, que por eso arranca con md:pt-12 (el titulo queda debajo). */}
      <span
        className="absolute right-3 top-3 z-10 inline-flex items-center rounded-[999px] px-3 py-1 text-[11px] font-bold uppercase tracking-[.1em] text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.15)]"
        style={{ backgroundColor: 'var(--kind)' }}
      >
        {KIND_LABELS[publication.kind] || publication.kind}
      </span>

      {/* Imagen: unico elemento que recorta. Sin gradientes: si no hay foto real, fondo tintado del tipo.
          En horizontal, minimo 280 px y se estira con la fila (si el texto es mas alto no queda hueco).
          min-w 200: solo actua con tarjetas < ~620 px (2 columnas); en 1 columna manda el 42%. */}
      <div className="relative h-[220px] shrink-0 overflow-hidden bg-[#f3ece0] md:h-auto md:min-h-[280px] md:w-[42%] md:min-w-[200px]" role="img" aria-label={publication.title}>
        {hasRealImage ? (
          <div
            className={`absolute inset-0 bg-cover bg-center transition-[scale] duration-500 ${EASE} motion-safe:group-hover:scale-[1.04]`}
            style={{ backgroundImage: `url("${image}")` }}
          />
        ) : (
          <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--kind)_12%,#f3ece0)]" />
        )}
      </div>

      <div className="flex flex-1 flex-col px-6 py-5 md:pt-12">
        <h3 className="mt-0 mb-2 font-sans text-[22px] font-bold leading-[1.2] tracking-[-.03em] text-ink">{publication.title}</h3>
        <p className="font-display m-0 mb-3 italic font-bold leading-[1.4] text-[17px] text-[#2d5a3d]">{publication.summary}</p>
        {expanded && publication.content && (
          <p className="m-0 mb-3 text-[14px] leading-[1.6] text-[#53645c]">{publication.content}</p>
        )}
        <p className="m-0 mb-4 text-[13px] font-semibold uppercase tracking-[.06em] text-[#6c756f]">{publication.location || 'Caucasia'}</p>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-t-line pt-3.5">
          <button
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border-none bg-[#173b32] py-2.5 px-4 text-[13px] font-bold text-[#f7f0e5] transition-colors duration-200 ease-[ease] hover:bg-[#0f2a23] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            type="button"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Ver menos' : 'Ver detalles'}
            <Icon name={expanded ? 'arrow-left' : 'arrow-right'} className="size-4" />
          </button>
          <div className="flex shrink-0 items-center gap-2">
            {shareStatus === 'points' && (
              <span className="text-[13px] font-bold text-gold animate-[fadeToast_2s_ease_forwards]">+10 pts</span>
            )}
            <button
              className={ICON_BUTTON}
              onClick={handleToggleFavorite}
              title={favorite ? 'Quitar de guardados' : 'Guardar'}
              aria-pressed={favorite}
            >
              <Icon name="bookmark" className={`size-4 ${favorite ? 'fill-current text-[var(--kind)]' : ''}`} />
            </button>
            <div className="relative">
              <button
                className={ICON_BUTTON}
                onClick={() => setShowShareMenu(!showShareMenu)}
                title="Compartir"
                aria-expanded={showShareMenu}
              >
                <Icon name="share" className="size-4" />
              </button>
              {showShareMenu && (
                <div className="absolute bottom-full right-0 mb-2 bg-white border border-line rounded-[10px] [box-shadow:0_8px_24px_rgba(0,0,0,0.12)] overflow-hidden z-10 min-w-[140px]">
                  <button className={SHARE_ITEM} onClick={() => handleShare('whatsapp')}>WhatsApp</button>
                  <button className={SHARE_ITEM} onClick={() => handleShare('facebook')}>Facebook</button>
                  <button className={SHARE_ITEM} onClick={() => handleShare('copy')}>
                    {shareStatus === 'copied' ? 'Copiado' : 'Copiar enlace'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
