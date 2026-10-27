// "Respaldo", segun el diseño: los reconocimientos como un certificado (marco doble y un sello de
// tinta en la esquina) y los testimonios en tarjetas tostadas con estrellas, texto y autor. Los
// carga el equipo o el lider de la rama: no son reseñas publicas.
function Stars({ rating }) {
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`${rating} de 5`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <svg key={value} className={`size-[17px] ${value <= rating ? 'text-[#b8862f]' : 'text-[#d9cfbe]'}`} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" />
        </svg>
      ))}
    </span>
  );
}

// Sello de tinta (trazo, sin relleno) de la esquina del certificado. Decorativo.
function Stamp() {
  return (
    <svg viewBox="0 0 48 48" className="absolute right-3 top-3 size-11 text-[#b8862f]" fill="none" stroke="currentColor" aria-hidden="true">
      <circle cx="24" cy="24" r="21" strokeWidth="1.4" />
      <circle cx="24" cy="24" r="16.5" strokeWidth="1" strokeDasharray="2 2" />
      <path d="m17 24.5 4.5 4.5 9-9.5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Endorsements({ endorsements }) {
  return (
    <ul className="m-0 grid list-none grid-cols-[repeat(3,minmax(0,1fr))] items-start gap-4 p-0 max1024:grid-cols-[repeat(2,minmax(0,1fr))] max600:grid-cols-[minmax(0,1fr)]">
      {endorsements.map((item, index) => (
        <li key={index} className="min-w-0">
          {item.kind === 'RECOGNITION' ? (
            <div className="relative rounded-[6px] border border-[#cdbd9e] bg-[#fffdf7] p-5 pr-16 [box-shadow:inset_0_0_0_4px_#fffdf7,inset_0_0_0_5px_#e3d3b0,0_6px_16px_rgba(12,36,30,.06)]">
              <Stamp />
              <p className="m-0 text-[11px] font-bold uppercase tracking-[.12em] text-[#7a5c12]">Reconocimiento</p>
              <p className="mt-1 mb-0 text-[20px] font-extrabold leading-[1.2] tracking-[-.01em] text-ink">{item.title}</p>
              {item.text && <p className="mt-2 mb-0 text-[13px] leading-[1.55] text-[#3f514a]">{item.text}</p>}
            </div>
          ) : (
            <figure className="m-0 rounded-[10px] bg-[#f2e7d3] p-5">
              {item.rating ? <Stars rating={item.rating} /> : <p className="m-0 text-[11px] font-bold uppercase tracking-[.12em] text-[#7a5c12]">Testimonio</p>}
              {item.text && <blockquote className="mx-0 mt-2.5 mb-0 text-[15px] leading-[1.5] text-ink">“{item.text}”</blockquote>}
              <figcaption className="mt-3 text-[13px] font-bold text-[#3f514a]">— {item.title}</figcaption>
            </figure>
          )}
        </li>
      ))}
    </ul>
  );
}
