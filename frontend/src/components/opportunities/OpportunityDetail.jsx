import { DayNotice, Pill } from '../territory/TerritoryParts.jsx';
import { PILL_COLORS, TERRITORY, typeColors } from '../uiStyles.js';
import { MUNICIPALITY_BY_SLUG } from '../../utils/municipalities.js';
import { closingNotice, isClosed } from '../../utils/opportunities.js';

// Piezas del detalle de una OPORTUNIDAD (PublicationScreen): pildoras de la cabecera, ficha resumen y
// requisitos numerados. Colores de uiStyles.js.

export function OpportunityPills({ pub }) {
  const municipality = MUNICIPALITY_BY_SLUG[pub.municipality];
  const closed = isClosed(pub.end_date);
  const notice = closed ? null : closingNotice(pub.end_date);
  return (
    <div className="flex flex-wrap items-center gap-2" data-pildoras-detalle>
      {municipality && <Pill colors={PILL_COLORS.municipality} band={TERRITORY.paper} data-municipio>{municipality.name}</Pill>}
      {pub.opportunity_type && <Pill colors={typeColors(pub.opportunity_type.color)} band={TERRITORY.paper} data-tipo={pub.opportunity_type.color}>{pub.opportunity_type.label}</Pill>}
      {closed ? <Pill colors={PILL_COLORS.closed} band={TERRITORY.paper} icon="close" data-estado="cerrada">Cerrada</Pill> : <DayNotice notice={notice} band={TERRITORY.paper} />}
    </div>
  );
}

export function OpportunitySummary({ pub, deadline, formatDateTime }) {
  const rows = [
    ['Quién convoca', pub.organizer],
    ['A quién va dirigida', pub.audience],
    ['Premio o monto', pub.prize],
    ['Fecha límite', deadline ? formatDateTime(deadline) : 'Convocatoria abierta, sin fecha de cierre'],
  ].filter(([, value]) => value);
  return (
    <section className="rounded-[24px] border-l-4 border-[#d4a843] bg-[#f3e4c8] p-6" aria-labelledby="oportunidad-ficha" data-ficha>
      <h2 id="oportunidad-ficha" className="m-0 text-[13px] font-extrabold uppercase tracking-[.14em] text-[#a44727]">Ficha de la convocatoria</h2>
      <dl className="mt-4 mb-0 grid gap-4">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[14px] font-bold text-[#173f36]">{label}</dt>
            <dd className="m-0 mt-0.5 text-[16px] leading-[1.45] text-[#3f514a] [overflow-wrap:anywhere]">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function OpportunityRequirements({ items }) {
  if (!items?.length) return null;
  return (
    <section className="mt-10" aria-labelledby="oportunidad-requisitos">
      <h2 id="oportunidad-requisitos" className="m-0 font-sans text-[24px] font-extrabold tracking-[-0.02em] text-[#173f36]">Requisitos de participación</h2>
      <ol className="mt-4 mb-0 grid list-none gap-3 p-0 [counter-reset:req]" data-requisitos>
        {items.map((item) => (
          <li key={item} className="flex gap-3 rounded-[14px] border border-[#ddd5c7] bg-white px-4 py-3 text-[16px] leading-[1.5] text-[#173f36] [counter-increment:req] before:flex before:size-7 before:shrink-0 before:items-center before:justify-center before:rounded-full before:bg-[#173f36] before:text-[14px] before:font-bold before:text-[#fff9ec] before:content-[counter(req)] [overflow-wrap:anywhere]">
            {item}
          </li>
        ))}
      </ol>
    </section>
  );
}
