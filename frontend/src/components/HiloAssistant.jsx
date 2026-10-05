/**
 * HILOASSISTANT.JSX — Asistente Virtual con Personalidad
 *
 * Hilo es el guía virtual de TEJIDO. No es solo un botón — es un compañero
 * que reacciona a lo que haces en la plataforma.
 *
 * Estructura (rediseño 2026-10):
 * - Lanzador compacto: cápsula tinta "Habla con Hilo · Guía de Caucasia" (punto río de
 *   "activo") con Hilo a su derecha. A su izquierda, un susurro contextual según la pantalla
 *   (prop `screen`) que se esconde solo a los 5 s.
 * - Panel abierto, en tres capas: Hilo protagonista (ilustración completa, sin recorte),
 *   la Brújula (4 destinos en 2x2 + 2 píldoras secundarias) y el Chat Turístico, que va en
 *   su propia vista con "← Volver a Brújula".
 * - Chat Turístico: reglas por palabras clave contra las publicaciones reales (prop
 *   `publications`), sin IA ni API externa. Si encuentra algo responde con una mini-tarjeta
 *   y píldoras de seguimiento; si no, lo dice sin inventar.
 *
 * Personalidad (sin cambios): saludo según la hora, confeti al descubrir algo, poses que
 * cambian con el contexto y un mensaje si el usuario lleva un rato inactivo.
 *
 * Poses de Hilo (imágenes PNG en /images/hilo/): saluda, senala, lee, piensa, explica,
 * celebra, sorprendido, descubre, teje.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import Icon from './Icon.jsx';
import { CULTURAL_CATEGORIES, KIND_LABELS } from '../utils/constants.js';

const SLUG_BY_CATEGORY = Object.fromEntries(CULTURAL_CATEGORIES.map(([key, , slug]) => [key, slug]));
const LABEL_BY_CATEGORY = Object.fromEntries(CULTURAL_CATEGORIES.map(([key, label]) => [key, label]));
const WHISPER_MS = 5000;

/**
 * Brújula: los 4 destinos principales (2x2). [clave, etiqueta, apoyo, hash, icono, color, pose]
 */
