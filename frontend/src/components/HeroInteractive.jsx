/**
 * HEROINTERACTIVE.JSX — Hero Conversacional con Hilo
 *
 * El hero no es una pagina estatica — es una experiencia interactiva
 * donde Hilo te guia por la esencia del Bajo Cauca.
 *
 * Flujo:
 *   greeting -> choose -> explore -> municipality -> detail
 *
 * Cada escena cambia:
 *   - La pose de Hilo
 *   - El fondo visual
 *   - Las opciones disponibles
 *   - El mensaje de Hilo
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { BTN_CULTURAL } from './uiStyles.js';
import Icon from './Icon.jsx';
import Threads from './Threads.jsx';

/* --- ESCENAS -------------------------------------------------- */

const SCENES = {
  greeting: {
    pose: 'hilo-saluda.png',
    message: '¡Bienvenido! Soy Hilo. Soy el hilo que une al Bajo Cauca. ¿Qué quieres descubrir?',
    background: 'default',
    options: [
      { id: 'historias', icon: 'book', label: 'Historias del río', sub: 'Lo que el Bajo Cauca cuenta' },
      { id: 'gente', icon: 'people', label: 'Conocer gente', sub: 'Quiénes mueven el territorio' },
      { id: 'musica', icon: 'music', label: 'Música viva', sub: 'El sonido del territorio' },
    ],
  },
  historias: {
    pose: 'hilo-senala.png',
    message: 'Las historias nacen del río. Cada piedra guarda un secreto. ¿De cuál municipio quieres saber?',
    background: 'river',
    options: [
      { id: 'muni-caucasia', icon: 'confluence', label: 'Caucasia', sub: 'Capital, confluencia', color: '#d4a843' },
      { id: 'muni-caceres', icon: 'columns', label: 'Cáceres', sub: 'Historia, 1576', color: '#1d8fa3' },
      { id: 'muni-taraza', icon: 'coffee', label: 'Tarazá', sub: 'Tierra de café', color: '#75b79b' },
      { id: 'muni-nechi', icon: 'waves', label: 'Nechí', sub: 'Río y tradición', color: '#0f6b7a' },
      { id: 'muni-elbagre', icon: 'gem', label: 'El Bagre', sub: 'Oro ancestral', color: '#c4713a' },
      { id: 'muni-zaragoza', icon: 'anchor', label: 'Zaragoza', sub: 'Fundación, 1581', color: '#6b3a7d' },
    ],
  },
  gente: {
    pose: 'hilo-saluda.png',
    message: 'El Bajo Cauca está vivo por su gente. Los gestores son los hilos que tejen la comunidad.',
    background: 'people',
    options: [
      { id: 'gestores', icon: 'thread', label: 'Gestores', sub: 'Los que tejen el territorio' },
      { id: 'artistas', icon: 'palette', label: 'Artistas', sub: 'Las voces del Bajo Cauca' },
      { id: 'back', icon: 'arrow-left', label: 'Volver', sub: 'Seguir explorando' },
    ],
  },
  musica: {
    pose: 'hilo-celebra.png',
    message: 'La música es el latido del Bajo Cauca. De las corralejas a la música urbana, todo se conecta.',
    background: 'music',
    options: [
      { id: 'moneystack', icon: 'music', label: 'Moneystack', sub: 'El sello del territorio' },
      { id: 'folklore', icon: 'drum', label: 'Folklore', sub: 'Tuna, tambora y décima' },
      { id: 'back', icon: 'arrow-left', label: 'Volver', sub: 'Seguir explorando' },
    ],
  },
  gestores: {
    pose: 'hilo-explica.png',
    message: 'Los gestores son personas que conectan al Bajo Cauca a través del pensamiento crítico. Cada gestor es un hilo del tejido.',
    background: 'people',
    options: [
      { id: 'explorar-gestores', icon: 'search', label: 'Ver gestores', sub: 'En la plataforma' },
      { id: 'back-gente', icon: 'arrow-left', label: 'Volver', sub: 'Más opciones' },
    ],
  },
  artistas: {
    pose: 'hilo-descubre.png',
    message: 'Los artistas del Bajo Cauca cuentan historias que el río guarda. Moneystack es su sello.',
    background: 'music',
    options: [
      { id: 'explorar-artistas', icon: 'mic', label: 'Ver artistas', sub: 'En la plataforma' },
      { id: 'back-gente', icon: 'arrow-left', label: 'Volver', sub: 'Más opciones' },
    ],
  },
  moneystack: {
    pose: 'hilo-celebra.png',
    message: 'Moneystack es el sello independiente del Bajo Cauca. Aquí nacen los artistas que hacen latir al territorio.',
    background: 'music',
    options: [
      { id: 'ir-moneystack', icon: 'music', label: 'Ir a Moneystack', sub: 'Explorar el sello' },
      { id: 'back-musica', icon: 'arrow-left', label: 'Volver', sub: 'Más opciones' },
    ],
  },
  folklore: {
    pose: 'hilo-explica.png',
    message: 'La tuna y la tambora, la décima, los cantos de vaquería, la zafra, el grito del monte. La música que acompaña las corralejas y los fandangos.',
    background: 'music',
    options: [
      { id: 'explorar-folklore', icon: 'book', label: 'Explorar historias', sub: 'Del folklore' },
      { id: 'back-musica', icon: 'arrow-left', label: 'Volver', sub: 'Más opciones' },
    ],
  },
};

