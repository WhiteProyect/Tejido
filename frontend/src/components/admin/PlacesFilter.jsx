import PlaceIcon from '../PlaceIcon.jsx';

// Filtro de los dashboards (admin y lider): todo o solo los lugares. Botones con aria-pressed.
const BASE = 'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-[1.5px] px-4 text-[14px] font-bold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

export default function PlacesFilter({ value, onChange, count }) {
  const options = [['ALL', 'Todo'], ['LUGAR', `Solo lugares (${count})`]];
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Qué publicaciones ver" data-filtro-lugares>
      {options.map(([key, label]) => {
        const active = value === key;
        return (
          <button key={key} type="button" aria-pressed={active} onClick={() => onChange(key)}
            className={`${BASE} ${active ? 'border-ink bg-ink text-white' : 'border-[#d9cfbe] bg-white text-ink hover:border-ink'}`}>
            {key === 'LUGAR' && <PlaceIcon icon="pin" className="size-4" />}{label}
          </button>
        );
      })}
    </div>
  );
}
