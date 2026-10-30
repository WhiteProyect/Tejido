import { useEffect, useId, useRef, useState } from 'react';
import BackHomeButton from '../components/BackHomeButton.jsx';
import Logo from '../components/Logo.jsx';
import { BTN_INK_MD, EYEBROW } from '../components/uiStyles.js';
import { useToast } from '../context/ToastContext.jsx';
import { MUNICIPALITIES } from '../utils/constants.js';

// Iniciar sesion, crear una cuenta de ciudadano (POST /api/auth/signup) o pedir el enlace para
// restablecer la contrasena (POST /api/auth/forgot-password, siempre con el mismo mensaje neutro).
// Entrar y registrarse terminan igual: token en localStorage y onSuccess(user). El registro pide
// nombre, apellido, municipio (opcional) y aceptar los Terminos y la Politica de Privacidad (se
// abren en otra pestaña para no perder el formulario); el correo queda por verificar.
// Errores por campo (aria-invalid + aria-describedby) y el general en role="alert".
const MIN_PASSWORD = 8; // misma regla que backend/service/services/invites.py
const NAME_MIN = 2;
const NAME_MAX = 60;
const EMPTY = { first_name: '', last_name: '', email: '', municipality: '', password: '', confirm: '', accept_terms: false };

function validateSignup(values) {
  const errors = {};
  for (const [field, label] of [['first_name', 'El nombre'], ['last_name', 'El apellido']]) {
    const value = values[field].replace(/\s+/g, ' ').trim();
    if (!value) errors[field] = `${label} es obligatorio.`;
    else if (value.length < NAME_MIN || value.length > NAME_MAX) errors[field] = `${label} debe tener entre ${NAME_MIN} y ${NAME_MAX} caracteres.`;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = 'Escribe un correo válido.';
  if (values.password.length < MIN_PASSWORD) errors.password = `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`;
  else if (values.password !== values.confirm) errors.confirm = 'Las contraseñas no coinciden.';
  if (!values.accept_terms) errors.accept_terms = 'Para crear tu cuenta acepta los Términos y Condiciones y la Política de Privacidad.';
  return errors;
}

// Error del backend -> campo del formulario (si no encaja en ninguno, va al mensaje general).
function fieldForBackendError(result) {
  if (result.error === 'EMAIL_TAKEN') return 'email';
  if (result.error === 'WEAK_PASSWORD') return 'password';
  if (result.error === 'TERMS_REQUIRED') return 'accept_terms';
  const text = String(result.message || '').toLowerCase();
  if (text.includes('apellido')) return 'last_name';
  if (text.includes('nombre')) return 'first_name';
  if (text.includes('municipio')) return 'municipality';
  if (text.includes('correo')) return 'email';
  return null;
}

function Field({ id, label, error, hint, children }) {
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className={LOGIN_LABEL}>{label}</label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="m-0 text-[13px] text-muted">{hint}</p>}
      {error && <p id={`${id}-error`} className="m-0 text-[13px] font-semibold text-[#b3442b]">{error}</p>}
    </div>
  );
}

