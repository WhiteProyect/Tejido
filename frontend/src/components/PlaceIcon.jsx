import { placeIconPath } from '../utils/placeIcons.js';
import { placeColors } from './uiStyles.js';

// Icono de una categoria de lugar (utils/placeIcons.js). Los trazos son texto fijo del propio codigo
// (nunca datos del usuario), por eso se pueden incrustar. Decorativo salvo que lleve `title`.
export default function PlaceIcon({ icon, className = 'size-6', title, strokeWidth = 1.5 }) {
  return (
    <svg className={`shrink-0 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : 'true'} role={title ? 'img' : undefined}
      aria-label={title || undefined} focusable="false" dangerouslySetInnerHTML={{ __html: placeIconPath(icon) }} />
  );
}

// Respaldo de la foto de un lugar sin imagen: su icono, en el color de su categoria, sobre fondo crema. El aro
// tinta separa del crema los discos claros (menta, amarillo y crema no llegan a 3:1 contra el fondo).
export function PlaceFallback({ category, className = '', iconClass = 'size-12' }) {
  const colors = placeColors(category?.color);
  return (
    <div className={`flex items-center justify-center bg-[#f3e4c8] ${className}`} data-respaldo-lugar>
      <span className="grid size-[76px] place-items-center rounded-full border-2" style={{ backgroundColor: colors.bg, color: colors.text, borderColor: '#173f36' }}>
        <PlaceIcon icon={category?.icon} className={iconClass} />
      </span>
    </div>
  );
}
