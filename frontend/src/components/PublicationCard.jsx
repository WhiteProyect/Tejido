import { useState } from 'react';
import Icon from './Icon.jsx';
import { KIND_COLORS } from '../utils/constants.js';

// Tarjeta de publicacion de Explorar (unico consumidor: ExploreSection).
//
// Capas: la tarjeta NO recorta (sin overflow-hidden), para que el menu de compartir, que se
// abre hacia arriba, nunca quede cortado. Solo el marco de la imagen tiene su propio
// overflow-hidden y radio, y dentro la imagen se acerca un poco en hover.
// El color de la categoria (--kind, de KIND_COLORS) es solo un acento: el punto de la
// senal y el tono del borde en hover/foco.
const SHARE_ITEM = 'block w-full py-2.5 px-4 border-none bg-transparent text-left text-[13px] cursor-pointer transition-[background] duration-200 ease-[ease] hover:bg-cream';
const EASE = 'ease-[cubic-bezier(.22,1,.36,1)]';

export default function PublicationCard({ publication, user }) {
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [shareStatus, setShareStatus] = useState(null);
  const image = publication.image || '';
  const isGradient = image.startsWith('linear-gradient(');

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

  return (
    <article
      className={`group relative flex h-full flex-col rounded-[24px] border border-[#e2d9ca] bg-[#fffaf2] transition-[border-color,translate] duration-300 ${EASE} hover:border-[color-mix(in_srgb,var(--kind)_40%,#e2d9ca)] focus-within:border-[color-mix(in_srgb,var(--kind)_40%,#e2d9ca)] motion-safe:hover:-translate-y-0.5`}
      style={{ '--kind': KIND_COLORS[publication.kind] || 'var(--river)' }}
    >
      {/* Capa visual: el unico elemento que recorta. */}
      <div className="relative m-2 mb-0 h-[196px] overflow-hidden rounded-[18px] bg-[#3d8570]" role="img" aria-label={publication.title}>
        <div
          className={`absolute inset-0 bg-cover bg-center transition-[scale] duration-500 ${EASE} motion-safe:group-hover:scale-[1.04]`}
          style={{ backgroundImage: isGradient ? image : `url("${image}")` }}
        />
      </div>

      <div className="flex flex-1 flex-col px-5 pt-4 pb-4">
        {/* Senal de categoria: punto de color + nombre, discreta. */}
        <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.14em] text-muted">
          <span className="size-2 shrink-0 rounded-full bg-[var(--kind)]" aria-hidden="true" />
          {publication.kind}
        </span>
        {/* Alturas minimas de 2 y 3 lineas: las tarjetas quedan parejas aunque cambie el largo. */}
        <h3 className="mt-2.5 mb-2 line-clamp-2 min-h-[2.4em] font-sans text-[21px] font-bold leading-[1.2] tracking-[-.03em] text-ink">{publication.title}</h3>
        <p className="mt-0 mb-5 line-clamp-3 min-h-[4.5em] text-[14px] leading-[1.5] text-[#53645c]">{publication.summary}</p>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-t-line pt-3.5">
          <p className="m-0 inline-flex min-w-0 items-center gap-1.5 text-[12px] text-[#6c756f]">
            <Icon name="pin" className="size-3.5" />
            <span className="truncate">{publication.location || 'Caucasia'}</span>
          </p>
          <div className="flex shrink-0 items-center gap-2.5">
            {shareStatus === 'points' && (
              <span className="text-[13px] font-bold text-gold animate-[fadeToast_2s_ease_forwards]">+10 pts</span>
            )}
            <div className="relative">
              <button
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border-none bg-cream py-1.5 px-3 text-[13px] font-semibold text-ink transition-colors duration-200 ease-[ease] hover:bg-river hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                onClick={() => setShowShareMenu(!showShareMenu)}
                title="Compartir"
                aria-expanded={showShareMenu}
              >
                <Icon name="share" className="size-4" />
                Compartir
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
