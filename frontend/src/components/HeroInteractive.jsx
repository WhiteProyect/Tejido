/**
 * HEROINTERACTIVE.JSX — Hero del inicio con Hilo
 *
 * Saludo de Hilo y la navegacion rapida de TEJIDO: 7 tarjetas (utils/heroCards.js). Cinco son enlaces
 * directos a su pantalla; dos abren una sub-escena de un solo nivel (Historias del rio: los 6
 * municipios; Artistas: dos caminos) con su pose y fondo de Hilo. "Volver" regresa al saludo con el
 * foco en la tarjeta que la abrio; al abrir una sub-escena el foco pasa al mensaje de Hilo.
 */

import { Fragment, useState, useEffect, useCallback, useRef } from 'react';
import Icon from './Icon.jsx';
import { BTN_GHOST, BTN_INK_LG } from './uiStyles.js';
import Threads from './Threads.jsx';
import { HERO_CARDS, HERO_SCENES } from '../utils/heroCards.js';

const GREETING = {
  pose: 'hilo-saluda.png',
  // Solo el saludo va en tres niveles (voz dual de la marca); las sub-escenas usan `message`.
  title: ['¡Bienvenido!', 'Soy Hilo.'], // dos lineas
  subtitle: 'Soy el hilo que une al Bajo Cauca.',
  question: '¿Qué quieres descubrir hoy?',
};
const TRANSITION_MS = 400;

/* --- ESTILOS (Tailwind) ----------------------------------------
 * El contenedor de fondo (.hero-interactive-bg) aloja los hilos animados
 * (Threads, React Bits). El resto usa utilidades. */

// Fondo de la seccion en las sub-escenas (legado: .hero-bg-*). El saludo va sobre crema liso.
const HERO_BG = {
  river: 'bg-[linear-gradient(160deg,#faf3e6_0%,rgba(29,143,163,0.06)_50%,rgba(212,168,67,0.04)_100%)]',
  music: 'bg-[linear-gradient(160deg,#faf3e6_0%,rgba(138,79,125,0.06)_50%,rgba(232,93,58,0.04)_100%)]',
};

