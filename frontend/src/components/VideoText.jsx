import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion, useScroll, useTransform } from 'framer-motion';

// Texto relleno de video (estilo "Video Text" de Magic UI, sin la libreria). El <video> va al
// fondo y encima un rectangulo SVG color forest con la palabra recortada como hueco, asi el
// video solo se ve dentro de las letras. Se hace al reves de "mask sobre el <video>" porque
// Safari no aplica mask: url(#...) de CSS a elementos HTML; una mascara SVG sobre un elemento
// SVG si funciona en todos los navegadores.
// El fondo forest de la seccion cubre mientras el video carga. Con movimiento reducido el
// video no arranca y se queda en su primer cuadro.
//
// Franja botanica (caña fistula, PDF "Franja Botanica y Video TEJIDO"). Una UNIDAD por lado, con una
// sola escala: la rama de fondo y su racimo de frente. Los PNG de frente son el mismo dibujo que un
// racimo de la rama de fondo (recortes de la misma composicion, misma escala; posicion medida por
// comparacion de pixeles: offset). Para que no haya doble imagen, la capa del racimo se pinta con la
// MISMA imagen de la rama (mismo tamaño y posicion, pixel a pixel) y el PNG de frente solo se usa como
// mascara para quedarse con el racimo. Mientras el racimo entra, la rama lleva la mascara contraria
// (el hueco del racimo; su primera capa es un color solido, no un degradado); al asentarse se quita y
// las dos capas son la misma imagen.
// Las PNG son recortes de una composicion mayor (hojas cortadas en seco en sus bordes): la unidad
// sobra un 12 % arriba y abajo de la seccion y su borde exterior queda fuera del viewport, asi ni la
// entrada ni el balanceo destapan un corte. El rect de la mascara del video es opaco: toda la flora va
// ENCIMA del svg; la unidad se ubica para que solo el racimo pise la T (esquina superior izquierda) y la
// O (borde derecho). Las letras se miden en el navegador (measureLetters) con ResizeObserver.
const MASK_ID = 'tejido-video-text-mask';
// Letras: 22.5vw desde 768 px (con la altura de la seccion, ver SECTION_HEIGHT, la flora queda pegada
// al borde del viewport y al racimo de la letra hasta 2560 px). En movil (< 768 px), 26.5vw: ~86 %
// del ancho (opcion B del PDF).
const FONT_SIZE_CLASS = '[font-size:clamp(84px,22.5vw,600px)] max-[767.98px]:[font-size:clamp(84px,26.5vw,300px)]';
// Desde 768 px la altura escala con el ancho (36vw) entre 320 y 455 px: 455 px es el tope para que
// las PNG (434 px de alto, con el 24 % de sobrante) no pasen de 1.3x. En movil, la de siempre
// (55vh, 40vh en <= 600 px), sin pasar de 455 px.
const SECTION_HEIGHT = 'min-h-[320px] h-[clamp(320px,36vw,455px)] max-h-[455px] max-[767.98px]:h-[55vh] max600:h-[40vh] max600:min-h-[260px]';
const FONT_FAMILY = "'DM Sans', sans-serif";
const LETTER_SPACING = '-.04em';
// Sobrante de la unidad por arriba y por abajo de la seccion (fraccion del alto de la seccion), y
// minimo del borde exterior por fuera del viewport.
const BLEED_Y = 0.12;
const BLEED_X = 0.03;
// Cuanto pisa el racimo la letra (fraccion del tamaño de letra): la esquina de la T y el borde de la O.
const OVER_T = 0.17;
const OVER_O = 0.08;

