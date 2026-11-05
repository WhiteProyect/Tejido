import { useId } from 'react';
import { DayNotice, Pill } from '../territory/TerritoryParts.jsx';
import { TS } from '../territory/territoryStyles.js';
import { BANDS, PILL_COLORS, TERRITORY, typeColors } from '../uiStyles.js';
import { cdnImage, cdnSrcSet } from '../../utils/cloudinaryUrl.js';
import { MUNICIPALITY_BY_SLUG } from '../../utils/municipalities.js';
import { closingLine, closingNotice } from '../../utils/opportunities.js';

function Fact({ label, children, color }) {
  return (
    <p className="m-0 text-[15px] leading-[1.45] [overflow-wrap:anywhere]" style={{ color }}>
      <strong style={{ color: TERRITORY.ink }}>{label}</strong> {children}
    </p>
  );
}

// Tarjeta de una oportunidad. Banda con el color del TIPO (municipio, tipo y aviso de dias); titulo;
// Convoca / Dirigida a / Premio o estimulo (o el resumen si no hay ninguno); caja de cierre; y los
// botones "Ver y postularme →" (enlace al detalle) y "♡ Guardar" (solo sin sesion o CIUDADANO; sin
// sesion abre el aviso). Cerrada: atenuada (colores explicitos), "Cerrada", "Cerró el ..." y la pildora
// deshabilitada "Convocatoria cerrada"; su titulo es el enlace al detalle.
export default function OpportunityCard({ item, user, saved = false, busy = false, onToggleSave }) {
  const id = useId().replace(/:/g, '');
  const closed = Boolean(item.closed);
  const municipality = MUNICIPALITY_BY_SLUG[item.municipality];
  const type = item.type ? typeColors(item.type.color) : null;
  const band = closed ? BANDS.muted : (type ? type.bg : TERRITORY.cream);
  const notice = closed ? null : closingNotice(item.end_date);
  const date = closingLine(item.end_date);
  const textColor = closed ? TERRITORY.mutedSoft : TERRITORY.mutedText;
  const facts = [['Convoca:', item.organizer], ['Dirigida a:', item.audience], ['Premio o estímulo:', item.prize]].filter(([, value]) => value);
  const canSave = !user || user.role === 'CIUDADANO';

  return (
    <article className={TS.card} style={{ backgroundColor: closed ? TERRITORY.cream : TERRITORY.white }} data-oportunidad={closed ? 'cerrada' : 'abierta'} aria-labelledby={`${id}-titulo`}>
      {item.image ? (
        <div className={TS.media}>
          <img src={cdnImage(item.image, { width: 720 })} srcSet={cdnSrcSet(item.image, [480, 720, 1080])}
            sizes="(max-width: 767px) 92vw, 46vw" alt="" loading="lazy" decoding="async" className={TS.image} />
        </div>
      ) : null}
      <div className={TS.band} style={{ backgroundColor: band }} data-banda={closed ? 'cerrada' : (item.type?.color || 'sin-tipo')}>
        {municipality && <Pill colors={closed ? PILL_COLORS.municipalityMuted : PILL_COLORS.municipality} band={band} data-municipio>{municipality.name}</Pill>}
        {item.type && <Pill colors={closed ? PILL_COLORS.typeMuted : type} band={band} data-tipo={item.type.color}>{item.type.label}</Pill>}
        {closed ? <Pill colors={PILL_COLORS.closed} band={band} icon="close" data-estado="cerrada">Cerrada</Pill> : <DayNotice notice={notice} band={band} />}
      </div>
      <div className={TS.body}>
        <h3 id={`${id}-titulo`} className={TS.title} style={{ color: closed ? TERRITORY.mutedText : TERRITORY.ink }}>
          {closed ? <a href={`#publicacion/${item.id}`} className={`text-inherit underline decoration-[#ddd5c7] decoration-2 underline-offset-4 ${TS.focus}`}>{item.title}</a> : item.title}
        </h3>
        {facts.length ? facts.map(([label, value]) => <Fact key={label} label={label} color={textColor}>{value}</Fact>)
          : item.summary && <p className={TS.summary} style={{ color: textColor }}>{item.summary}</p>}
        <p className={TS.dateBox} style={{ borderLeftColor: closed ? TERRITORY.muted : TERRITORY.gold, backgroundColor: closed ? TERRITORY.paper : TERRITORY.cream, color: TERRITORY.ink }} data-cierre>
          {!item.end_date ? 'Convocatoria abierta' : closed ? `Cerró el ${date}` : <>Fecha de cierre: {date}</>}
        </p>
        <div className="mt-auto flex flex-wrap gap-3 pt-1 max-[767px]:flex-col" data-acciones>
          {closed ? (
            <button type="button" aria-disabled="true" className={`${TS.btnDisabled} ${TS.focus} max-[767px]:w-full`} onClick={(event) => event.preventDefault()}>Convocatoria cerrada</button>
          ) : (
            <>
              <a href={`#publicacion/${item.id}`} className={`${TS.btnSolid} max-[767px]:w-full`} aria-describedby={`${id}-titulo`}>Ver y postularme <span aria-hidden="true">→</span></a>
              {canSave && (
                <button type="button" className={`${TS.btnOutline} max-[767px]:w-full`} style={saved ? { backgroundColor: TERRITORY.cream } : undefined} aria-pressed={user ? saved : undefined}
                  aria-describedby={`${id}-titulo`} disabled={busy} onClick={(event) => onToggleSave?.(item, event)}>
                  <span aria-hidden="true">{saved ? '♥' : '♡'}</span> {saved ? 'Guardada' : 'Guardar'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </article>
  );
}
