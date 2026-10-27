import Icon from '../Icon.jsx';
import { formatCOP } from '../../utils/talent.js';

// "Qué ofrece": filas con check, el servicio y su precio a la derecha (A convenir si no tiene),
// separadas por lineas finas.
export function ServicesList({ services }) {
  return (
    <ul className="m-0 grid list-none p-0">
      {services.map((service, index) => (
        <li key={index} className="flex items-start gap-2.5 border-b border-b-[#e3d6bf] py-2.5 first:pt-0 last:border-b-0">
          <Icon name="check" className="mt-0.5 size-4 shrink-0 text-orange" />
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[15px] leading-[1.35] text-ink [overflow-wrap:anywhere]">{service.title}</p>
            {service.description && <p className="mt-0.5 mb-0 text-[13px] leading-[1.45] text-[#53645c]">{service.description}</p>}
          </div>
          <div className="shrink-0 text-right">
            <p className="m-0 text-[15px] font-semibold text-ink">{service.price === null || service.price === undefined ? 'A convenir' : formatCOP(service.price)}</p>
            {service.price_note && <p className="mt-0.5 mb-0 max-w-[120px] text-[12px] leading-[1.35] text-[#53645c]">{service.price_note}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

// "Ficha técnica": "Etiqueta: valor" por fila, separadas por lineas finas.
export function SpecsList({ specs }) {
  return (
    <dl className="m-0 grid">
      {specs.map((spec, index) => (
        <div key={index} className="border-b border-b-[#e3d6bf] py-2.5 text-[14px] leading-[1.45] first:pt-0 last:border-b-0">
          <dt className="inline font-bold text-ink">{spec.label}:</dt>{' '}
          <dd className="m-0 inline text-ink [overflow-wrap:anywhere]">{spec.value}</dd>
        </div>
      ))}
    </dl>
  );
}
