/**
 * OPPORTUNITIESSCREEN.JSX — Pantalla de Oportunidades
 *
 * Muestra convocatorias, proyectos y espacios para participar
 * en el territorio del Bajo Cauca.
 *
 * Incluye:
 * - Contador de días restantes ("Cierra en X días")
 * - Indicador visual de urgencia
 * - Nombre de la organización
 * - Ubicación
 *
 * Parte de la FASE 3 del plan de magia.
 */

import ScreenIntro from '../components/ScreenIntro.jsx';
import { getDeadlineText, getDateUrgency, formatDateShort } from '../utils/dateUtils.js';
import { PUB_KIND, SCREEN_LIST, SCREEN_LIST_ITEM, SCREEN_LIST_TEXT, SCREEN_LIST_TITLE, SCREEN_SECTION, SMALL_DATE, STATUS, URGENCY, URGENCY_PILL } from '../components/uiStyles.js';

export default function OpportunitiesScreen({ opportunities = [] }) {
  return (
    <section className={SCREEN_SECTION}>
      <ScreenIntro
        eyebrow="Abre una puerta"
        title="Oportunidades"
        description="Convocatorias, proyectos y espacios para participar en el territorio."
      />

      <div className={SCREEN_LIST}>
        {opportunities.length ? (
          opportunities.map((opportunity) => {
            /** Texto del plazo restante */
            const deadlineText = getDeadlineText(opportunity.end_date);
            /** Urgencia visual */
            const urgency = getDateUrgency(opportunity.end_date);

            return (
              <article className={SCREEN_LIST_ITEM} key={opportunity.id}>
                {/* Etiqueta del tipo */}
                <span className={PUB_KIND}>OPORTUNIDAD</span>

                {/* Título */}
                <h2 className={SCREEN_LIST_TITLE}>{opportunity.title}</h2>

                {/* Resumen */}
                <p className={SCREEN_LIST_TEXT}>{opportunity.summary}</p>

                {/* Plazo con countdown */}
                <div className={`${URGENCY_PILL} ${URGENCY[urgency]}`}>
                  <span className="text-[14px]">
                    {urgency === 'urgent' ? '\u26A0' : '\u23F0'}
                  </span>
                  <span>{deadlineText}</span>
                </div>

                {/* Fecha de cierre formateada */}
                {opportunity.end_date && (
                  <small className={SMALL_DATE}>
                    Fecha límite: {formatDateShort(opportunity.end_date)}
                  </small>
                )}
              </article>
            );
          })
        ) : (
          <p className={STATUS}>Pronto encontrarás nuevas oportunidades.</p>
        )}
      </div>
    </section>
  );
}