const COMPASS = [
  ['mapa', 'Recorrer Caucasia', 'El mapa vivo', 'mapa', 'compass', 'var(--river)', 'hilo-senala.png'],
  ['plan', 'Encontrar un plan', 'Eventos y agenda', 'agenda', 'calendar', 'var(--orange)', 'hilo-descubre.png'],
  ['gente', 'Conocer gente y talento', 'Quiénes mueven el territorio', 'talento', 'people', '#276749', 'hilo-saluda.png'],
  ['oportunidades', 'Convocatorias', 'Oportunidades abiertas', 'oportunidades', 'seal', '#b8860b', 'hilo-celebra.png'],
];
// Acciones secundarias, más discretas que la Brújula. [etiqueta, hash, icono, pose]
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
    'Added a tu colección. No se te va a olvidar.',
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
const normalize = (value) => String(value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
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
    words: ['comer', 'comida', 'restaurante', 'gastronomia', 'gastronomico', 'hambre', 'cocina', 'almorzar', 'cenar', 'desayunar'],
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

function detectIntent(text) {
  const normalized = ` ${normalize(text).replace(/[^a-z0-9ñ ]+/g, ' ')} `;
  return INTENTS.find((intent) => intent.words.some((word) => normalized.includes(` ${word} `)));
}

// Devuelve { text, publication?, follow, pose } para un intento (offset = "ver otro").
function answerIntent(intent, publications, offset = 0) {
  const results = publications.filter(intent.filter);
  if (intent.sort) results.sort(intent.sort);
  if (!results.length) return { text: NOT_FOUND, follow: [FOLLOW.mapa, FOLLOW.agenda], pose: 'hilo-piensa.png' };
  const publication = results[offset % results.length];
  return { text: intent.say(publication, results.length - 1), publication, follow: intent.follow, pose: 'hilo-descubre.png', intent: intent.key, offset };
}

function answerFreeText(text, publications) {
  const normalized = normalize(text);
  const found = publications.find((pub) => normalize([pub.title, pub.summary, pub.location, pub.kind].filter(Boolean).join(' ')).includes(normalized));
  if (!found) return { text: NOT_FOUND, follow: [FOLLOW.mapa, FOLLOW.agenda], pose: 'hilo-piensa.png' };
  return { text: `¡Encontré algo! "${found.title}" — ${found.location || 'Caucasia'}`, publication: found, follow: FREE_SEARCH_FOLLOW, pose: 'hilo-sorprendido.png' };
}

/**
 * Mini-tarjeta de una publicación dentro del chat. No hay página de detalle individual:
 * "Ver lugar" lleva a su categoría cultural, o a Explorar si no tiene.
 */
function HiloMiniCard({ publication, onNavigate }) {
  const slug = SLUG_BY_CATEGORY[publication.cultural_category];
  const meta = [LABEL_BY_CATEGORY[publication.cultural_category] || KIND_LABELS[publication.kind], publication.location || 'Caucasia'].filter(Boolean);
  return (
    <div className="mt-2 rounded-[16px] border-[1.5px] border-river bg-white p-3.5">
      <p className="m-0 text-[10px] font-extrabold uppercase tracking-[.14em] text-river">{meta.join(' · ')}</p>
      <p className="mt-1 mb-2.5 font-sans text-[15px] font-bold leading-[1.25] tracking-[-.01em] text-ink">{publication.title}</p>
      <a
        href={slug ? `#categoria/${slug}` : '#explorar'}
        onClick={onNavigate}
        className="inline-flex items-center gap-1.5 rounded-full bg-river py-1.5 px-3 text-[12px] font-bold text-white no-underline transition-colors duration-200 hover:bg-[#167585] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        Ver lugar <Icon name="arrow-right" className="size-3.5" strokeWidth={2} />
      </a>
    </div>
  );
}

export default function HiloAssistant({ publications = [], screen = '' }) {
  /** Si el panel de Hilo está abierto */
  const [open, setOpen] = useState(false);
  /** Vista del panel: la Brújula (destinos) o el Chat Turístico */
  const [view, setView] = useState('brujula');
  /** Pose actual de Hilo (imagen PNG) */
  const [pose, setPose] = useState('hilo-saluda.png');
  /** Mensaje actual de Hilo (el susurro del lanzador) */
  const [message, setMessage] = useState(`${getGreeting()}${whisperFor(screen)}`);
  /** Si el susurro está visible (se esconde solo a los 5 s) */
  const [whisperVisible, setWhisperVisible] = useState(true);
  /** Texto del input de búsqueda */
  const [input, setInput] = useState('');
  /** Historial de conversación */
  const [conversation, setConversation] = useState([]);
  /** Contador de interacciones del usuario */
  const [interactions, setInteractions] = useState(0);
  /** Timestamp de la última interacción (para detectar idle) */
  const lastInteractionRef = useRef(Date.now());
  /** Flag para saber si Hilo ya habló en idle */
  const idleMessageRef = useRef(false);
  const chatEndRef = useRef(null);
  const firstScreenRef = useRef(true);

  /**
   * Detecta inactividad del usuario y Hilo reacciona.
   * Si el usuario no hace nada por 60 segundos, Hilo dice algo.
   */
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - lastInteractionRef.current;
      if (elapsed > 60000 && !idleMessageRef.current && !open) {
        setMessage(pickRandom(REACTIVE_MESSAGES.idle));
        setPose('hilo-piensa.png');
        idleMessageRef.current = true;
      }
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

  // El chat baja solo al último mensaje.
  useEffect(() => {
    if (view === 'chat') chatEndRef.current?.scrollIntoView({ block: 'end' });
  }, [conversation, view]);

  /**
   * Registra una interacción del usuario (resetea el timer de idle).
   */
  const recordInteraction = useCallback(() => {
    lastInteractionRef.current = Date.now();
    idleMessageRef.current = false;
    setInteractions((prev) => prev + 1);
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
   */
  function reply(userText, answer) {
    setView('chat');
    setPose(answer.pose);
    setConversation((current) => [...current, { type: 'user', text: userText }, { type: 'hilo', ...answer }]);
    if (answer.publication) {
      // Encontró algo: Hilo celebra con confeti, como antes.
      setTimeout(() => {
        setPose('hilo-descubre.png');
        triggerConfetti();
      }, 800);
    }
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
    reply(text, intent ? answerIntent(intent, publications) : answerFreeText(text, publications));
    setInput('');
  }

  /**
   * Píldora de seguimiento: relanza una intención (mostrando otro resultado) o navega.
   */
  function follow(item, previous) {
    if (item.hash) { goTo(item.hash, 'hilo-senala.png'); return; }
    recordInteraction();
    const intent = INTENTS.find((candidate) => candidate.key === item.intent);
    let answer = answerIntent(intent, publications, previous?.intent === intent.key ? previous.offset + 1 : 0);
    // No repetir justo lo que se acaba de mostrar (p. ej. "Ver más eventos" tras una comida).
    if (answer.publication && answer.publication.id === previous?.publication?.id) {
      answer = answerIntent(intent, publications, answer.offset + 1);
    }
    reply(item.label, answer);
  }

  const whisperShown = !open && whisperVisible && message;

  return (
    <section
      className="fixed bottom-3 right-[18px] z-70 font-sans max600:bottom-2 max600:right-2"
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
            className="group flex cursor-pointer items-end border-0 bg-transparent p-0"
            type="button"
            onClick={() => {
              setOpen(true);
              setView('brujula');
              setMessage('');
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
        <aside className="fixed bottom-[18px] right-[18px] flex flex-col h-[min(730px,calc(100dvh-36px))] w-[min(510px,calc(100vw-36px))] overflow-hidden bg-[#fffaf0] border border-[rgba(23,58,49,.14)] rounded-[32px] [box-shadow:0_30px_90px_rgba(23,58,49,.32)] max600:inset-1.5 max600:w-auto max600:rounded-[25px]" role="dialog" aria-label="Conversación con Hilo">
          {/* Barra superior */}
          <div className="relative flex shrink-0 items-center min-h-14 overflow-hidden whitespace-nowrap bg-ink text-white text-[12px] font-bold py-3 pr-[62px] pl-5">
            {view === 'chat' ? (
              <button type="button" className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border-0 bg-[rgba(255,255,255,.14)] py-1.5 px-3 text-[12px] font-bold text-white hover:bg-[rgba(255,255,255,.24)]" onClick={() => { setView('brujula'); setPose('hilo-saluda.png'); }}>
                <Icon name="arrow-left" className="size-3.5" strokeWidth={2} /> Volver a Brújula
              </button>
            ) : (
              <span className="overflow-hidden text-ellipsis">HILO ESTÁ CONTIGO · Una conversación para descubrir Caucasia</span>
            )}
            <button className="absolute right-[13px] top-2 h-10 w-10 cursor-pointer bg-[rgba(255,255,255,.16)] border-0 rounded-[50%] text-white text-[22px]" type="button" onClick={close} aria-label="Cerrar asistente">
              &times;
            </button>
          </div>

          {/* Hilo protagonista: ilustración completa, sin recorte, junto al saludo */}
          <div className={`flex shrink-0 items-end gap-4 border-b border-b-[rgba(23,58,49,.1)] bg-[#cde5d5] px-5 pt-3 ${view === 'chat' ? 'max600:hidden' : ''}`}>
            <img
              className={`shrink-0 object-contain object-bottom [filter:drop-shadow(0_10px_12px_rgba(23,58,49,.18))] ${view === 'chat' ? 'h-[84px] w-[70px]' : 'h-[132px] w-[108px] max600:h-[112px] max600:w-[92px]'}`}
              src={`/images/hilo/${pose}`}
              alt="Hilo, guía de TEJIDO"
            />
            <p className="m-0 pb-4 text-[17px] font-bold leading-[1.3] text-ink max600:text-[15px]">
              {view === 'chat' ? 'Pregúntame por planes, comida, música o lugares.' : `${getGreeting()}Cuéntame qué quieres hacer hoy en Caucasia.`}
            </p>
          </div>

          {/* Brújula (2x2 + secundarias) o Chat Turístico */}
          <div className="min-h-0 flex-1 overflow-auto bg-[linear-gradient(180deg,#fffaf0,#f6eddd)] pt-4 px-[18px] pb-3">
            {view === 'brujula' ? (
              // div con role, no <nav>: el CSS legado oculta la etiqueta nav por debajo de 800 px.
              <div role="navigation" aria-label="Brújula de Hilo">
                <div className="grid grid-cols-2 gap-3">
                  {COMPASS.map(([key, label, sub, hash, icon, color, nextPose]) => (
                    <button
                      key={key}
                      type="button"
                      className="group relative flex min-h-[112px] cursor-pointer flex-col items-start gap-2 overflow-hidden rounded-[18px] border border-[rgba(23,58,49,.1)] bg-white p-4 text-left transition-[border-color,box-shadow,translate] duration-200 hover:border-[var(--accent)] hover:[box-shadow:0_14px_30px_rgba(18,60,52,.12)] motion-safe:hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink max600:min-h-[104px] max600:p-3.5"
                      style={{ '--accent': color }}
                      onMouseEnter={() => setPose(nextPose)}
                      onClick={() => goTo(hash, nextPose)}
                    >
                      <span className="absolute inset-x-0 top-0 h-1 bg-[var(--accent)]" aria-hidden="true" />
                      <span className="grid size-10 place-items-center rounded-full bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)]">
                        <Icon name={icon} className="size-[22px]" strokeWidth={1.7} />
                      </span>
                      <span className="text-[14px] font-extrabold leading-[1.2] text-ink max600:text-[13px]">{label}</span>
                      <span className="-mt-1 text-[12px] font-medium leading-[1.25] text-muted">{sub}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
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
              </div>
            ) : (
              <div aria-live="polite">
                {conversation.length === 0 && (
                  <p className="m-0 mb-3 text-[13px] text-muted">Escribe abajo, por ejemplo: «¿dónde comer?», «¿qué hay esta noche?» o «música».</p>
                )}
                {conversation.map((item, index) => (item.type === 'user' ? (
                  <p key={index} className="mt-0 mb-2.5 ml-auto max-w-[85%] w-fit rounded-[16px] rounded-br-[5px] bg-ink py-2.5 px-[13px] text-[13px] leading-[1.45] text-white">{item.text}</p>
                ) : (
                  <div key={index} className="mb-3.5 flex items-start gap-2">
                    <img className="mt-0.5 h-10 w-[34px] shrink-0 object-contain object-top" src={`/images/hilo/${item.pose}`} alt="" aria-hidden="true" />
                    <div className="min-w-0 max-w-[85%]">
                      <p className="m-0 rounded-[16px] rounded-tl-[5px] border border-line bg-white py-2.5 px-[13px] text-[13px] leading-[1.45] text-ink">{item.text}</p>
                      {item.publication && <HiloMiniCard publication={item.publication} onNavigate={() => { recordInteraction(); setOpen(false); setView('brujula'); }} />}
                      {index === conversation.length - 1 && item.follow?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {item.follow.map((pill) => (
                            <button key={pill.label} type="button" className="cursor-pointer rounded-full border border-gold bg-[rgba(212,168,67,.12)] py-1.5 px-3 text-[12px] font-bold text-[#7a5c12] transition-colors duration-200 hover:bg-[rgba(212,168,67,.24)]" onClick={() => follow(pill, item)}>
                              {pill.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )))}
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
              className="flex-1 min-w-0 bg-white border border-line rounded-[999px] font-sans text-[15px] outline-0 py-[13px] px-5 focus:border-ink"
              id="hilo-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => setView('chat')}
              placeholder="Chat Turístico: ¿qué buscas?"
              autoComplete="off"
            />
            <button className="grid h-12 w-12 shrink-0 cursor-pointer place-items-center bg-ink border-0 rounded-[50%] text-white" type="submit" aria-label="Enviar">
              <Icon name="send" className="size-5" strokeWidth={1.8} />
            </button>
          </form>
        </aside>
      )}
    </section>
  );
}