/* --- DATOS DE MUNICIPIOS -------------------------------------- */

const MUNICIPALITIES = {
  'muni-caucasia': {
    pose: 'hilo-descubre.png',
    name: 'Caucasia',
    color: '#d4a843',
    title: 'Capital del Bajo Cauca',
    description: 'Centro comercial y administrativo de la región. Confluencia de los ríos Cauca y Nechí. Fundada en 1866. Donde todo se conecta.',
    tags: ['Capital', 'Confluencia', 'Comercio'],
    background: 'muni-caucasia',
  },
  'muni-caceres': {
    pose: 'hilo-descubre.png',
    name: 'Cáceres',
    color: '#1d8fa3',
    title: 'Historia y Tradición',
    description: 'Fundado en 1576. Uno de los pueblos más antiguos de Antioquia con rica historia minera y tradición colonial que se respira en sus calles empedradas.',
    tags: ['Colonial', 'Minería', 'Historia'],
    background: 'muni-caceres',
  },
  'muni-taraza': {
    pose: 'hilo-descubre.png',
    name: 'Tarazá',
    color: '#75b79b',
    title: 'Tierra de Café',
    description: 'Tierra de cafetaleros y tradición campesina. Conocido por su calidez humana, producción agrícola y los paisajes verdes de sus montañas.',
    tags: ['Café', 'Agricultura', 'Campesinos'],
    background: 'muni-taraza',
  },
  'muni-nechi': {
    pose: 'hilo-descubre.png',
    name: 'Nechí',
    color: '#0f6b7a',
    title: 'Río y Tradición Minera',
    description: 'Fundado en 1636 como campamento minero. Hogar de comunidades afrocolombianas que mantienen vivas las tradiciones ancestrales del río.',
    tags: ['Minería', 'Afrocolombiano', 'Río'],
    background: 'muni-nechi',
  },
  'muni-elbagre': {
    pose: 'hilo-descubre.png',
    name: 'El Bagre',
    color: '#c4713a',
    title: 'Cuna de Artistas',
    description: 'Primer productor de oro de Antioquia. Tierra de artistas y músicos que enamoran con su folklore y la alegría de su gente.',
    tags: ['Oro', 'Folklore', 'Música'],
    background: 'muni-elbagre',
  },
  'muni-zaragoza': {
    pose: 'hilo-descubre.png',
    name: 'Zaragoza',
    color: '#6b3a7d',
    title: 'Municipio Fundado',
    description: 'Fundado en 1581. Pueblo con historia minera milenaria y paisajes naturales impresionantes donde el río Cauca narra historias.',
    tags: ['Fundación', 'Naturaleza', 'Minería'],
    background: 'muni-zaragoza',
  },
};

/* --- ESTILOS (Tailwind) ----------------------------------------
 * El contenedor de fondo (.hero-interactive-bg) aloja los hilos animados
 * (Threads, React Bits) sobre el degradado de la escena.
 * El resto usa utilidades. */

