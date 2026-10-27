import Icon from '../Icon.jsx';
import TalentSeal from './TalentSeal.jsx';
import { cdnImage } from '../../utils/cloudinaryUrl.js';
import { canSave, categoryColor, categoryOrigin, categoryTint, formatCOP, formatShortDay, initials, useTalentFavorite } from '../../utils/talent.js';

// Tarjeta de talento (listado #talento, "Talento parecido" y Guardadas), segun el diseño: foto a
// todo el ancho arriba con "Verificado por Tejido" encima y el sello dorado montado sobre su borde
// inferior derecho; debajo CATEGORIA · MUNICIPIO, nombre, servicios y el pie con precio y fecha.
// Toda la tarjeta es un enlace a #talento/<slug> (enlace estirado con el nombre como aria-label);
// guardar es un boton aparte, encima del enlace, y solo lo ven visitantes y ciudadanos. Sin foto:
// fondo solido tintado por categoria.
const EASE = 'ease-[cubic-bezier(.22,1,.36,1)]';

export default function TalentCard({ talent, user, returnTo, onFavoriteChange, headingLevel = 3 }) {
  const { favorite, busy, toggle } = useTalentFavorite(talent, user, { returnTo, onChange: onFavoriteChange });
  const Heading = `h${headingLevel}`;
  const hasPrice = talent.price_from !== null && talent.price_from !== undefined;

  return (
    <article className={`group relative flex w-full min-w-0 flex-col rounded-[16px] border border-[#e3d6bf] bg-[#fffaf0] [box-shadow:0_6px_18px_rgba(12,36,30,.08)] transition-[box-shadow,translate] duration-300 ${EASE} hover:[box-shadow:0_12px_28px_rgba(12,36,30,.14)] motion-safe:hover:-translate-y-0.5`}>
      <div className="relative aspect-[16/9] rounded-t-[15px]" style={{ backgroundColor: categoryTint(talent.category) }}>
        <div className="absolute inset-0 overflow-hidden rounded-t-[15px]">
          {talent.cover_url ? (
            <img src={cdnImage(talent.cover_url, { width: 640 })} alt="" loading="lazy" decoding="async"
              className={`size-full object-cover transition-[scale] duration-500 ${EASE} motion-safe:group-hover:scale-[1.03]`} />
          ) : (
            <div className="flex size-full items-center justify-center" aria-hidden="true">
              <span className="font-display text-[52px] font-bold italic" style={{ color: categoryColor(talent.category) }}>{initials(talent.name)}</span>
            </div>
          )}
        </div>
        {talent.verified && (
          <>
            <span className="absolute left-2.5 top-2.5 z-[2] inline-flex items-center gap-1.5 rounded-full bg-[rgba(12,36,30,.62)] py-1 pr-2.5 pl-1 text-[12px] font-bold text-white">
              <TalentSeal className="size-5" /> Verificado por Tejido
            </span>
            <TalentSeal className="absolute -bottom-5 right-3 z-[2] size-12" />
          </>
        )}
      </div>

      <div className="flex flex-1 flex-col px-4 pt-3.5 pb-4">
        <p className="m-0 pr-12 text-[11px] font-extrabold uppercase tracking-[.1em] text-[#53645c]">{categoryOrigin(talent)}</p>
        <Heading className="mt-1 mb-0 font-sans text-[19px] font-bold leading-[1.2] tracking-[-.015em] text-ink">{talent.name}</Heading>
        {talent.tags?.length > 0 && (
          <ul className="mt-2.5 mb-0 flex list-none flex-wrap gap-1.5 p-0" aria-label="Servicios">
            {talent.tags.map((tag) => (
              <li key={tag} className="rounded-full border border-[#cdbd9e] bg-transparent py-0.5 px-2.5 text-[12px] font-semibold lowercase text-[#3f514a]">{tag}</li>
            ))}
          </ul>
        )}
        <div className="min-h-3 flex-1" aria-hidden="true" />
        {(hasPrice || talent.next_available) && (
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-1">
            {hasPrice ? <p className="m-0 text-[14px] font-bold text-ink">Desde {formatCOP(talent.price_from)}</p> : <span />}
            {talent.next_available && (
              <p className="m-0 text-[13px] font-semibold text-[#3f514a]">Disponible {formatShortDay(talent.next_available)}</p>
            )}
          </div>
        )}
      </div>

      {/* Enlace estirado: toda la tarjeta lleva al perfil. */}
      <a href={`#talento/${talent.slug}`} aria-label={talent.name}
        className="absolute inset-0 z-[3] rounded-[16px] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink" />

      {canSave(user) && (
        <button type="button" onClick={toggle} disabled={busy} aria-pressed={favorite}
          aria-label={favorite ? `Quitar a ${talent.name} de mi agenda` : `Guardar a ${talent.name} en mi agenda`}
          title={favorite ? 'Quitar de mi agenda' : 'Guardar en mi agenda'}
          className="absolute right-2.5 top-2.5 z-[4] inline-flex size-8 cursor-pointer items-center justify-center rounded-full border-0 bg-[#fff9ec] text-ink [box-shadow:0_2px_6px_rgba(12,36,30,.2)] transition-colors duration-200 hover:bg-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-wait">
          <Icon name="bookmark" className={`size-4 ${favorite ? 'fill-current text-orange' : ''}`} />
        </button>
      )}
    </article>
  );
}
