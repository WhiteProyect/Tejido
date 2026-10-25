import { useState } from 'react';
import Icon from './Icon.jsx';
import { useToast } from '../context/ToastContext.jsx';

// Guardar y compartir una publicacion: la misma logica en la tarjeta (PublicationCard) y en su
// pagina (PublicationScreen).
// - Guardar: sin sesion lleva a login y vuelve a `returnTo`; con sesion, POST/DELETE
//   /api/publications/{id}/favorite con toast.
// - Compartir: WhatsApp, Facebook o copiar el enlace #publicacion/<id>; con sesion suma los
//   +10 pts de colaborador (POST /api/collaborators/share).
// withLabels: botones con texto (pagina) en vez de solo icono (tarjeta). menuUp: el menu de
// compartir abre hacia arriba (la tarjeta lo tiene al pie).
const SHARE_ITEM = 'block w-full py-2.5 px-4 border-none bg-transparent text-left text-[13px] cursor-pointer transition-[background] duration-200 ease-[ease] hover:bg-cream focus-visible:bg-cream focus-visible:outline-none';
const ICON_BUTTON = 'inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line bg-white text-ink transition-colors duration-200 ease-[ease] hover:bg-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';
const LABELED_BUTTON = 'inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full border border-line bg-white px-4 text-[14px] font-bold text-ink transition-colors duration-200 ease-[ease] hover:bg-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

export function publicationShareUrl(id) {
  return `${window.location.origin}/#publicacion/${id}`;
}

export default function PublicationActions({ publication, user, returnTo = 'explorar', withLabels = false, menuUp = true }) {
  const { showToast } = useToast();
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [shareStatus, setShareStatus] = useState(null);
  const [favorite, setFavorite] = useState(!!publication.favorite);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const shareUrl = publicationShareUrl(publication.id);

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

    if (url) window.open(url, '_blank', 'noopener');
    setShowShareMenu(false);

    if (user) {
      try {
        const token = localStorage.getItem('tejido_token');
        const response = await fetch('/api/collaborators/share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ publication_id: publication.id }),
        });
        if (!response.ok) return;
        setShareStatus('points');
        setTimeout(() => setShareStatus(null), 2000);
      } catch {}
    }
  }

  async function handleToggleFavorite() {
    if (favoriteBusy) return;
    if (!user) {
      sessionStorage.setItem('tejido_return_to', returnTo);
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

  const button = withLabels ? LABELED_BUTTON : ICON_BUTTON;
  const favoriteLabel = favorite ? 'Quitar de guardados' : 'Guardar';

  return (
    <div className="flex shrink-0 items-center gap-2">
      {shareStatus === 'points' && (
        <span className="text-[13px] font-bold text-gold animate-[fadeToast_2s_ease_forwards]">+10 pts</span>
      )}
      <button type="button" className={button} onClick={handleToggleFavorite} title={favoriteLabel} aria-label={withLabels ? undefined : favoriteLabel} aria-pressed={favorite}>
        <Icon name="bookmark" className={`size-4 ${favorite ? 'fill-current text-[var(--kind)]' : ''}`} />
        {withLabels && (favorite ? 'Guardada' : 'Guardar')}
      </button>
      <div className="relative">
        <button type="button" className={button} onClick={() => setShowShareMenu(!showShareMenu)} title="Compartir" aria-label={withLabels ? undefined : 'Compartir'} aria-expanded={showShareMenu}>
          <Icon name="share" className="size-4" />
          {withLabels && 'Compartir'}
        </button>
        {showShareMenu && (
          <div className={`absolute right-0 z-10 min-w-[140px] overflow-hidden rounded-[10px] border border-line bg-white [box-shadow:0_8px_24px_rgba(0,0,0,0.12)] ${menuUp ? 'bottom-full mb-2' : 'top-full mt-2'}`}>
            <button type="button" className={SHARE_ITEM} onClick={() => handleShare('whatsapp')}>WhatsApp</button>
            <button type="button" className={SHARE_ITEM} onClick={() => handleShare('facebook')}>Facebook</button>
            <button type="button" className={SHARE_ITEM} onClick={() => handleShare('copy')}>
              {shareStatus === 'copied' ? 'Copiado' : 'Copiar enlace'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
