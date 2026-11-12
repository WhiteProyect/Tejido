/**
 * HILOASSISTANT.JSX — Asistente Virtual con Personalidad
 *
 * Hilo es el guía virtual de TEJIDO. No es solo un botón — es un compañero
 * que reacciona a lo que haces en la plataforma.
 *
 * Estructura (rediseño 2026-11, "telar"):
 * - Lanzador compacto: cápsula tinta "Habla con Hilo · Guía de Caucasia" (punto río de
 *   "activo") con Hilo a su derecha. A su izquierda, un susurro contextual según la pantalla
 *   (prop `screen`) que se esconde solo a los 5 s.
 * - Panel con Hilo protagonista: un arco de hilos conecta cuatro nudos (los destinos de la
 *   Brújula) alrededor de Hilo, que va grande y al centro. Sin tarjetas ni cuadrícula.
 * - Chat Turístico: reglas por palabras clave contra las publicaciones reales (prop
 *   `publications`), sin IA ni API externa. Si encuentra algo responde con una mini-tarjeta
 *   y píldoras de seguimiento; si no, lo dice sin inventar.
 * - Interacción: indicador de escritura, chips contextuales por pantalla, búsqueda libre por
 *   puntaje, memoria de sesión del chat y reacciones a guardar/compartir (utils/hiloBus.js).
 *
 * Personalidad (sin cambios): saludo según la hora, confeti al descubrir algo, poses que
 * cambian con el contexto y un mensaje si el usuario lleva un rato inactivo.
 *
 * Poses de Hilo (imágenes PNG en /images/hilo/): saluda, senala, lee, piensa, explica,
 * celebra, sorprendido, descubre, teje.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import Icon from './Icon.jsx';
import { KIND_LABELS } from '../utils/constants.js';
import { branchLabel, branchSlug, isActiveKey } from '../utils/culturalBranches.js';
import { onHiloReaction } from '../utils/hiloBus.js';
import { exploreHash } from '../utils/search.js';

const WHISPER_MS = 5000;
const CHAT_KEY = 'tejido_hilo_chat_v1';
const MAX_STORED_MESSAGES = 30;

/**
 * Brújula: los 4 destinos (nudos del telar).
 * [clave, etiqueta, apoyo, hash, icono, color, pose]
 */
const COMPASS = [
  ['mapa', 'Recorrer Caucasia', 'El mapa vivo', 'mapa', 'compass', 'var(--river)', 'hilo-senala.png'],
  ['plan', 'Encontrar un plan', 'Eventos y agenda', 'agenda', 'calendar', 'var(--orange)', 'hilo-descubre.png'],
  ['gente', 'Conocer gente y talento', 'Quiénes mueven el territorio', 'talento', 'people', '#276749', 'hilo-lee.png'],
  ['oportunidades', 'Convocatorias', 'Oportunidades abiertas', 'oportunidades', 'seal', '#b8860b', 'hilo-celebra.png'],
];
// Posición de cada nudo sobre el arco tejido (escritorio y móvil comparten proporciones).
const KNOT_POSITIONS = [
  'left-[4%] top-[15%]',
  'left-[20%] top-[3%]',
  'right-[20%] top-[3%]',
  'right-[4%] top-[15%]',
];
// Acciones secundarias, más discretas que los nudos. [etiqueta, hash, icono, pose]
const SECONDARY = [
  ['Mis guardados', 'guardadas', 'bookmark', 'hilo-lee.png'],
  ['Enviar sugerencia', 'nosotros', 'pen', 'hilo-explica.png'],
];
// Pantallas a las que Hilo lleva al usuario (y cierra el panel).
const NAVIGATES = ['mapa', 'agenda', 'oportunidades', 'talento', 'guardadas', 'nosotros'];

/**
 * Susurros del lanzador según la pantalla activa (route.screen de App).
 */
const WHISPERS = {
  explorar: 'Cada categoría cultural es una puerta. ¿Por cuál entramos?',
  categoria: 'Aquí se juntan los que tejen esta rama. Mira quién la mueve.',
  mapa: 'Seis municipios, un mismo río. Toca uno y te cuento qué pasa ahí.',
  agenda: 'Mira lo que viene en el calendario. ¿Hay plan para el fin de semana?',
  oportunidades: 'Hay convocatorias abiertas. Puede que una sea para ti.',
  talento: 'Detrás de cada nombre hay una historia del Bajo Cauca.',
  guardadas: 'Lo que guardas no se pierde: aquí lo tienes a mano.',
  nosotros: '¿Una idea para TEJIDO? Cuéntanosla, la leemos todas.',
  perfil: 'Este es tu rincón. Desde aquí sigues tu recorrido.',
  moneystack: 'Suena a Caucasia. ¿Le damos play?',
};
const DEFAULT_WHISPER = '¿Te ayudo a descubrir Caucasia?';
const whisperFor = (screen) => WHISPERS[screen] || DEFAULT_WHISPER;

/**
 * Chips de arranque del chat, según la pantalla en la que está el usuario.
 * Reutilizan las intenciones y los destinos que ya conoce el asistente.
 */
