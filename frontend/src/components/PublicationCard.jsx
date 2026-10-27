import Icon from './Icon.jsx';
import PublicationActions from './PublicationActions.jsx';
import { BTN_INK_SM } from './uiStyles.js';
import { KIND_COLORS, KIND_LABELS } from '../utils/constants.js';
import { cdnImage } from '../utils/cloudinaryUrl.js';

// Tarjeta de publicacion (Explorar, categorias, dashboard del gestor). "Ver detalles" abre su
// pagina (#publicacion/<id>); guardar y compartir viven en PublicationActions.
//
// Formato horizontal (imagen a la izquierda, contenido a la derecha) definido por el dueño
// del proyecto el 2026-09-27 para el pivote de portal cultural/turistico. Reemplaza el
// formato vertical anterior. Sin gradientes: cuando no hay foto real (o la publicacion trae
// el gradiente placeholder heredado de datos viejos), se muestra un fondo solido de marca
// con la ilustracion de Hilo en vez de un color decorativo.
const EASE = 'ease-[cubic-bezier(.22,1,.36,1)]';

export default function PublicationCard({ publication, user, returnTo, onFavoriteChange }) {
  const image = publication.image || '';
  const hasRealImage = Boolean(image) && !image.startsWith('linear-gradient(');

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
            style={{ backgroundImage: `url("${cdnImage(image, { width: 960 })}")` }}
          />
        ) : (
          <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--kind)_12%,#f3ece0)]" />
        )}
      </div>

      <div className="flex flex-1 flex-col px-6 py-5 md:pt-12">
        <h3 className="mt-0 mb-2 font-sans text-[22px] font-bold leading-[1.2] tracking-[-.03em] text-ink">{publication.title}</h3>
        <p className="font-display m-0 mb-3 italic font-bold leading-[1.4] text-[17px] text-[#2d5a3d]">{publication.summary}</p>
        <p className="m-0 mb-4 text-[13px] font-semibold uppercase tracking-[.06em] text-[#6c756f]">{publication.location || 'Caucasia'}</p>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-t-line pt-3.5">
          <a className={BTN_INK_SM} href={`#publicacion/${publication.id}`}>
            Ver detalles
            <Icon name="arrow-right" className="size-4" />
          </a>
          <PublicationActions publication={publication} user={user} returnTo={returnTo} onFavoriteChange={onFavoriteChange} />
        </div>
      </div>
    </article>
  );
}
