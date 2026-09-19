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

export default function Footer() {
  return (
    <motion.footer
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
          keyframe nuevo. */}
      <svg className="footer-threshold" aria-hidden="true">
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

      <motion.div className="footer-brand" variants={footerItem}>
        <Logo showLocation={false} />
        <p>Descubre lo que mueve a Caucasia.</p>
        <div className="footer-partners" aria-label="Aliados de Tejido">
          <div className="footer-partner-logo">
            <img src="/images/white-proyect-logo.png" alt="White Proyect" title="White Proyect" />
          </div>
          <div className="footer-partner-logo footer-moneystack-logo">
            <img
              src="/images/moneystack/logo.png"
              alt="Moneystack"
              title="Moneystack"
              onError={(event) => {
                event.currentTarget.style.display = 'none';
                event.currentTarget.parentElement?.classList.add('is-fallback');
              }}
            />
            <span className="footer-moneystack-mark" aria-hidden="true">MS</span>
          </div>
        </div>
      </motion.div>
      <motion.div variants={footerItem}>
        <b>Explora</b>
        <a href="#explorar">Historias</a>
        <a href="#agenda">Eventos</a>
        <a href="#oportunidades">Oportunidades</a>
        <a href="#talento">Talento</a>
      </motion.div>
      <motion.div variants={footerItem}>
        <b>Proyecto</b>
        <a href="#inicio">Acerca de TEJIDO</a>
        <a href="#mapa">Mapa vivo</a>
        <a href="#guardadas">Guardadas</a>
      </motion.div>
      <motion.div className="footer-note" variants={footerItem}>
        <span>Hecho con orgullo<br />en Caucasia, Antioquia.</span>
        <span>© 2026 TEJIDO</span>
      </motion.div>
    </motion.footer>
  );
}
