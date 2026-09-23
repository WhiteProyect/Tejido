import { useState } from 'react';
import { motion } from 'framer-motion';
import Logo from './Logo.jsx';

const footerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const footerItem = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

// Columnas del footer y sus enlaces (antes: reglas globales `footer > div` y `footer a` de main.css).
const COL = 'flex flex-col items-start gap-[9px]';
const LINK = 'text-[#aebdb8] text-[13px] transition-[color] duration-200 ease-[ease] hover:text-gold';
// El logo tambien era un `footer a`: mismo color y hover que los enlaces, con su propio tamano.
const LOGO_TEXT = 'text-[#aebdb8] transition-[color] duration-200 ease-[ease] hover:text-gold';
const HEADING = 'text-gold text-[11px] font-bold tracking-[.14em] mb-[7px] uppercase';
const PARTNER = 'group flex flex-col items-center gap-2 min-w-16';
const PARTNER_IMG = 'items-center justify-center h-16 w-16 object-contain transition-[filter,transform] duration-300 ease-[cubic-bezier(.25,.8,.25,1)] group-hover:[filter:brightness(1.15)] group-hover:[transform:translateY(-3px)]';

export default function Footer() {
  const [moneystackLogoFailed, setMoneystackLogoFailed] = useState(false);

  return (
    <motion.footer
      className="relative grid grid-cols-[2fr_1fr_1fr_1.2fr] gap-[50px] overflow-hidden bg-footer text-white rounded-footer mt-[60px] mx-[clamp(16px,3vw,40px)] mb-10 pt-[70px] px-[7vw] pb-10 max600:grid-cols-[1fr] max600:rounded-footer-sm max600:mt-10 max600:mx-3 max600:mb-6 max600:py-15 max600:px-5"
      variants={footerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.15 }}
    >
      {/* El "umbral" de la puerta -- ver MANUAL_ESENCIA_TEJIDO.md, seccion
          FOOTER: "no es un muro, es una puerta". Ahora recorre todo el borde
          (siguiendo las esquinas redondeadas), reutilizando literalmente la
          animacion snakeFlow (stroke-dashoffset, 12s ease-in-out) que ya
          define el manual para el rio/serpiente, en vez de inventar un
          keyframe nuevo. El trazo (.footer-threshold-line) se queda en main.css. */}
      <svg className="absolute inset-0 pointer-events-none w-full h-full z-1" aria-hidden="true">
        <defs>
          {/* userSpaceOnUse: un rect sin fill puede tener bbox valido, pero
              se mantiene por consistencia con el fix anterior del gradiente. */}
          <linearGradient id="footer-threshold-gradient" gradientUnits="userSpaceOnUse" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--gold, #d4a843)" />
            <stop offset="100%" stopColor="var(--river, #1d8fa3)" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" rx="28" ry="28" className="footer-threshold-line" />
      </svg>

      <motion.div className={COL} variants={footerItem}>
        <Logo showLocation={false} className={LOGO_TEXT} ringClassName="border-white" />
        <p className="text-[#aebdb8]">Descubre lo que mueve a Caucasia.</p>
        <div className="flex flex-wrap [align-items:start] gap-7 mt-6" aria-label="Aliados de Tejido">
          <div className={PARTNER}>
            <img className={`flex ${PARTNER_IMG}`} src="/images/white-proyect-logo.png" alt="White Proyect" title="White Proyect" />
          </div>
          <div className={PARTNER}>
            <img
              className={`${moneystackLogoFailed ? 'hidden' : 'flex'} ${PARTNER_IMG}`}
              src="/images/moneystack/logo.png"
              alt="Moneystack"
              title="Moneystack"
              onError={() => setMoneystackLogoFailed(true)}
            />
            <span className={`${moneystackLogoFailed ? 'flex' : 'hidden'} items-center justify-center h-16 w-16 object-contain text-white text-[20px] font-extrabold tracking-[-.08em]`} aria-hidden="true">MS</span>
          </div>
        </div>
      </motion.div>
      {/* Divisor sutil entre las dos columnas de navegacion: se desvanece arriba y abajo. */}
      <motion.div className={`${COL} border-l [border-image:linear-gradient(to_bottom,transparent,rgba(255,255,255,.16),transparent)_1] pl-[34px] max600:border-none max600:pl-0`} variants={footerItem}>
        <b className={HEADING}>Explora</b>
        <a href="#explorar" className={LINK}>Historias</a>
        <a href="#agenda" className={LINK}>Eventos</a>
        <a href="#oportunidades" className={LINK}>Oportunidades</a>
        <a href="#talento" className={LINK}>Talento</a>
      </motion.div>
      <motion.div className={COL} variants={footerItem}>
        <b className={HEADING}>Proyecto</b>
        <a href="#nosotros" className={LINK}>Nosotros</a>
        <a href="#mapa" className={LINK}>Mapa vivo</a>
        <a href="#guardadas" className={LINK}>Guardadas</a>
      </motion.div>
      <motion.div className={`${COL} text-[#aebdb8]`} variants={footerItem}>
        <span>Hecho con orgullo<br />en Caucasia, Antioquia.</span>
        <span className="text-[11px] mt-auto">© 2026 TEJIDO</span>
      </motion.div>
    </motion.footer>
  );
}
