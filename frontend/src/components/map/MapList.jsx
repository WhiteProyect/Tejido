import { useEffect, useState } from 'react';
import { TS } from '../territory/territoryStyles.js';
import { BTN_LLEGAR, BTN_VER, PointChips, PointPhoto, WhenBlock, pointWhen } from './MapCard.jsx';
import { directionsUrl } from '../../utils/mapConfig.js';

const PAGE = 48;

function ListCard({ point, today }) {
  const [broken, setBroken] = useState(false);
  const titleId = `lista-punto-${point.key}`;
  return (
    <li className={TS.cell}>
      <article className={TS.card} aria-labelledby={titleId} data-tarjeta-lista={point.key}>
        <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-[#f3e4c8]">
          <PointPhoto point={point} broken={broken} onBroken={() => setBroken(true)} className="size-full" />
        </div>
        <div className="flex flex-1 flex-col gap-2.5 p-5 max-[1023px]:p-4">
          <PointChips point={point} today={today} />
          <h3 id={titleId} className="m-0 font-sans text-[20px] font-extrabold leading-[1.2] [overflow-wrap:anywhere]">{point.title}</h3>
          <WhenBlock when={pointWhen(point, today)} />
          {point.location && (
            <p className="m-0 text-[15px] font-semibold leading-[1.4] text-[#3f514a] [overflow-wrap:anywhere]">
              {point.type === 'LUGAR' ? 'Dirección' : 'Lugar'}: {point.location}
            </p>
          )}
          <div className="mt-auto flex flex-wrap gap-2 pt-1">
            <a href={point.href} className={BTN_VER}>Ver<span className="sr-only"> {point.title}</span> <span aria-hidden="true">→</span></a>
            <a href={directionsUrl(point.lat, point.lng)} target="_blank" rel="noopener noreferrer" className={BTN_LLEGAR}>
              Cómo llegar <span aria-hidden="true">↗</span><span className="sr-only"> a {point.title} (abre las direcciones en una pestaña nueva)</span>
            </a>
          </div>
        </div>
      </article>
    </li>
  );
}

// Vista de lista del Mapa vivo: los mismos puntos filtrados en tarjetas (2 columnas desde 768 px, 1 en
// movil), en el orden de la API (eventos por fecha, lugares por titulo). Se muestran de a 48 con
// "Mostrar más" para no pintar mil tarjetas de golpe.
export default function MapList({ id, points, today, empty }) {
  const [shown, setShown] = useState(PAGE);
  useEffect(() => { setShown(PAGE); }, [points]);
  const visible = points.slice(0, shown);
  return (
    <section id={id} className="mx-auto w-full max-w-[1300px] px-10 pt-6 pb-16 max-[1023px]:px-6 max-[767px]:px-4" aria-labelledby={`${id}-titulo`} data-lista-mapa>
      <h2 id={`${id}-titulo`} className="sr-only" tabIndex={-1}>Puntos del mapa en lista</h2>
      {points.length ? (
        <>
          <ul className={`${TS.grid} !mt-0`}>
            {visible.map((point) => <ListCard key={point.key} point={point} today={today} />)}
          </ul>
          {shown < points.length && (
            <div className="mt-6 flex justify-center">
              <button type="button" className={TS.btnOutline} onClick={() => setShown((n) => n + PAGE)} data-mostrar-mas>
                Mostrar más ({points.length - shown} restantes)
              </button>
            </div>
          )}
        </>
      ) : empty}
    </section>
  );
}