export default function LoginScreen({ onSuccess }) {
  const { showToast } = useToast();
  const id = useId().replace(/:/g, '');
  const [mode, setMode] = useState('login'); // login | signup | forgot
  const [values, setValues] = useState(EMPTY);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const isSignup = mode === 'signup';
  const isForgot = mode === 'forgot';
  const firstRef = useRef(null);
  const emailRef = useRef(null);

  // Al entrar y al cambiar de vista, el cursor queda en el primer campo del formulario.
  useEffect(() => {
    (isSignup ? firstRef : emailRef).current?.focus();
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  function switchMode(next) {
    setMode(next);
    setError('');
    setNotice('');
    setFieldErrors({});
    setValues((current) => ({ ...current, password: '', confirm: '' }));
  }

  const set = (name) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setValues((current) => ({ ...current, [name]: value }));
    if (fieldErrors[name]) setFieldErrors((current) => ({ ...current, [name]: undefined }));
  };

  const fieldProps = (name) => ({
    id: `${id}-${name}`,
    'aria-invalid': fieldErrors[name] ? true : undefined,
    'aria-describedby': fieldErrors[name] ? `${id}-${name}-error` : undefined,
  });

  async function post(url, body) {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({}));
    return { ok: response.ok, result };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (isSignup) {
      const errors = validateSignup(values);
      setFieldErrors(errors);
      if (Object.keys(errors).length) {
        document.getElementById(`${id}-${Object.keys(errors)[0]}`)?.focus();
        return;
      }
    }
    setLoading(true);
    try {
      if (isForgot) {
        const { ok, result } = await post('/api/auth/forgot-password', { email: values.email });
        if (!ok) throw new Error(result.message || 'No fue posible enviar el enlace.');
        setNotice(result.message);
        return;
      }
      const body = isSignup
        ? { first_name: values.first_name, last_name: values.last_name, email: values.email, password: values.password,
            municipality: values.municipality || null, accept_terms: values.accept_terms }
        : { email: values.email, password: values.password };
      const { ok, result } = await post(isSignup ? '/api/auth/signup' : '/api/auth/login', body);
      if (!ok) {
        const field = isSignup ? fieldForBackendError(result) : null;
        if (field) {
          setFieldErrors({ [field]: result.message });
          document.getElementById(`${id}-${field}`)?.focus();
          return;
        }
        throw new Error(result.message || (isSignup ? 'No fue posible crear tu cuenta' : 'No fue posible iniciar sesión'));
      }
      localStorage.setItem('tejido_token', result.token);
      onSuccess(result.user);
      showToast(isSignup
        ? { tone: 'dorado', eyebrow: 'Nuevo hilo en la red', title: '¡Bienvenido a TEJIDO!', text: `Te enviamos un correo a ${result.user.email} para verificarlo. Mientras tanto ya puedes explorar.` }
        : { tone: 'rio', eyebrow: 'Hilo te reconoce', title: '¡Bienvenido de nuevo!', text: 'Tu territorio sigue aquí, listo para seguir explorando.' });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setLoading(false);
    }
  }

  const intro = isSignup ? 'Crea tu cuenta para guardar y participar.' : isForgot
    ? 'Escribe tu correo y te enviamos un enlace para crear una contraseña nueva.' : 'Ingresa para guardar, publicar y participar.';
  const submitLabel = loading
    ? (isSignup ? 'Creando cuenta...' : isForgot ? 'Enviando...' : 'Ingresando...')
    : (isSignup ? 'Crear cuenta' : isForgot ? 'Enviar enlace' : 'Ingresar');

  return (
    <section className="relative flex min-h-svh items-center justify-center overflow-clip bg-paper px-6 pt-[112px] pb-[88px] max600:pt-[92px] max600:pb-16">
      <BackHomeButton />

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
        <p className="mt-5 mb-8 text-[16px] leading-[1.5] text-muted">{intro}</p>

        {!isForgot && (
          <div className="mb-8 grid w-full grid-cols-2 gap-1 rounded-[999px] bg-cream p-1" role="tablist" aria-label="Acceso">
            {[['login', 'Iniciar sesión'], ['signup', 'Crear cuenta']].map(([value, label]) => (
              <button key={value} className={`${TAB} ${mode === value ? 'bg-ink text-white' : 'bg-transparent text-ink hover:bg-[rgba(23,63,54,.08)]'}`} type="button" role="tab" aria-selected={mode === value} onClick={() => switchMode(value)}>{label}</button>
            ))}
          </div>
        )}

        <form className="grid w-full gap-6" onSubmit={handleSubmit} noValidate>
          {isSignup && (
            <>
              <Field id={`${id}-first_name`} label="Nombre" error={fieldErrors.first_name}>
                <input className={LOGIN_INPUT} ref={firstRef} type="text" autoComplete="given-name" maxLength={NAME_MAX} value={values.first_name} onChange={set('first_name')} required {...fieldProps('first_name')} />
              </Field>
              <Field id={`${id}-last_name`} label="Apellido" error={fieldErrors.last_name}>
                <input className={LOGIN_INPUT} type="text" autoComplete="family-name" maxLength={NAME_MAX} value={values.last_name} onChange={set('last_name')} required {...fieldProps('last_name')} />
              </Field>
            </>
          )}
          <Field id={`${id}-email`} label="Correo" error={fieldErrors.email}>
            <input className={LOGIN_INPUT} ref={emailRef} type="email" autoComplete="email" value={values.email} onChange={set('email')} required {...fieldProps('email')} />
          </Field>
          {isSignup && (
            <Field id={`${id}-municipality`} label="Municipio (opcional)" error={fieldErrors.municipality}>
              <select className={`${LOGIN_INPUT} cursor-pointer`} value={values.municipality} onChange={set('municipality')} {...fieldProps('municipality')}>
                <option value="">Prefiero no decirlo</option>
                {MUNICIPALITIES.map(({ id: key, name }) => <option key={key} value={key}>{name}</option>)}
              </select>
            </Field>
          )}
          {!isForgot && (
            <Field id={`${id}-password`} label="Contraseña" error={fieldErrors.password} hint={isSignup ? `Mínimo ${MIN_PASSWORD} caracteres.` : undefined}>
              <input className={LOGIN_INPUT} type="password" autoComplete={isSignup ? 'new-password' : 'current-password'} minLength={isSignup ? MIN_PASSWORD : undefined}
                value={values.password} onChange={set('password')} required {...fieldProps('password')}
                aria-describedby={fieldErrors.password ? `${id}-password-error` : isSignup ? `${id}-password-hint` : undefined} />
            </Field>
          )}
          {isSignup && (
            <Field id={`${id}-confirm`} label="Confirmar contraseña" error={fieldErrors.confirm}>
              <input className={LOGIN_INPUT} type="password" autoComplete="new-password" minLength={MIN_PASSWORD} value={values.confirm} onChange={set('confirm')} required {...fieldProps('confirm')} />
            </Field>
          )}
          {isSignup && (
            <div className="grid gap-2 text-left">
              <label className="flex cursor-pointer items-start gap-3 text-[14px] leading-[1.5] text-ink">
                <input type="checkbox" className="mt-1 size-[18px] shrink-0 cursor-pointer accent-[var(--ink)]" checked={values.accept_terms} onChange={set('accept_terms')} {...fieldProps('accept_terms')} />
                <span>
                  Acepto los{' '}
                  <a className="font-bold text-ink underline underline-offset-2" href="#terminos" target="_blank" rel="noopener">Términos y Condiciones<span className="sr-only"> (se abre en otra pestaña)</span></a>
                  {' '}y la{' '}
                  <a className="font-bold text-ink underline underline-offset-2" href="#privacidad" target="_blank" rel="noopener">Política de Privacidad<span className="sr-only"> (se abre en otra pestaña)</span></a>.
                </span>
              </label>
              {fieldErrors.accept_terms && <p id={`${id}-accept_terms-error`} className="m-0 text-[13px] font-semibold text-[#b3442b]">{fieldErrors.accept_terms}</p>}
            </div>
          )}
          {error && <p className="m-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[14px] text-[#b3442b]" role="alert">{error}</p>}
          {notice && <p className="m-0 rounded-[14px] bg-[rgba(117,183,155,.16)] py-3 px-4 text-[14px] leading-[1.5] text-[#2f5a46]" role="status">{notice}</p>}
          <button className={`${BTN_INK_MD} mt-2 w-full disabled:cursor-wait!`} type="submit" disabled={loading}>{submitLabel}</button>
          {mode === 'login' && (
            <button type="button" className={LINK_BUTTON} onClick={() => switchMode('forgot')}>¿Olvidaste tu contraseña?</button>
          )}
          {isForgot && (
            <button type="button" className={LINK_BUTTON} onClick={() => switchMode('login')}>Volver a iniciar sesión</button>
          )}
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
const LOGIN_LABEL = 'text-[11px] font-extrabold uppercase tracking-[.18em] text-muted';
// text-[17px]: 16 px o mas evita el zoom automatico de iOS al enfocar.
const LOGIN_INPUT = 'w-full rounded-t-[10px] border-0 border-b-2 border-b-[rgba(23,63,54,.22)] bg-transparent py-3 px-3 text-center text-[17px] font-medium normal-case tracking-normal text-ink outline-none transition-colors duration-200 hover:border-b-[rgba(23,63,54,.4)] focus:border-b-orange focus:bg-[rgba(117,183,155,.14)] aria-[invalid=true]:border-b-[#b3442b]';
const LINK_BUTTON = 'cursor-pointer justify-self-center border-0 bg-transparent p-1 text-[14px] font-semibold text-ink underline decoration-[rgba(23,63,54,.35)] underline-offset-4 hover:decoration-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';