// Cada unidad: rama de fondo (tamaño natural), su racimo de frente registrado en % de la unidad, la
// tinta del racimo en px de la imagen de fondo (borde que pisa la letra) y los origenes de giro.
const UNITS = {
  left: {
    back: { src: '/images/flora/flora-izq-fondo.png', w: 406, h: 434 },
    front: { src: '/images/flora/flora-izq-frente.png', w: 390, h: 434 },
    // izq-frente cae en (109, 0) px de izq-fondo (26,847 % del ancho de la rama).
    offset: 109,
    // Perfil de tinta por bandas de 10 filas (alfa > 24, medido sobre las PNG), en px de izq-fondo:
    // x maximo del racimo y de toda la rama en cada banda (-1 = banda vacia).
    cluster: [310, 307, 306, 297, 337, 332, 322, 361, 359, 349, 364, 381, 382, 350, 376, 384, 387, 361, 359, 354, 354, 338, 342, 340, 336, 341, 338, 325, 306, 320, 313, 306, 306, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    branch: [310, 307, 306, 297, 337, 332, 322, 361, 359, 349, 364, 381, 382, 350, 376, 384, 387, 361, 359, 354, 354, 338, 342, 340, 336, 341, 344, 339, 324, 364, 380, 382, 338, 332, 339, 345, 352, 352, 339, 341, 193, 194, 196, 196],
    // Balanceo de la unidad desde el borde del que nace; la entrada del racimo gira desde su punta (x 135, y 0).
    origin: '0% 60%',
    frontOrigin: `${((109 + 135) / 406) * 100}% 0%`,
  },
  right: {
    back: { src: '/images/flora/flora-der-fondo.png', w: 469, h: 434 },
    front: { src: '/images/flora/flora-der-frente.png', w: 427, h: 434 },
    // der-frente cae en (17, 0) px de der-fondo (3,625 % del ancho de la rama).
    offset: 17,
    // Igual, en px de der-fondo: x minimo del racimo y de toda la rama en cada banda.
    cluster: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 179, 182, 158, 156, 187, 170, 158, 154, 154, 172, 168, 168, 171, 162, 149, 141, 178, 175, 173, 171, 167, 163, 161, 161, 161, 225, 225, 232, 238, 238, -1, -1, -1],
    branch: [104, 19, 23, 35, 46, 61, 90, 75, 61, 96, 96, 179, 182, 158, 156, 187, 170, 158, 154, 154, 172, 168, 161, 161, 161, 149, 141, 178, 175, 173, 171, 167, 163, 161, 161, 161, 225, 225, 232, 238, 238, 277, 300, 318],
    origin: '100% 60%',
    frontOrigin: `${((17 + 186) / 469) * 100}% ${(111 / 434) * 100}%`,
  },
};

// Entrada (una vez, al ver ~35 % de la seccion): la unidad crece desde su costado y el racimo cae
// despues. Balanceo continuo de la unidad desde su borde, con duracion y fase distintas en cada lado.
// El racimo NO tiene pendulo propio: la mascara deja un contorno tenue del racimo en la rama (los
// bordes suavizados) y cualquier giro independiente, aun de 1 grado, lo mostraria desfasado.
const MOTION = {
  left: {
    from: { opacity: 0, x: -80, rotate: -4, scale: 0.92 }, delay: 0, duration: 1.4,
    sway: { rot: '1.6deg', y: '4px', time: '11s', phase: '-3.2s' },
    front: { from: { opacity: 0, y: -20, rotate: -3 }, delay: 0.45, duration: 1.3 },
  },
  right: {
    from: { opacity: 0, x: 80, rotate: 4, scale: 0.92 }, delay: 0.12, duration: 1.5,
    sway: { rot: '1.6deg', y: '4px', time: '9.6s', phase: '-7.1s' },
    front: { from: { opacity: 0, y: -20, rotate: 3 }, delay: 0.57, duration: 1.3 },
  },
};
const PARALLAX = 12;
const SETTLED = { opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 };
const EASE_OUT = [0.16, 1, 0.3, 1];

// Caja de tinta de cada letra en px de la seccion. Del <text> salen la posicion de cada caracter
// (getStartPositionOfChar, ya con el letter-spacing y el centrado) y su celda (getExtentOfChar: arriba
// de la celda + el ascenso de la fuente = linea base). De canvas measureText, con la misma fuente,
// sale la tinta del glifo respecto a esa linea base (actualBoundingBox*). Verificado contra los
// pixeles reales de la T a 1300 y 390 px.
function measureLetters(textEl, text) {
  const fontSize = parseFloat(getComputedStyle(textEl).fontSize);
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = `700 ${fontSize}px "DM Sans"`;
  ctx.textBaseline = 'alphabetic';
  return [...text].map((char, index) => {
    const start = textEl.getStartPositionOfChar(index);
    const cell = textEl.getExtentOfChar(index);
    const m = ctx.measureText(char);
    const baseline = cell.y + m.fontBoundingBoxAscent;
    return {
      left: start.x - m.actualBoundingBoxLeft,
      right: start.x + m.actualBoundingBoxRight,
      top: baseline - m.actualBoundingBoxAscent,
      bottom: baseline + m.actualBoundingBoxDescent,
      fontSize,
    };
  });
}

// Extremo del perfil (max o min) entre dos alturas de la seccion, pasadas a filas de la imagen.
const BAND = 10;
function inkExtreme(profile, fromY, toY, top, scale, pick) {
  const first = Math.max(0, Math.floor((fromY - top) / scale / BAND));
  const last = Math.min(profile.length - 1, Math.floor((toY - top) / scale / BAND));
  const values = profile.slice(first, last + 1).filter((v) => v >= 0);
  return values.length ? pick(...values) : null;
}

