import { useId } from 'react';
import Icon from '../Icon.jsx';
import { DayNotice, Pill } from '../territory/TerritoryParts.jsx';
import { TS } from '../territory/territoryStyles.js';
import { BANDS, PILL_COLORS, TERRITORY } from '../uiStyles.js';
import { cdnImage, cdnSrcSet } from '../../utils/cloudinaryUrl.js';
import { dateLine, dateText, eventTime } from '../../utils/agenda.js';
import { eventNotice } from '../../utils/dateUtils.js';
import { MUNICIPALITY_BY_SLUG } from '../../utils/municipalities.js';

const fold = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function placeText(location, municipality) {
  if (location && municipality && !fold(location).includes(fold(municipality))) return `${location} · ${municipality}`;
  return location || municipality || '';
}

// Colores de cada variante (de uiStyles.js): banda, borde de la caja de fecha, textos.
const VARIANTS = {
  upcoming: { band: BANDS.upcoming, rule: TERRITORY.gold, title: TERRITORY.ink, text: TERRITORY.mutedText, place: TERRITORY.ochre, dateBg: TERRITORY.cream },
  tradition: { band: BANDS.tradition, rule: TERRITORY.purple, title: TERRITORY.ink, text: TERRITORY.mutedText, place: TERRITORY.ochre, dateBg: TERRITORY.cream },
  past: { band: BANDS.muted, rule: TERRITORY.muted, title: TERRITORY.mutedText, text: TERRITORY.mutedSoft, place: TERRITORY.mutedText, dateBg: TERRITORY.paper },
};

// Tarjeta de un evento de la Agenda. variant: 'upcoming' | 'tradition' | 'past'. Toda la tarjeta es un
// solo enlace a #publicacion/<id>: su nombre es el titulo y la descripcion, la fecha y el estado.
// Foto arriba; banda de color con las pildoras (municipio, categoria y aviso o etiqueta); titulo,
// resumen, caja de fecha y "Lugar: ... →". "Ya pasó" va atenuada con colores explicitos (sin opacity).
export default function AgendaCard({ event, variant }) {
  const id = useId().replace(/:/g, '');
  const past = variant === 'past';
  const tradition = variant === 'tradition';
  const v = VARIANTS[variant];
  const municipality = MUNICIPALITY_BY_SLUG[event.municipality];
  const notice = variant === 'upcoming' ? eventNotice(event.start_date, event.end_date) : null;
  const place = placeText(event.location, event.municipality_label);
  const when = tradition ? (event.tradition_text || 'Fecha por confirmar') : dateLine(event.start_date, event.end_date);
  const status = past ? 'Ya pasó' : tradition ? 'Tradición' : '';
  const time = tradition ? '' : eventTime(event.start_date);

  return (
    <a href={`#publicacion/${event.id}`} className={`${TS.card} ${TS.cardHover} ${TS.focus}`} style={{ backgroundColor: past ? TERRITORY.cream : TERRITORY.white }}
      aria-labelledby={`${id}-titulo`} aria-describedby={`${id}-datos`} data-agenda-card={variant}>
      {event.image ? (
        <div className={TS.media}>
          <img src={cdnImage(event.image, { width: 720 })} srcSet={cdnSrcSet(event.image, [480, 720, 1080])}
            sizes="(max-width: 767px) 92vw, 46vw" alt="" loading="lazy" decoding="async" className={TS.image} />
        </div>
      ) : null}
      <div className={TS.band} style={{ backgroundColor: v.band }} data-banda={variant}>
        {municipality && (
          <Pill colors={past ? PILL_COLORS.municipalityMuted : PILL_COLORS.municipality} band={v.band} data-municipio>{municipality.name}</Pill>
        )}
        {event.category_label && <Pill colors={PILL_COLORS.category} band={v.band}>{event.category_label}</Pill>}
        {tradition && <Pill colors={PILL_COLORS.tradition} band={v.band} icon="thread" data-estado="tradicion">Tradición</Pill>}
        {past && <Pill colors={PILL_COLORS.past} band={v.band} icon="check" data-estado="paso">Ya pasó</Pill>}
        {!past && <DayNotice notice={notice} band={v.band} />}
      </div>
      <div className={TS.body}>
        <h3 id={`${id}-titulo`} className={TS.title} style={{ color: v.title }}>{event.title}</h3>
        {event.summary && <p className={TS.summary} style={{ color: v.text }}>{event.summary}</p>}
        <p className={TS.dateBox} style={{ borderLeftColor: v.rule, backgroundColor: v.dateBg, color: v.title }} aria-hidden="true" data-fecha>
          {tradition && <Icon name="thread" className="mr-1.5 inline size-4 align-[-2px]" />}{when}
        </p>
        {place && (
          <p className={TS.place} style={{ color: v.place }} aria-hidden="true">Lugar: {place} <span aria-hidden="true">→</span></p>
        )}
        <p id={`${id}-datos`} className="sr-only">
          {[status, tradition ? when : dateText(event.start_date, event.end_date), time && `a las ${time}`, notice?.text, place && `Lugar: ${place}`].filter(Boolean).join(', ')}
        </p>
      </div>
    </a>
  );
}
