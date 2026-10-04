import { useEffect, useRef, useState } from 'react';
import Logo from '../components/Logo.jsx';
import { EYEBROW } from '../components/uiStyles.js';
import { useToast } from '../context/ToastContext.jsx';

// Iniciar sesion o crear una cuenta de ciudadano (POST /api/auth/signup). Las dos
// terminan igual: token en localStorage y onSuccess(user).
const MIN_PASSWORD = 8; // misma regla que backend/service/services/invites.py

export default function LoginScreen({ onSuccess }) {
  const { showToast } = useToast();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const isSignup = mode === 'signup';
  const nameRef = useRef(null);
  const emailRef = useRef(null);

  // Al entrar y al cambiar de pestana, el cursor queda en el primer campo del formulario.
  useEffect(() => {
    (isSignup ? nameRef : emailRef).current?.focus();
  }, [isSignup]);

  function switchMode(next) {
    setMode(next);
    setError('');
    setPassword('');
    setConfirm('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (isSignup) {
      if (password.length < MIN_PASSWORD) {
        setError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
        return;
      }
      if (password !== confirm) {
        setError('Las contraseñas no coinciden.');
        return;
      }
    }
    setLoading(true);
    try {
      const response = await fetch(isSignup ? '/api/auth/signup' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isSignup ? { name, email, password } : { email, password }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || (isSignup ? 'No fue posible crear tu cuenta' : 'No fue posible iniciar sesión'));
      localStorage.setItem('tejido_token', result.token);
      onSuccess(result.user);
      showToast(isSignup
        ? { tone: 'dorado', eyebrow: 'Nuevo hilo en la red', title: '¡Bienvenido a TEJIDO!', text: 'Tu cuenta quedó lista. Empieza a guardar y descubrir.' }
        : { tone: 'rio', eyebrow: 'Hilo te reconoce', title: '¡Bienvenido de nuevo!', text: 'Tu territorio sigue aquí, listo para seguir explorando.' });
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="relative flex min-h-svh items-center justify-center overflow-hidden bg-paper px-6 pt-[112px] pb-[88px] max600:pt-[92px] max600:pb-16">
      <a className="absolute left-6 top-6 z-20 inline-flex items-center gap-2 rounded-[999px] py-2.5 px-4 text-[14px] font-semibold text-ink transition-colors duration-200 hover:bg-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink max600:left-3 max600:top-4" href="#inicio">
        <span aria-hidden="true">←</span> Volver al inicio
      </a>

      {/* Arte: tres ondas concentricas alrededor del formulario (el rio que se abre) y los tres
          puntos de la marca -- la confluencia -- flotando sobre ellas (en movil, dos). Decorativo, sin eventos. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <span className={`${WAVE} size-[640px] border-[rgba(23,63,54,.16)] max600:size-[420px]`} />
        <span className={`${WAVE} size-[920px] border-[rgba(23,63,54,.10)] [animation-delay:-3s] max600:size-[580px]`} />
        <span className={`${WAVE} size-[1200px] border-[rgba(23,63,54,.06)] [animation-delay:-6s] max600:size-[760px]`} />
        <span className={`${ORBIT} size-[920px] rotate-[58deg] max600:size-[760px] max600:rotate-[25deg]`}>
          <i className={`${DOT} size-[150px] bg-mint opacity-60 max600:size-[84px]`} />
        </span>
        <span className={`${ORBIT} size-[640px] rotate-[-104deg] max600:hidden`}>
          <i className={`${DOT} size-[96px] border-[3px] border-ink opacity-80 [animation-delay:-4s]`} />
        </span>
        <span className={`${ORBIT} size-[1200px] rotate-[-62deg] max600:size-[760px] max600:rotate-[-24deg]`}>
          <i className={`${DOT} size-[18px] bg-purple [animation-delay:-7s] max600:size-[14px]`} />
        </span>
      </div>

      <div className="relative z-10 flex w-full max-w-[420px] flex-col items-center text-center">
        <Logo href={null} />
        <p className={`${EYEBROW} mt-[34px]`}>Bienvenido a TEJIDO</p>
        <h1 className="m-0 font-sans text-[length:clamp(44px,6vw,72px)] font-bold leading-[.98] tracking-[-.055em]">
          Tu territorio<br /><em className="font-display italic font-bold text-purple">te espera.</em>
        </h1>
        <p className="mt-5 mb-8 text-[16px] leading-[1.5] text-muted">{isSignup ? 'Crea tu cuenta para guardar y participar.' : 'Ingresa para guardar, publicar y participar.'}</p>

        <div className="mb-8 grid w-full grid-cols-2 gap-1 rounded-[999px] bg-cream p-1" role="tablist" aria-label="Acceso">
          {[['login', 'Iniciar sesión'], ['signup', 'Crear cuenta']].map(([value, label]) => (
            <button key={value} className={`${TAB} ${mode === value ? 'bg-ink text-white' : 'bg-transparent text-ink hover:bg-[rgba(23,63,54,.08)]'}`} type="button" role="tab" aria-selected={mode === value} onClick={() => switchMode(value)}>{label}</button>
          ))}
        </div>

        <form className="grid w-full gap-6" onSubmit={handleSubmit}>
          {isSignup && <label className={LOGIN_LABEL}>Nombre<input className={LOGIN_INPUT} ref={nameRef} type="text" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required /></label>}
          <label className={LOGIN_LABEL}>Correo<input className={LOGIN_INPUT} ref={emailRef} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label className={LOGIN_LABEL}>Contraseña<input className={LOGIN_INPUT} type="password" autoComplete={isSignup ? 'new-password' : 'current-password'} minLength={isSignup ? MIN_PASSWORD : undefined} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          {isSignup && (
            <>
              <label className={LOGIN_LABEL}>Confirmar contraseña<input className={LOGIN_INPUT} type="password" autoComplete="new-password" minLength={MIN_PASSWORD} value={confirm} onChange={(event) => setConfirm(event.target.value)} required /></label>
              <p className="-mt-2 mb-0 text-[13px] text-muted">Mínimo {MIN_PASSWORD} caracteres.</p>
            </>
          )}
          {error && <p className="m-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[14px] text-[#b3442b]" role="alert">{error}</p>}
          <button className="mt-2 w-full cursor-pointer rounded-[999px] border-0 bg-ink py-4 px-6 text-[16px] font-bold text-white transition-colors duration-200 hover:bg-ink-deep focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink disabled:cursor-wait disabled:opacity-65" type="submit" disabled={loading}>{loading ? (isSignup ? 'Creando cuenta...' : 'Ingresando...') : (isSignup ? 'Crear cuenta' : 'Ingresar')}</button>
        </form>
      </div>
    </section>
  );
}

// Onda: circulo centrado en la pantalla que respira despacio (keyframes en art.css).
const WAVE = 'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border motion-safe:animate-[loginBreath_9s_ease-in-out_infinite]';
// Orbita: caja del tamano de una onda, girada para ubicar su punto en un angulo fijo del borde.
const ORBIT = 'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2';
// Punto sobre el borde superior de su orbita, con una flotacion leve.
const DOT = 'absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full motion-safe:animate-[loginFloat_10s_ease-in-out_infinite]';
// Pestana del selector Iniciar sesion / Crear cuenta.
const TAB = 'cursor-pointer rounded-[999px] border-0 py-2.5 px-4 text-[14px] font-bold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';
const LOGIN_LABEL = 'grid gap-2 text-[11px] font-extrabold uppercase tracking-[.18em] text-muted';
// text-[17px]: 16 px o mas evita el zoom automatico de iOS al enfocar.
const LOGIN_INPUT = 'rounded-t-[10px] border-0 border-b-2 border-b-[rgba(23,63,54,.22)] bg-transparent py-3 px-3 text-center text-[17px] font-medium normal-case tracking-normal text-ink outline-none transition-colors duration-200 hover:border-b-[rgba(23,63,54,.4)] focus:border-b-orange focus:bg-[rgba(117,183,155,.14)]';