const STARTERS = {
  agenda: [
    { label: '¿Qué hay esta noche?', intent: 'evento' },
    { label: 'Planes de fin de semana', intent: 'evento' },
    { label: 'Abrir el mapa', hash: 'mapa' },
  ],
  mapa: [
    { label: '¿Dónde comer?', intent: 'comer' },
    { label: '¿Qué hay esta noche?', intent: 'evento' },
    { label: 'Música y talento', intent: 'talento' },
  ],
  talento: [
    { label: 'Música y talento', intent: 'talento' },
    { label: '¿Qué hay esta noche?', intent: 'evento' },
    { label: 'Ver la agenda', hash: 'agenda' },
  ],
  oportunidades: [
    { label: 'Ver convocatorias', hash: 'oportunidades' },
    { label: 'Música y talento', intent: 'talento' },
    { label: 'Abrir el mapa', hash: 'mapa' },
  ],
  guardadas: [
    { label: 'Mis guardados', hash: 'guardadas' },
    { label: '¿Qué hay esta noche?', intent: 'evento' },
    { label: 'Música y talento', intent: 'talento' },
  ],
  default: [
    { label: '¿Qué hay esta noche?', intent: 'evento' },
    { label: '¿Dónde comer?', intent: 'comer' },
    { label: 'Música y talento', intent: 'talento' },
  ],
};
const startersFor = (screen) => STARTERS[screen] || STARTERS.default;

/**
 * Saludos de Hilo según la hora del día.
 */
function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return '¡Buenos días! Soy Hilo. ';
  if (hour >= 12 && hour < 18) return '¡Buenas tardes! Soy Hilo. ';
  return '¡Buenas noches! Soy Hilo. ';
}

/**
 * Mensajes reactivos de Hilo según la acción del usuario.
 * Se usan para dar personalidad a las interacciones.
 */
const REACTIVE_MESSAGES = {
  share: [
    '¡Genial! Compartir es tejer comunidad. +10 puntos para ti.',
    '¡Eso! Cada share une más al Bajo Cauca.',
    'Compartido. La gente se entera gracias a ti.',
  ],
  favorite: [
    '¡Buena elección! Lo guardo en tu hilo personal.',
    'Guardado. Ese contenido es especial.',
    'Sumado a tu colección. No se te va a olvidar.',
  ],
  unfavorite: [
    'Lo quité de tu ruta. Cuando quieras vuelve a guardarlo.',
  ],
  interest: [
    '¡Anotado! Ya sé qué te mueve del territorio.',
    'Esa señal me ayuda a mostrarte cosas parecidas.',
    'Me interesa que te interese. Sigo tu hilo.',
  ],
  explore: [
    'Descubriendo el territorio... me encanta.',
    'Cada rincón de Caucasia tiene algo que contar.',
    'Sigues el río de las historias.',
  ],
  idle: [
    '¿Sigues ahí? Puedo contarte algo del Bajo Cauca.',
    'Hey, no te vayas sin explorar todo.',
    'Hay mucho por descubrir aún.',
  ],
};

/**
 * Elige un mensaje aleatorio de una lista.
 */
