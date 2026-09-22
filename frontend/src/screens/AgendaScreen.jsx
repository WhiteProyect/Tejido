/**
 * AGENDASCREEN.JSX — Pantalla de Agenda / Eventos
 *
 * Muestra la lista de eventos del Bajo Cauca con:
 * - Countdown visual "Faltan X días" o "¡Es hoy!"
 * - Fechas formateadas en español legible
 * - Indicador de urgencia por colores
 * - Ubicación del evento
 *
 * Parte de la FASE 3 del plan de magia.
 */

import ScreenIntro from '../components/ScreenIntro.jsx';
import { formatDate, getCountdown, getDateUrgency } from '../utils/dateUtils.js';
import { KIND_LABELS } from '../utils/constants.js';
import { PUB_KIND, SCREEN_LIST, SCREEN_LIST_ITEM, SCREEN_LIST_TEXT, SCREEN_LIST_TITLE, SCREEN_SECTION, SMALL_DATE, STATUS, URGENCY, URGENCY_PILL } from '../components/uiStyles.js';

export default function AgendaScreen({ events = [] }) {
  return (
    <section className={SCREEN_SECTION}>
      <ScreenIntro
        eyebrow="La ronda continúa"
        title="Agenda de Caucasia"
        description="Planes para encontrarnos, aprender y celebrar lo nuestro."
      />

      <div className={SCREEN_LIST}>
        {events.length ? (
          events.map((event) => {
            /** Countdown del evento */
            const countdown = getCountdown(event.start_date);
            /** Nivel de urgencia para estilo visual */
            const urgency = getDateUrgency(event.start_date);

            return (
              <article className={SCREEN_LIST_ITEM} key={event.id}>
                {/* Etiqueta del tipo */}
                <span className={PUB_KIND}>
                  {KIND_LABELS[event.kind] || event.kind}
                </span>

                {/* Título del evento */}
                <h2 className={SCREEN_LIST_TITLE}>{event.title}</h2>

                {/* Resumen */}
                <p className={SCREEN_LIST_TEXT}>{event.summary}</p>

                {/* Fecha formateada */}
                {event.start_date && (
                  <small className={SMALL_DATE}>
                    {formatDate(event.start_date)}
                  </small>
                )}

                {/* Countdown visual */}
                {event.start_date && (
                  <div className={`${URGENCY_PILL} ${URGENCY[urgency]}`}>
                    <span className="text-[14px]">
                      {countdown.isToday ? '!' : countdown.isPast ? '\u2713' : '\u23F0'}
                    </span>
                    <span>{countdown.text}</span>
                  </div>
                )}

                {/* Ubicación */}
                <small className="text-muted block text-[11px] mt-0.5">
                  {event.location || 'Caucasia'}
                </small>
              </article>
            );
          })
        ) : (
          <p className={STATUS}>Pronto encontrarás nuevos eventos.</p>
        )}
      </div>
    </section>
  );
}
