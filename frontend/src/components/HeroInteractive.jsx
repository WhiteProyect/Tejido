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

/* --- ESCENAS -------------------------------------------------- */

const SCENES = {
  greeting: {
    pose: 'hilo-saluda.png',
    message: '¡Buenos días! Soy Hilo. Soy el hilo que une al Bajo Cauca. ¿Qué quieres descubrir?',
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
 * El contenedor de fondo (.hero-interactive-bg) y todo su arte animado (rio-serpiente,
 * sol, agua, figuras, montana, particulas) conservan sus clases propias en main.css.
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
const STAT_NUMBER = 'text-ink text-[32px] font-extrabold max768:text-[26px]';
const STAT_LABEL = 'text-[var(--muted,#66746f)] text-[12px] font-semibold tracking-[0.05em] uppercase';
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

function generateScales(path, count = 14) {
  const nums = path.match(/[\d.]+/g);
  if (!nums || nums.length < 6) return [];
  const scales = [];
  const totalPoints = nums.length / 2;
  const step = Math.max(1, Math.floor(totalPoints / count));
  for (let i = 1; i < count && i * step < totalPoints - 1; i++) {
    const idx = i * step * 2;
    if (idx + 1 < nums.length) {
      scales.push({
        x: parseFloat(nums[idx]),
        y: parseFloat(nums[idx + 1]),
        size: 4 + Math.random() * 3,
        opacity: 0.06 + Math.random() * 0.06,
      });
    }
  }
  return scales;
}

const SNAKE_PATH = 'M-80,320 C120,220 280,420 480,280 C680,140 840,380 1040,260 C1240,140 1360,340 1480,280';

function getSnakeHeadPos() {
  const nums = SNAKE_PATH.match(/[\d.]+/g);
  return { x: parseFloat(nums[nums.length - 2]), y: parseFloat(nums[nums.length - 1]) };
}

function getSnakeTailPos() {
  const nums = SNAKE_PATH.match(/[\d.]+/g);
  return { x: parseFloat(nums[0]), y: parseFloat(nums[1]) };
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
  const snakeScales = useMemo(() => generateScales(SNAKE_PATH), []);
  const snakeHead = useMemo(() => getSnakeHeadPos(), []);
  const snakeTail = useMemo(() => getSnakeTailPos(), []);

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
      {/* Fondo animado con parallax */}
      <div
        className="hero-interactive-bg"
        aria-hidden="true"
        style={{ transform: `translateY(${parallaxShift}px)`, transition: 'transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)' }}
      >
        <svg
          className="hero-river-svg"
          viewBox="0 0 1400 600"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <linearGradient id="heroRiverGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1d8fa3" stopOpacity="0.03" />
              <stop offset="20%" stopColor="#1d8fa3" stopOpacity="0.18" />
              <stop offset="80%" stopColor="#1d8fa3" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#1d8fa3" stopOpacity="0.03" />
            </linearGradient>
            <linearGradient id="heroRiverGradInner" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1d8fa3" stopOpacity="0" />
              <stop offset="20%" stopColor="#3db8c9" stopOpacity="0.3" />
              <stop offset="80%" stopColor="#3db8c9" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#1d8fa3" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="heroHeadGlowPulse">
              <stop offset="0%" stopColor="#3db8c9" stopOpacity="0.4">
                <animate attributeName="stopOpacity" values="0.4;0.6;0.4" dur="3s" repeatCount="indefinite"/>
              </stop>
              <stop offset="100%" stopColor="#1d8fa3" stopOpacity="0"/>
            </radialGradient>
            <linearGradient id="heroScaleGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3db8c9" stopOpacity="0.12"/>
              <stop offset="100%" stopColor="#1d8fa3" stopOpacity="0.04"/>
            </linearGradient>
            <linearGradient id="heroTongueGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#c44" stopOpacity="0.5"/>
              <stop offset="100%" stopColor="#a33" stopOpacity="0.3"/>
            </linearGradient>
            {/* Agua */}
            <linearGradient id="heroWaterGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1d8fa3" stopOpacity="0.18"/>
              <stop offset="40%" stopColor="#1a7a8c" stopOpacity="0.12"/>
              <stop offset="100%" stopColor="#165f6e" stopOpacity="0.06"/>
            </linearGradient>
            <linearGradient id="heroWaterShine" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#fff" stopOpacity="0"/>
              <stop offset="50%" stopColor="#fff" stopOpacity="0.08"/>
              <stop offset="100%" stopColor="#fff" stopOpacity="0"/>
            </linearGradient>
            {/* Oro */}
            <linearGradient id="heroGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f4d03f"/>
              <stop offset="50%" stopColor="#d4a843"/>
              <stop offset="100%" stopColor="#b8860b"/>
            </linearGradient>
            {/* Madera canoa */}
            <linearGradient id="heroWoodGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#8B5E3C"/>
              <stop offset="50%" stopColor="#6B4226"/>
              <stop offset="100%" stopColor="#5C3317"/>
            </linearGradient>
            {/* Piel barequero y pescador */}
            <linearGradient id="heroSkinGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#8B6914"/>
              <stop offset="100%" stopColor="#6B4F12"/>
            </linearGradient>
            {/* Sol SVG — halo difuso y disco cálido */}
            <radialGradient id="heroSunHaloGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#e8c252" stopOpacity="0.2"/>
              <stop offset="50%" stopColor="#e8c252" stopOpacity="0.06"/>
              <stop offset="100%" stopColor="#e8c252" stopOpacity="0"/>
            </radialGradient>
            <radialGradient id="heroSunDiscGrad" cx="40%" cy="35%" r="60%">
              <stop offset="0%" stopColor="#f5dfa0"/>
              <stop offset="40%" stopColor="#e8c252"/>
              <stop offset="100%" stopColor="#d85b36"/>
            </radialGradient>
            {/* Triángulo — montaña estilizada */}
            <linearGradient id="heroTriGrad" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#2d5a3f" stopOpacity="0.18"/>
              <stop offset="100%" stopColor="#1a3d2a" stopOpacity="0.03"/>
            </linearGradient>
          </defs>

          {/* === SOL SVG — disco, rayos y halo realistas en el cielo === */}
          <g className="hero-svg-sun">
            <circle cx="1150" cy="70" r="90" fill="url(#heroSunHaloGrad)" opacity="0.5"/>
            {Array.from({ length: 16 }).map((_, i) => {
              const a = (i * 22.5) * Math.PI / 180;
              const inner = 38;
              const outer = i % 2 === 0 ? 80 : 65;
              return (
                <line key={`ray-${i}`}
                  x1={1150 + Math.cos(a) * inner} y1={70 + Math.sin(a) * inner}
                  x2={1150 + Math.cos(a) * outer} y2={70 + Math.sin(a) * outer}
                  stroke="#e8c252" strokeWidth={i % 2 === 0 ? 2.5 : 1.5}
                  opacity={i % 2 === 0 ? 0.35 : 0.2} strokeLinecap="round"
                />
              );
            })}
            <circle cx="1150" cy="70" r="35" fill="url(#heroSunDiscGrad)"/>
            <circle cx="1140" cy="62" r="10" fill="white" opacity="0.12"/>
          </g>

          {/* Sombra del cuerpo */}
          <path
            className="hero-river-shadow"
            d={SNAKE_PATH}
            fill="none"
            stroke="rgba(12,36,30,0.05)"
            strokeWidth="90"
            strokeLinecap="round"
            transform="translate(4, 6)"
          />

          {/* Cuerpo de la serpiente/rio */}
          <path
            className="hero-river-path"
            d={SNAKE_PATH}
            fill="none"
            stroke="url(#heroRiverGrad)"
            strokeWidth="80"
            strokeLinecap="round"
          />

          {/* Escamas a lo largo del cuerpo */}
          {snakeScales.map((s, i) => (
            <g key={`scale-${i}`} className="hero-scale" style={{ animationDelay: `${i * 0.15}s` }}>
              <ellipse
                cx={s.x}
                cy={s.y}
                rx={s.size}
                ry={s.size * 0.65}
                fill="url(#heroScaleGrad)"
                opacity={s.opacity}
                transform={`rotate(${-15 + (i % 3) * 15}, ${s.x}, ${s.y})`}
              />
            </g>
          ))}

          {/* Highlight del cuerpo */}
          <path
            className="hero-river-highlight"
            d={SNAKE_PATH}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray="40 80"
            strokeDashoffset="20"
          />

          {/* === AGUA: Superficie con ondas === */}
          <g className="hero-water-surface">
            <path
              className="hero-water-wave hero-water-wave-1"
              d="M0,430 Q100,415 200,430 Q300,445 400,430 Q500,415 600,430 Q700,445 800,430 Q900,415 1000,430 Q1100,445 1200,430 Q1300,415 1400,430 L1400,600 L0,600 Z"
              fill="url(#heroWaterGrad)"
            />
            <path
              className="hero-water-wave hero-water-wave-2"
              d="M0,445 Q120,430 240,445 Q360,460 480,445 Q600,430 720,445 Q840,460 960,445 Q1080,430 1200,445 Q1320,460 1400,445 L1400,600 L0,600 Z"
              fill="url(#heroWaterGrad)"
              opacity="0.6"
            />
            <path
              className="hero-water-wave hero-water-wave-3"
              d="M0,460 Q80,450 160,460 Q240,470 320,460 Q400,450 480,460 Q560,470 640,460 Q720,450 800,460 Q880,470 960,460 Q1040,450 1120,460 Q1200,470 1280,460 Q1360,450 1400,460 L1400,600 L0,600 Z"
              fill="url(#heroWaterGrad)"
              opacity="0.35"
            />
            <ellipse className="hero-water-shine" cx="350" cy="440" rx="60" ry="3" fill="url(#heroWaterShine)"/>
            <ellipse className="hero-water-shine" cx="750" cy="435" rx="80" ry="4" fill="url(#heroWaterShine)" style={{animationDelay: '1.5s'}}/>
            <ellipse className="hero-water-shine" cx="1100" cy="442" rx="50" ry="3" fill="url(#heroWaterShine)" style={{animationDelay: '3s'}}/>
          </g>

          {/* Triángulo — pico de montaña en segundo plano */}
          <path d="M260,390 L310,280 L360,390 Z" fill="url(#heroTriGrad)" opacity="0.22" className="hero-triangle"/>

          {/* === BAREQUERO — silueta agachada con batea en la orilla izquierda === */}
          <g className="hero-barequero">
            {/* Sombrero de paja */}
            <ellipse cx="0" cy="-45" rx="15" ry="6" fill="#5C3317" opacity="0.7"/>
            <ellipse cx="0" cy="-50" rx="10" ry="8" fill="#6B4226" opacity="0.65"/>
            {/* Cabeza */}
            <circle cx="0" cy="-38" r="7" fill="url(#heroSkinGrad)" opacity="0.6"/>
            {/* Espalda curvada — postura de barequeo */}
            <path d="M0,-31 Q8,-15 12,5 Q14,15 10,20" fill="none" stroke="#5C3317" strokeWidth="5" strokeLinecap="round" opacity="0.55"/>
            {/* Brazo extendido con batea */}
            <path d="M8,-20 Q20,-10 30,-5" fill="none" stroke="#6B4F12" strokeWidth="3" strokeLinecap="round" opacity="0.5"/>
            {/* Batea/orina para separar oro del río */}
            <ellipse cx="34" cy="-2" rx="12" ry="5" fill="#8B7355" opacity="0.45" transform="rotate(-10, 34, -2)"/>
            <ellipse cx="34" cy="-3" rx="9" ry="3.5" fill="#a08060" opacity="0.3"/>
            {/* Piernas */}
            <path d="M5,15 L0,35" stroke="#5C3317" strokeWidth="3.5" strokeLinecap="round" opacity="0.45"/>
            <path d="M10,15 L15,35" stroke="#5C3317" strokeWidth="3.5" strokeLinecap="round" opacity="0.45"/>
          </g>

          {/* === PESCADOR — silueta con caña en la orilla derecha === */}
          <g className="hero-pescador">
            {/* Sombrero */}
            <ellipse cx="0" cy="-42" rx="12" ry="5" fill="#5C3317" opacity="0.6"/>
            <ellipse cx="0" cy="-46" rx="8" ry="7" fill="#6B4226" opacity="0.55"/>
            {/* Cabeza */}
            <circle cx="0" cy="-36" r="6" fill="url(#heroSkinGrad)" opacity="0.5"/>
            {/* Cuerpo erguido — postura de espera */}
            <path d="M0,-30 Q4,-18 5,-5" fill="none" stroke="#5C3317" strokeWidth="4.5" strokeLinecap="round" opacity="0.45"/>
            {/* Brazo con caña de pescar */}
            <path d="M4,-22 Q16,-32 32,-48" fill="none" stroke="#6B4F12" strokeWidth="2.5" strokeLinecap="round" opacity="0.4"/>
            {/* Línea de pesca cayendo al agua */}
            <path d="M32,-48 Q36,-28 34,-10" fill="none" stroke="#8B7355" strokeWidth="1" opacity="0.25" strokeDasharray="3 2"/>
            {/* Anzuelo */}
            <circle cx="34" cy="-8" r="1.5" fill="#a08060" opacity="0.3"/>
            {/* Piernas */}
            <path d="M3,0 L0,25" stroke="#5C3317" strokeWidth="3" strokeLinecap="round" opacity="0.4"/>
            <path d="M7,0 L12,25" stroke="#5C3317" strokeWidth="3" strokeLinecap="round" opacity="0.4"/>
          </g>

          {/* === CANOA: Flotando en el agua === */}
          <g className="hero-canoe">
            <path d="M-50,0 Q-45,-12 -30,-15 L30,-15 Q45,-12 50,0 Q40,8 0,10 Q-40,8 -50,0 Z" fill="url(#heroWoodGrad)" opacity="0.55"/>
            <path d="M-48,-2 Q-40,-14 -28,-16 L28,-16 Q40,-14 48,-2" fill="none" stroke="#A0724A" strokeWidth="1.5" opacity="0.4"/>
            <line x1="-35" y1="-8" x2="35" y2="-8" stroke="#5C3317" strokeWidth="0.5" opacity="0.3"/>
            <line x1="-40" y1="-3" x2="40" y2="-3" stroke="#5C3317" strokeWidth="0.5" opacity="0.25"/>
            <path d="M-45,10 Q-40,18 0,20 Q40,18 45,10" fill="url(#heroWaterGrad)" opacity="0.15"/>
          </g>

          {/* === PESCADO SALTANDO === */}
          <g className="hero-fish-jump">
            <circle cx="-20" cy="30" r="1.5" fill="#3db8c9" opacity="0.3"/>
            <circle cx="-10" cy="15" r="1" fill="#3db8c9" opacity="0.25"/>
            <circle cx="5" cy="5" r="1.2" fill="#3db8c9" opacity="0.2"/>
            <path d="M0,0 Q10,-8 25,-5 Q30,-2 25,3 Q10,8 0,0 Z" fill="url(#heroGoldGrad)" opacity="0.6"/>
            <path d="M-5,0 L-15,-7 L-15,7 Z" fill="#d4a843" opacity="0.5"/>
            <circle cx="20" cy="-2" r="1.5" fill="#0c241e" opacity="0.5"/>
            <circle cx="20.5" cy="-2.5" r="0.5" fill="#fff" opacity="0.3"/>
            <path d="M10,-4 Q12,-10 18,-6" fill="none" stroke="#d4a843" strokeWidth="1" opacity="0.4"/>
          </g>

          {/* === PESCADOS DORADOS NADANDO === */}
          <g className="hero-golden-fishes">
            <g className="hero-golden-fish hero-golden-fish-1">
              <path d="M0,0 Q6,-4 15,-3 Q18,-1 15,2 Q6,5 0,0 Z" fill="url(#heroGoldGrad)" opacity="0.45"/>
              <path d="M-3,0 L-8,-4 L-8,4 Z" fill="#d4a843" opacity="0.35"/>
              <circle cx="12" cy="-1" r="1" fill="#0c241e" opacity="0.4"/>
            </g>
            <g className="hero-golden-fish hero-golden-fish-2">
              <path d="M0,0 Q5,-3 12,-2 Q14,0 12,2 Q5,4 0,0 Z" fill="url(#heroGoldGrad)" opacity="0.35"/>
              <path d="M-2,0 L-6,-3 L-6,3 Z" fill="#d4a843" opacity="0.3"/>
              <circle cx="10" cy="-0.5" r="0.8" fill="#0c241e" opacity="0.35"/>
            </g>
            <g className="hero-golden-fish hero-golden-fish-3">
              <path d="M0,0 Q7,-5 18,-3 Q21,0 18,3 Q7,6 0,0 Z" fill="url(#heroGoldGrad)" opacity="0.4"/>
              <path d="M-4,0 L-10,-5 L-10,5 Z" fill="#d4a843" opacity="0.32"/>
              <circle cx="14" cy="-1" r="1.2" fill="#0c241e" opacity="0.38"/>
            </g>
          </g>

          {/* === PARTÍCULAS DE ORO === */}
          <g className="hero-gold-particles">
            <circle className="hero-gold-dot hero-gold-dot-1" cx="200" cy="455" r="2" fill="url(#heroGoldGrad)" opacity="0.5"/>
            <circle className="hero-gold-dot hero-gold-dot-2" cx="500" cy="465" r="1.5" fill="url(#heroGoldGrad)" opacity="0.4"/>
            <circle className="hero-gold-dot hero-gold-dot-3" cx="650" cy="450" r="2.5" fill="url(#heroGoldGrad)" opacity="0.45"/>
            <circle className="hero-gold-dot hero-gold-dot-4" cx="900" cy="460" r="1.8" fill="url(#heroGoldGrad)" opacity="0.35"/>
            <circle className="hero-gold-dot hero-gold-dot-5" cx="1150" cy="455" r="2" fill="url(#heroGoldGrad)" opacity="0.42"/>
            <circle className="hero-gold-dot hero-gold-dot-6" cx="350" cy="480" r="1.2" fill="url(#heroGoldGrad)" opacity="0.3"/>
            <circle className="hero-gold-dot hero-gold-dot-7" cx="800" cy="475" r="1.8" fill="url(#heroGoldGrad)" opacity="0.38"/>
            <circle className="hero-gold-dot hero-gold-dot-8" cx="1000" cy="470" r="1.5" fill="url(#heroGoldGrad)" opacity="0.33"/>
          </g>

          {/* Linea central */}
          <path
            className="hero-river-spine"
            d={SNAKE_PATH}
            fill="none"
            stroke="url(#heroRiverGradInner)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="14 9"
          />

          {/* Cabeza de la serpiente */}
          <g className="hero-snake-head">
            <circle cx={snakeHead.x} cy={snakeHead.y} r="34" fill="url(#heroHeadGlowPulse)"/>
            <ellipse cx={snakeHead.x} cy={snakeHead.y} rx="16" ry="12" fill="#1d8fa3" opacity="0.4"/>
            <ellipse cx={snakeHead.x + 2} cy={snakeHead.y - 2} rx="12" ry="8" fill="#1d8fa3" opacity="0.3"/>
            <circle cx={snakeHead.x - 5} cy={snakeHead.y - 4} r="3" fill="#0c241e" opacity="0.6"/>
            <circle cx={snakeHead.x - 4} cy={snakeHead.y - 5} r="1" fill="#fff" opacity="0.4"/>
            <circle cx={snakeHead.x + 5} cy={snakeHead.y - 4} r="3" fill="#0c241e" opacity="0.6"/>
            <circle cx={snakeHead.x + 6} cy={snakeHead.y - 5} r="1" fill="#fff" opacity="0.4"/>
            <g className="hero-tongue">
              <path
                d={`M${snakeHead.x + 14},${snakeHead.y} L${snakeHead.x + 24},${snakeHead.y - 4} M${snakeHead.x + 14},${snakeHead.y} L${snakeHead.x + 24},${snakeHead.y + 4}`}
                fill="none"
                stroke="url(#heroTongueGrad)"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </g>
          </g>

          {/* Cola */}
          <circle cx={snakeTail.x} cy={snakeTail.y} r="8" fill="#1d8fa3" opacity="0.12"/>
          <circle cx={snakeTail.x - 4} cy={snakeTail.y} r="4" fill="#1d8fa3" opacity="0.06"/>
        </svg>

        {/* Montaña SVG detallada */}
        <svg className="hero-mountain-svg" viewBox="0 0 400 350" preserveAspectRatio="xMidYMax meet">
          <defs>
            <linearGradient id="heroMountainBack" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1a3d2a" stopOpacity="0.12"/>
              <stop offset="100%" stopColor="#1a3d2a" stopOpacity="0.04"/>
            </linearGradient>
            <linearGradient id="heroMountainMid" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#2d5a3f" stopOpacity="0.1"/>
              <stop offset="100%" stopColor="#2d5a3f" stopOpacity="0.03"/>
            </linearGradient>
            <linearGradient id="heroMountainFront" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#4a7c5c" stopOpacity="0.08"/>
              <stop offset="100%" stopColor="#4a7c5c" stopOpacity="0.02"/>
            </linearGradient>
            <radialGradient id="heroMountainFog" cx="50%" cy="100%" r="60%">
              <stop offset="0%" stopColor="#faf3e6" stopOpacity="0.4"/>
              <stop offset="100%" stopColor="#faf3e6" stopOpacity="0"/>
            </radialGradient>
          </defs>
          <path d="M50,340 L140,120 L175,155 L220,90 L280,140 L350,340 Z" fill="url(#heroMountainBack)" className="hero-mountain-layer"/>
          <path d="M20,340 L100,180 L145,210 L190,150 L240,195 L300,160 L380,340 Z" fill="url(#heroMountainMid)" className="hero-mountain-layer"/>
          <path d="M0,340 L70,220 L110,245 L150,195 L185,225 L230,180 L275,215 L320,190 L400,340 Z" fill="url(#heroMountainFront)" className="hero-mountain-layer"/>
          <circle cx="155" cy="200" r="4" fill="#2d5a3f" opacity="0.1"/>
          <circle cx="235" cy="185" r="3" fill="#2d5a3f" opacity="0.08"/>
          <circle cx="110" cy="248" r="5" fill="#4a7c5c" opacity="0.07"/>
          <circle cx="280" cy="218" r="3.5" fill="#4a7c5c" opacity="0.06"/>
          <ellipse cx="200" cy="330" rx="180" ry="40" fill="url(#heroMountainFog)" className="hero-mountain-fog"/>
        </svg>
        {/* Particulas de oro */}
        <div className="hero-gold-particles" aria-hidden="true">
          {[...Array(12)].map((_, i) => (
            <span key={i} className={`hero-particle p${i + 1}`} />
          ))}
        </div>
      </div>

      {/* Contenido principal con parallax inverso */}
      <div
        className={`relative z-2 max-w-[800px] [transform:translateY(12px)] ${showContent ? 'opacity-100' : 'opacity-0'}`}
        style={{ transform: `translateY(${-parallaxShift * 0.5}px)`, transition: 'opacity 0.6s ease, transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)' }}
      >
        {/* Avatar de Hilo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-[180px] h-[180px] rounded-[50%] overflow-hidden [box-shadow:0_20px_60px_rgba(12,36,30,0.18),0_0_0_4px_rgba(255,255,255,0.8)] mb-7 animate-[heroHiloFloat_3.6s_ease-in-out_infinite] bg-[var(--cream,#f3e4c8)] max768:w-[140px] max768:h-[140px]">
            <img
              className="w-full h-full object-cover"
              src={`/images/hilo/${currentData.pose || 'hilo-saluda.png'}`}
              alt="Hilo, guia de TEJIDO"
            />
          </div>

          {/* Mensaje de Hilo */}
          <p className="text-[length:clamp(20px,2.8vw,28px)] font-bold leading-[1.4] text-ink max-w-[600px] my-0 mx-auto max768:text-[20px]">{currentData.message}</p>
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