function pickRandom(messages) {
  return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Genera confetti simple usando CSS animations (sin librería externa).
 * Crea partículas de colores que caen y desaparecen.
 */
function triggerConfetti() {
  const container = document.createElement('div');
  container.className = 'hilo-confetti-container';
  container.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;';

  const colors = ['#d4a843', '#1d8fa3', '#d85b36', '#8a4f7d', '#75b79b', '#f4b942'];

  for (let i = 0; i < 30; i++) {
    const particle = document.createElement('div');
    const color = colors[Math.floor(Math.random() * colors.length)];
    const left = Math.random() * 100;
    const delay = Math.random() * 0.5;
    const size = 6 + Math.random() * 8;

    particle.style.cssText = `
      position:absolute;
      top:-20px;
      left:${left}%;
      width:${size}px;
      height:${size}px;
      background:${color};
      border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
      animation:hiloConfettiFall ${1.5 + Math.random()}s ease-out ${delay}s forwards;
    `;
    container.appendChild(particle);
  }

  document.body.appendChild(container);
  // Limpiar después de la animación
  setTimeout(() => container.remove(), 3000);
}

// ─── Chat Turístico: intenciones por palabras clave ─────────────────────────
// Sin IA: se normaliza el texto (minúsculas, sin tildes) y la primera intención con una
// palabra clave presente decide el filtro sobre las publicaciones reales. Cada intención
// trae su frase en voz Hilo y sus píldoras de seguimiento.
const normalize = (value) => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const textOf = (pub) => normalize([pub.title, pub.summary, pub.location].filter(Boolean).join(' '));
const timeOf = (value) => (value ? new Date(value).getTime() : NaN);

// Eventos: primero los que vienen (el más próximo), luego los ya pasados (el más reciente).
function byUpcoming(a, b) {
  const now = Date.now();
  const ta = timeOf(a.start_date);
  const tb = timeOf(b.start_date);
  const fa = ta >= now;
  const fb = tb >= now;
  if (fa !== fb) return fa ? -1 : 1;
  if (Number.isNaN(ta) || Number.isNaN(tb)) return Number.isNaN(ta) - Number.isNaN(tb);
  return fa ? ta - tb : tb - ta;
}

const FOLLOW = {
  otroEvento: { label: 'Ver más eventos', intent: 'evento' },
  comer: { label: '¿Dónde comer?', intent: 'comer' },
  talento: { label: 'Música y talento', intent: 'talento' },
  mapa: { label: 'Abrir Mapa Vivo', hash: 'mapa' },
  agenda: { label: 'Ver la agenda', hash: 'agenda' },
};

const INTENTS = [
  {
    key: 'comer',
    words: ['comer', 'come', 'comida', 'comidas', 'comiendo', 'restaurante', 'gastronomia', 'gastronomico', 'hambre', 'cocina', 'almorzar', 'cenar', 'desayunar'],
    // Gastronomía cultural, o publicaciones que hablan de cocina/comida.
    filter: (pub) => pub.cultural_category === 'GASTRONOMIA_CULTURAL' || /gastronom|cocina|comida|sabor/.test(textOf(pub)),
    say: (pub, more) => `Para el antojo, mira "${pub.title}".${more ? ` Tengo ${more} más con sabor a Caucasia.` : ''}`,
    follow: [FOLLOW.otroEvento, FOLLOW.mapa],
  },
  {
    key: 'evento',
    words: ['evento', 'eventos', 'plan', 'planes', 'hoy', 'esta noche', 'que hacer', 'fiesta', 'festival', 'concierto', 'fin de semana', 'agenda'],
    filter: (pub) => pub.kind === 'EVENTO',
    sort: byUpcoming,
    say: (pub, more) => `Un plan: "${pub.title}"${pub.start_date ? `, el ${new Date(pub.start_date).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}` : ''}.${more ? ` Hay ${more} plan${more === 1 ? '' : 'es'} más en la agenda.` : ''}`,
    follow: [FOLLOW.otroEvento, FOLLOW.agenda, FOLLOW.mapa],
  },
  {
    key: 'talento',
    words: ['musica', 'arte', 'artista', 'artistas', 'talento', 'talentos', 'cantante', 'banda', 'baile', 'fotografia'],
    filter: (pub) => pub.cultural_category === 'MUSICA' || pub.kind === 'TALENTO',
    say: (pub, more) => `Te presento "${pub.title}".${more ? ` Y hay ${more} más que suenan a territorio.` : ''}`,
    follow: [FOLLOW.otroEvento, FOLLOW.mapa],
  },
  {
    key: 'hospedaje',
    words: ['dormir', 'hotel', 'hoteles', 'hospedaje', 'alojamiento', 'hostal', 'quedarme'],
    // No hay una categoría de hospedaje: se buscan lugares y se dice con honestidad.
    filter: (pub) => pub.kind === 'LUGAR',
    say: (pub) => `Aún no tengo hospedajes registrados como tal, pero este lugar puede orientarte: "${pub.title}".`,
    follow: [FOLLOW.mapa, FOLLOW.comer],
  },
];
const FREE_SEARCH_FOLLOW = [FOLLOW.otroEvento, FOLLOW.comer, FOLLOW.mapa];
const NOT_FOUND = 'No encontré nada con eso. Prueba con otro nombre, evento o lugar del Bajo Cauca.';

// Palabras vacías que no aportan a la búsqueda libre.
const STOPWORDS = new Set([
  'de', 'la', 'el', 'que', 'en', 'un', 'una', 'y', 'o', 'hay', 'para', 'por', 'con', 'del',
  'los', 'las', 'me', 'mi', 'tu', 'es', 'esta', 'este', 'como', 'donde', 'cuando', 'quien',
  'cual', 'al', 'se', 'su', 'mas', 'pero', 'muy', 'sin', 'sobre', 'entre', 'hasta', 'desde',
  'lo', 'le', 'les', 'algo', 'quiero', 'busco', 'ver', 'conocer', 'recomiendame',
]);

function tokensOf(text) {
  return normalize(text)
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
}

// Puntúa una publicación según dónde aparecen las palabras buscadas.
function scorePublication(pub, tokens) {
  const title = normalize(pub.title || '');
  const summary = normalize(pub.summary || '');
  const location = normalize(pub.location || '');
  const meta = normalize([
    pub.cultural_category && branchLabel(pub.cultural_category),
    KIND_LABELS[pub.kind],
    pub.cultural_category,
  ].filter(Boolean).join(' '));
  let score = 0;
  for (const token of tokens) {
    if (title.includes(token)) score += 4;
    else if (location.includes(token)) score += 3;
    else if (meta.includes(token)) score += 2;
    else if (summary.includes(token)) score += 1;
  }
  return score;
}

function detectIntent(text) {
  const normalized = ` ${normalize(text).replace(/[^a-z0-9ñ ]+/g, ' ')} `;
  return INTENTS.find((intent) => intent.words.some((word) => normalized.includes(` ${word} `)));
}

// Devuelve { text, publication?, follow, pose } para un intento (offset = "ver otro").
function answerIntent(intent, publications, offset = 0) {
  const results = publications.filter(intent.filter);
  if (intent.sort) results.sort(intent.sort);
  if (!results.length) return { text: NOT_FOUND, follow: [FOLLOW.mapa, FOLLOW.agenda], pose: 'hilo-piensa.png', celebrate: false };
  const publication = results[offset % results.length];
  return {
    text: intent.say(publication, results.length - 1),
    publication,
    follow: intent.follow,
    pose: 'hilo-descubre.png',
    intent: intent.key,
    offset,
    celebrate: offset === 0,
  };
}

function answerFreeText(text, publications, offset = 0) {
  const tokens = tokensOf(text);
  const scored = publications
    .map((pub) => ({ pub, score: scorePublication(pub, tokens) }))
    .filter((entry) => entry.score >= 3)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.pub);

  if (!scored.length) {
    return { text: NOT_FOUND, follow: [FOLLOW.mapa, FOLLOW.agenda], pose: 'hilo-piensa.png', celebrate: false };
  }

  const publication = scored[offset % scored.length];
  const follow = scored.length > 1
    ? [{ label: 'Ver otra coincidencia', freeText: text, offset }, { label: 'Ver en Explorar', explore: text }, ...FREE_SEARCH_FOLLOW]
    : [{ label: 'Ver en Explorar', explore: text }, ...FREE_SEARCH_FOLLOW];

  return {
    text: `¡Encontré algo! "${publication.title}" — ${publication.location || 'Caucasia'}`,
    publication,
    follow,
    pose: 'hilo-sorprendido.png',
    freeText: text,
    offset,
    celebrate: offset === 0,
  };
}

