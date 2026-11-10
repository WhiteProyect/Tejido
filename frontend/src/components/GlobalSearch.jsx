import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { KIND_LABELS } from '../utils/constants.js';
import { exploreHash, searchPublications } from '../utils/search.js';

// Buscador global del header. No hay endpoint de búsqueda: puntúa las publicaciones que App ya
// cargó (utils/search.js, el mismo criterio del Chat Turístico de Hilo) y muestra las primeras
// coincidencias. Cada resultado abre su página (#publicacion/<id>); "Ver todo" lleva a Explorar
// con el texto y los filtros en el hash.
const RESULT_LIMIT = 6;

export default function GlobalSearch({ publications = [], loading = false, dark = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const buttonRef = useRef(null);

  const results = open ? searchPublications(publications, query).slice(0, RESULT_LIMIT) : [];
  const total = open && query.trim() ? searchPublications(publications, query).length : 0;

  useEffect(() => {
    if (!open) return undefined;
    inputRef.current?.focus();
    function onPointer(event) {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    }
    function onKey(event) {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    function onHash() { setOpen(false); }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    window.addEventListener('hashchange', onHash);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('hashchange', onHash);
    };
  }, [open]);

  useEffect(() => { setActive(0); }, [query]);

  function close(restoreFocus = false) {
    setOpen(false);
    setQuery('');
    if (restoreFocus) buttonRef.current?.focus();
  }

  function submit(event) {
    event.preventDefault();
    if (!query.trim()) return;
    window.location.hash = exploreHash({ q: query });
    close();
  }

  const panelTone = dark
    ? 'bg-[#121514] border-[#333b38] text-[#f7f7f5]'
    : 'bg-white border-line text-ink';
  const inputTone = dark
    ? 'bg-[#0a0a0a] border-[#333b38] text-[#f7f7f5] placeholder:text-[#9aa39f] focus:border-gold'
    : 'bg-[#fffdf8] border-[#d9cfbe] text-ink placeholder:text-muted focus:border-ink';
  const resultTone = dark
    ? 'hover:bg-[#1d2422] focus-visible:outline-gold'
    : 'hover:bg-cream focus-visible:outline-ink';
  const metaTone = dark ? 'text-[#b9c2be]' : 'text-muted';

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        className={`group relative inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 ${dark ? 'text-[#f7f7f5] hover:bg-[rgba(247,247,245,0.1)] focus-visible:outline-[#f7f7f5]' : 'text-ink hover:bg-cream focus-visible:outline-ink'}`}
        aria-label="Buscar en TEJIDO"
        aria-expanded={open}
        aria-controls="buscador-global"
        onClick={() => (open ? close(true) : setOpen(true))}
      >
        <Icon name={open ? 'close' : 'search'} className="size-[22px]" strokeWidth={1.8} />
      </button>

      {open && (
        <div
          id="buscador-global"
          className={`absolute top-full right-0 z-30 mt-2 w-[min(520px,calc(100vw-32px))] overflow-hidden rounded-[20px] border [box-shadow:0_18px_50px_rgba(23,58,49,.22)] ${panelTone}`}
          role="search"
          aria-label="Buscar en TEJIDO"
        >
          <form onSubmit={submit} className="flex items-center gap-2 border-b border-b-[rgba(23,58,49,.12)] px-3.5 py-2.5">
            <Icon name="search" className={`size-4 shrink-0 ${metaTone}`} strokeWidth={2} />
            <label className="sr-only" htmlFor="buscador-global-input">Buscar publicaciones, lugares, eventos y oportunidades</label>
            <input
              ref={inputRef}
              id="buscador-global-input"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' && results.length) {
                  event.preventDefault();
                  setActive((current) => (current + 1) % results.length);
                } else if (event.key === 'ArrowUp' && results.length) {
                  event.preventDefault();
                  setActive((current) => (current - 1 + results.length) % results.length);
                } else if (event.key === 'Enter' && results[active]) {
                  event.preventDefault();
                  window.location.hash = `publicacion/${results[active].id}`;
                  close();
                }
              }}
              className={`min-w-0 flex-1 rounded-full border bg-transparent py-2 px-3 font-sans text-[15px] outline-none ${inputTone}`}
              placeholder="Buscar en TEJIDO…"
              autoComplete="off"
            />
          </form>

          <div className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
            {loading && <p className={`m-0 px-3 py-4 text-[13px] ${metaTone}`} aria-busy="true">Cargando contenidos…</p>}
            {!loading && query.trim() && !results.length && (
              <p className={`m-0 px-3 py-4 text-[13px] ${metaTone}`}>No encontramos coincidencias. Prueba con otro nombre, lugar o categoría.</p>
            )}
            {!loading && !query.trim() && (
              <p className={`m-0 px-3 py-4 text-[13px] ${metaTone}`}>Escribe un lugar, un evento, una categoría o un talento.</p>
            )}
            {results.length > 0 && (
              <ul className="m-0 grid list-none gap-0.5 p-0">
                {results.map((publication, index) => (
                  <li key={publication.id}>
                    <a
                      href={`#publicacion/${publication.id}`}
                      onClick={() => close()}
                      onMouseEnter={() => setActive(index)}
                      onFocus={() => setActive(index)}
                      className={`flex items-center gap-3 rounded-[12px] px-3 py-2.5 no-underline focus-visible:outline-2 focus-visible:outline-offset-0 ${resultTone} ${index === active ? (dark ? 'bg-[#1d2422]' : 'bg-cream') : ''}`}
                    >
                      <span className={`grid size-8 shrink-0 place-items-center rounded-full ${dark ? 'bg-[#1d2422]' : 'bg-[#f3e4c8]'}`} aria-hidden="true">
                        <Icon name="pin" className="size-4" strokeWidth={1.7} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-bold">{publication.title}</span>
                        <span className={`block truncate text-[12px] ${metaTone}`}>
                          {[KIND_LABELS[publication.kind], publication.location].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <Icon name="arrow-right" className={`size-4 shrink-0 ${metaTone}`} strokeWidth={2} />
                    </a>
                  </li>
                ))}
              </ul>
            )}
            {query.trim() && (
              <div className={`mt-1 flex flex-wrap items-center justify-between gap-2 border-t border-t-[rgba(23,58,49,.12)] px-2 pt-2`}>
                <a
                  href={exploreHash({ q: query })}
                  onClick={() => close()}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-bold no-underline focus-visible:outline-2 focus-visible:outline-offset-2 ${dark ? 'text-gold focus-visible:outline-gold' : 'text-river focus-visible:outline-ink'}`}
                >
                  Ver {total || 'todo'} en Explorar <Icon name="arrow-right" className="size-3.5" strokeWidth={2} />
                </a>
                <a
                  href={`#talento?q=${encodeURIComponent(query.trim())}`}
                  onClick={() => close()}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-bold no-underline focus-visible:outline-2 focus-visible:outline-offset-2 ${dark ? 'text-[#b9c2be] focus-visible:outline-gold' : 'text-muted focus-visible:outline-ink'}`}
                >
                  Buscar en Talento
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
