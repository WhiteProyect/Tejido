import { useLayoutEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

// Contenedor cuya altura sigue a su contenido con una animacion (mide con ResizeObserver): cuando el
// contenido cambia de golpe, lo que viene debajo se desplaza suave en vez de saltar. Recorta solo
// mientras anima, para no cortar los anillos de foco en reposo.
export default function AutoHeight({ children, className = '', duration = 0.28 }) {
  const reduceMotion = useReducedMotion();
  const inner = useRef(null);
  const [height, setHeight] = useState(null);
  const [clip, setClip] = useState(false);

  useLayoutEffect(() => {
    const node = inner.current;
    if (!node) return undefined;
    setHeight(node.offsetHeight);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => setHeight(node.offsetHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      className={className}
      initial={false}
      animate={height === null ? undefined : { height }}
      transition={{ duration: reduceMotion ? 0 : duration, ease: [0.22, 1, 0.36, 1] }}
      style={{ overflow: clip ? 'hidden' : 'visible' }}
      onAnimationStart={() => setClip(true)}
      onAnimationComplete={() => setClip(false)}
    >
      <div ref={inner} className="flow-root">{children}</div>
    </motion.div>
  );
}