// Caja de cada unidad (px de la seccion). Alto = seccion + sobrante. El racimo izquierdo llega OVER_T
// dentro de la T en las filas de su travesaño y el derecho entra OVER_O en la O a media altura (con el
// perfil de tinta de esas filas, no con la caja del dibujo). Topes: la rama entera no llega a la E ni
// a la D en las filas de las letras, y el borde exterior nunca queda dentro de la seccion.
function layoutUnits(letters, width, height) {
  const T = letters[0];
  const E = letters[1];
  const D = letters[letters.length - 2];
  const O = letters[letters.length - 1];
  const fs = T.fontSize;
  const margin = height * BLEED_X;
  const gap = Math.max(4, 0.03 * fs);
  const bandTop = Math.min(...letters.map((l) => l.top));
  const bandBottom = Math.max(...letters.map((l) => l.bottom));
  const box = (unit) => {
    const scale = (height * (1 + 2 * BLEED_Y)) / unit.back.h;
    const unitHeight = unit.back.h * scale;
    return { scale, unitHeight, width: unit.back.w * scale, top: Math.round((height - unitHeight) / 2) };
  };
  const left = (() => {
    const { cluster, branch } = UNITS.left;
    const { scale, unitHeight, width: w, top } = box(UNITS.left);
    const tCrossbar = T.top + 0.22 * (T.bottom - T.top);
    const reach = inkExtreme(cluster, T.top, tCrossbar, top, scale, Math.max) ?? Math.max(...cluster);
    const widest = inkExtreme(branch, bandTop, bandBottom, top, scale, Math.max) ?? 0;
    const x = Math.min(T.left + OVER_T * fs - reach * scale, E.left - gap - widest * scale, -margin);
    return { left: Math.floor(x), top, width: w, height: unitHeight, scale };
  })();
  const right = (() => {
    const { cluster, branch } = UNITS.right;
    const { scale, unitHeight, width: w, top } = box(UNITS.right);
    const oHeight = O.bottom - O.top;
    const reach = inkExtreme(cluster, O.top + 0.3 * oHeight, O.top + 0.7 * oHeight, top, scale, Math.min) ?? 141;
    const nearest = inkExtreme(branch, bandTop, bandBottom, top, scale, Math.min) ?? w;
    const x = Math.max(O.right - OVER_O * fs - reach * scale, D.right + gap - nearest * scale, width + margin - w);
    return { left: Math.ceil(x), top, width: w, height: unitHeight, scale };
  })();
  return { left, right };
}

