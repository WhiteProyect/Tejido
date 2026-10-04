import { useEffect, useMemo, useState } from 'react';
import EmptyNote from '../components/EmptyNote.jsx';
import Icon from '../components/Icon.jsx';
import PublicationCard from '../components/PublicationCard.jsx';
import ScreenIntro from '../components/ScreenIntro.jsx';
import { SCREEN_SECTION, STATUS, STATUS_ERROR } from '../components/uiStyles.js';
import { CULTURAL_CATEGORIES } from '../utils/constants.js';
import { getInitials } from '../utils/initials.js';
import { getMunicipalityFromLocation, stampMunicipality } from '../utils/passportUtils.js';

// Una categoria cultural (#categoria/<slug>): arriba sus gestores (GET /api/gestores?branch=),
// abajo sus publicaciones, filtradas de las que App ya cargo (cultural_category) y por el
// buscador de la pantalla (titulo).
const SUBTITLE = 'm-0 text-[11px] font-extrabold uppercase tracking-[.18em] text-[#6a7c75]';

function GestorAvatar({ gestor }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = gestor.photo_url && !photoFailed;
  return (
    <li className="flex w-[112px] flex-col items-center gap-2.5 text-center">
      <span className="grid size-[76px] place-items-center overflow-hidden rounded-full border-2 border-[#e2d9ca] bg-cream text-[22px] font-extrabold tracking-[.02em] text-ink" aria-hidden="true">
        {showPhoto
          ? <img src={gestor.photo_url} alt="" className="size-full object-cover" onError={() => setPhotoFailed(true)} />
          : getInitials(gestor.name)}
      </span>
      <span className="text-[14px] font-bold leading-[1.25] text-ink">{gestor.name}</span>
    </li>
  );
}

function useGestores(categoryKey) {
  const [state, setState] = useState({ loading: true, error: '', gestores: [] });
  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, error: '', gestores: [] });
    fetch(`/api/gestores?branch=${encodeURIComponent(categoryKey)}`)
      .then((response) => {
        if (!response.ok) throw new Error('No pudimos cargar los gestores de esta categoría.');
        return response.json();
      })
      .then((gestores) => { if (!cancelled) setState({ loading: false, error: '', gestores }); })
      .catch((loadError) => { if (!cancelled) setState({ loading: false, error: loadError.message, gestores: [] }); });
    return () => { cancelled = true; };
  }, [categoryKey]);
  return state;
}

export default function CategoryScreen({ categoryKey, publications = [], loading = false, error = '', user }) {
  const label = CULTURAL_CATEGORIES.find(([key]) => key === categoryKey)?.[1] || categoryKey;
  const gestores = useGestores(categoryKey);
  const [search, setSearch] = useState('');
  const term = search.trim().toLocaleLowerCase('es');
  const categoryItems = useMemo(
    () => publications.filter((publication) => publication.cultural_category === categoryKey),
    [publications, categoryKey],
  );
  const items = useMemo(
    () => (term ? categoryItems.filter((publication) => publication.title.toLocaleLowerCase('es').includes(term)) : categoryItems),
    [categoryItems, term],
  );

  // Al mostrar publicaciones, sella los municipios que tienen contenido visible: asi se
  // construye el pasaporte del usuario (antes lo hacia Explorar con su lista).
  useEffect(() => {
    items.forEach((pub) => {
      if (pub.location) stampMunicipality(getMunicipalityFromLocation(pub.location));
    });
  }, [items]);

  return (
    <section className={SCREEN_SECTION}>
      <a className="mb-8 inline-flex items-center gap-2 text-[14px] font-semibold text-ink no-underline hover:underline" href="#explorar">
        <Icon name="arrow-left" className="size-4" /> Todas las categorías
      </a>
      <ScreenIntro eyebrow="Categoría cultural" title={label} description={`Gestores y publicaciones de ${label.toLocaleLowerCase('es')} en Caucasia y el Bajo Cauca.`} />

      <section className="mb-14" aria-labelledby="categoria-gestores">
        <h2 id="categoria-gestores" className={`${SUBTITLE} mb-5 text-center`}>Quiénes la mueven</h2>
        {gestores.loading && <p className={`${STATUS} text-center`} aria-busy="true">Cargando gestores...</p>}
        {gestores.error && <p className={`${STATUS_ERROR} text-center`} role="alert">{gestores.error}</p>}
        {!gestores.loading && !gestores.error && (gestores.gestores.length ? (
          <ul className="m-0 flex list-none flex-wrap justify-center gap-6 p-0">
            {gestores.gestores.map((gestor) => <GestorAvatar key={gestor.id} gestor={gestor} />)}
          </ul>
        ) : (
          <div className="mx-auto max-w-[560px]">
            <EmptyNote icon="people" title="Aún no hay gestores en esta categoría" text="Cuando un gestor de esta rama se sume a TEJIDO, aparecerá aquí." />
          </div>
        ))}
      </section>

      <section aria-labelledby="categoria-publicaciones">
        <div className="mb-5 flex items-end justify-between gap-6 max800:flex-col max800:items-stretch">
          <h2 id="categoria-publicaciones" className={SUBTITLE}>Publicaciones</h2>
          {/* Solo con algo que buscar. Mismo estilo que tenia el buscador de Explorar. */}
          {!loading && !error && categoryItems.length > 0 && (
            <label className="flex items-center gap-2 border-b border-b-[#173b32] py-2 px-0 max800:w-full">
              <span aria-hidden="true">⌕</span>
              <input
                className="w-[230px] border-0 bg-transparent outline-0 max800:w-full"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar en esta categoría..."
                aria-label={`Buscar publicaciones de ${label} por título`}
              />
            </label>
          )}
        </div>
        {loading && <p className={STATUS} aria-busy="true">Cargando publicaciones...</p>}
        {!loading && error && <p className={STATUS_ERROR} role="alert">{error}. Verifica que el backend Python esté activo en el puerto 8765.</p>}
        {!loading && !error && (items.length ? (
          // Misma reticula que las tarjetas de publicaciones: 2 columnas desde 1201 px.
          <div className="grid grid-cols-2 gap-5 max1200:grid-cols-1">
            {items.map((publication) => <PublicationCard key={publication.id} publication={publication} user={user} />)}
          </div>
        ) : categoryItems.length ? (
          // Hay publicaciones, pero la busqueda no encontro ninguna: no es una categoria vacia.
          <EmptyNote icon="search" title="Sin coincidencias" text="Prueba con otro término de búsqueda." />
        ) : (
          <EmptyNote icon="book" title="Aún no hay publicaciones en esta categoría" text="Explora las demás categorías mientras se teje la primera historia de esta." />
        ))}
      </section>
    </section>
  );
}
