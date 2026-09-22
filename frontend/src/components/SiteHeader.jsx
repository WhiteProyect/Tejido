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
    ? { header: 'bg-black border-b-[rgba(0,0,0,0.742)]', text: 'text-[#f7f7f5]', ring: 'border-[#f7f7f5]', login: 'border-[#f7f7f5] text-[#f7f7f5] hover:bg-[#f7f7f5] hover:[box-shadow:0_8px_20px_rgba(0,0,0,.35)] hover:text-[#0a0a0a]' }
    : { header: 'bg-paper border-b-line', text: 'text-ink', ring: 'border-ink', login: 'border-ink text-ink hover:bg-ink hover:[box-shadow:0_8px_20px_rgba(23,63,54,.2)] hover:text-paper' };
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
        <a href="#colaborador" className={navLink}>Colaborar</a>
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
              <a href="#colaborador" className={USER_MENU_ITEM} onClick={() => setShowUserMenu(false)}>Mi Dashboard</a>
              <button className={USER_MENU_ITEM} onClick={() => { setShowUserMenu(false); onLogout(); }}>Cerrar Sesión</button>
            </div>
          )}
        </div>
      ) : (
        <>
          <button className={`rounded-[999px] cursor-pointer font-bold py-[13px] px-[22px] bg-transparent border-2 border-solid transition-[background,box-shadow,color,transform] duration-[250ms] ease-[cubic-bezier(.25,.8,.25,1)] hover:[transform:translateY(-1px)] active:[transform:translateY(0)] ${tone.login}`} type="button" onClick={onLogin}>Ingresar</button>
        </>
      )}
    </header>
  );
}

const USER_MENU_ITEM = 'block w-full py-2.5 px-4 border-none bg-transparent text-left text-[14px] cursor-pointer no-underline text-ink transition-[background] duration-200 ease-[ease] hover:bg-cream';
