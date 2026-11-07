import { useState } from 'react';
import Icon from '../Icon.jsx';
import PlaceIcon, { PlaceFallback } from '../PlaceIcon.jsx';
import { DayNotice, Pill } from '../territory/TerritoryParts.jsx';
import { TS } from '../territory/territoryStyles.js';
import { PILL_COLORS, TERRITORY, placeColors } from '../uiStyles.js';
import { cdnImage } from '../../utils/cloudinaryUrl.js';
import { dateLine } from '../../utils/agenda.js';
import { eventNotice } from '../../utils/dateUtils.js';
import { directionsUrl, whatsappHref } from '../../utils/mapConfig.js';

const TYPE_LABELS = { EVENTO: 'Evento', LUGAR: 'Lugar' };

// Mini tarjeta de un punto del Mapa vivo. EVENTO: foto, tipo, municipio, fecha (o texto de tradicion) con
// su aviso de dias y lugar. LUGAR: foto (o el icono de su categoria sobre crema), tipo, categoria de lugar
// con su icono y color, municipio y direccion. Botones "Ver" y "Como llegar" y, en un lugar con WhatsApp,
// "WhatsApp". En escritorio va dentro del popup anclado al marcador; en movil, en un panel inferior. Esc
// y el boton Cerrar la cierran (lo maneja MapScreen). Si la foto no carga, el mismo respaldo que sin foto.
export default function MapCard({ point, titleId, onClose, sheet = false }) {
  const [broken, setBroken] = useState(false);
  const isPlace = point.type === 'LUGAR';
  const when = isPlace ? '' : point.tradition_text && !point.start_date ? point.tradition_text : dateLine(point.start_date, point.end_date);
  const notice = isPlace ? null : eventNotice(point.start_date, point.end_date);
  const corner = sheet ? 'rounded-t-[20px]' : 'rounded-t-[16px]';
  const category = point.place_category;
  return (
    <article className={`text-[#173f36] ${sheet ? '' : 'w-[300px]'}`} aria-labelledby={titleId} data-tarjeta-mapa={point.key}>
      <div className="relative">
        {point.image && !broken ? (
          <img src={cdnImage(point.image, { width: 640 })} alt="" className={`block h-[140px] w-full object-cover ${corner}`} onError={() => setBroken(true)} />
        ) : isPlace ? (
          <PlaceFallback category={category} className={`h-[110px] ${corner}`} iconClass="size-10" />
        ) : <div className={`flex h-[90px] items-center justify-center bg-[#f3e4c8] ${corner}`}><Icon name="calendar" className="size-9 text-[#4d5a55]" /></div>}
        <button type="button" onClick={onClose} aria-label="Cerrar tarjeta"
          className={`absolute top-2 right-2 inline-flex size-11 cursor-pointer items-center justify-center rounded-full border-2 border-[#173f36] bg-[#fff9ec] text-[#173f36] ${TS.focus}`}>
          <Icon name="close" className="size-5" />
        </button>
      </div>
      <div className="grid gap-2.5 p-4">
        <div className="flex flex-wrap gap-1.5">
          <Pill colors={PILL_COLORS.category} data-tipo-punto>{TYPE_LABELS[point.type] || point.type}</Pill>
          {isPlace && category && (
            <Pill colors={placeColors(category.color)} data-categoria-lugar={category.slug}>
              <PlaceIcon icon={category.icon} className="size-4" /> {category.label}
            </Pill>
          )}
          {point.municipality_label && <Pill colors={PILL_COLORS.municipality}>{point.municipality_label}</Pill>}
          {notice && <DayNotice notice={notice} band={TERRITORY.paper} />}
        </div>
        <h2 id={titleId} className="m-0 font-sans text-[19px] font-extrabold leading-[1.2] [overflow-wrap:anywhere]">{point.title}</h2>
        {when && <p className="m-0 rounded-[10px] border-l-4 border-[#d4a843] bg-[#f3e4c8] px-3 py-2 text-[15px] font-bold leading-[1.35]" data-fecha>{when}</p>}
        {point.location && (
          <p className="m-0 text-[15px] font-semibold leading-[1.4] text-[#3f514a] [overflow-wrap:anywhere]" data-direccion-tarjeta>
            {isPlace ? 'Dirección' : 'Lugar'}: {point.location}
          </p>
        )}
        <div className="mt-1 grid grid-cols-2 gap-2">
          <a href={point.href} className={`${TS.btnSolid} !px-4`}>Ver</a>
          <a href={directionsUrl(point.lat, point.lng)} target="_blank" rel="noopener noreferrer" className={`${TS.btnOutline} !px-3 whitespace-nowrap`}>
            Cómo llegar<span className="sr-only"> (abre las direcciones en una pestaña nueva)</span>
          </a>
          {isPlace && point.whatsapp && (
            <a href={whatsappHref(point.whatsapp)} target="_blank" rel="noopener noreferrer" data-whatsapp
              className={`${TS.btnOutline} col-span-2 !px-3`} style={{ backgroundColor: TERRITORY.mint }}>
              WhatsApp<span className="sr-only"> (abre WhatsApp en una pestaña nueva)</span>
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
