import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../Icon.jsx';
import { TS } from '../territory/territoryStyles.js';

// Aviso sin sesion (guardar o postularse): dialogo con el foco atrapado, Esc y el fondo lo cierran y
// el foco vuelve a quien lo abrio (lo hace el padre). "Iniciar sesion" y "Crear mi cuenta gratis" dejan
// pedido el regreso (sessionStorage tejido_return_to, que usa App.handleLogin) y, el segundo, la pestaña
// de registro (tejido_login_mode).
// title/text cambian el mensaje (p. ej. reportar un dato de un lugar); por defecto, guardar o postularse.
export default function AuthDialog({ returnTo, onClose, title = null, text = null }) {
  const titleId = useId();
  const textId = useId();
  const ref = useRef(null);

  useEffect(() => { ref.current?.querySelector('[data-primero]')?.focus(); }, []);

  function onKeyDown(event) {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
    if (event.key !== 'Tab') return;
    const items = [...ref.current.querySelectorAll('button')];
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  function go(mode) {
    sessionStorage.setItem('tejido_return_to', returnTo);
    if (mode === 'signup') sessionStorage.setItem('tejido_login_mode', 'signup');
    window.location.hash = 'login';
  }

  return createPortal(
    <div className="fixed inset-0 z-[98] flex items-end justify-center bg-[rgba(12,36,30,.55)] p-4 min-[640px]:items-center"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={textId} onKeyDown={onKeyDown} data-aviso-sesion
        className="relative w-full max-w-[460px] rounded-[24px] border-2 border-[#173f36] bg-[#fff9ec] p-7 text-[#173f36] max-[767px]:p-5">
        <button type="button" onClick={onClose} aria-label="Cerrar"
          className={`absolute top-3 right-3 inline-flex size-11 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-[#173f36] hover:bg-[#f3e4c8] ${TS.focus}`}>
          <Icon name="close" className="size-5" />
        </button>
        <p className={TS.kicker}>Tu cuenta TEJIDO</p>
        <h2 id={titleId} className="mt-2 mb-0 pr-10 font-sans text-[26px] font-extrabold leading-[1.15] tracking-[-0.02em] max-[767px]:text-[23px]">
          {title || <>Inicia sesión para guardar o <span className={TS.heroItalic}>postularte</span></>}
        </h2>
        <p id={textId} className="mt-3 mb-0 text-[16px] leading-[1.5] text-[#3f514a]">
          {text || 'Tu cuenta en TEJIDO te permite guardar eventos y postularte a las convocatorias del Bajo Cauca.'}
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3 max-[480px]:grid-cols-1">
          <button type="button" data-primero className={TS.btnSolid} onClick={() => go('login')}>Iniciar sesión</button>
          <button type="button" className={TS.btnCream} onClick={() => go('signup')}>Crear mi cuenta gratis</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
