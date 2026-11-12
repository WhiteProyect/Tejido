import { useCallback, useEffect, useRef, useState } from 'react';
import AuthDialog from '../components/opportunities/AuthDialog.jsx';
import OpportunityCard from '../components/opportunities/OpportunityCard.jsx';
import { AnimatedBlock, BlockBar, FilterBar, HiloCard, PageHero, SkeletonCards } from '../components/territory/TerritoryParts.jsx';
import { TS } from '../components/territory/territoryStyles.js';
import { UNVERIFIED_TEXT, notifyUnverified } from '../components/VerifyEmailNotice.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { apiRequest } from '../utils/api.js';
import { slugOptions, useCulturalBranches } from '../utils/culturalBranches.js';
import { MUNICIPALITY_LIST } from '../utils/municipalities.js';
import {
  EMPTY_OPPORTUNITY_FILTERS, opportunitiesUrl, opportunityHash, parseOpportunityFilters, sameOpportunityFilters,
} from '../utils/opportunities.js';

// Oportunidades (#oportunidades): convocatorias, talleres, audiciones, concursos y cursos de los seis
// municipios (GET /api/opportunities; los tipos, de GET /api/opportunity-types). Bloques: 1 · Abiertas
// (de la que cierra antes a la que cierra despues), 2 · Sin fecha de cierre y 3 · Cerradas (al final,
// de a 12 con "Cargar mas"). "Cierran pronto": solo las que cierran en 7 dias o menos. Filtros en el
// hash (#oportunidades?mun=&tipo=&cat=&pronto=1), como en la Agenda. Guardar: solo sin sesion (abre
// el aviso) o CIUDADANO (POST/DELETE .../favorite; lo ya guardado sale de GET /api/me/saved).
const MUNICIPALITY_OPTIONS = MUNICIPALITY_LIST.map(({ slug, name }) => [slug, name]);

