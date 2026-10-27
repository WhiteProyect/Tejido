import { useCallback, useEffect, useRef, useState } from 'react';
import EmptyNote from '../components/EmptyNote.jsx';
import Icon from '../components/Icon.jsx';
import ThreadsBackdrop from '../components/ThreadsBackdrop.jsx';
import TalentCard from '../components/talent/TalentCard.jsx';
import TalentSeal from '../components/talent/TalentSeal.jsx';
import { BTN_INK_MD, BTN_INK_OUTLINE_MD } from '../components/uiStyles.js';
import { apiRequest } from '../utils/api.js';
import { CULTURAL_CATEGORIES, MUNICIPALITIES } from '../utils/constants.js';
import { CATEGORY_KEY_BY_SLUG, EMPTY_FILTERS, parseTalentFilters, talentHash } from '../utils/talent.js';
import { ARTICULATION_BANNER, TECHNICAL_SERVICES } from '../utils/talentContent.js';

// Listado publico del talento contratable (#talento), segun el diseño: encabezado centrado,
// buscador en capsula, fila de chips, grilla de 3 columnas, banner de la Mesa Blanca y las
// tarjetas de servicios tecnicos. Los filtros viajan en el hash
// (#talento?cat=<slug>&mun=<municipio>&q=<texto>&disp=1) para poder compartirlos: los cambios
// propios se escriben con replaceState (sin hashchange, asi App no sube la pagina ni hay bucles)
// y un hashchange de afuera (atras, un enlace) vuelve a leerlos. GET /api/talent trae las
// tarjetas, el total y las facetas (cada una contada con los otros filtros).
const PAGE = 24;
const DEBOUNCE_MS = 400;
const WRAP = 'mx-auto w-full max-w-[1000px]';

const CHIP = 'inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border text-[13px] font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';
const CHIP_PILL = `${CHIP} px-3.5`;
const CHIP_IDLE = 'border-[#cdbd9e] bg-[#fffaf0] text-ink hover:border-ink';
const CHIP_ACTIVE = 'border-ink bg-ink text-white';

function sameFilters(a, b) {
  return a.cat === b.cat && a.mun === b.mun && a.q === b.q && a.disp === b.disp;
}

function apiQuery(filters, offset) {
  const params = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
  if (filters.cat) params.set('category', CATEGORY_KEY_BY_SLUG[filters.cat]);
  if (filters.mun) params.set('origin', filters.mun);
  if (filters.q.trim()) params.set('q', filters.q.trim());
  if (filters.disp) params.set('available', '1');
  return `/api/talent?${params}`;
}

