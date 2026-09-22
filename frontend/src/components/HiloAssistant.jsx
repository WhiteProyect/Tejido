/**
 * HILOASSISTANT.JSX — Asistente Virtual con Personalidad
 *
 * Hilo es el guía virtual de TEJIDO. No es solo un botón — es un compañero
 * que reacciona a lo que haces en la plataforma.
 *
 * Características de personalidad:
 * - Cambia de pose según el contexto y las acciones del usuario
 * - Saluda según la hora del día ("Buenos días", "Buenas tardes")
 * - Celebra cuando el usuario comparte contenido (confeti)
 * - Se sorprende al descubrir cosas nuevas
 * - Se pone a pensar cuando no encuentra algo
 * - Reacciona a la navegación entre pantallas
 *
 * Poses de Hilo (imágenes PNG en /images/hilo/):
 * - saluda: saludo inicial
 * - senala: señalando algo
 * - lee: leyendo
 * - piensa: pensando
 * - explica: explicando
 * - celebra: celebrando
 * - sorprendido: sorpresa
 * - descubre: descubriendo algo
 * - teje: tejiendo (construyendo)
 *
 * Parte de la FASE 4 del plan de magia.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Acciones disponibles para Hilo.
 * Cada acción tiene: key, emoji, label, sublabel, navegación, pose de Hilo
 */
// Colores de cada tarjeta de Hilo (legado: .hilo-card-<clave>): la franja de arriba
// (::before) y el fondo del arte. Se pasan como variables CSS, igual que antes.
const CARD_COLORS = {
  gente: '[--card-accent:#cde5d5] [--card-art-bg:#e7f1d0]',
  plan: '[--card-accent:#f6dfae] [--card-art-bg:#fff2c9]',
  feedback: '[--card-accent:#e8d8e7] [--card-art-bg:#f3e4c8]',
  mapa: '[--card-accent:#c7e3e7] [--card-art-bg:#e1f1e5]',
  oportunidades: '[--card-accent:#f4d0b8] [--card-art-bg:#ffe5bf]',
  buscar: '[--card-accent:#dce7d1] [--card-art-bg:#eff4db]',
  ajustes: '[--card-accent:#ddd5c7] [--card-art-bg:#f3e4c8]',
  guardado: '[--card-accent:#d8e4ef] [--card-art-bg:#eaf0f4]',
  red: '[--card-accent:#d9c8eb] [--card-art-bg:#efe4f3]',
};
const CARD = "relative flex flex-col items-center gap-2 min-h-[136px] overflow-hidden bg-white border border-[rgba(23,58,49,.08)] rounded-[18px] cursor-pointer pt-2.5 px-2 pb-3.5 text-center transition-[border-color,box-shadow,transform] duration-[180ms] ease-[ease] hover:border-ink hover:[box-shadow:0_18px_35px_rgba(18,60,52,.12)] hover:[transform:translateY(-4px)] max600:py-3.5 max600:px-2 before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-14 before:bg-[var(--card-accent,#cde5d5)]";
const MESSAGE = 'rounded-[16px] text-[12px] leading-[1.45] mt-0 mx-0 mb-2.5 max-w-[88%] py-2.5 px-[13px]';
const BUBBLE = "absolute bottom-[134px] left-1/2 [transform:translateX(-50%)] w-[min(240px,46vw)] bg-[#fffdf8] border border-[rgba(23,58,49,.15)] rounded-[22px] [box-shadow:0_14px_34px_rgba(23,58,49,.18)] text-ink text-[13px] font-extrabold leading-[1.35] py-[13px] px-4 after:content-[''] after:absolute after:-bottom-2.5 after:left-1/2 after:h-5 after:w-5 after:bg-[#fffdf8] after:border-r after:border-t after:border-[rgba(23,58,49,.15)] after:[transform:translateX(-50%)_rotate(135deg)]";

const OPTIONS = [
  ['gente', '\uD83D\uDC65', 'Conocer gente', 'Talentos locales', 'talento', 'hilo-saluda.png'],
  ['plan', '\uD83D\uDCC5', 'Encontrar un plan', 'Eventos para hoy', 'agenda', 'hilo-descubre.png'],
  ['feedback', '\uD83D\uDCD6', 'Sugerencias', 'Dar feedback', 'sugerencia', 'hilo-explica.png'],
  ['mapa', '\uD83D\uDCCD', 'Recorrer Caucasia', 'Explorar el mapa', 'mapa', 'hilo-senala.png'],
  ['oportunidades', '\uD83D\uDCE2', 'Convocatorias', 'Ver oportunidades', 'oportunidades', 'hilo-celebra.png'],
  ['buscar', '\uD83D\uDD0D', 'Buscar algo', 'Descubrir', 'buscar', 'hilo-descubre.png'],
  ['ajustes', '\u2699\uFE0F', 'Ajustes', 'Configurar', 'ajustes', 'hilo-piensa.png'],
  ['guardado', '\uD83D\uDCE6', 'Mis cosas', 'Ver guardado', 'guardadas', 'hilo-lee.png'],
  ['red', '\uD83C\uDF10', 'Red social', 'Conectar', 'red', 'hilo-teje.png'],
];

