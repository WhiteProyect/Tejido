import { useCallback, useEffect, useMemo, useState } from 'react';
import CategoryCoversGrid from './CategoryCoversGrid.jsx';
import EmptyNote from './EmptyNote.jsx';
import Icon from './Icon.jsx';
import PublicationCard from './PublicationCard.jsx';
import { BTN_INK_MD, BTN_QUIET_SM, EYEBROW, H1, SECTION, STATUS, STATUS_ERROR } from './uiStyles.js';
import { CULTURAL_CATEGORIES, KIND_LABELS } from '../utils/constants.js';
import { MUNICIPALITY_LIST } from '../utils/municipalities.js';
import { countInterests, onInterestsChange, relatedToInterests } from '../utils/interests.js';
import { exploreHash, parseExploreFilters, searchPublications } from '../utils/search.js';

// Explorar: buscador y filtros sobre las publicaciones que App ya cargó, más las portadas de las
// categorías culturales y un bloque "Para ti" con señales locales (guardados y "me interesa").
// Los filtros viajan en el hash (#explorar?q=&kind=&mun=&cat=), como en Agenda y Talento.
const EMPTY_FILTERS = { q: '', kind: '', municipality: '', category: '' };
const SELECT = 'rounded-full border border-[#d9cfbe] bg-white py-2.5 px-4 font-sans text-[14px] font-semibold text-ink outline-none focus:border-ink';
const FIELD_LABEL = 'grid gap-1.5 text-[11px] font-extrabold uppercase tracking-[.14em] text-[#6a7c75]';
const KIND_OPTIONS = Object.entries(KIND_LABELS);
const CATEGORY_OPTIONS = CULTURAL_CATEGORIES.map(([key, label]) => [key, label]);
const MUNICIPALITY_OPTIONS = MUNICIPALITY_LIST.map(({ slug, name }) => [slug, name]);

function sameFilters(a, b) {
  return a.q === b.q && a.kind === b.kind && a.municipality === b.municipality && a.category === b.category;
}

function Results({ items, user }) {
  return (
    <ul className="m-0 grid list-none grid-cols-[repeat(2,minmax(0,1fr))] items-start gap-5 p-0 max1200:grid-cols-[minmax(0,1fr)]">
      {items.map((publication) => (
        <li key={publication.id} className="flex min-w-0">
          <PublicationCard publication={publication} user={user} returnTo="explorar" />
        </li>
      ))}
    </ul>
  );
}

