/**
 * DATEUTILS.JS — Utilidades de formato de fechas
 *
 * Funciones reutilizables para:
 * - Formatear fechas en español legible ("18 de julio de 2026")
 * - Calcular countdown para eventos ("Faltan 12 días")
 * - Calcular días restantes para oportunidades
 *
 * Parte de la FASE 3 del plan de magia.
 */

/**
 * Meses en español para formateo de fechas.
 */
const MESES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

/**
 * Días de la semana en español.
 */
const DIAS_ES = [
  'domingo', 'lunes', 'martes', 'miércoles',
  'jueves', 'viernes', 'sábado'
];

/**
 * Parsea una fecha ISO de forma segura.
 * Soporta tanto "YYYY-MM-DD" como "YYYY-MM-DDTHH:MM" (con hora incluida).
 * Si la fecha ya tiene hora, no agrega nada. Si solo tiene fecha, agrega mediodía.
 *
 * @param {string} isoDate - Fecha en formato ISO
 * @returns {Date|null} Objeto Date válido o null si no se puede parsear
 */
function safeParseDate(isoDate) {
  if (!isoDate) return null;
  // Si la fecha ya incluye hora (T presente), usarla directo
  const dateStr = isoDate.includes('T') ? isoDate : isoDate + 'T12:00:00';
  const date = new Date(dateStr);
  // Verificar que la fecha sea válida
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Formatea una fecha ISO a texto legible en español.
 * Ejemplo: "2026-07-18" → "viernes 18 de julio de 2026"
 * Soporta fechas con hora: "2026-07-18T15:00" → "sábado 18 de julio de 2026"
 *
 * @param {string} isoDate - Fecha en formato ISO (YYYY-MM-DD o YYYY-MM-DDTHH:MM)
 * @returns {string} Fecha formateada en español
 */
export function formatDate(isoDate) {
  const date = safeParseDate(isoDate);
  if (!date) return '';
  const day = date.getDate();
  const month = MESES_ES[date.getMonth()];
  const year = date.getFullYear();
  const dayName = DIAS_ES[date.getDay()];
  return `${dayName} ${day} de ${month} de ${year}`;
}

/**
 * Formatea una fecha ISO a formato corto.
 * Ejemplo: "2026-07-18" → "18 jul 2026"
 *
 * @param {string} isoDate - Fecha en formato ISO
 * @returns {string} Fecha formateada en formato corto
 */
export function formatDateShort(isoDate) {
  const date = safeParseDate(isoDate);
  if (!date) return '';
  const day = date.getDate();
  const month = MESES_ES[date.getMonth()].substring(0, 3);
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Calcula el countdown hasta una fecha futura.
 * Soporta fechas con o sin hora.
 *
 * @param {string} isoDate - Fecha en formato ISO (YYYY-MM-DD o YYYY-MM-DDTHH:MM)
 * @returns {object} { days, isPast, isToday, text }
 */
export function getCountdown(isoDate) {
  const target = safeParseDate(isoDate);
  if (!target) return { days: 0, isPast: true, isToday: false, text: '' };

  // Dias de calendario (local), no horas: un evento de hoy a las 7 p. m. visto a las 10 a. m. es "hoy",
  // no "mañana".
  const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfDay(target) - startOfDay(new Date())) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { days: 0, isPast: true, isToday: false, text: 'Evento finalizado' };
  }
  if (diffDays === 0) {
    return { days: 0, isPast: false, isToday: true, text: '¡Es hoy!' };
  }
  if (diffDays === 1) {
    return { days: 1, isPast: false, isToday: false, text: '¡Mañana!' };
  }
  return {
    days: diffDays,
    isPast: false,
    isToday: false,
    text: `Faltan ${diffDays} días`
  };
}

/**
 * Calcula días restantes para una fecha límite (oportunidades).
 *
 * @param {string} isoDate - Fecha límite en formato ISO
 * @returns {string} Texto descriptivo de los días restantes
 */
export function getDeadlineText(isoDate) {
  if (!isoDate) return 'Convocatoria abierta';
  const countdown = getCountdown(isoDate);
  if (countdown.isPast) return 'Plazo cerrado';
  if (countdown.isToday) return '¡Cierra hoy!';
  if (countdown.days === 1) return 'Cierra mañana';
  return `Cierra en ${countdown.days} días`;
}

/**
 * Determina la urgencia de una fecha para aplicar estilos visuales.
 *
 * @param {string} isoDate - Fecha en formato ISO
 * @returns {string} 'urgent' | 'warning' | 'normal' | 'past'
 */
export function getDateUrgency(isoDate) {
  if (!isoDate) return 'normal';
  const countdown = getCountdown(isoDate);
  if (countdown.isPast) return 'past';
  if (countdown.isToday) return 'urgent';
  if (countdown.days <= 3) return 'urgent';
  if (countdown.days <= 7) return 'warning';
  return 'normal';
}

/**
 * Rango corto de fechas: "18 jul 2026 – 20 jul 2026", o una sola si no hay fin o es el mismo dia.
 */
export function formatDateRange(start, end) {
  const from = formatDateShort(start);
  const to = formatDateShort(end);
  if (from && to && from !== to) return `${from} – ${to}`;
  return from || to;
}

/**
 * Aviso de dias de un evento segun la fecha del navegador: { text, tone, kind }; null si ya termino o
 * no tiene fechas. tone ('normal' | 'urgent' | 'ongoing') lo usa el carrusel del inicio (NOTICE_TONES);
 * kind ('today' | 'days' | 'ongoing') la Agenda y Oportunidades (NOTICE_COLORS de uiStyles.js).
 */
export function eventNotice(start, end) {
  if (!start && !end) return null;
  const first = getCountdown(start || end);
  if (getCountdown(end || start).isPast) return null;
  if (first.isToday) return { text: 'Es hoy', tone: 'urgent', kind: 'today' };
  if (!first.isPast) {
    return { text: first.days === 1 ? 'Falta 1 día' : `Faltan ${first.days} días`, tone: getDateUrgency(start || end) === 'urgent' ? 'urgent' : 'normal', kind: 'days' };
  }
  return { text: 'En curso', tone: 'ongoing', kind: 'ongoing' };
}

/**
 * Aviso de cierre (oportunidades): "Cierra hoy", "Queda 1 dia", "Quedan N dias"; null si ya cerro o
 * no hay fecha. Mismo shape que eventNotice. Lo comparten el carrusel y Oportunidades.
 */
export function closingNotice(end) {
  if (!end) return null;
  const countdown = getCountdown(end);
  if (countdown.isPast) return null;
  if (countdown.isToday) return { text: 'Cierra hoy', tone: 'urgent', kind: 'today' };
  return { text: countdown.days === 1 ? 'Queda 1 día' : `Quedan ${countdown.days} días`, tone: getDateUrgency(end) === 'urgent' ? 'urgent' : 'normal', kind: 'days' };
}