// Lee la conversación guardada en la sesión (sobrevive a un recargo de página).
function loadConversation() {
  try {
    const raw = sessionStorage.getItem(CHAT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-MAX_STORED_MESSAGES) : [];
  } catch {
    return [];
  }
}

// Guarda solo lo necesario de cada publicación, para no inflar el sessionStorage.
function slimConversation(conversation) {
  return conversation.slice(-MAX_STORED_MESSAGES).map((item) => (item.publication ? {
    ...item,
    publication: {
      id: item.publication.id,
      title: item.publication.title,
      location: item.publication.location,
      cultural_category: item.publication.cultural_category,
      kind: item.publication.kind,
    },
  } : item));
}

/**
 * Mini-tarjeta de una publicación dentro del chat. "Ver detalle" abre su página
 * (#publicacion/<id>); la categoría queda como enlace secundario.
 */
function HiloMiniCard({ publication, onNavigate }) {
  // Solo las ramas activas tienen pagina de categoria (utils/culturalBranches.js).
  const slug = isActiveKey(publication.cultural_category) ? branchSlug(publication.cultural_category) : null;
  const place = (publication.location || 'Caucasia').split(',')[0].trim();
  const meta = [(publication.cultural_category && branchLabel(publication.cultural_category)) || KIND_LABELS[publication.kind], place].filter(Boolean);
  return (
    <div className="mt-2 rounded-[16px] border-[1.5px] border-river bg-white p-3.5">
      <p className="m-0 truncate text-[10px] font-extrabold uppercase tracking-[.14em] text-river" title={publication.location || 'Caucasia'}>{meta.join(' · ')}</p>
      <p className="mt-1 mb-2.5 font-sans text-[15px] font-bold leading-[1.25] tracking-[-.01em] text-ink">{publication.title}</p>
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={`#publicacion/${publication.id}`}
          onClick={onNavigate}
          className="inline-flex items-center gap-1.5 rounded-full bg-river py-1.5 px-3 text-[12px] font-bold text-white no-underline transition-colors duration-200 hover:bg-[#167585] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          Ver detalle <Icon name="arrow-right" className="size-3.5" strokeWidth={2} />
        </a>
        {slug && (
          <a
            href={`#categoria/${slug}`}
            onClick={onNavigate}
            className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(29,143,163,.3)] py-1.5 px-3 text-[12px] font-bold text-river no-underline transition-colors duration-200 hover:bg-[rgba(29,143,163,.08)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Ver categoría
          </a>
        )}
      </div>
    </div>
  );
}

