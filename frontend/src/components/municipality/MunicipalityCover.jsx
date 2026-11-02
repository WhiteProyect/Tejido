import { useLayoutEffect, useRef, useState } from 'react';
import { animate, motion, useReducedMotion } from 'framer-motion';

// Modulo 1: portada territorial. Se pinta de inmediato con utils/municipalities.js (no espera al
// endpoint). Capas:
// - fondo de tinta: al llegar desde el hub (morphFrom = caja de la pildora pulsada) se pone encima de
//   la pildora antes de pintarse y crece hasta su tamaño en 280 ms (FLIP, ver
//   utils/municipalityTransition.js); las esquinas se compensan para que empiece como pildora;
// - la foto con una capa PLANA de tinta encima (sin degradados), recortadas en su propio marco: la
//   seccion no recorta, para que el fondo pueda viajar desde la pildora sin cortarse. La foto entra
//   con un fundido cuando termina el morph; si no carga, queda la tinta con el acento;
// - insignia y nombre entran juntos, la frase 80 ms despues y luego los datos rapidos
//   (MunicipalityInfo, con entranceDelays).
// El acento va en el borde de la insignia, su punto y la franja lateral (decorativos).
export const COVER_EASE = [0.22, 1, 0.36, 1];

const MORPH_SECONDS = 0.28;

export function entranceDelays(viaMorph) {
  // Desde el hub el contenido espera al morph (140-420 ms de la coreografia, ya montada a los 140).
  const base = viaMorph ? 0.28 : 0.05;
  return { photo: viaMorph ? 0.28 : 0, badge: base, title: base, phrase: base + 0.08, facts: base + 0.16 };
}

export default function MunicipalityCover({ municipality, headingRef, morphFrom = null }) {
  const reduceMotion = useReducedMotion();
  const viaMorph = Boolean(morphFrom) && !reduceMotion;
  const layerRef = useRef(null);
  const [failedImage, setFailedImage] = useState(null);

  // FLIP: medir el destino, ponerse sobre la pildora (antes de pintar) y animar hasta el destino.
  useLayoutEffect(() => {
    const layer = layerRef.current;
    if (!viaMorph || !layer) return undefined;
    // Medir sin transform: en desarrollo StrictMode repite el efecto y la primera pasada ya movio la capa.
    layer.style.transform = '';
    const to = layer.getBoundingClientRect();
    const sx = morphFrom.width / to.width;
    const sy = morphFrom.height / to.height;
    const pillRadius = morphFrom.height / 2;
    // Radio elíptico: con la escala, se ve como el de la pildora (y termina en el de la portada).
    const from = `${pillRadius / sx}px / ${pillRadius / sy}px`;
    layer.style.transformOrigin = '0 0';
    layer.style.transform = `translate(${morphFrom.left - to.left}px, ${morphFrom.top - to.top}px) scale(${sx}, ${sy})`;
    layer.style.borderRadius = from;
    const controls = animate(layer, {
      x: [morphFrom.left - to.left, 0],
      y: [morphFrom.top - to.top, 0],
      scaleX: [sx, 1],
      scaleY: [sy, 1],
      borderRadius: [from, '24px / 24px'],
    }, { duration: MORPH_SECONDS, ease: COVER_EASE });
    return () => {
      controls.stop();
      layer.style.transform = '';
      layer.style.borderRadius = '24px';
    };
  }, [viaMorph, morphFrom]);

  const showImage = municipality.image && failedImage !== municipality.image;
  const delays = entranceDelays(viaMorph);
  const rise = (delay) => (reduceMotion ? {} : {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.24, delay, ease: COVER_EASE },
  });

  return (
    <section aria-labelledby="municipio-titulo" className="relative isolate flex min-h-[440px] flex-col justify-end p-8 md:p-14 max600:min-h-[380px]">
      <div ref={layerRef} aria-hidden="true" className="absolute inset-0 -z-20 bg-ink" style={{ borderRadius: 24 }} />
      {/* Durante el morph este marco (capa plana y franja) no se ve: si no, ocuparia ya la portada entera. */}
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 -z-10 overflow-hidden rounded-3xl"
        {...(viaMorph ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2, delay: delays.photo } } : {})}
      >
        {showImage && (
          <motion.img
            src={municipality.image}
            alt=""
            className="absolute inset-0 size-full object-cover"
            decoding="async"
            onError={() => setFailedImage(municipality.image)}
            {...(reduceMotion ? {} : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.3, delay: delays.photo } })}
          />
        )}
        <span className="absolute inset-0 bg-ink/75" />
        <span className="absolute inset-y-0 left-0 w-2" style={{ backgroundColor: municipality.accent }} />
      </motion.div>
      <motion.p
        className="m-0 inline-flex w-fit max-w-full items-center gap-2 rounded-full border-[1.5px] bg-ink/60 py-1.5 px-4 text-[12px] font-bold uppercase tracking-[.12em] text-paper"
        style={{ borderColor: municipality.accent }}
        {...rise(delays.badge)}
      >
        <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: municipality.accent }} />
        Portada territorial · Bajo Cauca Antioqueño
      </motion.p>
      <motion.h1
        id="municipio-titulo"
        ref={headingRef}
        tabIndex={-1}
        className="mt-6 mb-0 font-sans text-[length:clamp(48px,8vw,104px)] font-bold leading-[.95] tracking-[-0.045em] text-paper outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper"
        {...rise(delays.title)}
      >
        {municipality.name}
      </motion.h1>
      <motion.p className="mt-5 mb-0 max-w-[640px] font-display text-[length:clamp(20px,2.4vw,30px)] italic leading-[1.35] text-paper" {...rise(delays.phrase)}>
        {municipality.phrase}
      </motion.p>
    </section>
  );
}
