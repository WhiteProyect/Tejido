import { useEffect, useRef, useState } from 'react';
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import GlobalSearch from './GlobalSearch.jsx';
import Logo from './Logo.jsx';
import MobileMenu from './MobileMenu.jsx';
import ThreadsIcon from './ThreadsIcon.jsx';
import { cdnImage } from '../utils/cloudinaryUrl.js';
import { NAV_LINKS, activeSection } from '../utils/navSections.js';

// Header: logo a la izquierda, las 9 pestañas centradas en la pantalla (tab bar) y el acceso o el
// avatar a la derecha. La pestaña activa (`screen` de App: las pantallas hijas cuentan para su
// pestaña) lleva una pastilla de tinta que se desliza con un muelle (layoutId propio) por debajo de
// los textos (z-index), sin taparlos al pasar; en las
// pantallas sin pestaña la pastilla se desvanece donde estaba y reaparece al volver a una.
// Por debajo de NAV_COMPACT_QUERY (navcompact) las pestañas pasan al menu movil (MobileMenu.jsx): el
// boton "tres hebras" (capsula de tinta) lo abre; al cerrarlo con Esc, su boton de cierre o el velo,
// el foco vuelve aqui. Abrirlo cierra el menu de usuario y viceversa. El header se oculta al bajar y
// reaparece al subir (no con el menu abierto).
const PILL_SPRING = { type: 'spring', stiffness: 380, damping: 32 };
const TAB = 'relative rounded-full px-4 py-2 text-[14px] leading-5 font-semibold no-underline transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 max-[1400px]:px-3 motion-reduce:transition-none';
// Capsula de 44x36 con area tactil de 44x44 (el ::before la alarga 4 px arriba y abajo).
const TRIGGER = "relative hidden h-9 w-11 shrink-0 cursor-pointer items-center justify-end rounded-full border-0 px-2.5 before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 navcompact:inline-flex";

