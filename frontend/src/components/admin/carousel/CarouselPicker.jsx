import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Icon from '../../Icon.jsx';
import Modal from '../../talent/Modal.jsx';
import { BTN_GHOST, BTN_INK_SM, FORM_INPUT, FORM_LABEL } from '../../uiStyles.js';
import { apiRequest } from '../../../utils/api.js';
import { cdnImage } from '../../../utils/cloudinaryUrl.js';
import { KIND_LABELS } from '../../../utils/constants.js';
import { keyOptions, useCulturalBranches } from '../../../utils/culturalBranches.js';
import { STATES, itemKey, meta } from './carouselItems.js';

// Selector para agregar al carrusel (GET /api/admin/home-carousel/candidates): buscador y filtros (Contenido:
// tipo y rama; Artistas: sello), de a 10 con "Cargar más". Solo publicados y vigentes que aun no estan
// elegidos (el backend excluye lo guardado; lo agregado sin guardar se oculta aqui). Agregar es un clic.
// restorable: lo guardado que se quito sin guardar (el backend lo sigue contando como elegido y no lo
// devuelve): sale primero si coincide con los filtros. En movil es un panel inferior.
const KIND_OPTIONS = [...Object.entries(KIND_LABELS).filter(([key]) => key !== 'TALENTO'), ['TALENT', 'Talento']];

export function Thumb({ item, size = 'size-14' }) {
  const [failed, setFailed] = useState(false);
  if (!item.image || failed) {
    return <span className={`grid ${size} shrink-0 place-items-center rounded-[12px] bg-[#efe6d6] text-[20px] font-extrabold text-[#8a7a5c]`} aria-hidden="true">{(item.title || '?').charAt(0)}</span>;
  }
  return <img src={cdnImage(item.image, { width: 120, height: 120, fit: 'fill' })} alt="" className={`${size} shrink-0 rounded-[12px] object-cover`} onError={() => setFailed(true)} />;
}

export function StateChip({ item }) {
  const state = STATES[item.status] || STATES.NO_PUBLICADO;
  return <span className={`whitespace-nowrap rounded-full py-0.5 px-2.5 text-[11px] font-bold uppercase tracking-[.08em] ${state.tone}`} data-estado={item.status}>{state.label}</span>;
}