// Chips de arranque: la misma pieza en la Brújula y en el chat vacío.
function StarterChips({ items, onPick }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={() => onPick(item)}
          className="cursor-pointer rounded-full border border-gold bg-[rgba(212,168,67,.12)] py-1.5 px-3 text-[12px] font-bold text-[#7a5c12] transition-colors duration-200 hover:bg-[rgba(212,168,67,.24)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export default function HiloAssistant({ publications = [], screen = '' }) {
  /** Si el panel de Hilo está abierto */
  const [open, setOpen] = useState(false);
  /** Vista del panel: el telar (destinos) o el Chat Turístico */
  const [view, setView] = useState('brujula');
  /** Pose actual de Hilo (imagen PNG) */
  const [pose, setPose] = useState('hilo-saluda.png');
  /** Mensaje actual de Hilo (el susurro del lanzador) */
  const [message, setMessage] = useState(`${getGreeting()}${whisperFor(screen)}`);
  /** Si el susurro está visible (se esconde solo a los 5 s) */
  const [whisperVisible, setWhisperVisible] = useState(true);
  /** Texto del input de búsqueda */
  const [input, setInput] = useState('');
  /** Historial de conversación (persistido en la sesión) */
  const [conversation, setConversation] = useState(loadConversation);
  /** Hilo está "escribiendo" su respuesta */
  const [typing, setTyping] = useState(false);
  /** Aviso breve de Hilo cuando reacciona con el panel abierto en el telar */
  const [reactionNote, setReactionNote] = useState('');
  /** Timestamp de la última interacción (para detectar idle) */
  const lastInteractionRef = useRef(Date.now());
  /** Si Hilo ya habló en idle durante esta sesión */
  const idleMessageRef = useRef(false);
  const chatEndRef = useRef(null);
  const firstScreenRef = useRef(true);
  const panelRef = useRef(null);
  const launcherRef = useRef(null);
  const typingTimerRef = useRef(null);
  const reactionTimerRef = useRef(null);

  /**
   * Detecta inactividad del usuario y Hilo reacciona una sola vez por sesión.
   * Si el usuario no hace nada por 60 segundos, Hilo dice algo.
   */
  useEffect(() => {
    const interval = setInterval(() => {
      if (open || idleMessageRef.current) return;
      if (document.visibilityState !== 'visible') return;
      const elapsed = Date.now() - lastInteractionRef.current;
      if (elapsed <= 60000) return;
      idleMessageRef.current = true;
      setMessage(pickRandom(REACTIVE_MESSAGES.idle));
      setPose('hilo-piensa.png');
      setTimeout(() => setPose('hilo-saluda.png'), 5200);
    }, 10000); // Revisar cada 10 segundos

    return () => clearInterval(interval);
  }, [open]);

  // Susurro contextual al cambiar de pantalla (el primero ya trae el saludo).
  useEffect(() => {
    if (firstScreenRef.current) { firstScreenRef.current = false; return; }
    setMessage(whisperFor(screen));
  }, [screen]);

  // Cada mensaje nuevo se muestra en el susurro y se esconde solo a los 5 s.
  useEffect(() => {
    if (!message || open) return undefined;
    setWhisperVisible(true);
    const timer = setTimeout(() => setWhisperVisible(false), WHISPER_MS);
    return () => clearTimeout(timer);
  }, [message, open]);

  // El chat baja solo al último mensaje (o al indicador de escritura).
  useEffect(() => {
    if (view === 'chat') chatEndRef.current?.scrollIntoView({ block: 'end' });
  }, [conversation, view, typing]);

  // Persistencia: la conversación sobrevive a un recargo de página.
  useEffect(() => {
    try {
      sessionStorage.setItem(CHAT_KEY, JSON.stringify(slimConversation(conversation)));
    } catch {
      // Si el navegador bloquea el storage, el chat sigue funcionando en memoria.
    }
  }, [conversation]);

  // Reacciones a acciones hechas fuera del panel (guardar, compartir).
  useEffect(() => onHiloReaction(({ kind }) => {
    const messages = REACTIVE_MESSAGES[kind];
    if (!messages) return;
    const text = pickRandom(messages);
    const nextPose = kind === 'favorite' ? 'hilo-celebra.png'
      : kind === 'share' ? 'hilo-teje.png'
        : kind === 'interest' ? 'hilo-senala.png'
          : 'hilo-lee.png';

    if (!open) {
      setMessage(text);
      setPose(nextPose);
      setTimeout(() => setPose('hilo-saluda.png'), 5200);
      return;
    }
    if (view === 'chat') {
      setConversation((current) => [...current, { type: 'hilo', text, pose: nextPose, follow: [] }]);
      return;
    }
    setReactionNote(text);
    clearTimeout(reactionTimerRef.current);
    reactionTimerRef.current = setTimeout(() => setReactionNote(''), 5000);
  }), [open, view]);

  // Escape cierra el panel y devuelve el foco al lanzador.
  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event) {
      if (event.key !== 'Escape') return;
      close();
      launcherRef.current?.focus();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  // Al abrir, el foco entra en el panel (lectores de pantalla y teclado).
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  // Limpieza de temporizadores al desmontar.
  useEffect(() => () => {
    clearTimeout(typingTimerRef.current);
    clearTimeout(reactionTimerRef.current);
  }, []);

  /**
   * Registra una interacción del usuario (resetea el timer de idle).
   */
  const recordInteraction = useCallback(() => {
    lastInteractionRef.current = Date.now();
  }, []);

  /**
   * Cierra el panel de Hilo.
   */
  function close() {
    setOpen(false);
    setView('brujula');
    setPose('hilo-saluda.png');
    setMessage('Aquí estaré cuando me necesites.');
  }

  /**
   * Lleva al usuario a una pantalla y cierra el panel.
   */
  function goTo(hash, nextPose) {
    recordInteraction();
    if (nextPose) setPose(nextPose);
    if (!NAVIGATES.includes(hash)) return;
    setOpen(false);
    setView('brujula');
    setMessage('Te traje hasta aquí. Sigue explorando.');
    window.location.hash = hash;
  }

  /**
   * Agrega al chat la pregunta del usuario y la respuesta de Hilo.
   * Hilo "piensa" un instante antes de responder, como un personaje.
   */
  function pushAnswer(userText, answer) {
    setView('chat');
    setTyping(true);
    setPose('hilo-piensa.png');
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      setTyping(false);
      setPose(answer.pose);
      setConversation((current) => [...current, { type: 'user', text: userText }, { type: 'hilo', ...answer }]);
      if (answer.publication && answer.celebrate) {
        setTimeout(() => {
          setPose('hilo-descubre.png');
          triggerConfetti();
        }, 300);
      }
    }, 650);
  }

  /**
   * Maneja el envío de un mensaje del Chat Turístico.
   */
  function sendMessage(event) {
    event.preventDefault();
    const text = input.trim();
    if (!text) return;
    recordInteraction();
    const intent = detectIntent(text);
    pushAnswer(text, intent ? answerIntent(intent, publications) : answerFreeText(text, publications));
    setInput('');
  }

  /**
   * Píldora de seguimiento: relanza una intención (mostrando otro resultado) o navega.
   */
  function follow(item, previous) {
    recordInteraction();
    if (item.hash) { goTo(item.hash, 'hilo-senala.png'); return; }
    // Búsqueda libre: abrir Explorar con el mismo texto en el hash.
    if (item.explore) {
      setOpen(false);
      setView('brujula');
      setMessage('Te dejo en Explorar con tu búsqueda.');
      window.location.hash = exploreHash({ q: item.explore }).replace('#', '');
      return;
    }

    if (item.freeText) {
      const offset = (item.offset ?? previous?.offset ?? 0) + 1;
      let answer = answerFreeText(item.freeText, publications, offset);
      // No repetir justo lo que se acaba de mostrar.
      if (answer.publication && answer.publication.id === previous?.publication?.id) {
        answer = answerFreeText(item.freeText, publications, offset + 1);
      }
      pushAnswer(item.label, answer);
      return;
    }

    const intent = INTENTS.find((candidate) => candidate.key === item.intent);
    if (!intent) return;
    let answer = answerIntent(intent, publications, previous?.intent === intent.key ? (previous.offset ?? 0) + 1 : 0);
    // No repetir justo lo que se acaba de mostrar (p. ej. "Ver más eventos" tras una comida).
    if (answer.publication && answer.publication.id === previous?.publication?.id) {
      answer = answerIntent(intent, publications, (answer.offset ?? 0) + 1);
    }
    pushAnswer(item.label, answer);
  }

  /**
   * Chip de arranque: navega o lanza una intención, igual que una píldora.
   */
  function runStarter(starter) {
    recordInteraction();
    if (starter.hash) { goTo(starter.hash, 'hilo-senala.png'); return; }
    if (starter.text) { pushAnswer(starter.label, answerFreeText(starter.text, publications)); return; }
    const intent = INTENTS.find((candidate) => candidate.key === starter.intent);
    if (intent) pushAnswer(starter.label, answerIntent(intent, publications));
  }

  /**
   * Vacía la conversación sin cerrar el panel.
   */
  function resetChat() {
    setConversation([]);
    try { sessionStorage.removeItem(CHAT_KEY); } catch { /* storage bloqueado */ }
    setTyping(false);
    setView('brujula');
    setPose('hilo-saluda.png');
  }

  /**
   * Mantiene el foco dentro del panel mientras está abierto (Tab / Shift+Tab).
   */
  function trapFocus(event) {
    if (event.key !== 'Tab' || !panelRef.current) return;
    const focusables = panelRef.current.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])');
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const whisperShown = !open && whisperVisible && message;
  const starters = startersFor(screen);

  return (
    <section
      // En el perfil de talento, en movil, sube por encima de su barra fija de "Contratar".
      className={`fixed right-[18px] z-70 font-sans max600:right-2 ${screen === 'talento-perfil' ? 'bottom-3 max768:bottom-[96px]' : 'bottom-[calc(var(--barra-inferior,0px)+12px)] max600:bottom-[calc(var(--barra-inferior,0px)+8px)]'}`}
      aria-label="Asistente virtual de TEJIDO"
    >
      {/* Lanzador: cápsula + Hilo a su derecha, y el susurro a la izquierda de ambos */}
      {!open && (
        <div className="relative flex items-end">
          {whisperShown && (
            <button
              type="button"
              className="absolute right-full bottom-1 mr-6 w-[min(250px,calc(100vw-236px))] cursor-pointer rounded-[20px] rounded-br-[6px] border-[1.5px] border-gold bg-[#fffdf8] py-3 px-4 text-left font-display text-[14px] italic leading-[1.35] text-ink [box-shadow:0_14px_34px_rgba(23,58,49,.16)] motion-safe:animate-[hilo-whisper_.35s_ease-out]"
              onClick={() => setWhisperVisible(false)}
              aria-label={`Hilo dice: ${message}. Tocar para ocultar`}
            >
              {message}
            </button>
          )}
          <button
            ref={launcherRef}
            className="group flex cursor-pointer items-end border-0 bg-transparent p-0"
            type="button"
            onClick={() => {
              setOpen(true);
              setView('brujula');
              setMessage('');
              setPose('hilo-saluda.png');
              recordInteraction();
            }}
            aria-label="Hablar con Hilo, guía de Caucasia"
          >
            <span className="mb-1.5 inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-ink py-2.5 pr-5 pl-4 text-[13px] font-bold text-white [box-shadow:0_10px_24px_rgba(23,58,49,.28)] transition-colors duration-200 group-hover:bg-ink-deep">
              <span className="relative flex size-2.5" aria-hidden="true">
                <span className="absolute inset-0 rounded-full bg-river opacity-60 motion-safe:animate-ping" />
                <span className="relative size-2.5 rounded-full bg-river" />
              </span>
              Habla con Hilo<span className="text-white/70 max600:hidden">· Guía de Caucasia</span>
            </span>
            <img
              className="relative z-1 -ml-4 h-[104px] w-[86px] object-contain [filter:drop-shadow(0_8px_10px_rgba(23,58,49,.2))] motion-safe:animate-[hilo-float_3.4s_ease-in-out_infinite] max600:-ml-3 max600:h-[80px] max600:w-[66px]"
              src={`/images/hilo/${pose}`}
              alt=""
              aria-hidden="true"
            />
          </button>
        </div>
      )}

      {/* Panel de conversación abierto */}
      {open && (
        <aside
          ref={panelRef}
          tabIndex={-1}
          onKeyDown={trapFocus}
          className="fixed bottom-[18px] right-[18px] flex flex-col h-[min(730px,calc(100dvh-36px))] w-[min(510px,calc(100vw-36px))] overflow-hidden bg-[#fffaf0] border border-[rgba(23,58,49,.14)] rounded-[32px] outline-none [box-shadow:0_30px_90px_rgba(23,58,49,.32)] max600:inset-1.5 max600:w-auto max600:rounded-[25px]"
          role="dialog"
          aria-modal="true"
          aria-label="Conversación con Hilo"
        >
          {/* Barra superior */}
          <div className="relative flex shrink-0 items-center gap-2 bg-ink py-2.5 pr-3 pl-4 text-white">
            {view === 'chat' ? (
              <button
                type="button"
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border-0 bg-[rgba(255,255,255,.14)] py-1.5 px-3 text-[12px] font-bold text-white hover:bg-[rgba(255,255,255,.24)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                onClick={() => { setView('brujula'); setPose('hilo-saluda.png'); }}
              >
                <Icon name="arrow-left" className="size-3.5" strokeWidth={2} /> Volver a Brújula
              </button>
            ) : (
              <>
                <span className="relative flex size-2 shrink-0" aria-hidden="true">
                  <span className="absolute inset-0 rounded-full bg-river opacity-60 motion-safe:animate-ping" />
                  <span className="relative size-2 rounded-full bg-river" />
                </span>
                <span className="min-w-0 flex-1 truncate text-[11px] font-extrabold uppercase tracking-[.13em] text-white/80">
                  Hilo está contigo · Descubre Caucasia
                </span>
              </>
            )}
            <button
              className="ml-auto grid size-9 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-[rgba(255,255,255,.16)] text-[20px] leading-none text-white hover:bg-[rgba(255,255,255,.28)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              type="button"
              onClick={close}
              aria-label="Cerrar asistente"
            >
              &times;
            </button>
          </div>

          {/* Telar: Hilo protagonista y los cuatro nudos conectados por hilos */}
          {view === 'brujula' ? (
            <div className="relative h-[352px] shrink-0 overflow-hidden bg-[linear-gradient(180deg,#cde5d5_0%,#e7efe2_72%,#f7f0e1_100%)] max600:h-[330px]">
              <svg className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                {/* Arco que une los cuatro nudos */}
                <path d="M4 22 C 18 6, 34 4, 50 4 C 66 4, 82 6, 96 22" fill="none" stroke="var(--gold)" strokeWidth="1.4" strokeDasharray="2.5 2.5" vectorEffect="non-scaling-stroke" opacity=".75" />
                {/* Hilos que nacen de la mano de Hilo */}
                <path d="M50 86 C 36 62, 20 44, 10 24" fill="none" stroke="var(--river)" strokeWidth="1" strokeDasharray="1.5 2.5" vectorEffect="non-scaling-stroke" opacity=".45" />
                <path d="M50 86 C 40 56, 36 30, 30 12" fill="none" stroke="var(--orange)" strokeWidth="1" strokeDasharray="1.5 2.5" vectorEffect="non-scaling-stroke" opacity=".4" />
                <path d="M50 86 C 60 56, 64 30, 70 12" fill="none" stroke="#276749" strokeWidth="1" strokeDasharray="1.5 2.5" vectorEffect="non-scaling-stroke" opacity=".35" />
                <path d="M50 86 C 64 62, 80 44, 90 24" fill="none" stroke="var(--gold)" strokeWidth="1" strokeDasharray="1.5 2.5" vectorEffect="non-scaling-stroke" opacity=".5" />
              </svg>

              {COMPASS.map(([key, label, sub, hash, icon, color, nextPose], index) => (
                <button
                  key={key}
                  type="button"
                  className={`group absolute z-[2] flex w-[92px] cursor-pointer flex-col items-center border-0 bg-transparent p-0 text-center max600:w-[76px] ${KNOT_POSITIONS[index]}`}
                  style={{ '--accent': color }}
                  title={sub}
                  aria-label={`${label}. ${sub}`}
                  onMouseEnter={() => setPose(nextPose)}
                  onFocus={() => setPose(nextPose)}
                  onMouseLeave={() => setPose('hilo-saluda.png')}
                  onBlur={() => setPose('hilo-saluda.png')}
                  onClick={() => goTo(hash, nextPose)}
                >
                  <span className="relative grid size-12 place-items-center rounded-full border-[1.5px] border-[var(--accent)] bg-[#fffdf8] text-[var(--accent)] [box-shadow:0_8px_18px_rgba(23,58,49,.12)] transition-transform duration-200 group-hover:-translate-y-1 group-focus-visible:-translate-y-1 max600:size-10">
                    <span className="absolute -inset-1 rounded-full border border-[var(--accent)] opacity-0 transition-opacity duration-200 group-hover:opacity-70 group-focus-visible:opacity-70" aria-hidden="true" />
                    <Icon name={icon} className="size-[22px] max600:size-5" strokeWidth={1.7} />
                  </span>
                  <span className="mt-1.5 text-[11px] font-extrabold leading-[1.15] text-ink max600:text-[10px]">{label}</span>
                </button>
              ))}

              <img
                className="absolute bottom-[62px] left-1/2 z-[1] h-[178px] w-[144px] -translate-x-1/2 object-contain [filter:drop-shadow(0_10px_12px_rgba(23,58,49,.18))] motion-safe:animate-[hilo-float_3.4s_ease-in-out_infinite] max600:bottom-[58px] max600:h-[146px] max600:w-[120px]"
                src={`/images/hilo/${pose}`}
                alt="Hilo, guía de TEJIDO"
              />

              <p className="absolute inset-x-4 bottom-3 z-[2] m-0 rounded-[16px] rounded-br-[5px] border-[1.5px] border-gold bg-[#fffdf8] py-2.5 px-4 text-center font-display text-[14px] italic leading-[1.3] text-ink [box-shadow:0_12px_26px_rgba(23,58,49,.14)] max600:text-[13px]">
                {getGreeting()}¿Qué quieres descubrir hoy?
              </p>
            </div>
          ) : (
            // En el chat, Hilo sigue presente en escritorio; en móvil cede el espacio.
            <div className="flex shrink-0 items-end gap-3 border-b border-b-[rgba(23,58,49,.1)] bg-[#cde5d5] px-5 pt-2 max600:hidden">
              <img
                className="h-[78px] w-[64px] shrink-0 object-contain object-bottom [filter:drop-shadow(0_8px_10px_rgba(23,58,49,.16))]"
                src={`/images/hilo/${pose}`}
                alt="Hilo, guía de TEJIDO"
              />
              <p className="m-0 pb-3 text-[13px] font-bold leading-[1.3] text-ink">
                Pregúntame por planes, comida, música o lugares.
              </p>
            </div>
          )}

          {/* Cuerpo: telar (chips) o Chat Turístico */}
          <div className="min-h-0 flex-1 overflow-auto bg-[#fffaf0] pt-4 px-[18px] pb-3">
            {view === 'brujula' ? (
              <div>
                <p className="m-0 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.16em] text-muted">
                  <span className="h-px flex-1 bg-line" aria-hidden="true" />
                  Hilo te sugiere
                  <span className="h-px flex-1 bg-line" aria-hidden="true" />
                </p>
                <div className="mt-2.5">
                  <StarterChips items={starters} onPick={runStarter} />
                </div>

                {reactionNote && (
                  <p className="mt-3 mb-0 rounded-[14px] border border-[rgba(29,143,163,.25)] bg-[rgba(29,143,163,.08)] py-2 px-3 font-display text-[13px] italic leading-[1.3] text-ink motion-safe:animate-[hilo-whisper_.35s_ease-out]" aria-live="polite">
                    {reactionNote}
                  </p>
                )}

                <div className="mt-3.5 flex flex-wrap gap-2">
                  {SECONDARY.map(([label, hash, icon, nextPose]) => (
                    <button
                      key={hash}
                      type="button"
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[rgba(138,79,125,.25)] bg-cream py-2 px-3.5 text-[12px] font-bold text-purple transition-colors duration-200 hover:border-purple focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                      onClick={() => goTo(hash, nextPose)}
                    >
                      <Icon name={icon} className="size-3.5" strokeWidth={1.8} /> {label}
                    </button>
                  ))}
                </div>

                <p className="mt-5 mb-0 text-center font-display text-[12px] italic leading-[1.35] text-muted">
                  Cada conversación teje un hilo nuevo en el Bajo Cauca.
                </p>
              </div>
            ) : (
              <div aria-live="polite" role="log" aria-label="Conversación con Hilo">
                {conversation.length === 0 && !typing && (
                  <div className="mb-3">
                    <p className="m-0 mb-2.5 text-[13px] text-muted">Escribe abajo o empieza con una idea:</p>
                    <StarterChips items={starters} onPick={runStarter} />
                  </div>
                )}
                {conversation.length > 0 && (
                  <div className="mb-2 flex justify-end">
                    <button
                      type="button"
                      className="cursor-pointer border-0 bg-transparent p-0 text-[11px] font-bold text-muted underline underline-offset-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                      onClick={resetChat}
                    >
                      Empezar de nuevo
                    </button>
                  </div>
                )}
                {conversation.map((item, index) => (item.type === 'user' ? (
                  <p key={index} className="mt-0 mb-2.5 ml-auto max-w-[85%] w-fit rounded-[16px] rounded-br-[5px] bg-ink py-2.5 px-[13px] text-[13px] leading-[1.45] text-white">{item.text}</p>
                ) : (
                  <div key={index} className="mb-3.5 flex items-start gap-2">
                    <img className="mt-0.5 h-10 w-[34px] shrink-0 object-contain object-top" src={`/images/hilo/${item.pose}`} alt="" aria-hidden="true" />
                    <div className="min-w-0 max-w-[85%]">
                      <p className="m-0 rounded-[16px] rounded-tl-[5px] border border-line bg-white py-2.5 px-[13px] text-[13px] leading-[1.45] text-ink">{item.text}</p>
                      {item.publication && <HiloMiniCard publication={item.publication} onNavigate={() => { recordInteraction(); setOpen(false); setView('brujula'); }} />}
                      {!typing && index === conversation.length - 1 && item.follow?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {item.follow.map((pill) => (
                            <button key={pill.label} type="button" className="cursor-pointer rounded-full border border-gold bg-[rgba(212,168,67,.12)] py-1.5 px-3 text-[12px] font-bold text-[#7a5c12] transition-colors duration-200 hover:bg-[rgba(212,168,67,.24)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink" onClick={() => follow(pill, item)}>
                              {pill.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )))}
                {typing && (
                  <div className="mb-3.5 flex items-start gap-2" aria-label="Hilo está escribiendo">
                    <img className="mt-0.5 h-10 w-[34px] shrink-0 object-contain object-top" src="/images/hilo/hilo-piensa.png" alt="" aria-hidden="true" />
                    <div className="flex items-center gap-1.5 rounded-[16px] rounded-tl-[5px] border border-line bg-white py-3 px-[13px]">
                      <span className="size-1.5 rounded-full bg-muted motion-safe:animate-bounce" />
                      <span className="size-1.5 rounded-full bg-muted motion-safe:animate-bounce [animation-delay:.15s]" />
                      <span className="size-1.5 rounded-full bg-muted motion-safe:animate-bounce [animation-delay:.3s]" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            )}
          </div>

          {/* Chat Turístico: al tocarlo, el panel pasa a la vista de conversación */}
          <form className="flex shrink-0 gap-2 bg-[#fffaf0] border-t border-t-line pt-3 px-4 pb-4" onSubmit={sendMessage}>
            <label className="sr-only" htmlFor="hilo-input">
              Chat Turístico: pregúntale a Hilo
            </label>
            <input
              className="flex-1 min-w-0 bg-white border border-line rounded-[999px] font-sans text-[16px] outline-0 py-[13px] px-5 focus:border-ink"
              id="hilo-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => setView('chat')}
              placeholder="Chat Turístico: ¿qué buscas?"
              autoComplete="off"
            />
            <button className="grid h-12 w-12 shrink-0 cursor-pointer place-items-center bg-ink border-0 rounded-[50%] text-white transition-colors duration-200 hover:bg-ink-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink" type="submit" aria-label="Enviar">
              <Icon name="send" className="size-5" strokeWidth={1.8} />
            </button>
          </form>
        </aside>
      )}
    </section>
  );
}
