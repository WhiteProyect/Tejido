import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import ArtistCard from '../components/artists/ArtistCard.jsx';
import Icon from '../components/Icon.jsx';
import { FilterBar, HiloCard, PageHero, SkeletonCards } from '../components/territory/TerritoryParts.jsx';
import { TS } from '../components/territory/territoryStyles.js';
import { fetchPublicArtists } from '../services/artistApi.js';
import {
  EMPTY_ARTIST_FILTERS, artistsHash, filterArtists, genreOptions, parseArtistFilters, sameArtistFilters,
} from '../utils/artists.js';
import { MUNICIPALITY_LIST } from '../utils/municipalities.js';

// Artistas de TEJIDO (#artistas[?mun=&genero=&q=]): solo los del sello TEJIDO (GET /api/artists?sello=tejido,
// activos y publicados, destacados primero). Se cargan todos de una vez (son pocos) y se filtran en el
// cliente por municipio, genero (los que existen) y nombre; los filtros viven en el hash (replaceState,
// como Agenda). Al final, un enlace discreto al sello Moneystack. Estetica de Agenda, sin degradados.
const MUNICIPALITY_OPTIONS = MUNICIPALITY_LIST.map(({ slug, name }) => [slug, name]);
const GRID = 'm-0 mt-5 grid list-none grid-cols-3 gap-6 p-0 max-[1023px]:grid-cols-2 max-[1023px]:gap-4 max-[539px]:grid-cols-1';

export default function ArtistsScreen() {
  const [filters, setFilters] = useState(() => parseArtistFilters());
  const [state, setState] = useState({ loading: true, error: '', artists: [] });
  const searchId = useId();

  useEffect(() => { document.title = 'Artistas del Bajo Cauca · TEJIDO'; }, []);

  useEffect(() => {
    function handleHash() {
      if (!window.location.hash.startsWith('#artistas')) return;
      const next = parseArtistFilters();
      setFilters((current) => (sameArtistFilters(current, next) ? current : next));
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
      if (sameArtistFilters(current, next)) return current;
      const hash = artistsHash(next);
      if (window.location.hash !== hash) window.history.replaceState(window.history.state, '', hash);
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const artists = await fetchPublicArtists({ sello: 'tejido' });
      setState({ loading: false, error: '', artists: Array.isArray(artists) ? artists : [] });
    } catch (error) {
      setState({ loading: false, error: error.message || 'No pudimos cargar los artistas.', artists: [] });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const genres = useMemo(() => genreOptions(state.artists), [state.artists]);
  const visible = useMemo(() => filterArtists(state.artists, filters), [state.artists, filters]);
  const hasFilters = Boolean(filters.mun || filters.genero || filters.q.trim());
  const clear = () => update(EMPTY_ARTIST_FILTERS);
  const countText = state.loading || state.error ? '' : `${visible.length} ${visible.length === 1 ? 'artista' : 'artistas'}${hasFilters ? ' con estos filtros' : ''}`;

  let content;
  if (state.loading) {
    content = <><p className="sr-only" role="status">Cargando los artistas...</p><SkeletonCards pills={1} /></>;
  } else if (state.error) {
    content = (
      <div className={TS.error} role="alert">
        <p className={TS.errorTitle}>Se nos enredó un hilo al cargar los artistas</p>
        <button type="button" className={`${TS.btnSolid} mt-4`} onClick={load}>Reintentar</button>
      </div>
    );
  } else if (!state.artists.length) {
    content = <HiloCard empty title="Pronto conocerás a los artistas de TEJIDO" text="Estamos tejiendo sus perfiles. Mientras tanto, mira la agenda cultural del territorio."
      action={<a className={TS.btnCream} href="#agenda">Ver la agenda</a>} />;
  } else if (!visible.length) {
    content = <HiloCard empty title="Ningún artista con estos filtros" text="Prueba con otro municipio, otro género u otro nombre."
      action={<button type="button" className={TS.btnCream} onClick={clear}>Quitar filtros</button>} />;
  } else {
    content = (
      <ul className={GRID} data-artistas>
        {visible.map((artist) => <li key={artist.slug} className={TS.cell}><ArtistCard artist={artist} /></li>)}
      </ul>
    );
  }

  return (
    <div className={TS.page}>
      <PageHero kicker="Artistas · Bajo Cauca" title="Las voces que" italic="nacen del río"
        text="Músicos, cantadoras, bailarines y creadores de los seis municipios que hacen parte de TEJIDO. Conócelos y sigue su camino." />
      <div className="mt-6 grid gap-1.5">
        <label htmlFor={searchId} className={TS.fieldLabel}>Buscar artista</label>
        <span className="relative block">
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-[#3f514a]" />
          <input id={searchId} type="search" value={filters.q} onChange={(event) => update({ q: event.target.value })} maxLength={80}
            placeholder="Escribe un nombre" className={`${TS.select} cursor-text pl-11`} data-buscar-artista />
        </span>
      </div>
      <FilterBar label="Filtros de artistas" onChange={update} onClear={clear}
        selects={[
          { key: 'mun', label: 'Municipio', value: filters.mun, options: MUNICIPALITY_OPTIONS, placeholder: 'Todos los municipios' },
          { key: 'genero', label: 'Género', value: filters.genero, options: genres, placeholder: 'Todos los géneros' },
        ]}
        toggles={[]} />
      <p className={TS.count} aria-live="polite" data-contador>{countText}</p>
      {content}
      <p className="mt-14 mb-0 border-t border-[#ddd5c7] pt-6 text-center">
        <a href="#moneystack" className={TS.clear} data-enlace-moneystack>Conoce el sello Moneystack</a>
      </p>
    </div>
  );
}
