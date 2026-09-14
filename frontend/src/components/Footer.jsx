import Logo from './Logo.jsx';

export default function Footer() {
  return (
    <footer>
      <div className="footer-brand">
        <Logo showLocation={false} />
        <p>Descubre lo que mueve a Caucasia.</p>
        <div className="footer-partners" aria-label="Aliados de Tejido">
          <div className="footer-partner-logo">
            <img src="/images/white-proyect-logo.png" alt="White Proyect" />
            <span>White Proyect</span>
          </div>
          <div className="footer-partner-logo footer-moneystack-logo">
            <img
              src="/images/moneystack/logo.png"
              alt="Moneystack"
              onError={(event) => {
                event.currentTarget.style.display = 'none';
                event.currentTarget.parentElement?.classList.add('is-fallback');
              }}
            />
            <span className="footer-moneystack-mark" aria-hidden="true">MS</span>
            <span>Moneystack</span>
          </div>
        </div>
      </div>
      <div>
        <b>Explora</b>
        <a href="#explorar">Historias</a>
        <a href="#agenda">Eventos</a>
        <a href="#oportunidades">Oportunidades</a>
        <a href="#talento">Talento</a>
      </div>
      <div>
        <b>Proyecto</b>
        <a href="#inicio">Acerca de TEJIDO</a>
        <a href="#mapa">Mapa vivo</a>
        <a href="#guardadas">Guardadas</a>
      </div>
      <div className="footer-note">
        <span>Hecho con orgullo<br />en Caucasia, Antioquia.</span>
        <span>© 2026 TEJIDO</span>
      </div>
    </footer>
  );
}
