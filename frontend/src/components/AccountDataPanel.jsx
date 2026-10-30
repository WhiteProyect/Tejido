import { useId, useState } from 'react';
import Icon from './Icon.jsx';
import { BTN_INK_MD, FORM_INPUT, FORM_LABEL, PANEL, PANEL_TITLE } from './uiStyles.js';
import { useToast } from '../context/ToastContext.jsx';
import { apiRequest } from '../utils/api.js';
import { MUNICIPALITIES } from '../utils/constants.js';

// "Tus datos" en el perfil (todos los roles): nombre, apellido y municipio, editables con
// PATCH /api/me (el backend recompone el nombre visible). El correo y su verificacion se muestran
// pero no se editan aqui. Las cuentas anteriores al registro nuevo empiezan sin nombre y apellido
// por separado: se proponen a partir del nombre que ya tienen.
const NAME_MIN = 2;
const NAME_MAX = 60;

function initialValues(user) {
  const [first, ...rest] = String(user.name || '').split(' ');
  return {
    first_name: user.first_name ?? first ?? '',
    last_name: user.last_name ?? rest.join(' '),
    municipality: user.municipality || '',
  };
}

export default function AccountDataPanel({ user, onUserUpdate }) {
  const { showToast } = useToast();
  const id = useId().replace(/:/g, '');
  const [values, setValues] = useState(() => initialValues(user));
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const saved = initialValues(user);
  const dirty = values.first_name !== saved.first_name || values.last_name !== saved.last_name || values.municipality !== saved.municipality;

  function check() {
    const found = {};
    for (const [field, label] of [['first_name', 'El nombre'], ['last_name', 'El apellido']]) {
      const value = values[field].replace(/\s+/g, ' ').trim();
      if (!value) found[field] = `${label} es obligatorio.`;
      else if (value.length < NAME_MIN || value.length > NAME_MAX) found[field] = `${label} debe tener entre ${NAME_MIN} y ${NAME_MAX} caracteres.`;
    }
    return found;
  }

  async function save(event) {
    event.preventDefault();
    const found = check();
    setErrors(found);
    setError('');
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      const result = await apiRequest('/api/me', { method: 'PATCH', body: { ...values, municipality: values.municipality || null } });
      onUserUpdate(result.user);
      setValues(initialValues(result.user));
      showToast({ tone: 'menta', title: 'Tus datos quedaron guardados' });
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  const input = (name) => ({
    id: `${id}-${name}`,
    value: values[name],
    onChange: (event) => setValues((current) => ({ ...current, [name]: event.target.value })),
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': errors[name] ? `${id}-${name}-error` : undefined,
  });

  return (
    <section className={PANEL} aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className={`${PANEL_TITLE} flex items-center gap-3`}><Icon name="pen" className="size-6 text-river" /> Tus datos</h2>
      <form className="mt-5 grid gap-5" onSubmit={save} noValidate>
        <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-5 max800:grid-cols-[minmax(0,1fr)]">
          {[['first_name', 'Nombre', 'given-name'], ['last_name', 'Apellido', 'family-name']].map(([name, label, autoComplete]) => (
            <div key={name} className="grid content-start gap-1.5">
              <label htmlFor={`${id}-${name}`} className={FORM_LABEL}>{label}</label>
              <input className={FORM_INPUT} type="text" autoComplete={autoComplete} maxLength={NAME_MAX} {...input(name)} />
              {errors[name] && <p id={`${id}-${name}-error`} className="m-0 text-[13px] font-semibold text-[#b3442b]">{errors[name]}</p>}
            </div>
          ))}
          <div className="grid content-start gap-1.5">
            <label htmlFor={`${id}-municipality`} className={FORM_LABEL}>Municipio</label>
            <select className={FORM_INPUT} {...input('municipality')}>
              <option value="">Prefiero no decirlo</option>
              {MUNICIPALITIES.map(({ id: key, name }) => <option key={key} value={key}>{name}</option>)}
            </select>
          </div>
        </div>
        <p className="m-0 flex flex-wrap items-center gap-2 text-[14px] text-[#53645c]">
          Correo: <strong className="text-ink">{user.email}</strong>
          <span className={`rounded-full py-0.5 px-2.5 text-[12px] font-bold ${user.email_verified ? 'bg-[rgba(117,183,155,.2)] text-[#2f5a46]' : 'bg-[rgba(212,168,67,.2)] text-[#7a5c12]'}`}>
            {user.email_verified ? 'Verificado' : 'Sin verificar'}
          </span>
        </p>
        {error && <p className="m-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[14px] text-[#b3442b]" role="alert">{error}</p>}
        <div><button type="submit" className={BTN_INK_MD} disabled={saving || !dirty}>{saving ? 'Guardando...' : 'Guardar mis datos'}</button></div>
      </form>
    </section>
  );
}