export default function ExploreSection({ publications = [], loading = false, error = '', user }) {
  const [filters, setFilters] = useState(() => parseExploreFilters());
  const [related, setRelated] = useState(() => relatedToInterests(publications));
  const [signals, setSignals] = useState(() => countInterests());

  // Un hashchange de afuera (atrás, un enlace compartido, el buscador del header) relee los filtros.
  useEffect(() => {
    function handleHash() {
      if (!window.location.hash.startsWith('#explorar')) return;
      const next = parseExploreFilters();
      setFilters((current) => (sameFilters(current, next) ? current : next));
    }
    window.addEventListener('hashchange', handleHash);
    window.addEventListener('popstate', handleHash);
    return () => {
      window.removeEventListener('hashchange', handleHash);
      window.removeEventListener('popstate', handleHash);
    };
  }, []);

  // "Para ti" se refresca al guardar o reaccionar en cualquier tarjeta.
  useEffect(() => {
    const refresh = () => {
      setRelated(relatedToInterests(publications));
      setSignals(countInterests());
    };
    refresh();
    return onInterestsChange(refresh);
  }, [publications]);

  const update = useCallback((patch) => {
    setFilters((current) => {
      const next = { ...current, ...patch };
      if (sameFilters(current, next)) return current;
      const hash = exploreHash(next);
      if (window.location.hash !== hash) window.history.replaceState(window.history.state, '', hash);
      return next;
    });
  }, []);

  const hasCriteria = Boolean(filters.q.trim() || filters.kind || filters.municipality || filters.category);
  const items = useMemo(
    () => searchPublications(publications, filters.q, {
      kind: filters.kind,
      municipality: filters.municipality,
      category: filters.category,
    }),
    [publications, filters],
  );

  const clear = () => update(EMPTY_FILTERS);

  return (
    <section className={SECTION} id="explorar">
      <div className="mb-[34px] flex items-end justify-between gap-[50px] max800:flex-col max800:items-start max800:gap-6">
        <div><p className={EYEBROW}>Voces desde capital</p><h2 className={H1}>Descubre el tejido de la cultura</h2></div>
        <p className="max-w-[340px] leading-[1.6]">Contenido local para encontrarnos, aprender y celebrar lo nuestro.</p>
      </div>

      {/* Buscador y filtros */}
      <div className="mb-6 rounded-[22px] border border-[#e2d9ca] bg-[#fffaf2] p-4">
        <div className="flex items-center gap-2 rounded-full border border-[#d9cfbe] bg-white py-1.5 pr-2 pl-4 focus-within:border-ink">
          <Icon name="search" className="size-[18px] shrink-0 text-muted" strokeWidth={1.8} />
          <label className="sr-only" htmlFor="explorar-buscador">Buscar en todo TEJIDO</label>
          <input
            id="explorar-buscador"
            type="search"
            value={filters.q}
            onChange={(event) => update({ q: event.target.value })}
            placeholder="Busca un evento, un lugar, una historia…"
            autoComplete="off"
            className="min-w-0 flex-1 border-0 bg-transparent py-2 font-sans text-[16px] text-ink outline-none"
          />
          {hasCriteria && (
            <button type="button" onClick={clear} className={BTN_QUIET_SM} aria-label="Limpiar búsqueda y filtros">
              <Icon name="close" className="size-3.5" strokeWidth={2} /> Limpiar
            </button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className={FIELD_LABEL}>
            Municipio
            <select className={SELECT} value={filters.municipality} onChange={(event) => update({ municipality: event.target.value })}>
              <option value="">Todos</option>
              {MUNICIPALITY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className={FIELD_LABEL}>
            Tipo
            <select className={SELECT} value={filters.kind} onChange={(event) => update({ kind: event.target.value })}>
              <option value="">Todos</option>
              {KIND_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className={FIELD_LABEL}>
            Categoría
            <select className={SELECT} value={filters.category} onChange={(event) => update({ category: event.target.value })}>
              <option value="">Todas</option>
              {CATEGORY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>
      </div>

      {loading && <p className={STATUS} aria-busy="true">Cargando contenidos…</p>}
      {!loading && error && <p className={STATUS_ERROR} role="alert">{error}</p>}

      {!loading && !error && (hasCriteria ? (
        <section aria-labelledby="explorar-resultados">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 id="explorar-resultados" className="m-0 font-sans text-[22px] font-extrabold tracking-[-.03em] text-ink">
              {items.length} {items.length === 1 ? 'resultado' : 'resultados'}
            </h3>
            <p className="m-0 text-[13px] font-semibold text-muted" aria-live="polite">
              {filters.q.trim() ? `Para “${filters.q.trim()}”` : 'Con estos filtros'}
            </p>
          </div>
          {items.length ? (
            <Results items={items} user={user} />
          ) : (
            <EmptyNote
              icon="search"
              title="Sin coincidencias"
              text="Prueba con otra palabra o quita algún filtro."
              action={<button type="button" className={BTN_INK_MD} onClick={clear}>Limpiar búsqueda</button>}
            />
          )}
        </section>
      ) : (
        <>
          {related.length > 0 && (
            <section className="mb-14" aria-labelledby="explorar-para-ti">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className={EYEBROW}>Para ti</p>
                  <h3 id="explorar-para-ti" className="m-0 font-sans text-[26px] font-extrabold tracking-[-.03em] text-ink">Sigue el hilo de lo que te interesa</h3>
                </div>
                <p className="m-0 text-[13px] font-semibold text-muted">
                  {signals} {signals === 1 ? 'señal tuya' : 'señales tuyas'} · guardados y reacciones
                </p>
              </div>
              <Results items={related} user={user} />
            </section>
          )}
          <CategoryCoversGrid />
        </>
      ))}
    </section>
  );
}
