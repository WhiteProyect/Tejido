import Icon from '../Icon.jsx';
import PlaceIcon from '../PlaceIcon.jsx';
import EmptyNote from '../EmptyNote.jsx';

// Filtro por tipo de las publicaciones del admin (en el cliente, sobre la lista ya cargada): Todo y un
// boton por cada Publication.kind. TALENTO son las publicaciones antiguas de ese tipo (ya no se ofrece al
// crear; los portafolios de talento tienen su pestaña). No hay "Artistas": no son publicaciones.
// Botones con aria-pressed; la fila se desplaza en horizontal si no cabe. PlacesFilter (Todo / Solo
// lugares) sigue siendo el del dashboard del lider.
export const KIND_FILTERS = [
  { key: 'ALL', label: 'Todo', icon: 'thread' },
  { key: 'EVENTO', label: 'Eventos', icon: 'calendar' },
  { key: 'TALENTO', label: 'Talento', icon: 'mic' },
  { key: 'LUGAR', label: 'Lugares', icon: 'pin', place: true },
  { key: 'OPORTUNIDAD', label: 'Oportunidades', icon: 'compass' },
  { key: 'HISTORIA', label: 'Historias', icon: 'book' },
  { key: 'INICIATIVA', label: 'Iniciativas', icon: 'sprout' },
];

const EMPTY = {
  ALL: ['book', 'Aún no hay publicaciones', 'Crea la primera o espera a que los gestores envíen las suyas.'],
  EVENTO: ['calendar', 'Aún no hay eventos', 'Crea uno con «Nueva publicación» y el tipo Evento, o espera a que un gestor envíe el suyo.'],
  TALENTO: ['mic', 'No hay publicaciones de talento', 'Este tipo ya no se ofrece al crear: el talento contratable se gestiona en la pestaña Talento.'],
  LUGAR: ['pin', 'Aún no hay lugares', 'Crea uno con «Nueva publicación» y el tipo Lugar, o espera a que un líder envíe el suyo.'],
  OPORTUNIDAD: ['compass', 'Aún no hay oportunidades', 'Crea una con «Nueva publicación» y el tipo Oportunidad, o espera a que un gestor envíe la suya.'],
  HISTORIA: ['book', 'Aún no hay historias', 'Crea una con «Nueva publicación» y el tipo Historia, o espera a que un gestor envíe la suya.'],
  INICIATIVA: ['sprout', 'Aún no hay iniciativas', 'Crea una con «Nueva publicación» y el tipo Iniciativa, o espera a que un gestor envíe la suya.'],
};

export function KindEmpty({ kind }) {
  const [icon, title, text] = EMPTY[kind] || EMPTY.ALL;
  return <EmptyNote icon={icon} title={title} text={text} />;
}

export const filterByKind = (publications, kind) => (kind === 'ALL' ? publications : publications.filter((item) => item.kind === kind));

const BASE = 'inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] px-2.5 text-[14px] font-bold whitespace-nowrap transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

export default function KindFilter({ value, onChange, publications }) {
  const counts = { ALL: publications.length };
  for (const item of publications) counts[item.kind] = (counts[item.kind] || 0) + 1;
  return (
    <div className="-mx-1 overflow-x-auto px-1 py-1 [scrollbar-width:thin]">
      <div className="flex w-max gap-1" role="group" aria-label="Qué publicaciones ver" data-filtro-tipos>
        {KIND_FILTERS.map(({ key, label, icon, place }) => {
          const active = value === key;
          return (
            <button key={key} type="button" aria-pressed={active} onClick={() => onChange(key)} data-tipo-pub={key}
              className={`${BASE} ${active ? 'border-ink bg-ink text-[#fff9ec]' : 'border-[#d9cfbe] bg-white text-ink hover:border-ink'}`}>
              {place ? <PlaceIcon icon="pin" className="size-4" strokeWidth={2} /> : <Icon name={icon} className="size-4" strokeWidth={2} />}
              {label}
              <span className={`inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-px text-[12px] font-extrabold tabular-nums ${active ? 'bg-[#fff9ec] text-ink' : 'bg-[#f3e4c8] text-ink'}`} data-conteo>
                {counts[key] || 0}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
