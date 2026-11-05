import { useState } from 'react';

// Lista de requisitos de una oportunidad (PublicationForm): una fila por requisito, Enter o "Agregar"
// suman el escrito y cada fila tiene su boton para quitarlo. Mismas reglas que la API
// (services/publications.py::clean_requirements): sin HTML, recortados, sin repetidos sin distinguir
// mayusculas, hasta `max` de `maxLength` caracteres. `error` (de la API o de aqui) va en su campo.
const ROW = 'flex items-start justify-between gap-3 rounded-[12px] bg-[rgba(117,183,155,0.18)] py-2 pr-1.5 pl-3.5 text-[15px] leading-[1.45] text-ink';
const REMOVE = 'inline-flex min-h-9 shrink-0 cursor-pointer items-center rounded-full border-0 bg-transparent px-3 font-sans text-[14px] font-bold text-[#b3442b] hover:bg-[rgba(179,68,43,0.1)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink';
const ADD = 'inline-flex min-h-[46px] shrink-0 cursor-pointer items-center rounded-[12px] border-0 bg-ink px-4 font-sans text-[15px] font-bold text-[#fff9ec] hover:bg-forest disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

const plain = (text) => text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

export default function RequirementsInput({ id, label, hint, value, onChange, max = 8, maxLength = 160, disabled = false, error = '', onError }) {
  const [draft, setDraft] = useState('');
  const full = value.length >= max;
  const describedBy = [`${id}-hint`, error ? `${id}-error` : null].filter(Boolean).join(' ');

  function add() {
    const text = plain(draft);
    if (!text) return;
    if (text.length > maxLength) { onError(`Cada requisito puede tener hasta ${maxLength} caracteres.`); return; }
    if (value.some((existing) => existing.toLocaleLowerCase('es') === text.toLocaleLowerCase('es'))) { onError('Ese requisito ya está.'); return; }
    if (value.length >= max) { onError(`Máximo ${max} requisitos.`); return; }
    onError('');
    onChange([...value, text]);
    setDraft('');
  }

  function remove(index) {
    onChange(value.filter((_, position) => position !== index));
    onError('');
    requestAnimationFrame(() => document.getElementById(id)?.focus());
  }

  return (
    <div className="grid content-start gap-1.5">
      <label className="text-[12px] font-bold uppercase tracking-[.12em] text-muted" htmlFor={id}>{label}</label>
      {value.length > 0 && (
        <ol className="m-0 grid list-none gap-2 p-0" aria-label="Requisitos agregados">
          {value.map((item, index) => (
            <li key={item} className={ROW}>
              <span className="min-w-0 py-1 [overflow-wrap:anywhere]">{item}</span>
              <button type="button" className={REMOVE} onClick={() => remove(index)} disabled={disabled} aria-label={`Quitar el requisito ${item}`}>Quitar</button>
            </li>
          ))}
        </ol>
      )}
      <div className="flex gap-2">
        <input
          id={id}
          className={`w-full min-w-0 rounded-[12px] border bg-white py-2.5 px-3.5 font-sans text-[15px] font-medium text-ink outline-none focus:border-ink disabled:opacity-60 ${error ? 'border-[#b3442b]' : 'border-[#d9cfbe]'}`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); add(); } }}
          maxLength={maxLength + 10}
          disabled={disabled || full}
          placeholder={full ? `Máximo ${max}` : 'Escribe un requisito y pulsa Enter'}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
        <button type="button" className={ADD} onClick={add} disabled={disabled || full || !draft.trim()}>Agregar</button>
      </div>
      <div className="flex justify-between gap-3 text-[13px] text-muted">
        <span id={`${id}-hint`}>{hint}</span>
        <span aria-live="polite" className="shrink-0 tabular-nums">{value.length}/{max}</span>
      </div>
      {error && <p id={`${id}-error`} className="m-0 text-[13px] font-semibold text-[#b3442b]">{error}</p>}
    </div>
  );
}