function SkeletonGrid() {
  return (
    <ul className="m-0 grid list-none grid-cols-[repeat(3,minmax(0,1fr))] gap-5 p-0 max900:grid-cols-[repeat(2,minmax(0,1fr))] max600:grid-cols-[minmax(0,1fr)]" aria-hidden="true">
      {Array.from({ length: 6 }, (_, index) => (
        <li key={index} className="overflow-hidden rounded-[16px] border border-[#e3d6bf] bg-[#fffaf0]">
          <div className="aspect-[16/9] bg-[#efe6d6] motion-safe:animate-pulse" />
          <div className="p-4">
            <div className="h-3 w-1/2 rounded bg-[#efe6d6]" />
            <div className="mt-3 h-5 w-3/4 rounded bg-[#efe6d6]" />
            <div className="mt-5 h-4 w-full rounded bg-[#efe6d6]" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function ArticulationBanner() {
  const { title, figure, seal } = ARTICULATION_BANNER;
  return (
    <section className="relative mt-16 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-8 overflow-hidden rounded-[16px] bg-ink-deep py-10 pr-10 pl-12 max800:grid-cols-[minmax(0,1fr)] max800:p-8 max480:px-6" aria-labelledby="talento-mesa">
      <div className="relative">
        <h2 id="talento-mesa" className="m-0 font-sans text-[18px] font-extrabold uppercase leading-[1.3] tracking-[.04em] text-[#fff9ec]">{title}</h2>
        <p className="mt-2 mb-0 font-sans text-[length:clamp(52px,6vw,76px)] font-extrabold leading-none tracking-[-.03em] text-[#fff9ec]">{figure}</p>
      </div>
      <div className="relative w-[280px] rounded-[10px] border border-[#e3d6bf] bg-[#fffdf7] py-5 px-5 text-center [box-shadow:0_10px_30px_rgba(0,0,0,.25)] max800:justify-self-start">
        <span className="absolute -top-px right-5 h-11 w-5 bg-orange [clip-path:polygon(0_0,100%_0,100%_100%,50%_78%,0_100%)]" aria-hidden="true" />
        <TalentSeal className="mx-auto size-12" />
        <p className="mt-2 mb-0 text-[14px] font-bold text-ink">{seal.title}</p>
        <p className="mt-2.5 mb-0 border-y border-y-[#e3d6bf] py-1.5 text-[12px] font-semibold text-[#3f514a]">{seal.act}</p>
      </div>
    </section>
  );
}

function TechnicalServices() {
  return (
    <section className="mt-8" aria-label={TECHNICAL_SERVICES.eyebrow}>
      <ul className="m-0 grid list-none grid-cols-[repeat(4,minmax(0,1fr))] gap-5 p-0 max900:grid-cols-[repeat(2,minmax(0,1fr))] max480:grid-cols-[minmax(0,1fr)]">
        {TECHNICAL_SERVICES.items.map((title) => (
          <li key={title} className="rounded-[14px] border border-[#e3d6bf] bg-[#fffaf0] py-5 px-4 text-center [box-shadow:0_4px_14px_rgba(12,36,30,.06)]">
            <p className="m-0 text-[11px] font-bold uppercase leading-[1.35] tracking-[.08em] text-[#3f514a]">{TECHNICAL_SERVICES.eyebrow}</p>
            <h3 className="mt-1.5 mb-0 font-sans text-[22px] font-bold leading-[1.2] tracking-[-.01em] text-ink">{title}</h3>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function TalentScreen({ user }) {
  const [filters, setFilters] = useState(() => parseTalentFilters());
  const [draft, setDraft] = useState(() => parseTalentFilters().q);
  const [state, setState] = useState({ items: [], total: 0, facets: null, loading: true, loadingMore: false, error: '' });
  const request = useRef(0);

  useEffect(() => { document.title = 'Talento del Bajo Cauca · TEJIDO'; }, []);

  // Un hashchange de afuera (atras, un enlace compartido o del menu) vuelve a leer los filtros.
  useEffect(() => {
    function handleHash() {
      if (!window.location.hash.startsWith('#talento') || window.location.hash.startsWith('#talento/')) return;
      const next = parseTalentFilters();
      setFilters((current) => (sameFilters(current, next) ? current : next));
      setDraft(next.q);
    }
    window.addEventListener('hashchange', handleHash);
    window.addEventListener('popstate', handleHash);
    return () => {
      window.removeEventListener('hashchange', handleHash);
      window.removeEventListener('popstate', handleHash);
    };
  }, []);

  const update = useCallback((patch) => {
    setFilters((current) => {
      const next = { ...current, ...patch };
      if (sameFilters(current, next)) return current;
      const hash = talentHash(next);
      if (window.location.hash !== hash) window.history.replaceState(window.history.state, '', hash);
      return next;
    });
  }, []);

  const load = useCallback(async (offset) => {
    const id = ++request.current;
    setState((current) => ({ ...current, error: '', ...(offset ? { loadingMore: true } : { loading: true }) }));
    try {
      const data = await apiRequest(apiQuery(filters, offset));
      if (id !== request.current) return;
      setState((current) => ({
        items: offset ? [...current.items, ...data.items] : data.items,
        total: data.total,
        facets: offset ? current.facets : data.facets,
        loading: false,
        loadingMore: false,
        error: '',
      }));
    } catch (error) {
      if (id !== request.current) return;
      setState((current) => ({ ...current, loading: false, loadingMore: false, error: error.message || 'No pudimos cargar el talento.' }));
    }
  }, [filters]);

  useEffect(() => { load(0); }, [load]);

  // Busqueda al escribir, con un retardo corto.
  useEffect(() => {
    const timer = setTimeout(() => update({ q: draft.slice(0, 100) }), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, update]);

  function submitSearch(event) {
    event.preventDefault();
    update({ q: draft.slice(0, 100) });
  }

  function clearFilters() {
    setDraft('');
    update(EMPTY_FILTERS);
  }

  const hasFilters = Boolean(filters.cat || filters.mun || filters.q.trim() || filters.disp);
  const facets = state.facets;
  const activeKey = filters.cat ? CATEGORY_KEY_BY_SLUG[filters.cat] : null;
  const categoryChips = CULTURAL_CATEGORIES.filter(([key]) => key === activeKey || (facets?.categories?.[key] || 0) > 0);
  const returnTo = talentHash(filters).replace('#', '');
  const countText = state.loading ? '' : `${state.total} ${state.total === 1 ? 'talento' : 'talentos'}${hasFilters ? ' con estos filtros' : ''}`;

  let results;
  if (state.loading) {
    results = <><p className="sr-only" role="status">Cargando talento...</p><SkeletonGrid /></>;
  } else if (state.error && state.items.length === 0) {
    results = (
      <div className="rounded-[16px] border border-[rgba(216,91,54,.35)] bg-[#fffaf0] py-8 px-6 text-center" role="alert">
        <p className="m-0 text-[17px] font-bold text-ink">No pudimos cargar el talento</p>
        <p className="mt-1 mb-5 text-[14px] text-[#53645c]">{state.error}</p>
        <button type="button" className={BTN_INK_MD} onClick={() => load(0)}>Reintentar</button>
      </div>
    );
  } else if (state.items.length === 0) {
    results = hasFilters ? (
      <EmptyNote icon="search" title="No encontramos talento con esos filtros" text="Prueba con otra categoría, otro municipio o una búsqueda más corta."
        action={<button type="button" className={BTN_INK_OUTLINE_MD} onClick={clearFilters}>Quitar filtros</button>} />
    ) : (
      <EmptyNote icon="people" title="Pronto conocerás nuevos talentos" text="Estamos verificando los primeros portafolios del Bajo Cauca." />
    );
  } else {
    results = (
      <>
        <ul className="m-0 grid list-none grid-cols-[repeat(3,minmax(0,1fr))] gap-5 p-0 max900:grid-cols-[repeat(2,minmax(0,1fr))] max600:grid-cols-[minmax(0,1fr)]">
          {state.items.map((talent) => (
            <li key={talent.id} className="flex min-w-0">
              <TalentCard talent={talent} user={user} returnTo={returnTo} />
            </li>
          ))}
        </ul>
        {state.error && <p className="mt-6 mb-0 text-center text-[14px] text-[#b3442b]" role="alert">{state.error}</p>}
        {state.items.length < state.total && (
          <div className="mt-10 text-center">
            <button type="button" className={BTN_INK_OUTLINE_MD} onClick={() => load(state.items.length)} disabled={state.loadingMore} aria-busy={state.loadingMore}>
              {state.loadingMore ? 'Cargando...' : 'Ver más talento'}
            </button>
          </div>
        )}
      </>
    );
  }

  // Sin fondo propio: hereda el de la pagina (paper), el mismo que rodea al pie. overflow-clip (no
  // hidden) para no crear un contenedor de scroll, que romperia el sticky de los hilos.
  return (
    <section className="relative min-h-[62vh] overflow-clip pt-[56px] pb-[90px] px-[6vw] max800:pt-10 max800:pb-16">
      {/* Hilos animados del hero (mismas propiedades): lienzo del alto de la pantalla, pegado arriba
          mientras se recorre la seccion y cortado donde ella termina. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="sticky top-0 h-screen max768:h-svh">
          <ThreadsBackdrop className="absolute inset-0 opacity-35" amplitude={3.7} distance={0.4} enableMouseInteraction={false} speed={0.2} color={[0.114, 0.561, 0.639]} />
        </div>
      </div>
      <div className="relative z-[1]">
        <header className="mx-auto max-w-[760px] text-center">
          <p className="m-0 inline-flex rounded-full bg-[#16707f] py-1 px-3.5 text-[11px] font-bold uppercase tracking-[.12em] text-white">Portafolio vivo</p>
          <h1 className="mt-4 mb-0 font-sans text-[length:clamp(36px,4.6vw,60px)] font-extrabold leading-[1.08] tracking-[-.035em] text-ink">
            El talento del Bajo Cauca,<br className="max600:hidden" /> listo para{' '}
            <span className="relative inline-block font-display font-bold italic text-orange">
              contratar
              <svg className="pointer-events-none absolute -bottom-[0.18em] left-[-4%] h-[0.32em] w-[108%] text-orange" viewBox="0 0 200 20" preserveAspectRatio="none" fill="none" aria-hidden="true">
                <path d="M3 14 C 50 5, 120 4, 197 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              </svg>
            </span>
          </h1>
          <p className="mx-auto mt-5 mb-0 max-w-[560px] text-[17px] leading-[1.5] text-[#3f514a]">
            Perfiles verificados de música, danza, artes visuales y emprendimiento. Con acta, con agenda, con dónde.
          </p>
        </header>

        <form role="search" onSubmit={submitSearch}
          className="mx-auto mt-6 flex max-w-[600px] items-center gap-2 rounded-full border border-[#cdbd9e] bg-[#fffdf7] p-1 pl-4 [box-shadow:0_4px_14px_rgba(12,36,30,.06)] focus-within:border-ink max480:flex-wrap max480:rounded-[22px] max480:p-2 max480:pl-3.5">
          <Icon name="search" className="size-[18px] shrink-0 text-[#53645c]" />
          <label htmlFor="talento-buscar" className="sr-only">Buscar talento por nombre o frase</label>
          <input id="talento-buscar" type="search" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={100}
            placeholder="Buscar talento" autoComplete="off"
            className="h-10 min-w-0 flex-1 border-0 bg-transparent font-sans text-[16px] text-ink outline-none placeholder:text-[#6c756f]" />
          <button type="submit" className="inline-flex h-10 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-[#2e7d5e] px-6 text-[15px] font-bold text-white transition-colors duration-200 hover:bg-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink max480:w-full">
            Buscar talento
          </button>
        </form>

        <div className="mx-auto mt-4 flex max-w-[900px] flex-wrap items-center justify-center gap-2" role="group" aria-label="Filtros del talento">
          {categoryChips.map(([key, label, slug]) => {
            const active = key === activeKey;
            return (
              <button key={key} type="button" aria-pressed={active} className={`${CHIP_PILL} ${active ? CHIP_ACTIVE : CHIP_IDLE}`}
                onClick={() => update({ cat: active ? '' : slug })}>
                {label}
              </button>
            );
          })}
          <label className="relative">
            <span className="sr-only">Municipio de origen</span>
            <select value={filters.mun} onChange={(event) => update({ mun: event.target.value })}
              className={`${CHIP} ${filters.mun ? CHIP_ACTIVE : CHIP_IDLE} appearance-none pl-3.5 pr-8 font-sans`}>
              <option value="">Todos los municipios</option>
              {MUNICIPALITIES.map(({ id, name }) => (
                <option key={id} value={id}>{name} ({facets?.origins?.[id] || 0})</option>
              ))}
            </select>
            <svg className={`pointer-events-none absolute right-3 top-1/2 size-3 -translate-y-1/2 ${filters.mun ? 'text-white' : 'text-ink'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </label>
          <button type="button" aria-pressed={filters.disp} className={`${CHIP_PILL} ${filters.disp ? CHIP_ACTIVE : CHIP_IDLE}`} onClick={() => update({ disp: !filters.disp })}>
            Disponible para contratar
          </button>
          {hasFilters && (
            <button type="button" onClick={clearFilters}
              className="cursor-pointer border-0 bg-transparent py-1 px-1.5 text-[13px] font-bold text-ink underline decoration-[rgba(23,63,54,.35)] underline-offset-4 hover:decoration-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
              Quitar filtros
            </button>
          )}
        </div>

        <div className={`${WRAP} mt-8`}>
          <p className="mt-0 mb-4 min-h-[20px] text-[14px] font-semibold text-[#53645c]" aria-live="polite">{countText}</p>
          {results}
          <ArticulationBanner />
          <TechnicalServices />
        </div>
      </div>
    </section>
  );
}
