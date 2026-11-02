import { useId, useState } from 'react';
import SuggestNote from './SuggestNote.jsx';

// Modulo 4: publicaciones del municipio (las que trae GET /api/municipalities/{slug}, hasta 12).
// Filtro en el cliente por `kind`: Eventos = EVENTO, Historias = HISTORIA, Oportunidades =
// OPORTUNIDAD; iniciativas, lugares y el talento antiguo solo salen en "Todo". Un filtro sin
// publicaciones no se oculta: muestra su estado vacio. Cada tarjeta abre #publicacion/<id>.
const FILTERS = [
  ['TODO', 'Todo', null],
  ['EVENTO', 'Eventos', 'eventos'],
  ['HISTORIA', 'Historias', 'historias'],
  ['OPORTUNIDAD', 'Oportunidades', 'oportunidades'],
];

// Insignia por tipo, con su contraste (texto sobre fondo):
// Evento #b8502b + blanco 4.98:1 (el #c85a32 del diseño da 4.23:1 con texto de 11 px);
// Historia tinta + crema 9.3:1; Oportunidad dorado + tinta 5.27:1; Iniciativa menta + tinta 5.87:1;
// Lugar rio ajustado + blanco 4.75:1; Talento morado + blanco 6.01:1.
const KIND_BADGES = {
  EVENTO: ['Evento cultural', 'bg-[#b8502b] text-white'],
  HISTORIA: ['Historia local', 'bg-ink text-cream'],
  OPORTUNIDAD: ['Oportunidad', 'bg-gold text-ink'],
  INICIATIVA: ['Iniciativa', 'bg-[#88c5a4] text-ink'],
  LUGAR: ['Lugar', 'bg-[#1a7e8f] text-white'],
  TALENTO: ['Talento', 'bg-purple text-white'],
};
// Rio #1d8fa3 como texto solo da 3.6-3.8:1: los filtros usan el tono ajustado (4.52:1 sobre papel,
// 4.75:1 con texto blanco encima).
const RIVER = '#1a7e8f';

function PublicationTile({ publication }) {
  const [label, tone] = KIND_BADGES[publication.kind] || [publication.kind, 'bg-ink text-cream'];
  return (
    <article className="relative flex min-w-0 flex-col gap-3 rounded-2xl border border-[#ddd5c7] bg-white p-6 transition-[border-color,translate] duration-200 focus-within:border-ink hover:border-ink motion-safe:hover:-translate-y-0.5">
      <span className={`w-fit rounded-full py-1 px-3 text-[11px] font-bold uppercase tracking-[.12em] ${tone}`}>{label}</span>
      <h3 className="m-0 font-sans text-[21px] font-extrabold leading-[1.25] tracking-[-0.02em] text-ink">
        {/* El enlace cubre toda la tarjeta (after:inset-0) y su foco se ve en el borde de la tarjeta. */}
        <a href={`#publicacion/${publication.id}`} className="text-ink no-underline outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ink">
          {publication.title}
        </a>
      </h3>
      {publication.summary && <p className="m-0 font-display text-[17px] italic leading-[1.5] text-[#44564f]">«{publication.summary}»</p>}
      {publication.location && <p className="mt-auto mb-0 pt-2 text-[13px] font-semibold text-[#53645c]">{publication.location}</p>}
    </article>
  );
}

export default function MunicipalityPublications({ municipality, publications }) {
  const [filter, setFilter] = useState('TODO');
  const listId = useId().replace(/:/g, '');
  const visible = filter === 'TODO' ? publications : publications.filter((publication) => publication.kind === filter);
  const noun = FILTERS.find(([key]) => key === filter)[2];

  return (
    <section aria-labelledby="municipio-publicaciones">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 id="municipio-publicaciones" className="m-0 font-sans text-[length:clamp(28px,3.4vw,40px)] font-extrabold leading-[1.1] tracking-[-0.04em] text-ink">
          Publicaciones de {municipality.name}
        </h2>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar publicaciones">
          {FILTERS.map(([key, label]) => {
            const active = key === filter;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                aria-controls={listId}
                onClick={() => setFilter(key)}
                className="min-h-11 cursor-pointer rounded-full border-[1.5px] py-2 px-5 text-[14px] font-bold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                style={active ? { backgroundColor: RIVER, borderColor: RIVER, color: '#ffffff' } : { backgroundColor: '#ffffff', borderColor: RIVER, color: RIVER }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
      <div id={listId} className="mt-6" aria-live="polite">
        {visible.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((publication) => <PublicationTile key={publication.id} publication={publication} />)}
          </div>
        ) : (
          <SuggestNote
            title={noun ? `Aún no hay ${noun} de ${municipality.name}` : `Aún no hay publicaciones de ${municipality.name}`}
            text={`¿Conoces una historia, un evento o una oportunidad de ${municipality.name}? Cuéntanosla y la tejemos con su gente.`}
            draft={`Quiero sugerir una historia de ${municipality.name}: `}
          />
        )}
      </div>
    </section>
  );
}