export default function SiteHeader({ user, onLogin, onLogout, screen, municipalitySlug = null, isMoneystack = false, publications = [], publicationsLoading = false }) {
  const reduceMotion = useReducedMotion();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // La foto viene de PATCH /api/me (una URL): si no carga, vuelve la inicial.
  const [avatarFailed, setAvatarFailed] = useState(false);
  useEffect(() => { setAvatarFailed(false); }, [user?.avatar_url]);
  const [isHidden, setIsHidden] = useState(false);
  const active = activeSection(screen);
  // Donde queda la pastilla: la pestaña activa o, si no hay, la ultima (alli se desvanece).
  const [lastActive, setLastActive] = useState(active);
  if (active && active !== lastActive) setLastActive(active);
  const pillAt = active || lastActive;
  const menuRef = useRef(null);
  const headerRef = useRef(null);
  const burgerRef = useRef(null);
  const restoreFocus = useRef(false);
  // Alto real del header al abrir el menu movil (88 px con el boton de acceso, menos con el avatar):
  // la cabecera del panel lo copia para que el boton de cierre quede donde estaba el del header.
  const [headerHeight, setHeaderHeight] = useState(88);
  const menuOpenRef = useRef(false);
  menuOpenRef.current = menuOpen;
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

  // Alto real del header publicado en :root como --header-height (el Mapa vivo ocupa el resto de la
  // pantalla con calc(100dvh - var(--header-height))). Sigue los cambios de alto (avatar, salto de linea,
  // corte compacto) sin depender de un numero fijo.
  useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const root = document.documentElement;
    const publish = () => root.style.setProperty('--header-height', `${Math.round(el.getBoundingClientRect().height)}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function handleScroll() {
      const currentScrollY = window.scrollY;
      const scrollDifference = currentScrollY - lastScrollY.current;
      lastScrollY.current = currentScrollY;
      if (menuOpenRef.current) return;

      // El header permanece visible arriba y reaparece cuando el usuario sube.
      if (currentScrollY <= 80 || scrollDifference < -6) {
        setIsHidden(false);
      } else if (scrollDifference > 6) {
        setIsHidden(true);
        setShowUserMenu(false);
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Al cerrar el menu movil con Esc, su boton o el velo, el foco vuelve al boton del header (cuando el
  // resto de la app ya dejo de estar inerte).
  useEffect(() => {
    if (menuOpen || !restoreFocus.current) return;
    restoreFocus.current = false;
    burgerRef.current?.focus();
  }, [menuOpen]);

  // Variante oscura en la pantalla de Moneystack. En el legado el hover naranja de los
  // enlaces ganaba tambien ahi (era mas especifico), por eso `hover:text-orange` va en ambos.
  const tone = isMoneystack
    ? {
      header: 'bg-black border-b-[rgba(0,0,0,0.742)]', text: 'text-[#f7f7f5]', ring: 'border-[#f7f7f5]',
      login: 'text-[#f7f7f5] hover:bg-[rgba(247,247,245,0.1)] focus-visible:outline-[#f7f7f5]', tip: 'bg-[#f7f7f5] text-[#0a0a0a]',
      bar: 'bg-[rgba(247,247,245,0.10)]', pill: 'bg-[#f7f7f5]', activeText: 'text-[#0a0a0a]', focus: 'focus-visible:outline-[#f7f7f5]',
      trigger: 'bg-[#f7f7f5] focus-visible:outline-[#f7f7f5]', threads: '#173f36',
    }
    : {
      header: 'bg-paper border-b-line', text: 'text-ink', ring: 'border-ink',
      login: 'text-ink hover:bg-cream focus-visible:outline-ink', tip: 'bg-ink text-paper',
      bar: 'bg-cream', pill: 'bg-ink', activeText: 'text-paper', focus: 'focus-visible:outline-ink',
      trigger: 'bg-ink focus-visible:outline-ink', threads: '#f3e4c8',
    };
  const pillTransition = reduceMotion ? { duration: 0 } : { layout: PILL_SPRING, opacity: { duration: 0.2 } };
  const tabColor = (key) => (active === key ? tone.activeText : `${tone.text} hover:text-orange`);

  function openMenu() {
    if (headerRef.current) setHeaderHeight(Math.round(headerRef.current.getBoundingClientRect().height));
    setShowUserMenu(false);
    setMenuOpen(true);
  }
  function closeMenu(restore) {
    restoreFocus.current = restore;
    setMenuOpen(false);
  }

  const pill = (layoutId) => (
    <motion.span
      layoutId={layoutId}
      className={`absolute inset-0 z-0 rounded-full ${tone.pill}`}
      initial={false}
      animate={{ opacity: active ? 1 : 0 }}
      transition={pillTransition}
    />
  );

  return (
    <>
      {/* Con el menu de usuario abierto el header sube sobre los avisos (Toast, z-90), que en movil
          aparecen justo debajo y taparian "Cerrar Sesion". El menu movil va en un portal por encima. */}
      <header ref={headerRef} className={`grid grid-cols-[1fr_auto_1fr] items-center gap-4 py-[18px] px-[5vw] border-b sticky top-0 ${showUserMenu ? 'z-[95]' : 'z-5'} transition-[transform] duration-[220ms] ease-[ease] motion-reduce:transition-none ${tone.header} ${isHidden && !menuOpen ? '[transform:translateY(-100%)]' : '[transform:translateY(0)]'}`}>
        <div className="justify-self-start">
          <Logo className={tone.text} ringClassName={tone.ring} />
        </div>
        <LayoutGroup id="tab-bar">
          <nav aria-label="Principal" className={`flex items-center gap-1 rounded-full p-1.5 max-[1400px]:gap-0.5 navcompact:hidden ${tone.bar}`}>
            {NAV_LINKS.map(([key, label]) => (
              <a key={key} href={`#${key}`} className={`${TAB} ${tabColor(key)} ${tone.focus}`} aria-current={active === key ? 'page' : undefined}>
                {pillAt === key && pill('pestana-activa')}
                <span className="relative z-[1]">{label}</span>
              </a>
            ))}
          </nav>
        </LayoutGroup>
        <div className="col-start-3 flex items-center justify-self-end gap-2">
          <GlobalSearch publications={publications} loading={publicationsLoading} dark={isMoneystack} />
          {user ? (
            <div className="relative" ref={menuRef}>
              <button className="w-9 h-9 overflow-hidden rounded-[50%] bg-ink text-white border-none p-0 text-[14px] font-bold cursor-pointer" aria-label={`Menú de ${user.name}`} onClick={() => { closeMenu(false); setShowUserMenu(!showUserMenu); }}>
                {user.avatar_url && !avatarFailed
                  ? <img src={cdnImage(user.avatar_url, { width: 72, fit: 'fill' })} alt="" className="size-full object-cover" decoding="async" onError={() => setAvatarFailed(true)} />
                  : user.name?.charAt(0) || '?'}
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
          <button
            ref={burgerRef}
            type="button"
            className={`${TRIGGER} ${tone.trigger}`}
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menuOpen}
            aria-controls="menu-principal"
            onClick={() => (menuOpen ? closeMenu(true) : openMenu())}
          >
            <ThreadsIcon open={menuOpen} line={tone.threads} />
          </button>
        </div>

      </header>
      <MobileMenu
        open={menuOpen}
        onClose={closeMenu}
        bandHeight={headerHeight}
        active={active}
        municipalitySlug={municipalitySlug}
        user={user}
        onLogin={onLogin}
        onLogout={onLogout}
      />
    </>
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
