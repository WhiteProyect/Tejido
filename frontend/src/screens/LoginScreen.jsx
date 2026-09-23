import { useState } from 'react';
import Logo from '../components/Logo.jsx';
import { EYEBROW } from '../components/uiStyles.js';

const demoAccounts = {
  admin: { email: 'admin@tejido.co', password: 'Admin123!' },
  gestor: { email: 'gestor@tejido.co', password: 'Gestor123!' },
  ciudadano: { email: 'ciudadano@tejido.co', password: 'Ciudadano123!' },
};

export default function LoginScreen({ onSuccess }) {
  const [email, setEmail] = useState(demoAccounts.gestor.email);
  const [password, setPassword] = useState(demoAccounts.gestor.password);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'No fue posible iniciar sesión');
      localStorage.setItem('tejido_token', result.token);
      onSuccess(result.user);
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
        <p className="mt-5 mb-10 text-[16px] leading-[1.5] text-muted">Ingresa para guardar, publicar y participar.</p>

        <form className="grid w-full gap-6" onSubmit={handleSubmit}>
          <label className={LOGIN_LABEL}>Correo<input className={LOGIN_INPUT} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label className={LOGIN_LABEL}>Contraseña<input className={LOGIN_INPUT} type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          {error && <p className="m-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[14px] text-[#b3442b]" role="alert">{error}</p>}
          <button className="mt-2 w-full cursor-pointer rounded-[999px] border-0 bg-ink py-4 px-6 text-[16px] font-bold text-white transition-colors duration-200 hover:bg-ink-deep focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink disabled:cursor-wait disabled:opacity-65" type="submit" disabled={loading}>{loading ? 'Ingresando...' : 'Ingresar'}</button>
        </form>

        <div className="mt-12 w-full border-t border-t-line pt-7">
          <p className="m-0 text-[13px] font-bold">Cuentas de demostración</p>
          <p className="mt-1.5 mb-4 text-[12px] text-muted">Selecciona una cuenta para probar cada rol.</p>
          <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 max600:grid-cols-[1fr]">
            {Object.entries(demoAccounts).map(([role, account]) => (
              <button key={role} className="grid cursor-pointer gap-0.5 rounded-[14px] border border-line bg-transparent py-2.5 px-2 text-center transition-colors duration-200 hover:bg-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink" type="button" onClick={() => { setEmail(account.email); setPassword(account.password); }}>
                <strong className="text-[12px]">{role === 'admin' ? 'Administrador' : role === 'gestor' ? 'Gestor' : 'Ciudadano'}</strong>
                <span className="truncate text-[10px] text-muted">{account.email}</span>
              </button>
            ))}
          </div>
        </div>
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
const LOGIN_LABEL = 'grid gap-2 text-[11px] font-extrabold uppercase tracking-[.18em] text-muted';
// text-[17px]: 16 px o mas evita el zoom automatico de iOS al enfocar.
const LOGIN_INPUT = 'rounded-t-[10px] border-0 border-b-2 border-b-[rgba(23,63,54,.22)] bg-transparent py-3 px-3 text-center text-[17px] font-medium normal-case tracking-normal text-ink outline-none transition-colors duration-200 hover:border-b-[rgba(23,63,54,.4)] focus:border-b-orange focus:bg-[rgba(117,183,155,.14)]';
