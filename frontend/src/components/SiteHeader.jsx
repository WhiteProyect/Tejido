import { useState, useEffect, useRef } from 'react';
import Logo from './Logo.jsx';

export default function SiteHeader({ user, onLogin, onLogout, isMoneystack = false }) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const menuRef = useRef(null);
  const lastScrollY = useRef(0);

  useEffect(() => {
    if (!showUserMenu) return;
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    }
    function handleHashChange() {
      setShowUserMenu(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [showUserMenu]);

  useEffect(() => {
    function handleScroll() {
      const currentScrollY = window.scrollY;
      const scrollDifference = currentScrollY - lastScrollY.current;

      // El header permanece visible arriba y reaparece cuando el usuario sube.
      if (currentScrollY <= 80 || scrollDifference < -6) {
        setIsHidden(false);
      } else if (scrollDifference > 6) {
        setIsHidden(true);
        setShowUserMenu(false);
      }

      lastScrollY.current = currentScrollY;
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Variante oscura en la pantalla de Moneystack. En el legado el hover naranja de los
  // enlaces ganaba tambien ahi (era mas especifico), por eso `hover:text-orange` va en ambos.
  const tone = isMoneystack
    ? { header: 'bg-black border-b-[rgba(0,0,0,0.742)]', text: 'text-[#f7f7f5]', ring: 'border-[#f7f7f5]', login: 'text-[#f7f7f5] hover:bg-[rgba(247,247,245,0.1)] focus-visible:outline-[#f7f7f5]', tip: 'bg-[#f7f7f5] text-[#0a0a0a]' }
    : { header: 'bg-paper border-b-line', text: 'text-ink', ring: 'border-ink', login: 'text-ink hover:bg-cream focus-visible:outline-ink', tip: 'bg-ink text-paper' };
  const navLink = `${tone.text} hover:text-orange`;

  return (
    <header className={`flex items-center justify-between py-[18px] px-[5vw] border-b sticky top-0 z-5 transition-[transform] duration-[220ms] ease-[ease] motion-reduce:transition-none ${tone.header} ${isHidden ? '[transform:translateY(-100%)]' : '[transform:translateY(0)]'}`}>
      <Logo className={tone.text} ringClassName={tone.ring} />
      <nav aria-label="Principal" className="flex gap-8 text-[14px] font-semibold max800:hidden">
        <a href="#inicio" className={navLink}>Inicio</a>
        <a href="#explorar" className={navLink}>Explorar</a>
        <a href="#mapa" className={navLink}>Mapa vivo</a>
        <a href="#agenda" className={navLink}>Agenda</a>
        <a href="#oportunidades" className={navLink}>Oportunidades</a>
        <a href="#talento" className={navLink}>Talento</a>
        <a href="#nosotros" className={navLink}>Nosotros</a>
        <a href="#moneystack" className={navLink}>Moneystack</a>
      </nav>
      {user ? (
        <div className="relative" ref={menuRef}>
          <button className="w-9 h-9 rounded-[50%] bg-ink text-white border-none text-[14px] font-bold cursor-pointer" onClick={() => setShowUserMenu(!showUserMenu)}>
            {user.name?.charAt(0) || '?'}
          </button>
          {showUserMenu && (
            <div className="absolute top-full right-0 mt-2 bg-white border border-line rounded-[12px] [box-shadow:0_8px_24px_rgba(0,0,0,0.12)] min-w-[180px] overflow-hidden z-20">
              <span className="block py-3 px-4 text-[14px] font-bold border-b border-b-line">{user.name}</span>
              <a href="#perfil" className={USER_MENU_ITEM} onClick={() => setShowUserMenu(false)}>Mi perfil</a>
              <button className={USER_MENU_ITEM} onClick={() => { setShowUserMenu(false); onLogout(); }}>Cerrar Sesión</button>
            </div>
          )}
        </div>
      ) : (
        <button className={`group relative inline-flex size-[51px] shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 transition-colors duration-200 ease-[ease] focus-visible:outline-2 focus-visible:outline-offset-2 ${tone.login}`} type="button" onClick={onLogin} aria-label="Iniciar sesión">
          <LoginIcon className="size-9 transition-transform duration-200 ease-[ease] group-hover:scale-105 motion-reduce:transition-none" />
          {/* size-[51px]: misma altura que el antiguo CTA textual, asi el header no cambia de alto.
              Tooltip visual (hover y foco por teclado); el nombre accesible ya es el aria-label. */}
          <span className={`pointer-events-none absolute top-full right-0 mt-2 whitespace-nowrap rounded-[8px] py-1 px-2.5 text-[12px] font-semibold opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 ${tone.tip}`} aria-hidden="true">
            Iniciar sesión
          </span>
        </button>
      )}
    </header>
  );
}

// Icono de acceso: silueta de usuario (cabeza circular + cuerpo redondeado) con una flecha
// de entrada hacia la derecha, que cruza un umbral. Tres ideas de TEJIDO en tres colores:
// - la persona: silueta solida en --orange, sin contorno (con un brillo en --paper);
// - el hilo: la flecha ondula como el rio, en --river ("el color de la conexion", manual);
// - el umbral: la puerta del territorio, en currentColor (tinta en el header claro,
//   #f7f7f5 en Moneystack, para que no se pierda sobre negro).
// Sin animacion propia.
function LoginIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="9.5" cy="9" r="4.2" stroke="none" style={{ fill: 'var(--orange)' }} />
      <path d="M2.75 27c0-5 3-8.6 6.75-8.6s6.75 3.6 6.75 8.6z" stroke="none" style={{ fill: 'var(--orange)' }} />
      <path d="M5.5 22.5c1-1.6 2.4-2.4 4-2.4" strokeWidth="1.4" style={{ stroke: 'var(--paper)' }} />
      <path d="M23.5 5.5h2.75A2.75 2.75 0 0 1 29 8.25v15.5a2.75 2.75 0 0 1-2.75 2.75H23.5" />
      <path d="M15 16c1.6 0 2-1.3 3.5-1.3s1.9 1.3 3.5 1.3h3.2m-2.6-2.7 2.7 2.7-2.7 2.7" strokeWidth="2.1" style={{ stroke: 'var(--river)' }} />
    </svg>
  );
}

const USER_MENU_ITEM ='block w-full py-2.5 px-4 border-none bg-transparent text-left text-[14px] cursor-pointer no-underline text-ink transition-[background] duration-200 ease-[ease] hover:bg-cream';
