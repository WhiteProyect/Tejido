import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Icon from '../Icon.jsx';
import PlaceIcon from '../PlaceIcon.jsx';
import { TS } from '../territory/territoryStyles.js';
import { TERRITORY, placeColors } from '../uiStyles.js';
import { MUNICIPALITY_LIST } from '../../utils/municipalities.js';
import { OTHER_PLACES, OTHER_PLACES_LABEL } from '../../utils/mapFilters.js';

// Barras del Mapa vivo: contador, "Saltar a" con los 6 municipios, "Ver como lista", filtros de tipo
// (Todos, Solo eventos, Solo lugares; nunca historias) y, con lugares, la fila de subcategorias. Todo
// solido (sin degradados ni sombras) y con objetivos de 44 px. El estado elegido no depende solo del
// color: aria-pressed, marca de verificacion y borde.
const BASE = `inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border-2 font-sans text-[15px] font-bold leading-none whitespace-nowrap ${TS.focus}`;
const BADGE = 'inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-[13px] font-extrabold tabular-nums';

export function CounterPill({ text, className = '' }) {
  return (
    <p className={`m-0 inline-flex min-h-11 shrink-0 items-center rounded-full bg-[#173f36] px-4 font-sans text-[15px] font-bold whitespace-nowrap text-[#fff9ec] ${className}`}
      aria-live="polite" data-contador>{text}</p>
  );
}

export function ListToggle({ listOpen, onToggle, controls }) {
  return (
    <button type="button" className={`${BASE} border-[#173f36] bg-white px-4 text-[#173f36] hover:bg-[#f3e4c8]`} aria-controls={controls}
      onClick={onToggle} data-ver-lista={listOpen ? 'abierta' : 'cerrada'}>
      <Icon name={listOpen ? 'map' : 'list'} className="size-5" strokeWidth={2} /> {listOpen ? 'Volver al mapa' : 'Ver como lista'}
    </button>
  );
}

export function MunicipalityJump({ onJump, scroll = false }) {
  return (
    <div className={`flex min-w-0 items-center gap-1.5 ${scroll ? 'overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : 'flex-wrap'}`}
      role="group" aria-label="Saltar a un municipio" data-saltar-a>
      <span className="shrink-0 pr-1 pl-1 font-sans text-[15px] font-bold text-[#173f36]" aria-hidden="true">Saltar a:</span>
      {MUNICIPALITY_LIST.map(({ slug, name }) => {
        const home = slug === 'caucasia';
        return (
          <button key={slug} type="button" onClick={() => onJump(slug)} data-ir-municipio={slug}
            className={`${BASE} px-3.5 ${home ? 'border-[#b8502b] bg-[#b8502b] text-[#fff9ec] hover:bg-[#a44727]' : 'border-[#173f36] bg-[#f3e4c8] text-[#173f36] hover:bg-[#ead7b3]'}`}>
            {home && <Icon name="star" className="size-4" strokeWidth={2.2} />}{name}
          </button>
        );
      })}
    </div>
  );
}

const TYPE_OPTIONS = [
  { tipo: '', label: 'Todos', count: 'all', on: { backgroundColor: TERRITORY.ink, color: TERRITORY.paper } },
  { tipo: 'eventos', label: 'Solo eventos', count: 'events', on: { backgroundColor: TERRITORY.ochre, color: TERRITORY.paper } },
  { tipo: 'lugares', label: 'Solo lugares', count: 'places', on: { backgroundColor: TERRITORY.mint, color: TERRITORY.ink } },
];

export function ClearFilters({ onClear }) {
  return (
    <button type="button" onClick={onClear} data-quitar-filtros
      className={`inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1 rounded-full border-0 bg-transparent px-2 font-sans text-[15px] font-bold whitespace-nowrap text-[#b8502b] underline decoration-2 underline-offset-4 ${TS.focus}`}>
      <span aria-hidden="true">✕</span> Quitar filtros
    </button>
  );
}

export function TypeFilters({ filters, counts, onType, onClear, scroll = false, showClear = true }) {
  return (
    <div className={`flex min-w-0 items-center gap-1.5 ${scroll ? 'overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : 'flex-wrap'}`}
      role="group" aria-label="Filtrar por tipo" data-filtro-tipo>
      {TYPE_OPTIONS.map((option) => {
        const pressed = filters.tipo === option.tipo;
        return (
          <button key={option.label} type="button" aria-pressed={pressed} onClick={() => onType(option.tipo)} data-tipo={option.tipo || 'todos'}
            className={`${BASE} border-[#173f36] px-3.5 ${pressed ? '' : 'bg-white text-[#173f36] hover:bg-[#f3e4c8]'}`} style={pressed ? option.on : undefined}>
            {pressed && <Icon name="check" className="size-4" strokeWidth={2.6} />}
            {option.label}
            <span className={BADGE} style={pressed ? { backgroundColor: TERRITORY.paper, color: TERRITORY.ink } : { backgroundColor: TERRITORY.cream, color: TERRITORY.ink }} data-conteo>
              {counts ? counts[option.count] : '–'}
            </span>
          </button>
        );
      })}
      {showClear && filters.tipo && filters.tipo !== 'lugares' && <ClearFilters onClear={onClear} />}
    </div>
  );
}

function CategoryChip({ slug, label, icon, color, count, pressed, onToggle }) {
  const colors = placeColors(color);
  return (
    <button type="button" aria-pressed={pressed} onClick={() => onToggle(slug)} data-subcategoria={slug}
      className={`${BASE} border-[#173f36] pr-3 pl-1.5 ${pressed ? '' : 'bg-white text-[#173f36] hover:bg-[#f3e4c8]'}`}
      style={pressed ? { backgroundColor: colors.bg, color: colors.text } : undefined}>
      <span className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-[#173f36]" style={{ backgroundColor: colors.bg, color: colors.text }}>
        {pressed ? <Icon name="check" className="size-4" strokeWidth={2.6} /> : <PlaceIcon icon={icon} className="size-4" strokeWidth={2} />}
      </span>
      {label}
      <span className={BADGE} style={{ backgroundColor: pressed ? TERRITORY.paper : TERRITORY.cream, color: TERRITORY.ink }} data-conteo>{count}</span>
    </button>
  );
}

// Segunda fila (solo con "Solo lugares"): subcategorias presentes en los datos, seleccion multiple.
export function CategoryRow({ filters, counts, onToggle, onClear, scroll = false, className = '' }) {
  const reduce = useReducedMotion();
  const open = filters.tipo === 'lugares' && counts;
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div key="subcategorias" className={`min-w-0 ${className}`}
          initial={reduce ? false : { opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -8 }}
          transition={{ duration: reduce ? 0 : 0.22, ease: 'easeOut' }}>
          <div className={`flex min-w-0 items-center gap-1.5 ${scroll ? 'overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : 'flex-wrap'}`}
            role="group" aria-label="Tipos de lugar (puedes elegir varios)" data-fila-subcategorias>
            {counts.categories.map((category) => (
              <CategoryChip key={category.slug} {...category} pressed={filters.categorias.includes(category.slug)} onToggle={onToggle} />
            ))}
            {counts.other > 0 && (
              <CategoryChip slug={OTHER_PLACES} label={OTHER_PLACES_LABEL} icon="pin" color="crema" count={counts.other}
                pressed={filters.categorias.includes(OTHER_PLACES)} onToggle={onToggle} />
            )}
            <ClearFilters onClear={onClear} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
