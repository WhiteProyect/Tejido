import { useState } from 'react';
import Logo from '../components/Logo.jsx';
import { EYEBROW } from '../components/uiStyles.js';

// Activacion de cuenta desde el link de invitacion (#invitacion/<token>): la persona define
// su contrasena y queda con la sesion abierta, igual que al entrar por LoginScreen.
const MIN_PASSWORD = 8; // misma regla que backend/service/services/invites.py

export default function AcceptInviteScreen({ token, onSuccess }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (password.length < MIN_PASSWORD) {
      setError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/auth/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'No fue posible activar tu cuenta');
      localStorage.setItem('tejido_token', result.token);
      onSuccess(result.user);
      window.location.hash = 'perfil';
    } catch (acceptError) {
      setError(acceptError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="relative flex min-h-svh items-center justify-center overflow-hidden bg-paper px-6 pt-[112px] pb-[88px] max600:pt-[92px] max600:pb-16">
      <a className="absolute left-6 top-6 z-20 inline-flex items-center gap-2 rounded-[999px] py-2.5 px-4 text-[14px] font-semibold text-ink transition-colors duration-200 hover:bg-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink max600:left-3 max600:top-4" href="#inicio">
        <span aria-hidden="true">←</span> Volver al inicio
      </a>

      <div className="relative z-10 flex w-full max-w-[420px] flex-col items-center text-center">
        <Logo href={null} />
        <p className={`${EYEBROW} mt-[34px]`}>Invitación a TEJIDO</p>
        <h1 className="m-0 font-sans text-[length:clamp(40px,5.5vw,64px)] font-bold leading-[.98] tracking-[-.055em]">
          Activa tu<br /><em className="font-display italic font-bold text-purple">cuenta.</em>
        </h1>
        <p className="mt-5 mb-10 text-[16px] leading-[1.5] text-muted">Elige la contraseña con la que vas a entrar a TEJIDO.</p>

        {!token ? (
          <p className="m-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[14px] text-[#b3442b]" role="alert">
            Este enlace no trae una invitación. Pide a un administrador que te la reenvíe.
          </p>
        ) : (
          <form className="grid w-full gap-6" onSubmit={handleSubmit}>
            <label className={LABEL}>Contraseña
              <input className={INPUT} type="password" autoComplete="new-password" minLength={MIN_PASSWORD} value={password} onChange={(event) => setPassword(event.target.value)} required />
            </label>
            <label className={LABEL}>Confirmar contraseña
              <input className={INPUT} type="password" autoComplete="new-password" minLength={MIN_PASSWORD} value={confirm} onChange={(event) => setConfirm(event.target.value)} required />
            </label>
            <p className="-mt-2 mb-0 text-[13px] text-muted">Mínimo {MIN_PASSWORD} caracteres.</p>
            {error && <p className="m-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[14px] text-[#b3442b]" role="alert">{error}</p>}
            <button className="mt-2 w-full cursor-pointer rounded-[999px] border-0 bg-ink py-4 px-6 text-[16px] font-bold text-white transition-colors duration-200 hover:bg-ink-deep focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink disabled:cursor-wait disabled:opacity-65" type="submit" disabled={loading}>
              {loading ? 'Activando...' : 'Activar mi cuenta'}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

// Mismo estilo de campos que LoginScreen.
const LABEL = 'grid gap-2 text-[11px] font-extrabold uppercase tracking-[.18em] text-muted';
// text-[17px]: 16 px o mas evita el zoom automatico de iOS al enfocar.
const INPUT = 'rounded-t-[10px] border-0 border-b-2 border-b-[rgba(23,63,54,.22)] bg-transparent py-3 px-3 text-center text-[17px] font-medium normal-case tracking-normal text-ink outline-none transition-colors duration-200 hover:border-b-[rgba(23,63,54,.4)] focus:border-b-orange focus:bg-[rgba(117,183,155,.14)]';
