import { useState } from 'react';
import Icon from '../Icon.jsx';
import PlaceIcon, { PlaceFallback } from '../PlaceIcon.jsx';
import { Pill } from '../territory/TerritoryParts.jsx';
import { TS } from '../territory/territoryStyles.js';
import { PILL_BASE, PILL_COLORS, TERRITORY, placeColors } from '../uiStyles.js';
import { cdnImage } from '../../utils/cloudinaryUrl.js';
import { dateLine } from '../../utils/agenda.js';
import { directionsUrl, telHref, whatsappHref } from '../../utils/mapConfig.js';
import { isTraditionPoint, pointNotice } from '../../utils/mapFilters.js';

export const EVENT_CHIP = { bg: TERRITORY.ochre, text: TERRITORY.paper };
const NOTICE = { backgroundColor: TERRITORY.yellow, color: TERRITORY.ink, borderColor: TERRITORY.yellow };
const LINK = `inline-flex min-h-11 items-center gap-1.5 font-sans text-[15px] font-semibold text-[#173f36] underline underline-offset-4 ${TS.focus}`;
export const BTN_VER = `inline-flex min-h-11 flex-[1_1_auto] cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-full border-2 border-[#173f36] bg-[#173f36] px-3.5 font-sans text-[15px] font-bold text-[#fff9ec] no-underline hover:bg-[#2d5a3d] ${TS.focus}`;
export const BTN_LLEGAR = `inline-flex min-h-11 flex-[1_1_auto] cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-full border-2 border-[#173f36] bg-[#f3e4c8] px-3.5 font-sans text-[15px] font-bold text-[#173f36] no-underline hover:bg-[#ead7b3] ${TS.focus}`;
const safeWeb = (url) => (/^https?:\/\//i.test(url || '') ? url : '');

// Linea de cuando: fecha o rango (eventos), texto de tradicion (sin cuenta regresiva) u horario (lugares).
export function pointWhen(point, today) {
  if (point.type === 'LUGAR') return point.opening_hours ? { label: 'Horario', text: point.opening_hours } : null;
  if (isTraditionPoint(point, today)) return { label: 'Tradición', text: point.tradition_text };
  const text = dateLine(point.start_date, point.end_date);
  return text ? { label: 'Fecha', text } : null;
}

// Pildoras de un punto: municipio (siempre tinta con papel), tipo y aviso de dias.
export function PointChips({ point, today }) {
  const isPlace = point.type === 'LUGAR';
  const category = point.place_category;
  const notice = pointNotice(point, today);
  return (
    <div className="flex flex-wrap gap-1.5">
      {point.municipality_label && <Pill colors={PILL_COLORS.municipality} data-municipio-punto>{point.municipality_label}</Pill>}
      {isPlace ? (
        <Pill colors={category ? placeColors(category.color) : { ...PILL_COLORS.category, border: TERRITORY.ink }} data-tipo-punto data-categoria-lugar={category?.slug || 'otros'}>
          <PlaceIcon icon={category?.icon} className="size-4" strokeWidth={2} /> {category ? `Lugar · ${category.label}` : 'Lugar'}
        </Pill>
      ) : (
        <Pill colors={EVENT_CHIP} data-tipo-punto>
          <Icon name="calendar" className="size-4 shrink-0" strokeWidth={2} /> {point.category_label ? `Evento · ${point.category_label}` : 'Evento'}
        </Pill>
      )}
      {notice && <span className={PILL_BASE} style={NOTICE} data-aviso={notice.kind}>{notice.text}</span>}
    </div>
  );
}

export function WhenBlock({ when }) {
  if (!when) return null;
  return (
    <p className="m-0 rounded-[10px] border-l-4 border-[#d4a843] bg-[#f3e4c8] px-3 py-2 text-[15px] font-bold leading-[1.35] text-[#173f36] [overflow-wrap:anywhere]" data-fecha>
      <span className="sr-only">{when.label}: </span>{when.text}
    </p>
  );
}

export function PointPhoto({ point, className, broken, onBroken, width = 680 }) {
  if (point.image && !broken) {
    return <img src={cdnImage(point.image, { width })} alt="" loading="lazy" className={`block w-full object-cover ${className}`} onError={onBroken} />;
  }
  if (point.type === 'LUGAR') return <PlaceFallback category={point.place_category} className={className} iconClass="size-10" />;
  return <div className={`flex items-center justify-center bg-[#f3e4c8] ${className}`}><Icon name="calendar" className="size-10 text-[#4d5a55]" /></div>;
}

// Mini tarjeta de un punto del Mapa vivo con los 7 datos: foto 16:9, titulo, tipo, municipio, fecha o rango
// con su aviso (eventos) u horario (lugares), lugar o direccion, y "Ver publicacion" / "Como llegar". Los
// lugares conservan su contacto discreto (telefono, WhatsApp, web). Escritorio: dentro del popup anclado
// al pin (340 px; 320 en tablet). Movil: en el panel inferior, con la foto compacta. Esc, el boton Cerrar
// (44x44) y, en movil, deslizar hacia abajo o tocar el mapa la cierran (lo maneja MapScreen).
export default function MapCard({ point, titleId, today, onClose, sheet = false, width = 340 }) {
  const [broken, setBroken] = useState(false);
  const isPlace = point.type === 'LUGAR';
  const when = pointWhen(point, today);
  const corner = sheet ? '' : 'rounded-t-[16px]';
  const web = isPlace ? safeWeb(point.website) : '';
  const contact = isPlace && (point.phone || point.whatsapp || web);
  return (
    <article className="bg-white text-[#173f36]" style={sheet ? undefined : { width }} aria-labelledby={titleId} data-tarjeta-mapa={point.key}>
      <div className="relative">
        <PointPhoto point={point} broken={broken} onBroken={() => setBroken(true)} className={`${sheet ? 'h-[120px]' : 'aspect-[16/9]'} ${corner}`} />
        <button type="button" onClick={onClose} aria-label="Cerrar tarjeta" data-cerrar-tarjeta
          className={`absolute top-2 right-2 inline-flex size-11 cursor-pointer items-center justify-center rounded-full border-2 border-[#173f36] bg-[#fff9ec] text-[#173f36] ${TS.focus}`}>
          <Icon name="close" className="size-5" strokeWidth={2} />
        </button>
      </div>
      <div className="grid gap-2.5 p-4">
        <PointChips point={point} today={today} />
        <h2 id={titleId} className="m-0 font-sans text-[19px] font-extrabold leading-[1.2] [overflow-wrap:anywhere]">{point.title}</h2>
        <WhenBlock when={when} />
        {point.location && (
          <p className="m-0 text-[15px] font-semibold leading-[1.4] text-[#3f514a] [overflow-wrap:anywhere]" data-direccion-tarjeta>
            {isPlace ? 'Dirección' : 'Lugar'}: {point.location}
          </p>
        )}
        {contact && (
          <p className="m-0 flex flex-wrap gap-x-4" data-contacto-lugar>
            {point.phone && <a className={LINK} href={telHref(point.phone)} data-contacto="tel">Llamar<span className="sr-only"> al {point.phone}</span></a>}
            {point.whatsapp && (
              <a className={LINK} href={whatsappHref(point.whatsapp)} target="_blank" rel="noopener noreferrer" data-contacto="whatsapp" data-whatsapp>
                WhatsApp<span className="sr-only"> (abre WhatsApp en una pestaña nueva)</span>
              </a>
            )}
            {web && (
              <a className={LINK} href={web} target="_blank" rel="noopener noreferrer" data-contacto="web">
                Sitio web<span className="sr-only"> (se abre en una pestaña nueva)</span>
              </a>
            )}
          </p>
        )}
        <div className="mt-1 flex flex-wrap gap-2">
          <a href={point.href} className={BTN_VER} data-boton="ver">Ver publicación <span aria-hidden="true">→</span></a>
          <a href={directionsUrl(point.lat, point.lng)} target="_blank" rel="noopener noreferrer" className={BTN_LLEGAR} data-boton="llegar">
            Cómo llegar <span aria-hidden="true">↗</span><span className="sr-only"> (abre las direcciones en una pestaña nueva)</span>
          </a>
        </div>
      </div>
    </article>
  );
}
