import { useState } from 'react';

// Entrada de etiquetas como pildoras (PublicationForm): Enter o coma agregan, cada pildora tiene su
// boton para quitarla y Retroceso con el campo vacio quita la ultima. Mismas reglas que la API
// (services/publications.py::clean_tags): sin HTML, recortadas, sin repetidas sin distinguir
// mayusculas, hasta `max` de `maxLength` caracteres. `error` (de la API o de aqui) va en su campo.
const PILL = 'inline-flex items-center gap-1 rounded-full bg-[rgba(117,183,155,0.25)] py-1 pr-1 pl-3 text-[14px] font-semibold text-ink';
const REMOVE = 'flex size-7 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-[16px] leading-none text-ink hover:bg-[rgba(23,63,54,0.12)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink';

const plain = (text) => text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

export default function TagsInput({ id, label, hint, value, onChange, max = 3, maxLength = 24, disabled = false, error = '', onError }) {
  const [draft, setDraft] = useState('');
  const full = value.length >= max;
  const describedBy = [`${id}-hint`, error ? `${id}-error` : null].filter(Boolean).join(' ');

  function add(raw) {
    const tag = plain(raw);
    if (!tag) return true;
    if (tag.length > maxLength) { onError(`Cada etiqueta puede tener hasta ${maxLength} caracteres.`); return false; }
    if (value.some((existing) => existing.toLocaleLowerCase('es') === tag.toLocaleLowerCase('es'))) {
      onError('Esa etiqueta ya está.');
      return false;
    }
    if (value.length >= max) { onError(`Máximo ${max} etiquetas.`); return false; }
    onError('');
    onChange([...value, tag]);
    return true;
  }

  function onKeyDown(event) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      if (add(draft)) setDraft('');
    } else if (event.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  function onInput(event) {
    // Una coma pegada en medio del texto tambien separa.
    const parts = event.target.value.split(',');
    if (parts.length > 1) {
      let rest = '';
      parts.forEach((part, index) => {
        if (index === parts.length - 1) rest = part;
        else add(part);
      });
      setDraft(rest);
    } else {
      setDraft(event.target.value);
    }
  }

  function remove(tag) {
    onChange(value.filter((existing) => existing !== tag));
    onError('');
    // El campo puede estar deshabilitado (lleno) hasta el siguiente render.
    requestAnimationFrame(() => document.getElementById(id)?.focus());
  }

  return (
    <div className="grid content-start gap-1.5">
      <label className="text-[12px] font-bold uppercase tracking-[.12em] text-muted" htmlFor={id}>{label}</label>
      <div className={`flex min-h-[46px] flex-wrap items-center gap-2 rounded-[12px] border bg-white py-1.5 px-2 focus-within:border-ink ${error ? 'border-[#b3442b]' : 'border-[#d9cfbe]'} ${disabled ? 'opacity-60' : ''}`}>
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="Etiquetas agregadas">
          {value.map((tag) => (
            <li key={tag} className={PILL}>
              {tag}
              <button type="button" className={REMOVE} onClick={() => remove(tag)} disabled={disabled} aria-label={`Quitar la etiqueta ${tag}`}>×</button>
            </li>
          ))}
        </ul>
        <input
          id={id}
          className="min-w-[140px] flex-1 border-0 bg-transparent py-1 px-1.5 font-sans text-[15px] font-medium text-ink outline-none disabled:cursor-not-allowed"
          value={draft}
          onChange={onInput}
          onKeyDown={onKeyDown}
          onBlur={() => { if (draft.trim() && add(draft)) setDraft(''); }}
          maxLength={maxLength + 10}
          disabled={disabled || full}
          placeholder={full ? `Máximo ${max}` : 'Escribe y pulsa Enter'}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
      </div>
      <div className="flex justify-between gap-3 text-[13px] text-muted">
        <span id={`${id}-hint`}>{hint}</span>
        <span aria-live="polite" className="shrink-0 tabular-nums">{value.length}/{max}</span>
      </div>
      {error && <p id={`${id}-error`} className="m-0 text-[13px] font-semibold text-[#b3442b]">{error}</p>}
    </div>
  );
}
