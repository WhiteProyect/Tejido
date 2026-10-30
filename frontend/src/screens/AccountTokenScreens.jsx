import { useEffect, useId, useRef, useState } from 'react';
import EmptyNote from '../components/EmptyNote.jsx';
import Icon from '../components/Icon.jsx';
import { UnverifiedNotice } from '../components/VerifyEmailNotice.jsx';
import { BTN_INK_MD, FORM_INPUT, FORM_LABEL, PANEL, SECTION } from '../components/uiStyles.js';
import { apiRequest } from '../utils/api.js';

// Pantallas de los enlaces que llegan por correo (services/email_tokens.py):
// - #verificar?token=...   -> POST /api/auth/verify-email al entrar; exito o error (con
//   "Reenviar correo" si hay sesion sin verificar). Con sesion, refresca /api/me.
// - #restablecer?token=... -> formulario de contraseña nueva (POST /api/auth/reset-password). El
//   backend cierra todas las sesiones: aqui tambien se cierra la de esta pestaña y se lleva al login.
// El token se quita de la URL en cuanto se lee (no queda en el historial).
const MIN_PASSWORD = 8; // misma regla que backend/service/services/invites.py

export function tokenFromHash() {
  const query = window.location.hash.split('?')[1] || '';
  return new URLSearchParams(query).get('token') || '';
}

