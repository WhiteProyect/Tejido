import { useState } from 'react';
import Icon from './Icon.jsx';
import ShareMenu, { ICON_BUTTON, LABELED_BUTTON } from './ShareMenu.jsx';
import { UNVERIFIED_TEXT, notifyUnverified } from './VerifyEmailNotice.jsx';
import { useToast } from '../context/ToastContext.jsx';

// Guardar y compartir una publicacion: la misma logica en la tarjeta (PublicationCard) y en su
// pagina (PublicationScreen).
// - Guardar: sin sesion lleva a login y vuelve a `returnTo`; con sesion de ciudadano, POST/DELETE
//   /api/publications/{id}/favorite con toast (onFavoriteChange avisa al padre: Guardadas). Solo
//   el ciudadano guarda: a gestores y admins no se les muestra el boton.
// - Compartir: WhatsApp, Facebook o copiar el enlace #publicacion/<id>; con sesion suma los
//   +10 pts de colaborador (POST /api/collaborators/share).
// withLabels: botones con texto (pagina) en vez de solo icono (tarjeta). menuUp: el menu de
// compartir abre hacia arriba (la tarjeta lo tiene al pie).

export function publicationShareUrl(id) {
  return `${window.location.origin}/#publicacion/${id}`;
}

export default function PublicationActions({ publication, user, returnTo = 'explorar', withLabels = false, menuUp = true, onFavoriteChange }) {
  const { showToast } = useToast();
  const [points, setPoints] = useState(false);
  const [favorite, setFavorite] = useState(!!publication.favorite);
  const [favoriteBusy, setFavoriteBusy] = useState(false);

  // Con sesion, compartir por WhatsApp o Facebook suma los +10 pts de colaborador.
  async function handleShared() {
    if (!user) return;
    try {
      const token = localStorage.getItem('tejido_token');
      const response = await fetch('/api/collaborators/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ publication_id: publication.id }),
      });
      if (!response.ok) return;
      setPoints(true);
      setTimeout(() => setPoints(false), 2000);
    } catch {}
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
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        if (body.error === 'EMAIL_NOT_VERIFIED') {
          // Correo sin verificar: el aviso de verificacion, no un error generico.
          notifyUnverified();
          showToast({ tone: 'dorado', title: UNVERIFIED_TEXT, text: 'Usa el enlace que te enviamos o pide otro en el aviso de arriba.' });
        }
        throw new Error('favorite request failed');
      }
      showToast(next
        ? { tone: 'menta', eyebrow: 'Hilo guardado', title: 'Sumaste este hilo a tu ruta', text: 'Ya puedes verlo en tus guardados.' }
        : { tone: 'menta', title: 'Hilo quitado de tu ruta' });
      onFavoriteChange?.(next);
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
      {points && (
        <span className="text-[13px] font-bold text-gold animate-[fadeToast_2s_ease_forwards]">+10 pts</span>
      )}
      {(!user || user.role === 'CIUDADANO') && (
        <button type="button" className={button} onClick={handleToggleFavorite} title={favoriteLabel} aria-label={withLabels ? undefined : favoriteLabel} aria-pressed={favorite}>
          <Icon name="bookmark" className={`size-4 ${favorite ? 'fill-current text-[var(--kind)]' : ''}`} />
          {withLabels && (favorite ? 'Guardada' : 'Guardar')}
        </button>
      )}
      <ShareMenu url={publicationShareUrl(publication.id)} text={`${publication.title} - TEJIDO Bajo Cauca`} withLabels={withLabels} menuUp={menuUp} onShared={handleShared} />
    </div>
  );
}