// Fondo de la seccion segun la escena (legado: .hero-bg-*). Un solo degradado por escena.
const HERO_BG = {
  'hero-bg-default': 'bg-[linear-gradient(160deg,var(--cream-warm,#faf3e6)_0%,rgba(212,168,67,0.06)_50%,rgba(29,143,163,0.04)_100%)]',
  'hero-bg-river': 'bg-[linear-gradient(160deg,#faf3e6_0%,rgba(29,143,163,0.06)_50%,rgba(212,168,67,0.04)_100%)]',
  'hero-bg-people': 'bg-[linear-gradient(160deg,#faf3e6_0%,rgba(45,90,61,0.06)_50%,rgba(117,183,155,0.04)_100%)]',
  'hero-bg-music': 'bg-[linear-gradient(160deg,#faf3e6_0%,rgba(138,79,125,0.06)_50%,rgba(232,93,58,0.04)_100%)]',
  'hero-bg-muni-caucasia': 'bg-[linear-gradient(160deg,#faf3e6_0%,rgba(212,168,67,0.1)_50%,rgba(232,194,82,0.05)_100%)]',
  'hero-bg-muni-caceres': 'bg-[linear-gradient(160deg,#faf3e6_0%,rgba(29,143,163,0.1)_50%,rgba(15,107,122,0.05)_100%)]',
  'hero-bg-muni-taraza': 'bg-[linear-gradient(160deg,#faf3e6_0%,rgba(117,183,155,0.1)_50%,rgba(45,90,61,0.05)_100%)]',
  'hero-bg-muni-nechi': 'bg-[linear-gradient(160deg,#faf3e6_0%,rgba(15,107,122,0.1)_50%,rgba(29,143,163,0.05)_100%)]',
  'hero-bg-muni-elbagre': 'bg-[linear-gradient(160deg,#faf3e6_0%,rgba(196,113,58,0.1)_50%,rgba(212,168,67,0.05)_100%)]',
  'hero-bg-muni-zaragoza': 'bg-[linear-gradient(160deg,#faf3e6_0%,rgba(107,58,125,0.1)_50%,rgba(138,79,125,0.05)_100%)]',
};

// Opcion de la conversacion. La animacion de entrada (fill: forwards) fija el transform, asi
// que el hover solo cambia borde y sombra, igual que en el legado.
const OPTION = 'flex flex-col items-center gap-1.5 min-w-[170px] py-6 px-7 text-center cursor-pointer bg-[rgba(255,255,255,0.75)] backdrop-blur-[12px] border-2 border-solid border-transparent rounded-[22px] transition-all duration-[350ms] ease-[cubic-bezier(.34,1.56,.64,1)] opacity-0 [transform:translateY(20px)] animate-[heroOptionIn_0.5s_cubic-bezier(.34,1.56,.64,1)_forwards] hover:border-[var(--option-color,var(--river,#1d8fa3))] hover:[transform:translateY(-8px)_scale(1.03)] hover:[box-shadow:0_20px_50px_rgba(18,60,52,0.12),0_0_0_1px_var(--option-color,rgba(29,143,163,0.1))] active:[transform:translateY(-4px)_scale(1.01)] max768:min-w-[140px] max768:py-[18px] max768:px-5 max480:w-full max480:max-w-[280px]';
const STAT = 'flex flex-col items-center';
const STAT_NUMBER = 'text-ink text-[32px] font-extrabold max768:text-[26px] [text-shadow:0_0_16px_rgba(255,249,236,1),0_0_8px_rgba(255,249,236,1),0_0_3px_rgba(255,249,236,1)]';
const STAT_LABEL = 'text-[var(--muted,#66746f)] text-[12px] font-semibold tracking-[0.05em] uppercase [text-shadow:0_0_12px_rgba(255,249,236,1),0_0_6px_rgba(255,249,236,1),0_0_2px_rgba(255,249,236,1)]';
const STAT_DIVIDER = 'bg-[var(--line,#ddd5c7)] h-10 w-px';

/* --- UTILIDADES ----------------------------------------------- */

function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return '¡Buenos días!';
  if (hour >= 12 && hour < 18) return '¡Buenas tardes!';
  return '¡Buenas noches!';
}

function getSceneBackground(scene) {
  if (scene === 'greeting') return 'hero-bg-default';
  if (scene === 'historias') return 'hero-bg-river';
  if (scene === 'gente' || scene === 'gestores' || scene === 'artistas') return 'hero-bg-people';
  if (scene === 'musica' || scene === 'moneystack' || scene === 'folklore') return 'hero-bg-music';
  if (scene.startsWith('muni-')) return `hero-bg-${scene}`;
  return 'hero-bg-default';
}

/* --- COMPONENTE ----------------------------------------------- */