// Tarjeta (todas las escenas), en vidrio claro. La animacion de entrada (heroOptionIn, fill: forwards)
// fija `transform`, asi que el leve ascenso del hover usa la propiedad `translate`, que se suma a ella.
// Con movimiento reducido: sin entrada ni ascenso. Subtexto en DM Sans normal, #53645c (5,9:1 sobre la
// tarjeta; el muted #66746f da 4,6:1 y queda justo sobre el vidrio).
const CARD = 'flex flex-col items-center justify-center gap-1 py-4 px-3 text-center no-underline cursor-pointer bg-paper/90 backdrop-blur-sm border border-solid border-ink/10 rounded-[22px] transition-[border-color,box-shadow,translate] duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] opacity-0 [transform:translateY(20px)] animate-[heroOptionIn_0.5s_cubic-bezier(.34,1.56,.64,1)_forwards] hover:border-[var(--option-color)] hover:-translate-y-1 hover:[box-shadow:0_6px_16px_rgba(18,60,52,0.08)] active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink focus-visible:border-[var(--option-color)] motion-reduce:animate-none motion-reduce:opacity-100 motion-reduce:transform-none motion-reduce:transition-none motion-reduce:hover:translate-y-0 max-[767px]:gap-1 max-[767px]:rounded-[18px] max-[767px]:py-3.5 max-[767px]:px-2';
const CARD_ICON = 'mb-1 grid size-11 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--option-color)_12%,transparent)] text-[var(--option-color)] max-[767px]:mb-0.5 max-[767px]:size-10';
const CARD_LABEL = 'text-[16px] font-bold leading-[1.2] text-ink [text-wrap:balance] max1024:text-[15px] max-[767px]:text-[14px]';
const CARD_SUB = 'font-sans text-[14px] font-normal not-italic leading-[1.3] text-[#53645c] [text-wrap:balance] max-[767px]:text-[13px]';
// Saludo: 4 + 3 tarjetas del mismo ancho (la segunda fila centrada); <= 767 px, 2 columnas compactas
// con la ultima centrada. Por encima de 1024 px el contenido mide 620 px (el ancho de siempre, del que
// depende GREETING_POSITION) y la cuadricula sale 90 px por cada lado hasta 800 px, centrada.
const GREETING_GRID = 'mx-auto mt-7 flex w-full max-w-[800px] min-[1025px]:-mx-[90px] min-[1025px]:w-[800px] flex-wrap justify-center gap-4 max-[767px]:grid max-[767px]:grid-cols-2 max-[767px]:gap-3';
const GREETING_ITEM = 'w-[calc((100%-3rem)/4)] max-[767px]:w-auto max-[767px]:last:col-span-2 max-[767px]:last:w-[calc(50%-0.375rem)] max-[767px]:last:justify-self-center';
const SCENE_GRID = {
  historias: 'mx-auto mt-9 grid w-full max-w-[660px] grid-cols-3 gap-4 max-[767px]:mt-7 max-[767px]:grid-cols-2 max-[767px]:gap-3',
  artistas: 'mx-auto mt-9 grid w-full max-w-[460px] grid-cols-2 gap-4 max-[767px]:mt-7 max-[767px]:gap-3',
};
// Fondo ilustrado del hero (ver el JSX): cubre la seccion anclado abajo y corrido al 30% (cuando
// object-cover recorta los lados, el corte cae sobre las hojas de la derecha y el sol entra), con un
// fundido corto al pie. En movil, a ancho completo arriba.
const HERO_ART = 'absolute inset-0 h-full w-full object-cover object-[30%_100%] opacity-[.34] mix-blend-multiply [mask-image:linear-gradient(to_bottom,#000_90%,transparent_100%)] max768:inset-auto max768:top-0 max768:left-0 max768:h-auto max768:object-top';
// Halo crema para el texto que cae sobre el arte del arbol.
const HALO = '[text-shadow:0_0_14px_rgba(255,249,236,1),0_0_6px_rgba(255,249,236,1),0_0_3px_rgba(255,249,236,1)]';
// Pildora de estadisticas del saludo: fondo solido para que los numeros se lean sobre el arte.
// Etiquetas en text-muted (~4.6:1 sobre paper); el dorado #b8860b daba ~3.1:1 a 11 px.
// Saludo de la escena greeting en desktop (>1024 px): bloque a la derecha, CENTRADO en la franja
// libre entre Hilo y el borde de la pantalla. Hilo (250 px, mano incluida) termina en ~50% + 130 px,
// asi que la franja va de ahi al borde y su centro esta en 75vw + 65 px. El contenedor del
// contenido tiene transform, por eso el bloque se ubica respecto a esa columna centrada:
// left = 50% (su centro) + 25vw + 65 px; top = mitad del avatar (125 px). El ancho deja el mismo
// hueco a Hilo y al borde. Para moverlo, ajusta solo `left`/`top`/`w` de esta constante.
// En <=1024 px vuelve al flujo, centrado bajo Hilo.
const GREETING_POSITION = 'absolute left-[calc(60%+26vw+69px)] top-[250px] w-[min(333px,calc(60vw-260px))] -translate-x-1/2 -translate-y-1/2 text-left max1024:static max1024:w-auto max1024:max-w-[600px] max1024:mx-auto max1024:translate-none max1024:text-center';
// CTA del saludo.
const HERO_CTA = BTN_INK_LG;
const STAT = 'flex min-w-0 flex-col items-center';
const STAT_NUMBER = 'text-ink text-[26px] font-extrabold leading-none max480:text-[22px]';
const STAT_LABEL = 'mt-1.5 text-center text-[11px] font-bold uppercase leading-[1.2] tracking-[0.14em] text-muted max480:text-[10px] max480:tracking-[0.06em]';
const STAT_DIVIDER = 'h-8 w-px shrink-0 bg-line';

// Una tarjeta: enlace real si tiene destino (se puede abrir en otra pestaña); boton si abre una sub-escena.
function HeroCard({ item, index, className = '', onOpen }) {
  const style = { animationDelay: `${index * 0.07 + 0.3}s`, '--option-color': item.color };
  const body = (
    <>
      <span className={CARD_ICON} aria-hidden="true"><Icon name={item.icon} className="size-6 max-[767px]:size-5" /></span>
      <span className={CARD_LABEL}>{item.label}</span>
      <span className={CARD_SUB} data-hero-sub>{item.sub}</span>
    </>
  );
  if (item.href) {
    return <a className={`${CARD} ${className}`} href={item.href} style={style} data-hero-card={item.id}>{body}</a>;
  }
  return (
    <button className={`${CARD} ${className}`} type="button" style={style} data-hero-card={item.id} aria-label={item.action} onClick={() => onOpen(item)}>
      {body}
    </button>
  );
}

