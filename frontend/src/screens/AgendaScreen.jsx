import { useCallback, useEffect, useRef, useState } from 'react';
import AgendaCard from '../components/agenda/AgendaCard.jsx';
import { AnimatedBlock, BlockBar, FilterBar, HiloCard, PageHero, SkeletonCards } from '../components/territory/TerritoryParts.jsx';
import { TS } from '../components/territory/territoryStyles.js';
import { apiRequest } from '../utils/api.js';
import { EMPTY_AGENDA_FILTERS, agendaHash, agendaUrl, groupByMonth, parseAgendaFilters, sameAgendaFilters } from '../utils/agenda.js';
import { slugOptions, useCulturalBranches } from '../utils/culturalBranches.js';
import { MUNICIPALITY_LIST } from '../utils/municipalities.js';

// Agenda (#agenda): solo eventos (GET /api/agenda), de los seis municipios. Bloques con barras a todo
// el ancho: 1 · Proximos (una barra por mes), 2 · Tradiciones y 3 · Pasaron hace poco (15 dias) o, con
// "Ver anteriores", el archivo (de a 24, "Cargar mas"). Los filtros viajan en el hash
// (#agenda?mun=&cat=&anteriores=1): replaceState para los propios y un hashchange de afuera los relee.
// Aqui nunca hay convocatorias ni botones de postulacion.
const MUNICIPALITY_OPTIONS = MUNICIPALITY_LIST.map(({ slug, name }) => [slug, name]);

function Cards({ events, variant, invite }) {
  return (
    <ul className={TS.grid}>
      {events.map((event) => <li key={event.id} className={TS.cell}><AgendaCard event={event} variant={variant} /></li>)}
      {invite && <li className={TS.cell}>{invite}</li>}
    </ul>
  );
}

function focusHeading(id) {
  const heading = document.getElementById(id);
  heading?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  heading?.focus({ preventScroll: true });
}