export default function HeroInteractive({ onExplore, publications = [] }) {
  const [scene, setScene] = useState('greeting');
  const [history, setHistory] = useState([]);
  const [showContent, setShowContent] = useState(true);
  const [parallaxShift, setParallaxShift] = useState(0);

  const currentData = MUNICIPALITIES[scene] || SCENES[scene] || SCENES.greeting;
  const isMunicipality = !!MUNICIPALITIES[scene];

  const pubsForMuni = useMemo(() => {
    if (!isMunicipality) return [];
    const muniName = MUNICIPALITIES[scene].name.toLowerCase();
    return publications
      .filter((p) => p.location && p.location.toLowerCase().includes(muniName))
      .slice(0, 3);
  }, [scene, isMunicipality, publications]);

  const greeting = useMemo(() => getGreeting(), []);

  const navigateTo = useCallback(
    (nextScene) => {
      setShowContent(false);
      setParallaxShift((prev) => prev + 15);
      setTimeout(() => {
        setHistory((prev) => [...prev, scene]);
        setScene(nextScene);
        setTimeout(() => {
          setParallaxShift((prev) => prev - 10);
          setShowContent(true);
        }, 50);
      }, 400);
    },
    [scene]
  );

  const goBack = useCallback(() => {
    setShowContent(false);
    setParallaxShift((prev) => prev - 15);
    setTimeout(() => {
      setHistory((prev) => {
        const next = [...prev];
        next.pop();
        return next;
      });
      setScene((prev) => {
        const idx = history.lastIndexOf(prev);
        return idx > 0 ? history[idx - 1] : 'greeting';
      });
      setTimeout(() => {
        setParallaxShift((prev) => prev + 10);
        setShowContent(true);
      }, 50);
    }, 400);
  }, [history]);

  function handleOptionClick(option) {
    if (option.id === 'back') return goBack();
    if (option.id === 'back-gente') return navigateTo('gente');
    if (option.id === 'back-musica') return navigateTo('musica');
    if (option.id === 'explorar-gestores') return (window.location.hash = 'talento');
    if (option.id === 'explorar-artistas') return (window.location.hash = 'moneystack');
    if (option.id === 'explorar-folklore') return (window.location.hash = 'explorar');
    if (option.id === 'ir-moneystack') return (window.location.hash = 'moneystack');
    if (onExplore && option.id === 'explorar') return onExplore();
    navigateTo(option.id);
  }

  const bgClass = getSceneBackground(scene);

  return (
    <section className={`relative overflow-hidden flex flex-col items-center justify-center text-center min-h-screen pt-[100px] px-[7vw] pb-[60px] text-ink transition-[background] duration-[1.2s] ease-[ease] max768:pt-20 max768:px-[5vw] max768:pb-10 max768:min-h-[auto] ${HERO_BG[bgClass] || HERO_BG['hero-bg-default']}`} id="inicio">
      {/* Obra tejida (sol + arbol) — se funde con el fondo; los hilos pasan por encima */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none absolute top-0 left-0 right-0 opacity-90 mix-blend-multiply"
      >
        <img
          src="/images/hero/arbol-tejido.jpg"
          alt=""
          className="block h-auto w-full [mask-image:linear-gradient(to_bottom,#000_86%,transparent_100%)]"
        />
      </div>
      {/* Fondo animado con parallax */}
      <div
        className="hero-interactive-bg"
        aria-hidden="true"
        style={{ transform: `translateY(${parallaxShift}px)`, transition: 'transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)' }}
      >
        {/* Hilos animados (React Bits) — fondo con movimiento del hero */}
        <div className="absolute inset-0 opacity-35" aria-hidden="true">
          <Threads
            amplitude={3.7}
            distance={0.4}
            enableMouseInteraction={false}
            speed={0.2}
            color={[0.114, 0.561, 0.639]}
          />
        </div>
      </div>

      {/* Contenido principal con parallax inverso */}
      <div
        className={`relative z-2 max-w-[800px] [transform:translateY(12px)] ${showContent ? 'opacity-100' : 'opacity-0'}`}
        style={{ transform: `translateY(${-parallaxShift * 0.5}px)`, transition: 'opacity 0.6s ease, transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)' }}
      >
        {/* Avatar de Hilo — sin caja ni circulo: flota directo sobre los hilos */}
        <div className="flex flex-col items-center mb-8">
          <img
            className="h-[220px] w-auto mb-5 object-contain animate-[heroHiloFloat_3.6s_ease-in-out_infinite] drop-shadow-[0_18px_28px_rgba(12,36,30,0.2)] max768:h-[160px]"
            src={`/images/hilo/${currentData.pose || 'hilo-saluda.png'}`}
            alt="Hilo, guia de TEJIDO"
          />

          {/* Mensaje de Hilo */}
          <p className="text-[length:clamp(20px,2.8vw,28px)] font-bold leading-[1.4] text-ink max-w-[600px] my-0 mx-auto max768:text-[20px] [text-shadow:0_0_14px_rgba(255,249,236,1),0_0_6px_rgba(255,249,236,1),0_0_3px_rgba(255,249,236,1)]">{currentData.message}</p>
        </div>

        {/* Opciones interactivas */}
        {currentData.options && (
          <div className="flex gap-4 justify-center mt-9 flex-wrap max768:gap-3 max480:flex-col max480:items-center">
            {currentData.options.map((option, index) => (
              <button
                key={option.id}
                className={OPTION}
                type="button"
                onClick={() => handleOptionClick(option)}
                style={{
                  animationDelay: `${index * 0.1 + 0.3}s`,
                  '--option-color': option.color || 'var(--river)',
                }}
              >
                <Icon name={option.icon} className="mb-1.5 size-7 text-ink max768:size-6" />
                <span className="text-[16px] font-bold text-ink leading-[1.2] max768:text-[14px]">{option.label}</span>
                <span className="text-[12px] font-medium text-[var(--muted,#66746f)] leading-[1.3]">{option.sub}</span>
              </button>
            ))}
          </div>
        )}

        {/* Tarjetas de publicaciones (solo en vista de municipio) */}
        {isMunicipality && pubsForMuni.length > 0 && (
          <div className="mt-8 max-w-[700px] w-full">
            <h3 className="font-sans tracking-[-.055em] text-[16px] font-bold text-[var(--muted,#66746f)] mt-0 mx-0 mb-4">Lo que se esta contando</h3>
            <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(200px,1fr))] max768:grid-cols-[1fr]">
              {pubsForMuni.map((pub) => (
                <div key={pub.id} className="bg-[rgba(255,255,255,0.7)] backdrop-blur-[8px] border border-[rgba(23,58,49,0.06)] rounded-[16px] p-4 text-left transition-all duration-300 ease-[ease] hover:[transform:translateY(-3px)] hover:[box-shadow:0_8px_24px_rgba(18,60,52,0.1)] hover:border-[rgba(29,143,163,0.15)]">
                  <span className="text-[var(--sunset,#d85b36)] text-[10px] font-bold tracking-[0.1em] uppercase">{pub.kind}</span>
                  <h4 className="text-[15px] font-bold text-ink mt-1 mx-0 mb-1.5">{pub.title}</h4>
                  <p className="text-[12px] text-[var(--muted,#66746f)] leading-[1.4] m-0 line-clamp-2">{pub.summary}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tags del municipio */}
        {isMunicipality && (
          <div className="mt-6">
            <div className="flex gap-2 justify-center flex-wrap">
              {currentData.tags.map((tag, i) => (
                <span key={i} className="bg-[rgba(255,255,255,0.6)] border border-solid rounded-[999px] text-ink text-[12px] font-semibold py-1.5 px-3.5" style={{ borderColor: currentData.color }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Stats del ecosistema */}
        {scene === 'greeting' && (
          <div className="flex items-center gap-7 justify-center mt-12 pt-7 border-t border-t-[rgba(23,58,49,0.08)] max768:gap-4">
            <div className={STAT}>
              <span className={STAT_NUMBER}>6</span>
              <span className={STAT_LABEL}>Municipios</span>
            </div>
            <div className={STAT_DIVIDER} />
            <div className={STAT}>
              <span className={STAT_NUMBER}>{publications.length || '247'}</span>
              <span className={STAT_LABEL}>Historias</span>
            </div>
            <div className={STAT_DIVIDER} />
            <div className={STAT}>
              <span className={STAT_NUMBER}>1</span>
              <span className={STAT_LABEL}>Rio que conecta</span>
            </div>
          </div>
        )}

        {/* Boton de explorar (solo en greeting) */}
        {scene === 'greeting' && (
          <div className="mt-7">
            <button className={BTN_CULTURAL} type="button" onClick={() => onExplore && onExplore()}>
              Explorar el Territorio
            </button>
          </div>
        )}
      </div>

      {/* Boton de regreso (no en greeting) */}
      {scene !== 'greeting' && (
        <button className="absolute bottom-6 left-6 z-10 inline-flex items-center gap-1.5 bg-[rgba(255,255,255,0.8)] backdrop-blur-[8px] border border-[rgba(23,58,49,0.12)] rounded-[999px] text-ink cursor-pointer text-[14px] font-semibold py-2.5 px-5 transition-all duration-300 ease-[ease] hover:bg-white hover:[box-shadow:0_4px_16px_rgba(23,58,49,0.1)] max480:bottom-3 max480:left-3 max480:py-2 max480:px-4 max480:text-[13px]" type="button" onClick={goBack} aria-label="Volver">
          <Icon name="arrow-left" className="size-4" /> Volver
        </button>
      )}
    </section>
  );
}
