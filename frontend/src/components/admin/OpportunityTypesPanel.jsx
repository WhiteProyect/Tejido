import { useCallback, useEffect, useId, useState } from 'react';
import Icon from '../Icon.jsx';
import { Pill } from '../territory/TerritoryParts.jsx';
import { BTN_DANGER, BTN_GHOST, BTN_INK_MD, FORM_INPUT, FORM_LABEL, PANEL, PANEL_TITLE, TYPE_COLORS, TYPE_COLOR_KEYS, typeColors } from '../uiStyles.js';
import { useToast } from '../../context/ToastContext.jsx';
import { apiRequest } from '../../utils/api.js';

// Tipos de oportunidad (#admin-dashboard/oportunidades): GET/POST/PATCH/DELETE
// /api/admin/opportunity-types y .../{id}/move. Crear, renombrar (el slug no cambia), subir/bajar,
// activar/desactivar (con confirmacion si hay oportunidades que lo usan) y borrar (la API responde
// 409 si esta en uso: se muestra su mensaje). Cada tipo tiene un color de la paleta cerrada (selector de
// muestras con nombre, radios nativos: flechas para elegir). Tras cada cambio el foco vuelve a un sitio estable.
const ROW = 'flex flex-wrap items-center justify-between gap-3 border-b border-b-line py-4 last:border-b-0';
const ORDER_BTN = 'inline-flex size-11 cursor-pointer items-center justify-center rounded-full border border-[#d9cfbe] bg-white text-ink hover:border-ink disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';
const CHIP = 'rounded-full py-1 px-3 text-[13px] font-bold';