export default function AgendaScreen() {
  const [filters, setFilters] = useState(() => parseAgendaFilters());
  const [state, setState] = useState({ data: null, loading: true, loadingMore: false, error: '', moreError: '' });
  const request = useRef(0);

  useEffect(() => { document.title = 'Agenda del Bajo Cauca · TEJIDO'; }, []);

  // Al llegar la lista de ramas se releen los filtros (una rama nueva en ?cat= ya es valida).
  const { list: branches, ready: branchesReady } = useCulturalBranches();
  useEffect(() => {
    if (!branchesReady || !window.location.hash.startsWith('#agenda')) return;
    const next = parseAgendaFilters();
    setFilters((current) => (sameAgendaFilters(current, next) ? current : next));
  }, [branchesReady]);

  useEffect(() => {
    function handleHash() {
      if (!window.location.hash.startsWith('#agenda')) return;
      const next = parseAgendaFilters();
      setFilters((current) => (sameAgendaFilters(current, next) ? current : next));
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
      if (sameAgendaFilters(current, next)) return current;
      const hash = agendaHash(next);
      if (window.location.hash !== hash) window.history.replaceState(window.history.state, '', hash);
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    const id = ++request.current;
    setState((current) => ({ ...current, loading: true, error: '', moreError: '' }));
    try {
      const data = await apiRequest(agendaUrl(filters));
      if (id === request.current) setState({ data, loading: false, loadingMore: false, error: '', moreError: '' });
    } catch (error) {
      if (id === request.current) setState({ data: null, loading: false, loadingMore: false, error: error.message || 'No pudimos cargar la agenda.', moreError: '' });
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  async function loadMore() {
    const id = request.current;
    setState((current) => ({ ...current, loadingMore: true, moreError: '' }));
    try {
      const more = await apiRequest(agendaUrl(filters, state.data.archive_next_offset));
      if (id !== request.current) return;
      setState((current) => ({
        ...current,
        loadingMore: false,
        data: { ...current.data, archive: [...current.data.archive, ...more.archive], archive_next_offset: more.archive_next_offset },
      }));
    } catch (error) {
      if (id === request.current) setState((current) => ({ ...current, loadingMore: false, moreError: error.message || 'No pudimos cargar más eventos.' }));
    }
  }

  const clearFilters = () => update(EMPTY_AGENDA_FILTERS);
  const hasPlaceFilters = Boolean(filters.mun || filters.cat);
  const data = state.data;
  const shownCount = data ? data.counts.upcoming + data.counts.traditions + (filters.past ? data.counts.archive : data.counts.recent_past) : 0;
  const countText = state.loading || state.error ? '' : `${shownCount} ${shownCount === 1 ? 'evento' : 'eventos'}${hasPlaceFilters ? ' con estos filtros' : ''}`;
  const widen = hasPlaceFilters
    ? <button type="button" className={TS.btnSolid} onClick={clearFilters}>Ampliar filtros o ver los 6 municipios</button>
    : <a className={TS.btnSolid} href="#municipios">Ampliar filtros o ver los 6 municipios</a>;

  let content;
  if (state.loading) {
    content = <><p className="sr-only" role="status">Cargando la agenda...</p><SkeletonCards /></>;
  } else if (state.error) {
    content = (
      <div className={TS.error} role="alert">
        <p className={TS.errorTitle}>Se nos enredó un hilo al cargar la agenda</p>
        <p className="mt-1 mb-5 text-[15px] text-[#3f514a]">{state.error}</p>
        <button type="button" className={TS.btnSolid} onClick={load}>Reintentar</button>
      </div>
    );
  } else {
    const upcoming = data.upcoming || [];
    const traditions = data.traditions || [];
    const pastItems = (filters.past ? data.archive : data.recent_past) || [];
    const total = upcoming.length + traditions.length + pastItems.length;
    if (total === 0) {
      content = (
        <HiloCard empty title="Pronto encontrarás nuevos eventos"
          text={hasPlaceFilters ? 'No hay eventos con estos filtros por ahora.' : 'Estamos tejiendo la agenda cultural del Bajo Cauca.'} action={widen} />
      );
    } else {
      // Con un solo evento en toda la pantalla, la celda vecina invita a ampliar la busqueda.
      const invite = total === 1 ? (
        <HiloCard title="¿Buscas más planes?" text="Amplía los filtros o mira los eventos de los seis municipios."
          action={hasPlaceFilters ? <button type="button" className={TS.btnCream} onClick={clearFilters}>Ampliar filtros</button>
            : !filters.past ? <button type="button" className={TS.btnCream} onClick={() => update({ past: true })}>Ver eventos anteriores</button>
              : <a className={TS.btnCream} href="#municipios">Ver los 6 municipios</a>} />
      ) : null;
      const months = groupByMonth(upcoming);
      content = (
        <>
          <AnimatedBlock labelledBy="agenda-proximos">
            <BlockBar id="agenda-proximos" variant="ink">1 · Próximos eventos{months[0] ? ` — ${months[0].label}` : ''}</BlockBar>
            {months.length ? months.map((group, index) => (
              <div key={group.key}>
                {index > 0 && <BlockBar as="h3" variant="ink" className={TS.monthBar}>{group.label}</BlockBar>}
                <Cards events={group.events} variant="upcoming" invite={index === 0 && upcoming.length === 1 ? invite : null} />
              </div>
            )) : (
              <ul className={TS.grid}>
                <li className={`${TS.cell} col-span-full`}>
                  <HiloCard title="No hay eventos próximos por ahora"
                    text={traditions.length ? 'Mientras tanto, mira las celebraciones que vuelven cada año.' : 'Mira lo que pasó hace poco o los eventos anteriores.'}
                    action={traditions.length
                      ? <button type="button" className={TS.btnCream} onClick={() => focusHeading('agenda-tradiciones')}>Mirar las tradiciones</button>
                      : !filters.past && <button type="button" className={TS.btnCream} onClick={() => update({ past: true })}>Ver eventos anteriores</button>} />
                </li>
              </ul>
            )}
          </AnimatedBlock>
          <AnimatedBlock labelledBy="agenda-tradiciones">
            <BlockBar id="agenda-tradiciones" variant="purple">2 · Tradiciones — celebraciones que vuelven cada año</BlockBar>
            {traditions.length ? <Cards events={traditions} variant="tradition" invite={traditions.length === 1 && !upcoming.length ? invite : null} />
              : <p className="mt-4 mb-0 text-[15px] text-[#3f514a]">Aún no hay tradiciones{hasPlaceFilters ? ' con estos filtros' : ' registradas'}.</p>}
          </AnimatedBlock>
          <AnimatedBlock labelledBy="agenda-pasados">
            <BlockBar id="agenda-pasados" variant="cream">{filters.past ? '3 · Eventos anteriores' : '3 · Pasaron hace poco (últimos 15 días)'}</BlockBar>
            {pastItems.length ? <Cards events={pastItems} variant="past" invite={pastItems.length === 1 && !upcoming.length && !traditions.length ? invite : null} />
              : <p className="mt-4 mb-0 text-[15px] text-[#3f514a]">{filters.past ? 'No hay eventos anteriores' : 'Nada pasó en los últimos 15 días'}{hasPlaceFilters ? ' con estos filtros' : ''}.</p>}
            {filters.past && data.archive_next_offset != null && (
              <div className="mt-8 text-center">
                <button type="button" className={TS.btnOutline} onClick={loadMore} disabled={state.loadingMore} aria-busy={state.loadingMore}>
                  {state.loadingMore ? 'Cargando...' : 'Cargar más'}
                </button>
              </div>
            )}
            {state.moreError && <p className="mt-4 mb-0 text-center text-[15px] text-[#b3442b]" role="alert">{state.moreError}</p>}
          </AnimatedBlock>
        </>
      );
    }
  }

  return (
    <div className={TS.page}>
      <PageHero kicker="Agenda territorial · Bajo Cauca" title="¿Qué hay para hacer en" italic="nuestro territorio?"
        text="Encuentros culturales, música junto al río y celebraciones de los 6 municipios para vivir con la comunidad." />
      <FilterBar label="Filtros de la agenda" onChange={update} onClear={clearFilters}
        selects={[
          { key: 'mun', label: 'Municipio', value: filters.mun, options: MUNICIPALITY_OPTIONS, placeholder: 'Todos los municipios' },
          { key: 'cat', label: 'Categoría', value: filters.cat, options: slugOptions(branches), placeholder: 'Todas las categorías' },
        ]}
        toggles={[{ key: 'past', label: 'Ver anteriores', checked: filters.past }]} />
      <p className={TS.count} aria-live="polite">{countText}</p>
      {content}
    </div>
  );
}
