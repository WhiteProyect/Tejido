import { useId, useState } from 'react';
import Icon from '../../Icon.jsx';
import { useUnsavedChanges } from '../../admin/artist/unsavedChanges.js';
import { CharCount, HINT } from '../../gestor/edit/common.jsx';
import { BTN_GHOST, BTN_INK_OUTLINE_MD, BTN_QUIET_SM, FORM_INPUT, FORM_LABEL } from '../../uiStyles.js';
import EmptyNote from '../../EmptyNote.jsx';
import { formatCOP } from '../../../utils/talent.js';
import { ALERT, LIMITS, SaveBar, talentApi } from './common.jsx';

// Pestaña de lista del editor (servicios, ficha tecnica, trayectoria, respaldo, presentaciones):
// filas editables con subir/bajar y quitar, "Agregar" hasta el maximo y un Guardar que reemplaza la
// lista entera (PUT /api/talent/{id}/<key>). Los errores del backend quedan en el formulario sin
// perder lo escrito. config: listConfigs.js.

function FieldInput({ field, item, onChange, idPrefix }) {
  const id = `${idPrefix}-${field.name}`;
  const value = item[field.name] ?? '';
  const hint = typeof field.hint === 'function' ? field.hint(item) : field.hint;
  let control;
  if (field.type === 'select') {
    control = (
      <select id={id} className={FORM_INPUT} value={value} onChange={(event) => onChange(field.name, event.target.value)}>
        {field.options.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
    );
  } else if (field.type === 'price' || field.type === 'year') {
    control = (
      <input id={id} className={FORM_INPUT} inputMode="numeric" value={value} maxLength={field.type === 'year' ? 4 : 9}
        onChange={(event) => onChange(field.name, event.target.value.replace(/\D/g, ''))} aria-describedby={hint ? `${id}-hint` : undefined} />
    );
  } else {
    const Tag = field.multiline ? 'textarea' : 'input';
    control = (
      <Tag id={id} className={`${FORM_INPUT} ${field.multiline ? 'resize-y leading-[1.55]' : ''}`} value={value} maxLength={field.max}
        rows={field.multiline ? 3 : undefined} placeholder={field.placeholder} onChange={(event) => onChange(field.name, event.target.value)}
        aria-describedby={hint ? `${id}-hint` : undefined} />
    );
  }
  return (
    <div className={`grid gap-1.5 ${field.full ? 'col-span-2 max600:col-span-1' : ''}`}>
      <label htmlFor={id} className={`${FORM_LABEL} flex items-end justify-between gap-3`}>
        <span>{field.label}{field.required ? '' : ' (opcional)'}</span>
        {field.max && <CharCount value={value} max={field.max} />}
      </label>
      {control}
      {field.type === 'price' && (
        <p className={HINT} aria-live="polite">{String(value) === '' ? 'Se mostrará: A convenir' : `Se mostrará: ${formatCOP(Number(value))}`}</p>
      )}
      {hint && <p id={`${id}-hint`} className={HINT}>{hint}</p>}
    </div>
  );
}

function validate(config, items) {
  for (const [index, item] of items.entries()) {
    for (const field of config.fields) {
      if (field.show && !field.show(item)) continue;
      const value = String(item[field.name] ?? '').trim();
      if (field.required && !value) return `Falta «${field.label.toLowerCase()}» en el ${config.noun} ${index + 1}.`;
      if (field.type === 'price' && value && Number(value) > LIMITS.maxPrice) return `El precio del ${config.noun} ${index + 1} no puede superar ${formatCOP(LIMITS.maxPrice)}.`;
      if (field.type === 'year' && value) {
        const year = Number(value);
        const last = new Date().getFullYear() + 1;
        if (year < 1900 || year > last) return `El año del ${config.noun} ${index + 1} debe estar entre 1900 y ${last}.`;
      }
    }
  }
  return '';
}

export default function ListTab({ detail, config, onSaved }) {
  const prefix = useId().replace(/:/g, '');
  const [initial] = useState(() => detail[config.key].map(config.fromItem));
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [announce, setAnnounce] = useState('');
  const dirty = JSON.stringify(items) !== JSON.stringify(initial);
  useUnsavedChanges(dirty);

  const update = (index, name, value) => setItems((current) => current.map((item, i) => (i === index ? { ...item, [name]: value } : item)));
  function move(index, delta) {
    const next = [...items];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    setItems(next);
    setAnnounce(`${config.noun} movido a la posición ${index + delta + 1} de ${next.length}.`);
    requestAnimationFrame(() => document.getElementById(`${prefix}-${index + delta}-${delta < 0 ? 'up' : 'down'}`)?.focus());
  }
  function add() {
    setItems([...items, { ...config.empty }]);
    requestAnimationFrame(() => document.getElementById(`${prefix}-${items.length}-${config.fields[0].name}`)?.focus());
  }

  async function save(event) {
    event.preventDefault();
    const problem = validate(config, items);
    if (problem) { setError(problem); return; }
    setBusy(true);
    setError('');
    try {
      await talentApi.putList(detail.id, config.key, items.map(config.toItem));
      await onSaved({ title: `${config.title}: guardado`, reviewNote: true });
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} noValidate aria-labelledby={`${prefix}-title`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h3 id={`${prefix}-title`} className="m-0 font-sans text-[22px] font-extrabold tracking-[-0.03em] text-ink">
          {config.title} <span className="text-[16px] font-bold text-muted">({items.length} de {config.max})</span>
        </h3>
      </div>
      <p className={`${HINT} mt-2 max-w-[680px]`}>{config.intro}</p>
      <p className="sr-only" aria-live="polite">{announce}</p>

      {items.length === 0 ? (
        <div className="mt-5"><EmptyNote icon="pen" title={`Sin ${config.title.toLowerCase()} todavía`} text={`Agrega el primer ${config.noun}.`} /></div>
      ) : (
        <ol className="mt-5 mb-0 grid list-none gap-4 p-0">
          {items.map((item, index) => {
            const label = `${config.noun} ${index + 1}${config.name(item) ? `: ${config.name(item)}` : ''}`;
            return (
              <li key={index} className="rounded-[18px] border border-line bg-white/70 p-5 max600:p-4">
                <fieldset className="m-0 border-0 p-0">
                  <legend className="mb-3 p-0 text-[13px] font-extrabold uppercase tracking-[.1em] text-[#53645c]">{config.noun} {index + 1}</legend>
                  <div className="grid grid-cols-[1fr_1fr] gap-4 max600:grid-cols-[1fr]">
                    {config.fields.filter((field) => !field.show || field.show(item)).map((field) => (
                      <FieldInput key={field.name} field={field} item={item} idPrefix={`${prefix}-${index}`} onChange={(name, value) => update(index, name, value)} />
                    ))}
                  </div>
                </fieldset>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button id={`${prefix}-${index}-up`} type="button" className={BTN_QUIET_SM} disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Subir ${label}`}>↑ Subir</button>
                  <button id={`${prefix}-${index}-down`} type="button" className={BTN_QUIET_SM} disabled={index === items.length - 1} onClick={() => move(index, 1)} aria-label={`Bajar ${label}`}>↓ Bajar</button>
                  <button type="button" className={BTN_GHOST} onClick={() => setItems(items.filter((_, i) => i !== index))} aria-label={`Quitar ${label}`}>Quitar</button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-4">
        {items.length < config.max
          ? <button type="button" className={BTN_INK_OUTLINE_MD} onClick={add}><Icon name="pen" className="size-4" /> {config.addLabel}</button>
          : <p className={HINT}>Llegaste al máximo de {config.max}. Quita uno para agregar otro.</p>}
      </div>

      {error && <p className={`${ALERT} mt-5`} role="alert">{error}</p>}
      <SaveBar busy={busy} dirty={dirty} label={`Guardar ${config.title.toLowerCase()}`} />
    </form>
  );
}
