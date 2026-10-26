import { useEffect, useMemo, useState } from 'react';
import EmptyNote from '../components/EmptyNote.jsx';
import Icon from '../components/Icon.jsx';
import PublicationCard from '../components/PublicationCard.jsx';
import ParticipateBlock from '../components/branch/ParticipateBlock.jsx';
import ScreenIntro from '../components/ScreenIntro.jsx';
import { SCREEN_SECTION, STATUS, STATUS_ERROR } from '../components/uiStyles.js';
import { CULTURAL_CATEGORIES } from '../utils/constants.js';
import { getInitials } from '../utils/initials.js';
import { getMunicipalityFromLocation, stampMunicipality } from '../utils/passportUtils.js';
import { cdnImage } from '../utils/cloudinaryUrl.js';

// Una categoria cultural (#categoria/<slug>): arriba sus gestores (GET /api/gestores?branch=),
// abajo sus publicaciones, filtradas de las que App ya cargo (cultural_category) y por el
// buscador de la pantalla (titulo).
const SUBTITLE = 'm-0 text-[11px] font-extrabold uppercase tracking-[.18em] text-[#6a7c75]';

// Cada gestor enlaza a su perfil (#gestor/<slug>); sin slug (perfil oculto) queda sin enlace.
// El lider de la rama llega primero desde la API y lleva una insignia.
function GestorAvatar({ gestor }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = gestor.photo_url && !photoFailed;
  const content = (
    <>
      <span className="grid size-[76px] place-items-center overflow-hidden rounded-full border-2 border-[#e2d9ca] bg-cream text-[22px] font-extrabold tracking-[.02em] text-ink" aria-hidden="true">
        {showPhoto
          ? <img src={cdnImage(gestor.photo_url, { width: 152, fit: 'fill' })} alt="" className="size-full object-cover" loading="lazy" decoding="async" onError={() => setPhotoFailed(true)} />
          : getInitials(gestor.name)}
      </span>
      <span className="text-[14px] font-bold leading-[1.25] text-ink">{gestor.name}</span>
      {gestor.is_leader && <span className="rounded-full bg-[rgba(212,168,67,0.2)] py-0.5 px-2 text-[11px] font-bold text-[#6b500f]">Líder</span>}
    </>
  );
  return (
    <li className="w-[112px] text-center">
      {gestor.slug ? (
        <a href={`#gestor/${gestor.slug}`} aria-label={`Ver el perfil de ${gestor.name}${gestor.is_leader ? ', líder de la rama' : ''}`}
          className="flex flex-col items-center gap-2.5 rounded-[16px] p-1 no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
          {content}
        </a>
      ) : <div className="flex flex-col items-center gap-2.5 p-1">{content}</div>}
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
  const [, label = categoryKey, slug] = CULTURAL_CATEGORIES.find(([key]) => key === categoryKey) || [];
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

      {/* "Quiero participar": se oculta a gestores y admins (ParticipateBlock). */}
      {!gestores.loading && (!user || user.role === 'CIUDADANO') && (
        <section className="mx-auto mb-14 max-w-[760px] rounded-[24px] border border-[#e2d9ca] bg-[#fffaf2] p-8 max600:p-6" aria-label={`Participar en ${label}`}>
          <ParticipateBlock
            user={user}
            branch={categoryKey}
            hasLeader={gestores.gestores.some((gestor) => gestor.is_leader)}
            returnTo={`categoria/${slug}`}
            title={`¿Haces cultura en ${label.toLocaleLowerCase('es')}?`}
            text="Si eres artista, colectivo o gestor de esta rama, pide unirte: con la aprobación de su líder podrás publicar en TEJIDO."
          />
        </section>
      )}

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
