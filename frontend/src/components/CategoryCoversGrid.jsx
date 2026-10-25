import { useState } from 'react';
import { coverSources, useCategoryCovers } from '../utils/categoryCovers.js';
import { CULTURAL_CATEGORIES } from '../utils/constants.js';

// Portadas de las categorias culturales (Explorar sin filtro ni busqueda). Cada una lleva a
// #categoria/<slug>. La foto sale de la base (Cloudinary, utils/categoryCovers.js); si no hay o
// falla, de /images/categorias/<slug>.jpg; y si esa tambien falla, queda un fondo solido
// tintado, como el placeholder de PublicationCard.
const EASE = 'ease-[cubic-bezier(.22,1,.36,1)]';
// Tinte de respaldo por portada: se reparten los colores de marca en orden.
const TINTS = ['var(--river)', 'var(--purple)', 'var(--gold)', 'var(--orange)', 'var(--forest)'];

function CategoryCover({ label, slug, tint, sources }) {
  // 'loading' | 'loaded' | 'failed'. Con foto, texto blanco sobre un velo oscuro; sin foto,
  // texto en tinta sobre el tinte. Si una fuente falla se prueba la siguiente.
  const [image, setImage] = useState('loading');
  const [attempt, setAttempt] = useState(0);
  const hasImage = image === 'loaded';
  const src = sources[attempt];

  function handleError() {
    if (attempt + 1 < sources.length) setAttempt(attempt + 1);
    else setImage('failed');
  }

  return (
    <a
      href={`#categoria/${slug}`}
      className="group relative flex h-[220px] overflow-hidden rounded-[24px] border border-[#e2d9ca] no-underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink max600:h-[170px]"
      style={{ backgroundColor: `color-mix(in srgb, ${tint} 16%, #f3ece0)` }}
    >
      {image !== 'failed' && src && (
        <img
          src={src}
          alt=""
          aria-hidden="true"
          onLoad={() => setImage('loaded')}
          onError={handleError}
          className={`absolute inset-0 size-full object-cover transition-[scale,opacity] duration-500 ${EASE} motion-safe:group-hover:scale-[1.04] ${hasImage ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
      {hasImage && <span className="absolute inset-0 bg-[linear-gradient(to_top,rgba(12,36,30,.72)_0%,rgba(12,36,30,.2)_55%,transparent_100%)]" aria-hidden="true" />}
      <span className={`relative mt-auto flex w-full items-end justify-between gap-4 p-6 max600:p-5 ${hasImage ? 'text-white' : 'text-ink'}`}>
        <span className="font-sans text-[28px] font-bold leading-[1.05] tracking-[-.035em] max600:text-[24px]">{label}</span>
      </span>
    </a>
  );
}

export default function CategoryCoversGrid() {
  // Mientras llegan las portadas, ninguna tarjeta pide imagen (queda el tinte, como al cargar).
  const covers = useCategoryCovers();
  return (
    // div con role, no <nav>: el CSS legado oculta la etiqueta nav en movil (selector global).
    <div role="navigation" aria-label="Categorías culturales">
      {/* Misma reticula que las tarjetas de publicaciones: 2 columnas desde 1201 px. */}
      <ul className="m-0 grid list-none grid-cols-2 gap-5 p-0 max1200:grid-cols-1">
        {CULTURAL_CATEGORIES.map(([key, label, slug], index) => (
          <li key={key}>
            <CategoryCover
              key={covers === null ? 'pending' : 'ready'}
              label={label}
              slug={slug}
              tint={TINTS[index % TINTS.length]}
              sources={coverSources(covers, key, slug, { width: 800 })}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