function FloraUnit({ side, rect, reduceMotion, entered, visible, progress }) {
  const [failed, setFailed] = useState(false);
  // El racimo ya entro: la rama deja de llevar el hueco y las dos capas quedan identicas.
  const [settled, setSettled] = useState(false);
  const unit = UNITS[side];
  const spec = MOTION[side];
  const parallax = useTransform(progress, [0, 1], [PARALLAX, -PARALLAX]);
  if (failed || !rect) return null;
  const scale = rect.height / unit.back.h;
  const sway = reduceMotion ? { animation: 'none' } : {
    transformOrigin: unit.origin,
    '--flora-rot': spec.sway.rot,
    '--flora-y': spec.sway.y,
    animation: `floraSway ${spec.sway.time} ease-in-out ${spec.sway.phase} infinite alternate`,
    animationPlayState: visible ? 'running' : 'paused',
    willChange: visible ? 'transform' : 'auto',
  };
  // Mascara del racimo: el PNG de frente en su posicion registrada dentro de la rama.
  const cluster = { url: `url(${unit.front.src})`, position: `${unit.offset * scale}px 0px`, size: `${unit.front.w * scale}px ${unit.front.h * scale}px` };
  const maskStyle = (image, position, size, composite) => ({
    WebkitMaskImage: image, maskImage: image,
    WebkitMaskPosition: position, maskPosition: position,
    WebkitMaskSize: size, maskSize: size,
    WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
    ...(composite ? { WebkitMaskComposite: 'xor', maskComposite: 'exclude' } : {}),
  });
  const onlyCluster = maskStyle(cluster.url, cluster.position, cluster.size);
  const withoutCluster = reduceMotion || settled ? {} : maskStyle(`linear-gradient(#000 0 0), ${cluster.url}`, `0 0, ${cluster.position}`, `100% 100%, ${cluster.size}`, true);
  const transition = (cfg) => (reduceMotion ? { duration: 0 } : { duration: cfg.duration, delay: cfg.delay, ease: EASE_OUT });
  const imgProps = { src: unit.back.src, width: unit.back.w, height: unit.back.h, alt: '', draggable: false, decoding: 'async', loading: 'lazy', className: 'absolute inset-0 block size-full select-none' };

  return (
    // Envolturas (cada transform en la suya): parallax de la unidad > entrada de la unidad > balanceo
    // de la unidad > [rama, racimo con su entrada]. Rama y racimo comparten todo lo de la unidad, asi
    // el racimo no se separa de su rama.
    <motion.div
      aria-hidden="true"
      data-flora={side}
      className="pointer-events-none absolute z-10 select-none"
      style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height, y: reduceMotion ? 0 : parallax }}
    >
      <motion.div
        className="size-full"
        style={{ transformOrigin: unit.origin }}
        initial={reduceMotion ? SETTLED : spec.from}
        animate={reduceMotion || entered ? SETTLED : spec.from}
        transition={transition(spec)}
      >
        <div className="relative size-full" data-flora-sway style={sway}>
          <img {...imgProps} style={withoutCluster} onError={() => setFailed(true)} data-flora-back />
          <motion.div
            className="absolute inset-0"
            style={{ transformOrigin: unit.frontOrigin }}
            initial={reduceMotion ? SETTLED : spec.front.from}
            animate={reduceMotion || entered ? SETTLED : spec.front.from}
            transition={transition(spec.front)}
            onAnimationComplete={() => { if (entered) setSettled(true); }}
          >
            <img {...imgProps} style={onlyCluster} data-flora-front />
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function VideoText({ text = 'TEJIDO', videoSrc = '/videos/tejido-video.mp4', className = '' }) {
  const reduceMotion = useReducedMotion();
  const videoRef = useRef(null);
  const sectionRef = useRef(null);
  const measureRef = useRef(null);
  const [layout, setLayout] = useState(null);
  const entered = useInView(sectionRef, { once: true, amount: 0.35 });
  const visible = useInView(sectionRef, { amount: 0 });
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start end', 'end start'] });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (reduceMotion) {
      video.pause();
      video.currentTime = 0;
    } else {
      video.play().catch(() => {});
    }
  }, [reduceMotion]);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    const textEl = measureRef.current;
    if (!section || !textEl) return undefined;
    let alive = true;
    const update = () => {
      if (!alive) return;
      try {
        const { width, height } = section.getBoundingClientRect();
        setLayout(layoutUnits(measureLetters(textEl, text), width, height));
      } catch {
        setLayout(null);
      }
    };
    const observer = new ResizeObserver(update);
    observer.observe(section);
    // Las medidas cambian cuando termina de cargar DM Sans: se repite un cuadro despues, cuando el
    // <text> ya se maqueto con la fuente final.
    const afterFonts = () => requestAnimationFrame(update);
    document.fonts?.ready.then(afterFonts);
    document.fonts?.addEventListener('loadingdone', afterFonts);
    return () => {
      alive = false;
      observer.disconnect();
      document.fonts?.removeEventListener('loadingdone', afterFonts);
    };
  }, [text]);

  const unitProps = { reduceMotion, entered, visible, progress: scrollYProgress };

  return (
    <section ref={sectionRef} className={`relative w-full overflow-hidden bg-forest ${SECTION_HEIGHT} ${className}`}>
      <h2 className="sr-only">{text}</h2>
      <video
        ref={videoRef}
        src={videoSrc}
        autoPlay={!reduceMotion}
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
        className="absolute inset-0 size-full object-cover"
      />
      <svg className="absolute inset-0 z-0 size-full" aria-hidden="true">
        <defs>
          {/* Blanco = se pinta el forest; negro (las letras) = hueco por donde se ve el video. */}
          <mask id={MASK_ID}>
            <rect x="-5%" y="-5%" width="110%" height="110%" fill="white" />
            <text
              x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fill="black"
              fontFamily={FONT_FAMILY} fontWeight="700" letterSpacing={LETTER_SPACING}
              // 700: el peso mas alto de DM Sans que carga tailwind.css. El clamp va en CSS
              // porque el atributo font-size de SVG no acepta clamp().
              className={FONT_SIZE_CLASS}
            >
              {text}
            </text>
          </mask>
        </defs>
        {/* Se pasa un poco del borde (la seccion lo recorta) para que el redondeo de alturas
            fraccionarias, como 40vh, no deje ver una linea de video en el canto. */}
        <rect className="fill-forest" x="-5%" y="-5%" width="110%" height="110%" mask={`url(#${MASK_ID})`} />
        {/* Copia invisible del texto, solo para medir las letras (el de la mascara no se dibuja y no
            da geometria fiable). */}
        <text
          ref={measureRef}
          x="50%" y="50%" textAnchor="middle" dominantBaseline="central" visibility="hidden"
          fontFamily={FONT_FAMILY} fontWeight="700" letterSpacing={LETTER_SPACING}
          className={FONT_SIZE_CLASS}
        >
          {text}
        </text>
      </svg>
      {layout && (
        <>
          <FloraUnit side="left" rect={layout.left} {...unitProps} />
          <FloraUnit side="right" rect={layout.right} {...unitProps} />
        </>
      )}
    </section>
  );
}