/* --- COMPONENTE ----------------------------------------------- */

export default function HeroInteractive({ onExplore, publications = [] }) {
  const [scene, setScene] = useState('greeting');
  const [showContent, setShowContent] = useState(true);
  const [parallaxShift, setParallaxShift] = useState(0);
  const messageRef = useRef(null);
  const opener = useRef(null); // id de la tarjeta que abrio la sub-escena
  const focusOnShow = useRef(false);

  const isGreeting = scene === 'greeting';
  const currentData = isGreeting ? GREETING : HERO_SCENES[scene];
  // Conteo real de publicaciones: si no hay ninguna, el item no se muestra (nada inventado).
  const stats = [
    [6, 'Municipios'],
    ...(publications.length ? [[publications.length, 'Publicaciones']] : []),
    [1, 'Río conecta'],
  ];

  // Cambio de escena con la transicion de siempre: el contenido sale, el fondo se desplaza y entra.
  const switchTo = useCallback((next, shift) => {
    setShowContent(false);
    setParallaxShift((prev) => prev + shift);
    setTimeout(() => {
      setScene(next);
      setTimeout(() => {
        setParallaxShift((prev) => prev - Math.sign(shift) * 10);
        focusOnShow.current = true;
        setShowContent(true);
      }, 50);
    }, TRANSITION_MS);
  }, []);

  const openScene = useCallback((card) => {
    opener.current = card.id;
    switchTo(card.scene, 15);
  }, [switchTo]);

  // Profundidad 1: "Volver" siempre lleva al saludo.
  const goBack = useCallback(() => switchTo('greeting', -15), [switchTo]);

  // Con la escena ya visible: en una sub-escena, el foco al mensaje de Hilo; de vuelta en el saludo, a
  // la tarjeta que la abrio.
  useEffect(() => {
    if (!showContent || !focusOnShow.current) return;
    focusOnShow.current = false;
    const target = isGreeting ? document.querySelector(`[data-hero-card="${opener.current}"]`) : messageRef.current;
    target?.focus({ preventScroll: true });
  }, [showContent, isGreeting]);

  return (
    // isolate: el boton Volver (z-10) no sale a competir con el header (z-5).
    <section className={`relative isolate overflow-hidden flex flex-col items-center ${isGreeting ? 'justify-start pt-[72px]' : 'justify-center pt-[100px]'} text-center min-h-screen px-[7vw] pb-[60px] text-ink transition-[background] duration-[1.2s] ease-[ease] max768:pt-20 max768:px-[5vw] ${isGreeting ? 'max768:pb-10' : 'max768:pb-20'} max768:min-h-[auto] ${isGreeting ? 'bg-[#f8f4ea]' : HERO_BG[currentData.background]}`} id="inicio" data-hero-escena={scene}>
      {/* Obra tejida (sol + arbol + raices) aclarada sobre el crema: cubre toda la seccion, anclada
          abajo para que las raices queden al pie. El JPG es a todo color; el aclarado es CSS (opacidad
          + multiply, que funde su blanco con el crema) y un velo radial crema deja respirar el centro
          detras de Hilo y el texto. En movil la seccion es alta y angosta: ahi va a ancho completo
          arriba, detras de Hilo, en vez del zoom fuerte de object-cover. */}
      <div aria-hidden="true" className="pointer-events-none select-none absolute inset-0">
        <img
          src="/images/hero/arbol-tejido-claro.jpg"
          alt=""
          width="2000"
          height="1058"
          fetchPriority="high"
          decoding="async"
          className={HERO_ART}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_50%_at_50%_42%,rgba(248,244,234,0.82)_0%,rgba(248,244,234,0.45)_55%,rgba(248,244,234,0)_100%)]" />
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
        className={`relative z-2 w-full max-w-[800px] min-[1025px]:w-[620px] [transform:translateY(12px)] ${showContent ? 'opacity-100' : 'opacity-0'}`}
        style={{ transform: `translateY(${-parallaxShift * 0.5}px)`, transition: 'opacity 0.6s ease, transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)' }}
      >
        {/* Avatar de Hilo — sin caja ni circulo: flota directo sobre los hilos */}
        <div className={`flex flex-col items-center ${isGreeting ? 'mb-6' : 'mb-8'}`}>
          <img
            className="h-[300px] w-auto mb-5 object-contain animate-[heroHiloFloat_3.6s_ease-in-out_infinite] motion-reduce:animate-none drop-shadow-[0_18px_28px_rgba(12,36,30,0.2)] max768:h-[210px]"
            src={`/images/hilo/${currentData.pose}`}
            alt="Hilo, guía de TEJIDO"
          />

          {/* Mensaje de Hilo: en el saludo, tres niveles (DM Sans bold, Arial, pregunta),
              a la derecha en desktop (GREETING_POSITION) y bajo Hilo en pantallas medianas y chicas. */}
          {isGreeting ? (
            <div className={`${GREETING_POSITION} ${HALO}`}>
              <p className="m-0 font-sans text-[length:clamp(65px,3.4vw,50px)] font-bold leading-[1.08] tracking-[-0.03em] text-ink">
                {currentData.title[0]}<br />{currentData.title[1]}
              </p>
              <p className="mt-3 mb-0 font-display text-[length:clamp(20px,2vw,26px)] italic leading-[1.25] text-ink">{currentData.subtitle}</p>
              <p className="mt-3 mb-0 text-[17px] font-semibold leading-[1.4] text-ink">{currentData.question}</p>
            </div>
          ) : (
            <p ref={messageRef} tabIndex={-1} data-hero-mensaje
              className={`text-[length:clamp(20px,2.8vw,28px)] font-bold leading-[1.4] text-ink max-w-[600px] my-0 mx-auto outline-none max768:text-[20px] ${HALO}`}>
              {currentData.message}
            </p>
          )}
        </div>

        {/* Capsula de estadisticas (solo saludo), bajo Hilo */}
        {isGreeting && (
          <div data-hero-stats className="mx-auto flex w-full max-w-[520px] items-center justify-between gap-4 rounded-full border border-solid border-river bg-paper px-8 py-3 max480:gap-2 max480:px-4">
            {stats.map(([value, label], index) => (
              <Fragment key={label}>
                {index > 0 && <span className={STAT_DIVIDER} aria-hidden="true" />}
                <div className={STAT}>
                  <span className={STAT_NUMBER}>{value}</span>
                  <span className={STAT_LABEL}>{label}</span>
                </div>
              </Fragment>
            ))}
          </div>
        )}

        {/* Navegacion rapida: las 7 tarjetas del saludo o las opciones de la sub-escena */}
        {isGreeting ? (
          <nav aria-label="Explora TEJIDO" className={GREETING_GRID} data-hero-tarjetas>
            {HERO_CARDS.map((card, index) => (
              <HeroCard key={card.id} item={card} index={index} className={GREETING_ITEM} onOpen={openScene} />
            ))}
          </nav>
        ) : (
          <>
            <div className={SCENE_GRID[scene]} data-hero-tarjetas>
              {currentData.options.map((option, index) => <HeroCard key={option.id} item={option} index={index} />)}
            </div>
            {currentData.more && (
              <div className="mt-6">
                <a className={BTN_GHOST} href={currentData.more.href} data-hero-mas>
                  {currentData.more.label} <Icon name="arrow-right" className="size-4" />
                </a>
              </div>
            )}
          </>
        )}

        {/* Boton de explorar (solo en el saludo) */}
        {isGreeting && (
          // El boton va directo bajo las tarjetas (sin respiro artificial).
          <div className="mt-10">
            <button className={HERO_CTA} type="button" onClick={() => onExplore && onExplore()}>
              Explora el territorio
            </button>
          </div>
        )}
      </div>

      {/* Boton de regreso (en las sub-escenas) */}
      {!isGreeting && (
        <button className="absolute bottom-6 left-6 z-10 inline-flex items-center gap-1.5 bg-[rgba(255,255,255,0.8)] backdrop-blur-[8px] border border-[rgba(23,58,49,0.12)] rounded-[999px] text-ink cursor-pointer text-[14px] font-semibold py-2.5 px-5 transition-all duration-300 ease-[ease] hover:bg-white hover:[box-shadow:0_4px_16px_rgba(23,58,49,0.1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink max480:bottom-3 max480:left-3 max480:py-2 max480:px-4 max480:text-[13px]" type="button" onClick={goBack} data-hero-volver>
          <Icon name="arrow-left" className="size-4" /> Volver
        </button>
      )}
    </section>
  );
}