// Selector de color: radios nativos (Tab entra al grupo, flechas cambian) con la muestra y su nombre.
function ColorPicker({ name, value, onChange, disabled }) {
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0" data-selector-color>
      <legend className={`${FORM_LABEL} mb-1.5 p-0`}>Color</legend>
      <div className="flex flex-wrap gap-2">
        {TYPE_COLOR_KEYS.map((key) => {
          const colors = TYPE_COLORS[key];
          return (
            <label key={key} className="relative inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-[#ddd5c7] bg-white py-1 pr-3.5 pl-1.5 text-[15px] font-semibold text-[#173f36] has-[:checked]:border-[#173f36] has-[:checked]:[box-shadow:inset_0_0_0_1px_#173f36] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#173f36]">
              <input type="radio" name={name} value={key} checked={value === key} onChange={() => onChange(key)} disabled={disabled} className="sr-only" />
              <span className="size-7 shrink-0 rounded-full border" style={{ backgroundColor: colors.bg, borderColor: colors.border || colors.bg }} aria-hidden="true" />
              {colors.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function TypeRow({ item, index, total, busy, onAction, onRename }) {
  const [mode, setMode] = useState(null); // null | 'rename' | 'deactivate' | 'delete'
  const [label, setLabel] = useState(item.label);
  const [color, setColor] = useState(item.color);
  const inputId = useId();
  const uses = item.uses === 1 ? '1 oportunidad' : `${item.uses} oportunidades`;

  return (
    <li className={ROW} data-tipo={item.slug}>
      <div className="flex min-w-0 flex-1 basis-[260px] items-center gap-3">
        <div className="flex gap-1.5">
          <button type="button" className={ORDER_BTN} disabled={busy || index === 0} aria-label={`Subir ${item.label}`} data-mover="up"
            onClick={() => onAction(item, 'up')}><Icon name="arrow-left" className="size-4 rotate-90" /></button>
          <button type="button" className={ORDER_BTN} disabled={busy || index === total - 1} aria-label={`Bajar ${item.label}`} data-mover="down"
            onClick={() => onAction(item, 'down')}><Icon name="arrow-right" className="size-4 rotate-90" /></button>
        </div>
        {mode === 'rename' ? (
          <form className="grid min-w-0 flex-1 gap-3" onSubmit={(event) => { event.preventDefault(); onRename(item, label, color).then((ok) => ok && setMode(null)); }}>
            <label className="sr-only" htmlFor={inputId}>Nuevo nombre para {item.label}</label>
            <input id={inputId} className={`${FORM_INPUT} max-w-[260px]`} value={label} onChange={(event) => setLabel(event.target.value)} maxLength={40} autoFocus disabled={busy} />
            <ColorPicker name={`${inputId}-color`} value={color} onChange={setColor} disabled={busy} />
            <div className="flex flex-wrap gap-2">
              <button type="submit" className={BTN_INK_MD} disabled={busy}>Guardar</button>
              <button type="button" className={BTN_GHOST} disabled={busy} onClick={() => { setMode(null); setLabel(item.label); setColor(item.color); }}>Cancelar</button>
            </div>
          </form>
        ) : (
          <div className="min-w-0">
            <p className="m-0 flex flex-wrap items-center gap-2 text-[17px] font-bold text-ink">
              {item.label}
              <Pill colors={typeColors(item.color)} data-muestra={item.color}>{TYPE_COLORS[item.color]?.label || item.color}</Pill>
            </p>
            <p className="m-0 text-[14px] text-[#53645c]">{uses} · <span className="font-mono text-[13px]">{item.slug}</span></p>
          </div>
        )}
      </div>
      {mode !== 'rename' && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className={`${CHIP} ${item.active ? 'bg-[rgba(136,197,164,0.3)] text-ink' : 'bg-[#e9e2d5] text-[#4d5a55]'}`}>{item.active ? 'Activo' : 'Desactivado'}</span>
          {mode === 'deactivate' ? (
            <span className="flex flex-wrap items-center gap-2" role="group" aria-label={`Confirmar desactivar ${item.label}`}>
              <span className="text-[14px] text-[#53645c]">Lo usan {uses}: dejará de ofrecerse al crear, pero las que lo tienen lo conservan.</span>
              <button type="button" className={BTN_DANGER} disabled={busy} autoFocus onClick={() => { setMode(null); onAction(item, 'deactivate'); }}>Sí, desactivar</button>
              <button type="button" className={BTN_GHOST} disabled={busy} onClick={() => setMode(null)}>No</button>
            </span>
          ) : mode === 'delete' ? (
            <span className="flex flex-wrap items-center gap-2" role="group" aria-label={`Confirmar eliminar ${item.label}`}>
              <button type="button" className={BTN_DANGER} disabled={busy} autoFocus onClick={() => { setMode(null); onAction(item, 'delete'); }}>Sí, eliminar</button>
              <button type="button" className={BTN_GHOST} disabled={busy} onClick={() => setMode(null)}>No</button>
            </span>
          ) : (
            <>
              <button type="button" className={BTN_GHOST} disabled={busy} onClick={() => setMode('rename')}><Icon name="pen" className="size-3.5" /> Editar</button>
              <button type="button" className={BTN_GHOST} disabled={busy}
                onClick={() => (item.active ? (item.uses ? setMode('deactivate') : onAction(item, 'deactivate')) : onAction(item, 'activate'))}>
                {item.active ? 'Desactivar' : 'Activar'}
              </button>
              <button type="button" className={BTN_DANGER} disabled={busy} onClick={() => setMode('delete')}>Eliminar</button>
            </>
          )}
        </div>
      )}
    </li>
  );
}

export default function OpportunityTypesPanel() {
  const { showToast } = useToast();
  const [state, setState] = useState({ loading: true, items: [], error: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [label, setLabel] = useState('');
  const [color, setColor] = useState('');
  const [createError, setCreateError] = useState('');
  const createId = useId();
  const nextColor = color || TYPE_COLOR_KEYS[state.items.length % TYPE_COLOR_KEYS.length];

  const load = useCallback(async () => {
    try {
      const items = await apiRequest('/api/admin/opportunity-types');
      setState({ loading: false, items, error: '' });
    } catch (error) {
      setState({ loading: false, items: [], error: error.message });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function run(action, success) {
    setBusy(true);
    setMessage('');
    try {
      await action();
      await load();
      if (success) showToast({ tone: 'menta', title: success });
      return true;
    } catch (error) {
      setMessage(error.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleAction(item, action) {
    const base = `/api/admin/opportunity-types/${item.id}`;
    if (action === 'up' || action === 'down') {
      await run(() => apiRequest(`${base}/move`, { method: 'POST', body: { direction: action } }));
      // El foco sigue al tipo movido (su boton de la misma direccion, o el otro si llego al borde).
      requestAnimationFrame(() => {
        const row = document.querySelector(`[data-tipo="${item.slug}"]`);
        const button = row?.querySelector(`[data-mover="${action}"]:not(:disabled)`) || row?.querySelector('[data-mover]:not(:disabled)');
        button?.focus();
      });
    } else if (action === 'deactivate' || action === 'activate') {
      await run(() => apiRequest(base, { method: 'PATCH', body: { active: action === 'activate' } }),
        action === 'activate' ? `«${item.label}» está activo` : `«${item.label}» quedó desactivado`);
    } else if (action === 'delete') {
      await run(() => apiRequest(base, { method: 'DELETE' }), `«${item.label}» eliminado`);
    }
  }

  const handleRename = (item, next, nextColor) => run(() => apiRequest(`/api/admin/opportunity-types/${item.id}`, { method: 'PATCH', body: { label: next, color: nextColor } }),
    'Tipo actualizado');

  async function handleCreate(event) {
    event.preventDefault();
    setCreateError('');
    setBusy(true);
    try {
      await apiRequest('/api/admin/opportunity-types', { method: 'POST', body: { label, color: nextColor } });
      setLabel('');
      setColor('');
      await load();
      showToast({ tone: 'menta', title: 'Tipo creado', text: 'Ya se puede elegir al crear una oportunidad.' });
    } catch (error) {
      setCreateError(error.message);
      requestAnimationFrame(() => document.getElementById(createId)?.focus());
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={PANEL} aria-labelledby="admin-tipos-oportunidad">
      <h2 id="admin-tipos-oportunidad" className={`${PANEL_TITLE} flex items-center gap-3`}><Icon name="compass" className="size-6 text-river" /> Tipos de oportunidad</h2>
      <p className="mt-2 mb-0 max-w-[680px] text-[15px] text-muted">
        Los que se ofrecen al crear una oportunidad y en el filtro de la pantalla Oportunidades, en este orden. Uno en uso no se borra: desactívalo.
      </p>

      <form className="mt-6 flex flex-wrap items-end gap-3" onSubmit={handleCreate}>
        <div className="grid min-w-[240px] flex-1 gap-1.5">
          <label className={FORM_LABEL} htmlFor={createId}>Nuevo tipo</label>
          <input id={createId} className={`${FORM_INPUT} ${createError ? 'border-[#b3442b]' : ''}`} value={label} maxLength={40} placeholder="P. ej. Residencia artística"
            onChange={(event) => { setLabel(event.target.value); setCreateError(''); }} disabled={busy}
            aria-invalid={createError ? true : undefined} aria-describedby={createError ? `${createId}-error` : undefined} />
        </div>
        <div className="basis-full">
          {/* Por defecto, el siguiente color de la paleta (lo mismo que haria la API sin color). */}
          <ColorPicker name="nuevo-tipo-color" value={nextColor} onChange={setColor} disabled={busy} />
        </div>
        <button type="submit" className={BTN_INK_MD} disabled={busy || !label.trim()}><Icon name="check" className="size-4" /> Crear tipo</button>
        {createError && <p id={`${createId}-error`} className="m-0 basis-full text-[14px] font-semibold text-[#b3442b]">{createError}</p>}
      </form>

      {message && <p className="mt-5 mb-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[15px] text-[#b3442b]" role="alert">{message}</p>}
      {state.loading && <p className="m-0 py-6 text-[15px] text-muted" aria-busy="true">Cargando...</p>}
      {state.error && <p className="mt-4 mb-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[15px] text-[#b3442b]" role="alert">{state.error}</p>}
      {!state.loading && !state.error && (
        <ul className="mt-4 mb-0 grid list-none p-0" aria-label="Tipos de oportunidad, en orden">
          {state.items.map((item, index) => (
            <TypeRow key={`${item.id}-${item.label}`} item={item} index={index} total={state.items.length} busy={busy}
              onAction={handleAction} onRename={handleRename} />
          ))}
        </ul>
      )}
    </section>
  );
}
