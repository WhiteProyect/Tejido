import { useState } from 'react';
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
    <section className="grid grid-cols-[1fr_1fr] min-h-[calc(100vh-76px)] max600:grid-cols-[1fr]">
      {/* Arte: circulo de fondo (::before) y tres aros. */}
      <div className="flex items-center justify-center bg-mint min-h-[620px] overflow-hidden relative before:content-[''] before:absolute before:border-2 before:border-solid before:border-[rgba(23,63,54,.28)] before:rounded-[50%] before:h-[70%] before:w-[70%] before:-right-[14%] before:top-[12%] max600:min-h-[300px]" aria-hidden="true">
        <span className="text-ink text-[length:clamp(46px,6vw,84px)] font-bold tracking-[-.055em] leading-[.94] relative z-1">Vuelve a<br /><em className="text-purple font-display">conectar.</em></span>
        <i className={`${LOGIN_RING} left-[12%] top-[15%]`} /><i className={`${LOGIN_RING} bottom-[13%] left-[24%]`} /><i className={`${LOGIN_RING} bottom-[20%] right-[12%]`} />
      </div>
      <div className="self-center max-w-[480px] py-[70px] px-[8vw] w-full max600:py-[55px] max600:px-6">
        <p className={EYEBROW}>Bienvenido a TEJIDO</p>
        <h1 className="font-sans tracking-[-.055em] text-[length:clamp(42px,5vw,72px)] leading-[.98] my-[18px] mx-0">Tu territorio<br />te espera.</h1>
        <p className="text-muted mb-[30px]">Ingresa para guardar, publicar y participar.</p>
        <form className="grid gap-[18px]" onSubmit={handleSubmit}>
          <label className={LOGIN_LABEL}>Correo<input className={LOGIN_INPUT} type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label className={LOGIN_LABEL}>Contraseña<input className={LOGIN_INPUT} type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          {error && <p className="text-[#b3442b] text-[13px] m-0" role="alert">{error}</p>}
          {/* Sin estilo de boton propio: `btn btn-primary` nunca tuvieron reglas CSS, asi que se ve como boton nativo. */}
          <button className="border-0 mt-2.5 w-full disabled:cursor-wait disabled:opacity-65" type="submit" disabled={loading}>{loading ? 'Ingresando...' : 'Ingresar'}</button>
        </form>
        <div className="border-t border-t-line grid gap-[9px] mt-[35px] pt-[22px]">
          <b className="text-[12px]">Cuentas de demostración</b>
          <small className="text-muted text-[11px]">Selecciona una cuenta para probar cada rol.</small>
          {Object.entries(demoAccounts).map(([role, account]) => (
            <button key={role} className="bg-cream border-0 rounded-[12px] cursor-pointer grid gap-0.5 py-[11px] px-3.5 text-left hover:bg-[#ead7ac]" type="button" onClick={() => { setEmail(account.email); setPassword(account.password); }}>
              <strong className="text-[12px]">{role === 'admin' ? 'Administrador' : role === 'gestor' ? 'Gestor' : 'Ciudadano'}</strong>
              <span className="text-muted text-[10px]">{account.email}</span>
            </button>
          ))}
        </div>
        <a className="text-muted inline-block text-[12px] mt-7 underline" href="#inicio">Volver al inicio</a>
      </div>
    </section>
  );
}

const LOGIN_RING = 'border-[3px] border-solid border-ink rounded-[50%] h-[100px] w-[100px] absolute max600:h-[60px] max600:w-[60px]';
const LOGIN_LABEL = 'grid text-[12px] font-bold gap-[7px]';
const LOGIN_INPUT = 'bg-transparent border-0 border-b border-b-line outline-0 py-3 px-0 focus:border-orange';
