import { useEffect, useRef } from 'react';
import Icon from './Icon.jsx';
import { cdnImage } from '../utils/cloudinaryUrl.js';

// Vista ampliada de fotos (pagina de publicacion y perfil de gestor). photos: [{ url, alt, caption }].
// Accesible: dialogo modal, foco en "Cerrar" al abrir y de vuelta al disparador al cerrar, Esc
// cierra, flechas navegan (con vuelta), Tab queda atrapado dentro y clic en el fondo cierra.
export default function Lightbox({ photos, index, onClose, onMove }) {
  const closeRef = useRef(null);
  const photo = photos[index];

  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  useEffect(() => {
    function handleKey(event) {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowRight') onMove(1);
      else if (event.key === 'ArrowLeft') onMove(-1);
      else if (event.key === 'Tab') {
        // Foco atrapado dentro de la vista ampliada.
        const focusable = [...document.querySelectorAll('[data-lightbox] button')];
        const position = focusable.indexOf(document.activeElement);
        if (event.shiftKey && position <= 0) { event.preventDefault(); focusable[focusable.length - 1]?.focus(); }
        else if (!event.shiftKey && position === focusable.length - 1) { event.preventDefault(); focusable[0]?.focus(); }
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, onMove]);

  const navButton = `inline-flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/25 bg-black/40 text-white transition-colors duration-200 hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white max600:size-10`;

  return (
    <div
      data-lightbox
      className="fixed inset-0 z-[200] flex flex-col bg-[rgba(8,20,16,.92)] p-4 text-white max600:p-2"
      role="dialog"
      aria-modal="true"
      aria-label={`Galería de fotos: ${index + 1} de ${photos.length}`}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="flex items-center justify-between gap-4 px-2 py-1">
        <p className="m-0 text-[14px] font-bold" aria-live="polite">{index + 1} / {photos.length}</p>
        <button ref={closeRef} type="button" className={navButton} onClick={onClose} aria-label="Cerrar galería">
          <Icon name="close" className="size-5" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center gap-3" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
        <button type="button" className={navButton} onClick={() => onMove(-1)} aria-label="Foto anterior"><Icon name="arrow-left" className="size-5" /></button>
        <figure className="m-0 flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center">
          <img src={cdnImage(photo.url, { width: 1600 })} alt={photo.alt} className="max-h-[78vh] max-w-full rounded-[12px] object-contain" />
          {photo.caption && <figcaption className="mt-3 max-w-[720px] text-center text-[14px] leading-[1.5] text-white/80">{photo.caption}</figcaption>}
        </figure>
        <button type="button" className={navButton} onClick={() => onMove(1)} aria-label="Foto siguiente"><Icon name="arrow-right" className="size-5" /></button>
      </div>
    </div>
  );
}
