import { useState } from 'react';
import { PUB_KIND } from './uiStyles.js';

const SHARE_ITEM = 'block w-full py-2.5 px-4 border-none bg-transparent text-left text-[13px] cursor-pointer transition-[background] duration-200 ease-[ease] hover:bg-cream';

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
    <article className="bg-[#fffaf2] border border-[#e2d9ca]">
      <div
        className="bg-[#3d8570] bg-center bg-cover h-[190px]"
        style={{ backgroundImage: isGradient ? image : `url("${image}")` }}
        role="img"
        aria-label={publication.title}
      />
      <div className="p-[22px]">
        <span className={PUB_KIND}>{publication.kind}</span>
        <h3 className="font-sans tracking-[-.055em] text-[22px] my-2.5 mx-0">{publication.title}</h3>
        <p className="text-[#53645c] leading-[1.5] min-h-12">{publication.summary}</p>
        <small className="text-[#6c756f]">{publication.location || 'Caucasia'}</small>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-t-line">
          <div className="relative">
            <button
              className="inline-flex items-center gap-1.5 bg-cream border-none rounded-[8px] py-1.5 px-3 text-[13px] font-semibold cursor-pointer text-ink transition-all duration-200 ease-[ease] hover:bg-river hover:text-white"
              onClick={() => setShowShareMenu(!showShareMenu)}
              title="Compartir"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <circle cx="18" cy="5" r="3"/>
                <circle cx="6" cy="12" r="3"/>
                <circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              Compartir
            </button>
            {showShareMenu && (
              <div className="absolute bottom-full left-0 mb-2 bg-white border border-line rounded-[10px] [box-shadow:0_8px_24px_rgba(0,0,0,0.12)] overflow-hidden z-10 min-w-[140px]">
                <button className={SHARE_ITEM} onClick={() => handleShare('whatsapp')}>WhatsApp</button>
                <button className={SHARE_ITEM} onClick={() => handleShare('facebook')}>Facebook</button>
                <button className={SHARE_ITEM} onClick={() => handleShare('copy')}>
                  {shareStatus === 'copied' ? 'Copiado' : 'Copiar enlace'}
                </button>
              </div>
            )}
          </div>
          {shareStatus === 'points' && (
            <span className="text-[13px] font-bold text-gold animate-[fadeToast_2s_ease_forwards]">+10 pts</span>
          )}
        </div>
      </div>
    </article>
  );
}