// Si llega otro enlace con la pantalla ya abierta (mismo hash base), se toma el token nuevo.
function useTokenOnce(route) {
  const [token, setToken] = useState(tokenFromHash);
  useEffect(() => {
    const clear = () => window.history.replaceState(window.history.state, '', `#${route}`);
    function onHashChange() {
      const next = tokenFromHash();
      if (!next) return;
      setToken(next);
      clear();
    }
    clear();
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [route]);
  return token;
}

export function VerifyEmailScreen({ user, onUserUpdate }) {
  const token = useTokenOnce('verificar');
  const [state, setState] = useState({ loading: true, ok: false, message: '' });
  const started = useRef(null);

  useEffect(() => { document.title = 'Verificar correo · TEJIDO'; }, []);
  useEffect(() => {
    if (started.current === token) return;
    started.current = token;
    setState({ loading: true, ok: false, message: '' });
    if (!token) {
      setState({ loading: false, ok: false, message: 'Este enlace de verificación no es válido. Pide uno nuevo desde tu cuenta.' });
      return;
    }
    apiRequest('/api/auth/verify-email', { method: 'POST', body: { token } })
      .then(async (result) => {
        setState({ loading: false, ok: true, message: result.message });
        if (localStorage.getItem('tejido_token')) {
          const me = await apiRequest('/api/me').catch(() => null);
          if (me?.user) onUserUpdate?.(me.user);
        }
      })
      .catch((error) => setState({ loading: false, ok: false, message: error.message }));
  }, [token, onUserUpdate]);

  return (
    <section className={`${SECTION} min-h-[62vh]`}>
      <div className="mx-auto max-w-[560px]" aria-live="polite">
        {state.loading ? (
          <p className="m-0 py-10 text-center text-[16px] text-muted" role="status">Verificando tu correo...</p>
        ) : state.ok ? (
          <EmptyNote icon="check" title={state.message} text="Ya puedes guardar historias, eventos y talento, y pedir participar en una rama."
            action={<a className={BTN_INK_MD} href={user ? '#perfil' : '#login'}>{user ? 'Ir a mi perfil' : 'Iniciar sesión'} <Icon name="arrow-right" className="size-4" /></a>} />
        ) : (
          <div className="grid gap-4">
            <EmptyNote icon="close" title="No pudimos verificar tu correo" text={state.message}
              action={!user && <a className={BTN_INK_MD} href="#login">Iniciar sesión</a>} />
            {user && user.email_verified === false && <UnverifiedNotice email={user.email} />}
          </div>
        )}
      </div>
    </section>
  );
}

export function ResetPasswordScreen({ onSessionClosed }) {
  const token = useTokenOnce('restablecer');
  const id = useId().replace(/:/g, '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldError, setFieldError] = useState({});
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { document.title = 'Restablecer contraseña · TEJIDO'; }, []);

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (password.length < MIN_PASSWORD) { setFieldError({ password: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.` }); return; }
    if (password !== confirm) { setFieldError({ confirm: 'Las contraseñas no coinciden.' }); return; }
    setFieldError({});
    setBusy(true);
    try {
      const result = await apiRequest('/api/auth/reset-password', { method: 'POST', body: { token, password } });
      // El backend cerro todas las sesiones de la cuenta; si esta pestaña tenia una, se cierra.
      if (localStorage.getItem('tejido_token')) {
        localStorage.removeItem('tejido_token');
        onSessionClosed?.();
      }
      setDone(result.message);
    } catch (submitError) {
      if (submitError.code === 'WEAK_PASSWORD') setFieldError({ password: submitError.message });
      else setError(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  const describedBy = (name, hint) => (fieldError[name] ? `${id}-${name}-error` : hint);

  return (
    <section className={`${SECTION} min-h-[62vh]`}>
      <div className="mx-auto max-w-[480px]">
        {done ? (
          <div aria-live="polite">
            <EmptyNote icon="check" title={done} text="Por seguridad cerramos las sesiones que tenías abiertas."
              action={<a className={BTN_INK_MD} href="#login">Iniciar sesión <Icon name="arrow-right" className="size-4" /></a>} />
          </div>
        ) : !token ? (
          <EmptyNote icon="close" title="Este enlace no es válido" text="Pide uno nuevo desde «¿Olvidaste tu contraseña?» en el inicio de sesión."
            action={<a className={BTN_INK_MD} href="#login">Ir al inicio de sesión</a>} />
        ) : (
          <form className={`${PANEL} grid gap-5`} onSubmit={submit} noValidate aria-labelledby={`${id}-t`}>
            <h1 id={`${id}-t`} className="m-0 font-sans text-[30px] font-extrabold leading-[1.1] tracking-[-0.03em] text-ink">Crea una contraseña nueva</h1>
            <p className="m-0 text-[15px] leading-[1.55] text-[#53645c]">Al guardarla se cierran las sesiones abiertas de tu cuenta y luego inicias sesión con la nueva.</p>
            <div className="grid gap-1.5">
              <label htmlFor={`${id}-password`} className={FORM_LABEL}>Contraseña nueva</label>
              <input id={`${id}-password`} className={FORM_INPUT} type="password" autoComplete="new-password" minLength={MIN_PASSWORD} value={password}
                onChange={(event) => { setPassword(event.target.value); setFieldError({}); }} aria-invalid={fieldError.password ? true : undefined} aria-describedby={describedBy('password', `${id}-password-hint`)} />
              {fieldError.password
                ? <p id={`${id}-password-error`} className="m-0 text-[13px] font-semibold text-[#b3442b]">{fieldError.password}</p>
                : <p id={`${id}-password-hint`} className="m-0 text-[13px] text-muted">Mínimo {MIN_PASSWORD} caracteres.</p>}
            </div>
            <div className="grid gap-1.5">
              <label htmlFor={`${id}-confirm`} className={FORM_LABEL}>Confirmar contraseña</label>
              <input id={`${id}-confirm`} className={FORM_INPUT} type="password" autoComplete="new-password" value={confirm}
                onChange={(event) => { setConfirm(event.target.value); setFieldError({}); }} aria-invalid={fieldError.confirm ? true : undefined} aria-describedby={describedBy('confirm')} />
              {fieldError.confirm && <p id={`${id}-confirm-error`} className="m-0 text-[13px] font-semibold text-[#b3442b]">{fieldError.confirm}</p>}
            </div>
            {error && <p className="m-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[14px] text-[#b3442b]" role="alert">{error}</p>}
            <button type="submit" className={BTN_INK_MD} disabled={busy}>{busy ? 'Guardando...' : 'Guardar contraseña'}</button>
          </form>
        )}
      </div>
    </section>
  );
}
