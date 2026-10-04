import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

// Texto relleno de video (estilo "Video Text" de Magic UI, sin la libreria). El <video> va al
// fondo y encima un rectangulo SVG color forest con la palabra recortada como hueco, asi el
// video solo se ve dentro de las letras. Se hace al reves de "mask sobre el <video>" porque
// Safari no aplica mask: url(#...) de CSS a elementos HTML; una mascara SVG sobre un elemento
// SVG si funciona en todos los navegadores.
// El fondo forest de la seccion cubre mientras el video carga. Con movimiento reducido el
// video no arranca y se queda en su primer cuadro.
const MASK_ID = 'tejido-video-text-mask';

export default function VideoText({ text = 'TEJIDO', videoSrc = '/videos/tejido-video.mp4', className = '' }) {
  const reduceMotion = useReducedMotion();
  const videoRef = useRef(null);

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

  return (
    <section className={`relative h-[55vh] min-h-[320px] w-full overflow-hidden bg-forest max600:h-[40vh] max600:min-h-[260px] ${className}`}>
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
      <svg className="absolute inset-0 size-full" aria-hidden="true">
        <defs>
          {/* Blanco = se pinta el forest; negro (las letras) = hueco por donde se ve el video. */}
          <mask id={MASK_ID}>
            <rect x="-5%" y="-5%" width="110%" height="110%" fill="white" />
            <text
              x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fill="black"
              fontFamily="'DM Sans', sans-serif" fontWeight="700" letterSpacing="-.04em"
              // 700: el peso mas alto de DM Sans que carga tailwind.css. El clamp va en style
              // porque el atributo font-size de SVG no acepta clamp().
              style={{ fontSize: 'clamp(84px, 26vw, 300px)' }}
            >
              {text}
            </text>
          </mask>
        </defs>
        {/* Se pasa un poco del borde (la seccion lo recorta) para que el redondeo de alturas
            fraccionarias, como 40vh, no deje ver una linea de video en el canto. */}
        <rect className="fill-forest" x="-5%" y="-5%" width="110%" height="110%" mask={`url(#${MASK_ID})`} />
      </svg>
    </section>
  );
}
