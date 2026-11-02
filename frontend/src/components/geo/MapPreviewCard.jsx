// Vista previa de un municipio al pasar el cursor (o llegar con el teclado) por su nudo del mapa del
// inicio. Solo informativa: no recibe el puntero ni la lee el lector de pantalla (el enlace del nudo ya
// dice el nombre y la leyenda). `count`: publicaciones con publication.municipality de este municipio.
const TAG = 'rounded-full bg-[#f3e4c8] py-[3px] px-2 text-[11px] font-semibold text-ink';

export default function MapPreviewCard({ municipality, count, cardRef, style }) {
  return (
    <div
      ref={cardRef}
      aria-hidden="true"
      className="pointer-events-none absolute z-20 w-[260px] overflow-hidden rounded-[18px] bg-white shadow-[0_16px_48px_rgba(18,60,52,0.14),0_0_0_1px_rgba(18,60,52,0.06)] motion-safe:animate-[geoCardIn_0.2s_ease-out]"
      style={style}
    >
      <img src={municipality.image} alt="" className="block h-[110px] w-full bg-cream object-cover" loading="lazy" decoding="async" />
      <div className="pt-4 px-[18px] pb-[18px]">
        <p className="m-0 text-[11px] font-bold uppercase tracking-[.12em] text-[#1a7e8f]">Municipio · {municipality.tagline}</p>
        <p className="mt-1 mb-0 text-[18px] font-extrabold leading-tight text-ink">{municipality.name}</p>
        <p className="mt-0.5 mb-2 text-[13px] font-semibold text-[#7a5c12]">{municipality.title}</p>
        <p className="m-0 mb-2.5 line-clamp-3 text-[12px] leading-[1.45] text-muted">{municipality.description}</p>
        <div className="flex flex-wrap gap-1.5">
          {municipality.tags.map((tag) => <span key={tag} className={TAG}>{tag}</span>)}
        </div>
        <p className="mt-3 mb-0 text-[12px] font-bold text-ink">
          {count === 1 ? '1 publicación' : `${count} publicaciones`}
        </p>
      </div>
    </div>
  );
}