/**
 * Respuestas estáticas de Hilo para acciones que no navegan.
 */
const ANSWERS = {
  sugerencia: 'Este es el buzón de atención de TEJIDO. Escribe una sugerencia, felicitación o dificultad.',
  buscar: 'Escribe lo que buscas en el campo de abajo y lo encontraré entre los hilos de Caucasia.',
  ajustes: 'Los ajustes de usuario estarán disponibles en tu perfil.',
  red: 'La red social de TEJIDO está en construcción. Pronto podrás conectar con la comunidad.',
};

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

export default function HiloAssistant({ publications = [] }) {
  /** Si el panel de Hilo está abierto */
  const [open, setOpen] = useState(false);
  /** Pose actual de Hilo (imagen PNG) */
  const [pose, setPose] = useState('hilo-saluda.png');
  /** Mensaje actual de Hilo */
  const [message, setMessage] = useState(`${getGreeting()}¿Te ayudo a descubrir Caucasia?`);
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
    setPose('hilo-saluda.png');
    setMessage('Aquí estaré cuando me necesites.');
  }

  /**
   * Ejecuta una acción seleccionada por el usuario.
   * Navega a la pantalla correspondiente o muestra una respuesta.
   */
  function runAction(action, label, nextPose) {
    recordInteraction();
    setPose(nextPose);
    setConversation([{ type: 'user', text: label }]);

    // Acciones que navegan a otra pantalla
    if (['mapa', 'agenda', 'oportunidades', 'talento', 'guardadas'].includes(action)) {
      setMessage('Te traje hasta aquí. Sigue explorando.');
      window.location.hash = action;
      setOpen(false);
      return;
    }

    // Feedback: confeti + pose especial
    if (action === 'sugerencia') {
      setPose('hilo-celebra.png');
      triggerConfetti();
    }

    setMessage(ANSWERS[action] || 'Cuéntame qué quieres hacer en TEJIDO.');
  }

  /**
   * Maneja el envío de un mensaje de búsqueda.
   * Busca en las publicaciones y reacciona con la pose correspondiente.
   */
  function sendMessage(event) {
    event.preventDefault();
    const text = input.trim();
    if (!text) return;

    recordInteraction();
    const normalized = text.toLowerCase();

    // Buscar coincidencia en publicaciones
    const found = publications.find((item) =>
      [item.title, item.summary, item.location, item.kind]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalized)
    );

    // Agregar mensaje del usuario al historial
    setConversation((current) => [...current, { type: 'user', text }]);

    if (found) {
      // Encontró: Hilo se sorprende y muestra confeti
      setPose('hilo-sorprendido.png');
      setMessage(`¡Encontré algo! "${found.title}" — ${found.location || 'Caucasia'}`);
      // Breve confeti de celebración
      setTimeout(() => {
        setPose('hilo-descubre.png');
        triggerConfetti();
      }, 800);
    } else {
      // No encontró: Hilo se pone a pensar
      setPose('hilo-piensa.png');
      setMessage('No encontré nada con eso. Prueba con otro nombre, evento o lugar del Bajo Cauca.');
    }

    setInput('');
  }

  /**
   * Maneja hover sobre las tarjetas de acción.
   * Hilo cambia de pose según la tarjeta.
   */
  function handleCardHover(nextPose) {
    setPose(nextPose);
  }

  return (
    <section
      className="fixed bottom-3 right-[18px] z-70 font-sans max600:bottom-1 max600:right-1"
      aria-label="Asistente virtual de TEJIDO"
    >
      {/* Burbuja de mensaje cuando el panel está cerrado */}
      {!open && (
        <div className={BUBBLE}>{message}</div>
      )}

      {/* Botón flotante de Hilo */}
      {!open && (
        <button
          className="group relative grid [align-items:end] justify-items-center h-[166px] w-[136px] p-0 bg-transparent border-0 [filter:drop-shadow(0_14px_14px_rgba(23,58,49,.22))]"
          type="button"
          onClick={() => {
            setOpen(true);
            setMessage('');
            recordInteraction();
          }}
          aria-label="Hablar con Hilo"
        >
          <img
            className="block h-[152px] w-[118px] object-contain bg-transparent [filter:drop-shadow(0_10px_14px_rgba(23,58,49,.18))] animate-[hilo-float_3.4s_ease-in-out_infinite] group-hover:[filter:drop-shadow(0_12px_18px_rgba(23,58,49,.22))_saturate(1.08)] group-hover:[transform:translateY(-5px)_scale(1.04)]"
            src={`/images/hilo/${pose}`}
            alt="Hilo, asistente virtual de TEJIDO"
          />
          <span className="absolute bottom-0 left-1/2 [transform:translateX(-50%)] whitespace-nowrap bg-ink rounded-[999px] [box-shadow:0_8px_18px_rgba(23,58,49,.25)] text-white text-[11px] font-black py-[7px] px-[13px]">Habla con Hilo</span>
        </button>
      )}

      {/* Panel de conversación abierto */}
      {open && (
        <aside className="fixed bottom-[18px] right-[18px] grid grid-rows-[auto_auto_1fr_auto] h-[min(730px,calc(100dvh-36px))] w-[min(510px,calc(100vw-36px))] overflow-hidden bg-[#fffaf0] border border-[rgba(23,58,49,.14)] rounded-[32px] [box-shadow:0_30px_90px_rgba(23,58,49,.32)] max600:inset-1.5 max600:w-auto max600:rounded-[25px]" role="dialog" aria-label="Conversación con Hilo">
          {/* Barra superior */}
          <div className="relative flex items-center min-h-14 overflow-hidden whitespace-nowrap bg-ink text-white text-[12px] font-bold py-3 pr-[62px] pl-5">
            <span className="overflow-hidden text-ellipsis">HILO ESTÁ CONTIGO | Una conversación para descubrir Caucasia</span>
            <button className="absolute right-[13px] top-2.5 h-10 w-10 bg-[rgba(255,255,255,.16)] border-0 rounded-[50%] text-white text-[22px]" type="button" onClick={close} aria-label="Cerrar asistente">
              &times;
            </button>
          </div>

          {/* Escena del avatar con saludo contextual */}
          <div className="flex items-center gap-[18px] py-5 px-[18px] bg-[linear-gradient(145deg,#cde5d5_0_48%,#f6dfae_100%)] border-b border-b-[rgba(23,58,49,.1)] max600:gap-3.5 max600:p-4">
            <div className="flex items-center justify-center shrink-0 h-[92px] w-[92px] overflow-hidden bg-[rgba(255,255,255,.35)] border-2 border-solid border-[rgba(23,58,49,.08)] rounded-[50%] [box-shadow:0_8px_18px_rgba(23,58,49,.12)] max600:h-[72px] max600:w-[72px]">
              <img
                className="h-full w-full object-contain bg-transparent"
                src={`/images/hilo/${pose}`}
                alt="Hilo, guía de TEJIDO"
              />
            </div>
            <p className="text-ink text-[17px] font-bold leading-[1.3] m-0 max600:text-[15px]">
              {getGreeting()}Cuéntame qué quieres hacer hoy en Caucasia.
            </p>
          </div>

          {/* Área de contenido: mensajes + tarjetas de acción */}
          <div className="min-h-0 overflow-auto bg-[linear-gradient(180deg,#fffaf0,#f6eddd)] pt-4 px-[18px] pb-3">
            {/* Historial de conversación */}
            {conversation.map((item, index) => (
              <p
                className={`${MESSAGE} ${item.type === 'user' ? 'bg-ink rounded-br-[5px] text-white ml-auto' : 'bg-white border border-line rounded-bl-[5px]'}`}
                key={`${item.text}-${index}`}
              >
                {item.text}
              </p>
            ))}

            {/* Grid de acciones */}
            <div className="grid gap-3 grid-cols-[repeat(3,1fr)] max400:grid-cols-[repeat(2,1fr)]">
              {OPTIONS.map(([key, icon, label, sub, action, nextPose]) => (
                <button
                  className={`${CARD} ${CARD_COLORS[key]}`}
                  type="button"
                  key={key}
                  onMouseEnter={() => handleCardHover(nextPose)}
                  onClick={() => runAction(action, label, nextPose)}
                >
                  <span className="relative z-1 flex [align-items:end] justify-center h-[60px] w-[60px] mt-2 overflow-hidden bg-[var(--card-art-bg,#f6dfae)] border-[3px] border-solid border-[rgba(255,255,255,.86)] rounded-[38%_62%_57%_43%/42%_48%_52%_58%]">
                    <img className="h-[86px] w-[72px] object-contain object-[center_bottom]" src={`/images/hilo/${nextPose}`} alt="" aria-hidden="true" />
                  </span>
                  <span className="absolute right-[9px] top-[9px] z-2 grid items-center justify-center h-[30px] w-[30px] bg-yellow rounded-[50%] text-[17px]">{icon}</span>
                  <span className="text-ink text-[12px] font-extrabold leading-[1.15] mt-1">{label}</span>
                  <span className="text-muted text-[9px] font-semibold leading-[1.2]">{sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Formulario de búsqueda */}
          <form className="flex gap-2 bg-[#fffaf0] border-t border-t-line pt-3 px-4 pb-4" onSubmit={sendMessage}>
            <label className="sr-only" htmlFor="hilo-input">
              Cuéntaselo a Hilo
            </label>
            <input
              className="flex-1 min-w-0 bg-white border border-line rounded-[999px] outline-0 py-[13px] px-5"
              id="hilo-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Cuéntaselo a Hilo..."
            />
            <button className="h-12 w-12 bg-ink border-0 rounded-[50%] text-white cursor-pointer text-[22px]" type="submit" aria-label="Enviar">
              ➜
            </button>
          </form>
        </aside>
      )}
    </section>
  );
}
