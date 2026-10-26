import { useState } from 'react';
import Icon from './Icon.jsx';

// Boton "Compartir" con su menu: WhatsApp, Facebook y copiar enlace (publicaciones y perfiles de
// gestor). onShared(platform) avisa tras abrir WhatsApp/Facebook (p. ej. los +10 pts de una
// publicacion). withLabels: boton con texto en vez de solo icono. menuUp: el menu abre hacia arriba;
// menuAlign: borde del boton con el que se alinea el menu ('right' | 'left').
const SHARE_ITEM = 'block w-full py-2.5 px-4 border-none bg-transparent text-left text-[13px] cursor-pointer transition-[background] duration-200 ease-[ease] hover:bg-cream focus-visible:bg-cream focus-visible:outline-none';
export const ICON_BUTTON = 'inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line bg-white text-ink transition-colors duration-200 ease-[ease] hover:bg-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';
export const LABELED_BUTTON = 'inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full border border-line bg-white px-4 text-[14px] font-bold text-ink transition-colors duration-200 ease-[ease] hover:bg-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

export default function ShareMenu({ url, text, withLabels = false, menuUp = true, menuAlign = 'right', onShared }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function share(platform) {
    setOpen(false);
    if (platform === 'copy') {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        setCopied(false);
      }
      return;
    }
    const target = platform === 'whatsapp'
      ? `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`
      : `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    window.open(target, '_blank', 'noopener');
    onShared?.(platform);
  }

  return (
    <div className="relative">
      <button type="button" className={withLabels ? LABELED_BUTTON : ICON_BUTTON} onClick={() => setOpen(!open)} title="Compartir" aria-label={withLabels ? undefined : 'Compartir'} aria-expanded={open}>
        <Icon name="share" className="size-4" />
        {withLabels && (copied ? 'Enlace copiado' : 'Compartir')}
      </button>
      {open && (
        <div className={`absolute ${menuAlign === 'left' ? 'left-0' : 'right-0'} z-10 min-w-[140px] overflow-hidden rounded-[10px] border border-line bg-white [box-shadow:0_8px_24px_rgba(0,0,0,0.12)] ${menuUp ? 'bottom-full mb-2' : 'top-full mt-2'}`}>
          <button type="button" className={SHARE_ITEM} onClick={() => share('whatsapp')}>WhatsApp</button>
          <button type="button" className={SHARE_ITEM} onClick={() => share('facebook')}>Facebook</button>
          <button type="button" className={SHARE_ITEM} onClick={() => share('copy')}>{copied ? 'Copiado' : 'Copiar enlace'}</button>
        </div>
      )}
    </div>
  );
}
