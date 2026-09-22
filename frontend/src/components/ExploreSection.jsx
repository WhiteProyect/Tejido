import { useEffect } from 'react';
import PublicationCard from './PublicationCard.jsx';
import { EYEBROW, H1, SECTION, STATUS, STATUS_ERROR } from './uiStyles.js';
import { getMunicipalityFromLocation, stampMunicipality } from '../utils/passportUtils.js';

const kinds = [
  ['TODOS', 'Todo'],
  ['HISTORIA', 'Historias'],
  ['EVENTO', 'Eventos'],
  ['OPORTUNIDAD', 'Oportunidades'],
  ['TALENTO', 'Talento'],
  ['INICIATIVA', 'Iniciativas'],
];

export default function ExploreSection({ publications, activeKind, onKindChange, search, onSearchChange, loading, error }) {
  const filtered = publications.filter((publication) => {
    const matchesKind = activeKind === 'TODOS' || publication.kind === activeKind;
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || [publication.title, publication.summary, publication.location]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(term));
    return matchesKind && matchesSearch;
  });

  /**
   * Al mostrar publicaciones, sella automáticamente los municipios
   * que tienen contenido visible. Esto construye el pasaporte del usuario.
   */
  useEffect(() => {
    filtered.forEach((pub) => {
      if (pub.location) {
        const muni = getMunicipalityFromLocation(pub.location);
        stampMunicipality(muni);
      }
    });
  }, [filtered]);

  return (
    <section className={SECTION} id="explorar">
      <div className="flex [align-items:end] gap-[50px] justify-between mb-[45px] max800:items-start max800:flex-col max800:gap-6">
        <div><p className={EYEBROW}>Voces del territorio</p><h2 className={H1}>Descubre lo que se está tejiendo</h2></div>
        <p className="leading-[1.6] max-w-[340px]">Contenido local para encontrarnos, aprender y celebrar lo nuestro.</p>
      </div>
      <div className="flex items-center gap-5 justify-between mb-[30px] max800:items-start max800:flex-col max800:gap-6">
        <div className="flex flex-wrap gap-2" aria-label="Filtrar publicaciones">
          {kinds.map(([value, label]) => (
            <button key={value} className={`border rounded-[99px] cursor-pointer py-[9px] px-3.5 ${activeKind === value ? 'bg-[#173b32] border-[#173b32] text-[#f7f0e5]' : 'bg-transparent border-[#b8b2a5] text-[#173b32]'}`} type="button" onClick={() => onKindChange(value)}>{label}</button>
          ))}
        </div>
        <label className="flex items-center border-b border-b-[#173b32] gap-2 py-2 px-0 max800:w-full"><span aria-hidden="true">⌕</span><input className="bg-transparent border-0 outline-0 w-[210px] max800:w-full" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Buscar en Caucasia..." /></label>
      </div>
      {loading && <p className={STATUS}>Cargando publicaciones...</p>}
      {error && <p className={STATUS_ERROR}>{error}. Verifica que el backend Python esté activo en el puerto 8765.</p>}
      {!loading && !error && <div className="grid gap-[22px] grid-cols-[repeat(3,1fr)] max800:grid-cols-[1fr]">{filtered.map((publication) => <PublicationCard key={publication.id} publication={publication} />)}</div>}
      {!loading && !error && filtered.length === 0 && <p className={STATUS}>No encontramos coincidencias.</p>}
    </section>
  );
}
