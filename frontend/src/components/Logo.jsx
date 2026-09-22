// `className` pone el color del texto (y su hover); `ringClassName`, el color de los tres aros.
// El contexto decide: header -> ink, header de Moneystack -> #f7f7f5, footer -> gris con hover dorado.
export default function Logo({ href = '#inicio', showLocation = true, className = 'text-ink', ringClassName = 'border-ink' }) {
  const ring = `border-[3px] border-solid ${ringClassName} rounded-[50%] h-[18px] absolute w-[18px]`;
  const content = (
    <>
      <span className="inline-block h-[38px] relative w-[38px]" aria-hidden="true">
        <i className={`${ring} left-[10px] top-px`} />
        <i className={`${ring} bottom-px left-px`} />
        <i className={`${ring} bottom-px right-px`} />
      </span>
      <span>TEJIDO{showLocation && <small className="block text-[8px] tracking-[.32em] -mt-[3px]">CAUCASIA</small>}</span>
    </>
  );
  const brand = `flex items-center text-[20px] font-extrabold gap-[11px] tracking-[.16em] ${className}`;

  if (!href) {
    return <span className={brand}>{content}</span>;
  }

  return <a className={brand} href={href} aria-label="TEJIDO inicio">{content}</a>;
}