export default function OpportunitiesScreen({ user }) {
  const { showToast } = useToast();
  const [filters, setFilters] = useState(() => parseOpportunityFilters());
  const [types, setTypes] = useState([]);
  const [state, setState] = useState({ data: null, loading: true, loadingMore: false, error: '', moreError: '' });
  const [saved, setSaved] = useState(() => new Set());
  const [busyId, setBusyId] = useState(null);
  const [dialog, setDialog] = useState(false);
  const opener = useRef(null);
  const request = useRef(0);
  const isCitizen = user?.role === 'CIUDADANO';

  useEffect(() => { document.title = 'Oportunidades del Bajo Cauca · TEJIDO'; }, []);

  // Al llegar la lista de ramas se releen los filtros (una rama nueva en ?cat= ya es valida).
  const { list: branches, ready: branchesReady } = useCulturalBranches();
  useEffect(() => {
    if (!branchesReady || !window.location.hash.startsWith('#oportunidades')) return;
    const next = parseOpportunityFilters();
    setFilters((current) => (sameOpportunityFilters(current, next) ? current : next));
  }, [branchesReady]);
  useEffect(() => { apiRequest('/api/opportunity-types').then(setTypes).catch(() => setTypes([])); }, []);
  useEffect(() => {
    if (!isCitizen) { setSaved(new Set()); return; }
    apiRequest('/api/me/saved').then((data) => setSaved(new Set((data.publications || []).map((p) => p.id)))).catch(() => {});
  }, [isCitizen, user?.id]);

  useEffect(() => {
    function handleHash() {
      if (!window.location.hash.startsWith('#oportunidades')) return;
      const next = parseOpportunityFilters();
      setFilters((current) => (sameOpportunityFilters(current, next) ? current : next));
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
      if (sameOpportunityFilters(current, next)) return current;
      const hash = opportunityHash(next);
      if (window.location.hash !== hash) window.history.replaceState(window.history.state, '', hash);
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    const id = ++request.current;
    setState((current) => ({ ...current, loading: true, error: '', moreError: '' }));
    try {
      const data = await apiRequest(opportunitiesUrl(filters));
      if (id === request.current) setState({ data, loading: false, loadingMore: false, error: '', moreError: '' });
    } catch (error) {
      if (id !== request.current) return;
      if (error.code === 'INVALID_TYPE' && filters.tipo) { update({ tipo: '' }); return; }
      setState({ data: null, loading: false, loadingMore: false, error: error.message || 'No pudimos cargar las oportunidades.', moreError: '' });
    }
  }, [filters, update]);

  useEffect(() => { load(); }, [load]);

  async function loadMore() {
    const id = request.current;
    setState((current) => ({ ...current, loadingMore: true, moreError: '' }));
    try {
      const more = await apiRequest(opportunitiesUrl(filters, state.data.closed_next_offset));
      if (id !== request.current) return;
      setState((current) => ({
        ...current,
        loadingMore: false,
        data: { ...current.data, closed: [...current.data.closed, ...more.closed], closed_next_offset: more.closed_next_offset },
      }));
    } catch (error) {
      if (id === request.current) setState((current) => ({ ...current, loadingMore: false, moreError: error.message || 'No pudimos cargar más.' }));
    }
  }

  async function toggleSave(item, event) {
    if (!user) {
      opener.current = event.currentTarget;
      setDialog(true);
      return;
    }
    const next = !saved.has(item.id);
    setBusyId(item.id);
    try {
      await apiRequest(`/api/publications/${item.id}/favorite`, { method: next ? 'POST' : 'DELETE' });
      setSaved((current) => { const copy = new Set(current); if (next) copy.add(item.id); else copy.delete(item.id); return copy; });
      showToast(next
        ? { tone: 'menta', eyebrow: 'Oportunidad guardada', title: 'Está en tus guardadas', text: item.end_date ? 'Te avisaremos antes del cierre.' : 'Encuéntrala en Guardadas.' }
        : { tone: 'menta', title: 'Quitada de tus guardadas' });
    } catch (error) {
      if (error.code === 'EMAIL_NOT_VERIFIED') {
        notifyUnverified();
        showToast({ tone: 'dorado', title: UNVERIFIED_TEXT, text: 'Usa el enlace que te enviamos o pide otro en el aviso de arriba.' });
      } else {
        showToast({ tone: 'naranja', title: 'No pudimos guardarla', text: error.message || 'Intenta de nuevo.' });
      }
    } finally {
      setBusyId(null);
    }
  }

  function closeDialog() {
    setDialog(false);
    requestAnimationFrame(() => opener.current?.focus());
  }

  const clearFilters = () => update(EMPTY_OPPORTUNITY_FILTERS);
  const hasFilters = Boolean(filters.mun || filters.tipo || filters.cat || filters.pronto);
  const data = state.data;
  const total = data ? data.counts.open + data.counts.open_ended + data.counts.closed : 0;
  const countText = state.loading || state.error ? '' : `${total} ${total === 1 ? 'oportunidad' : 'oportunidades'}${hasFilters ? ' con estos filtros' : ''}`;
  const card = (item) => (
    <OpportunityCard item={item} user={user} saved={saved.has(item.id)} busy={busyId === item.id} onToggleSave={toggleSave} />
  );

  let content;
  if (state.loading) {
    content = <><p className="sr-only" role="status">Cargando oportunidades...</p><SkeletonCards pills={3} buttons /></>;
  } else if (state.error) {
    content = (
      <div className={TS.error} role="alert">
        <p className={TS.errorTitle}>Se nos enredó un hilo al cargar las oportunidades</p>
        <p className="mt-1 mb-5 text-[15px] text-[#3f514a]">{state.error}</p>
        <button type="button" className={TS.btnSolid} onClick={load}>Volver a cargar oportunidades</button>
      </div>
    );
  } else if (total === 0) {
    content = hasFilters ? (
      <HiloCard empty title="Aún no hay oportunidades con estos filtros" text="Prueba con otro tipo, otro municipio u otra categoría."
        action={<button type="button" className={TS.btnSolid} onClick={clearFilters}>Explorar todos los tipos y municipios</button>} />
    ) : (
      <HiloCard empty title="Pronto encontrarás nuevas oportunidades" text="Estamos reuniendo convocatorias, talleres y audiciones del Bajo Cauca."
        action={<a className={TS.btnSolid} href="#agenda">Mientras tanto, mira la agenda</a>} />
    );
  } else {
    const shown = data.open.length + data.open_ended.length + data.closed.length;
    const allClosed = !filters.pronto && data.open.length === 0 && data.open_ended.length === 0 && data.closed.length > 0;
    const invite = shown === 1 ? (
      <HiloCard title="¿Buscas más oportunidades?" text="Amplía los filtros o explora todos los tipos y municipios."
        action={hasFilters ? <button type="button" className={TS.btnCream} onClick={clearFilters}>Ampliar filtros</button>
          : <a className={TS.btnCream} href="#agenda">Ver la agenda</a>} />
    ) : null;
    const grid = (items) => (
      <ul className={TS.grid}>
        {items.map((item) => <li key={item.id} className={TS.cell}>{card(item)}</li>)}
        {items.length === 1 && invite && <li className={TS.cell}>{invite}</li>}
      </ul>
    );
    const emptyLine = (text) => <p className="mt-4 mb-0 text-[15px] text-[#3f514a]">{text}{hasFilters ? ' con estos filtros' : ''}.</p>;
    content = (
      <>
        {allClosed && <p className={TS.notice} role="note">Las convocatorias actuales ya cerraron, pero puedes consultar el historial abajo.</p>}
        {!allClosed && (
          <AnimatedBlock labelledBy="oport-abiertas">
            <BlockBar id="oport-abiertas" variant="ink">{filters.pronto ? '1 · Cierran pronto (7 días o menos)' : '1 · Abiertas — de la que cierra antes a la que cierra después'}</BlockBar>
            {data.open.length ? grid(data.open) : emptyLine(filters.pronto ? 'Nada cierra en los próximos 7 días' : 'No hay oportunidades con fecha de cierre')}
          </AnimatedBlock>
        )}
        {!filters.pronto && !allClosed && (
          <AnimatedBlock labelledBy="oport-sin-fecha">
            <BlockBar id="oport-sin-fecha" variant="ink">2 · Sin fecha de cierre — convocatorias abiertas</BlockBar>
            {data.open_ended.length ? grid(data.open_ended) : emptyLine('No hay convocatorias abiertas sin fecha')}
          </AnimatedBlock>
        )}
        {!filters.pronto && (
          <AnimatedBlock labelledBy="oport-cerradas">
            <BlockBar id="oport-cerradas" variant="cream">{allClosed ? 'Historial de convocatorias cerradas' : '3 · Cerradas — de la más reciente a la más antigua'}</BlockBar>
            {data.closed.length ? grid(data.closed) : emptyLine('No hay oportunidades cerradas')}
            {data.closed_next_offset != null && (
              <div className="mt-8 text-center">
                <button type="button" className={TS.btnOutline} onClick={loadMore} disabled={state.loadingMore} aria-busy={state.loadingMore}>
                  {state.loadingMore ? 'Cargando...' : 'Cargar más'}
                </button>
              </div>
            )}
            {state.moreError && <p className="mt-4 mb-0 text-center text-[15px] text-[#b3442b]" role="alert">{state.moreError}</p>}
          </AnimatedBlock>
        )}
      </>
    );
  }

  return (
    <div className={TS.page}>
      <PageHero kicker="Oportunidades culturales · Bajo Cauca" title="Impulsa tu talento y" italic="participa en la región"
        text="Convocatorias, talleres, audiciones, concursos y cursos abiertos para creadores de nuestros seis municipios." />
      <FilterBar label="Filtros de oportunidades" onChange={update} onClear={clearFilters}
        selects={[
          { key: 'mun', label: 'Municipio', value: filters.mun, options: MUNICIPALITY_OPTIONS, placeholder: 'Todos los municipios' },
          { key: 'tipo', label: 'Tipo', value: filters.tipo, options: types.map(({ slug, label }) => [slug, label]), placeholder: 'Todos los tipos' },
          { key: 'cat', label: 'Categoría', value: filters.cat, options: slugOptions(branches), placeholder: 'Todas las categorías' },
        ]}
        toggles={[{ key: 'pronto', label: 'Cierran pronto', checked: filters.pronto }]} />
      <p className={TS.count} aria-live="polite">{countText}</p>
      {content}
      {dialog && <AuthDialog returnTo={opportunityHash(filters).replace('#', '')} onClose={closeDialog} />}
    </div>
  );
}