export default function CarouselPicker({ section, excluded, restorable = [], onAdd, onClose }) {
  const reduce = useReducedMotion();
  const { list: branches } = useCulturalBranches();
  const [filters, setFilters] = useState({ q: '', kind: '', category: '', sello: '' });
  const [query, setQuery] = useState('');
  const [state, setState] = useState({ loading: true, error: '', items: [], next: null, more: false });
  const request = useRef(0);
  const isContent = section === 'content';

  useEffect(() => {
    const timer = setTimeout(() => setFilters((current) => (current.q === query.trim() ? current : { ...current, q: query.trim() })), 250);
    return () => clearTimeout(timer);
  }, [query]);

  async function load(offset = 0) {
    const ticket = ++request.current;
    const params = new URLSearchParams({ section });
    for (const key of isContent ? ['q', 'kind', 'category'] : ['q', 'sello']) if (filters[key]) params.set(key, filters[key]);
    if (offset) params.set('offset', String(offset));
    setState((current) => ({ ...current, loading: !offset, more: Boolean(offset), error: '' }));
    try {
      const data = await apiRequest(`/api/admin/home-carousel/candidates?${params}`);
      if (ticket !== request.current) return;
      setState((current) => ({ loading: false, more: false, error: '', next: data.next_offset, items: offset ? [...current.items, ...data.items] : data.items }));
    } catch (error) {
      if (ticket === request.current) setState((current) => ({ ...current, loading: false, more: false, error: error.message }));
    }
  }

  useEffect(() => { load(0); }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const fold = (text) => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const matches = (item) => (!filters.q || fold(item.title).includes(fold(filters.q)))
    && (!filters.kind || item.kind === filters.kind) && (!filters.category || item.branch === filters.category)
    && (!filters.sello || item.sello === filters.sello.toUpperCase());
  const visible = [...restorable.filter(matches), ...state.items].filter((item) => !excluded.has(itemKey(item)));
  const set = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }));
  const title = isContent ? 'Agregar contenido' : 'Agregar artistas';

  return (
    <Modal title={title} onClose={onClose} animated sheet wide>
      <div className="mt-5 grid gap-4" data-selector-carrusel={section}>
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 max800:grid-cols-[minmax(0,1fr)]">
          <label className={FORM_LABEL}>Buscar
            <input className={FORM_INPUT} type="search" value={query} onChange={(event) => setQuery(event.target.value)}
              placeholder={isContent ? 'Título o nombre' : 'Nombre artístico'} data-buscar-candidato />
          </label>
          {isContent ? (
            <>
              <label className={FORM_LABEL}>Tipo
                <select className={FORM_INPUT} value={filters.kind} onChange={set('kind')} data-filtro-tipo>
                  <option value="">Todos</option>
                  {KIND_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </label>
              <label className={FORM_LABEL}>Rama
                <select className={FORM_INPUT} value={filters.category} onChange={set('category')} data-filtro-rama>
                  <option value="">Todas</option>
                  {keyOptions(branches).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </label>
            </>
          ) : (
            <label className={FORM_LABEL}>Sello
              <select className={FORM_INPUT} value={filters.sello} onChange={set('sello')} data-filtro-sello>
                <option value="">Los dos</option>
                <option value="moneystack">Moneystack</option>
                <option value="tejido">TEJIDO</option>
              </select>
            </label>
          )}
        </div>

        <p className="m-0 text-[13px] text-[#53645c]">{isContent ? 'Solo lo publicado y vigente que aún no está en el carrusel.' : 'Solo artistas publicados y activos que aún no están en el carrusel.'}</p>
        {state.error && <p className="m-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[14px] text-[#b3442b]" role="alert">{state.error}</p>}
        {state.loading ? (
          <ul className="m-0 grid list-none gap-2 p-0" aria-busy="true" aria-label="Cargando">
            {[0, 1, 2].map((i) => <li key={i} className="h-[72px] rounded-[14px] bg-[#f3ece0] motion-safe:animate-pulse" />)}
          </ul>
        ) : (
          <ul className="m-0 grid list-none gap-2 p-0" aria-label="Resultados" data-candidatos>
            <AnimatePresence initial={false}>
              {visible.map((item) => (
                <motion.li key={itemKey(item)} layout={!reduce} exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, x: 24, transition: { duration: 0.18 } }}
                  className="flex min-w-0 flex-wrap items-center gap-3 rounded-[14px] border border-[#e2d9ca] bg-white p-2.5" data-candidato={itemKey(item)}>
                  <Thumb item={item} size="size-12" />
                  <div className="min-w-0 flex-1 basis-[160px]">
                    <p className="m-0 text-[15px] font-bold leading-[1.25] text-ink [overflow-wrap:anywhere]">{item.title}</p>
                    <p className="m-0 flex flex-wrap items-center gap-2 text-[13px] text-[#53645c]">
                      <span>{meta(item)}</span>
                      {item.status !== 'VISIBLE' && <StateChip item={item} />}
                    </p>
                  </div>
                  <button type="button" className={`${BTN_INK_SM} min-h-11`} onClick={() => onAdd(item)} aria-label={`Agregar «${item.title}»`} data-agregar>
                    <Icon name="plus" className="size-3.5" /> Agregar
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
            {!visible.length && !state.error && (
              <li className="rounded-[14px] bg-[#f6efe2] py-4 px-4 text-[14px] text-[#53645c]">No hay más para agregar con estos filtros.</li>
            )}
          </ul>
        )}
        {state.next != null && !state.loading && (
          <div><button type="button" className={`${BTN_GHOST} min-h-11`} disabled={state.more} onClick={() => load(state.next)}>{state.more ? 'Cargando…' : 'Cargar más'}</button></div>
        )}
      </div>
    </Modal>
  );
}
