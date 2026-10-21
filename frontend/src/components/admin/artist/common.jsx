import { useCallback, useEffect, useState } from 'react';
import Icon from '../../Icon.jsx';
import { BTN_DANGER, BTN_GHOST, BTN_INK_MD, BTN_INK_OUTLINE_MD, FORM_LABEL } from '../../uiStyles.js';
import { confirmDiscard, useUnsavedChanges } from './unsavedChanges.js';
import { cdnImage } from '../../../utils/cloudinaryUrl.js';

// Piezas comunes del editor de artistas (cada pestana las reutiliza): estado de una operacion,
// alerta de error, confirmacion en linea, formulario en linea con su estado, botones de reordenar
// (y su logica), etiquetas y avatar. Las imagenes usan components/ImageField.jsx (subida a Cloudinary).

export const ALERT = 'm-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[14px] text-[#b3442b]';
export const HELP = 'm-0 text-[12px] leading-[1.45] text-muted';
const TAG_BASE = 'whitespace-nowrap rounded-full py-0.5 px-2.5 text-[11px] font-bold uppercase tracking-[.08em]';
export const TAG = {
  gold: `${TAG_BASE} bg-[rgba(212,168,67,0.18)] text-[#7a5c12]`,
  grey: `${TAG_BASE} bg-[rgba(102,116,111,0.14)] text-[#44564f]`,
  river: `${TAG_BASE} bg-[rgba(29,143,163,0.12)] text-[#146f80]`,
};

// Patrones de URL para los campos de enlace de las pestanas (los de imagen usan components/ImageField).
export { IMAGE_PATTERN, LINK_PATTERN } from '../../../utils/urlPatterns.js';

// Estado de UNA operacion (guardar, eliminar, mover...): ocupado y mensaje de error del backend.
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = useCallback(async (operation) => {
    setBusy(true);
    setError('');
    try {
      await operation();
      return true;
    } catch (operationError) {
      setError(operationError.message);
      return false;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, run, setError };
}

// Valores de un formulario y cuales cambiaron; con cambios, avisa antes de salir.
export function useFormValues(initial) {
  const [initialValues] = useState(initial);
  const [values, setValues] = useState(initial);
  const changedKeys = Object.keys(initialValues).filter((key) => values[key] !== initialValues[key]);
  useUnsavedChanges(changedKeys.length > 0);
  const set = (name, value) => setValues((current) => ({ ...current, [name]: value }));
  const bind = (name) => ({
    value: values[name],
    onChange: (event) => set(name, event.target.value),
  });
  return { values, initialValues, changedKeys, set, bind };
}

// Cuerpo para POST (lo que tiene valor) o PUT (solo lo que cambio). Texto vacio en un PUT se envia
// "" (el backend lo guarda como null); fechas vacias van null (Pydantic no acepta "" como fecha).
export function buildPayload({ values, changedKeys }, isEdit, { dates = [], numbers = [] } = {}) {
  const keys = isEdit ? changedKeys : Object.keys(values);
  const body = {};
  for (const key of keys) {
    let value = values[key];
    if (typeof value === 'string') value = value.trim();
    if (numbers.includes(key)) value = value === '' ? 0 : Number(value);
    else if (dates.includes(key) && value === '') value = null;
    if (!isEdit && (value === '' || value === null)) continue;
    body[key] = value;
  }
  return body;
}

export function ErrorAlert({ children, className = '' }) {
  if (!children) return null;
  return <p className={`${ALERT} ${className}`} role="alert">{children}</p>;
}

// Accion destructiva con confirmacion en la misma fila ("Sí, eliminar" / "No").
export function ConfirmButton({ onConfirm, busy, label = 'Eliminar', confirmLabel = 'Sí, eliminar', itemName }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button type="button" className={BTN_DANGER} disabled={busy} onClick={() => setConfirming(true)} aria-label={itemName ? `${label} ${itemName}` : undefined}>
        {label}
      </button>
    );
  }
  return (
    <>
      <button type="button" className={BTN_DANGER} disabled={busy} onClick={onConfirm} autoFocus>{confirmLabel}</button>
      <button type="button" className={BTN_GHOST} disabled={busy} onClick={() => setConfirming(false)}>No</button>
    </>
  );
}

// Formulario de alta/edicion en linea: titulo, campos (rejilla de 2 columnas, 1 en movil),
// alerta del backend sin perder lo escrito y botones. Los campos de ancho completo usan FULL.
export const FULL = 'col-span-2 max600:col-span-1';

export function InlineForm({ id, title, onSubmit, onCancel, busy, error, submitLabel, children }) {
  return (
    <form
      id={id}
      className="mt-6 grid scroll-mt-24 grid-cols-[1fr_1fr] gap-4 rounded-[20px] border border-line bg-white/60 p-5 max600:grid-cols-[1fr]"
      onSubmit={(event) => { event.preventDefault(); onSubmit(); }}
      aria-label={title}
    >
      <h3 className={`${FULL} m-0 font-sans text-[20px] font-bold tracking-[-0.02em] text-ink`}>{title}</h3>
      {children}
      <ErrorAlert className={FULL}>{error}</ErrorAlert>
      <div className={`${FULL} flex flex-wrap gap-3`}>
        <button type="submit" className={BTN_INK_MD} disabled={busy}>
          <Icon name="check" className="size-4" /> {busy ? 'Guardando...' : submitLabel}
        </button>
        <button type="button" className={BTN_INK_OUTLINE_MD} onClick={onCancel} disabled={busy}>Cancelar</button>
      </div>
    </form>
  );
}

export function Field({ label, hint, className = '', children }) {
  return (
    <label className={`${FORM_LABEL} ${className}`}>
      {label}
      {children}
      {hint && <span className="text-[12px] font-medium normal-case tracking-normal text-muted">{hint}</span>}
    </label>
  );
}

// Subir / bajar un elemento de una lista ordenada. Los ids permiten devolver el foco tras moverlo.
export function ReorderButtons({ idPrefix, itemName, isFirst, isLast, busy, onMove }) {
  const base = `${BTN_GHOST} px-[11px]!`;
  return (
    <>
      <button id={`${idPrefix}-up`} type="button" className={base} disabled={busy || isFirst} onClick={() => onMove(-1)} aria-label={`Subir ${itemName}`}>
        <Icon name="arrow-left" className="size-3.5 rotate-90" />
      </button>
      <button id={`${idPrefix}-down`} type="button" className={base} disabled={busy || isLast} onClick={() => onMove(1)} aria-label={`Bajar ${itemName}`}>
        <Icon name="arrow-left" className="size-3.5 -rotate-90" />
      </button>
    </>
  );
}

// Foto del artista o, sin foto, su inicial sobre un fondo tintado.
export function ArtistAvatar({ artist, size = 'size-14', text = 'text-[22px]' }) {
  const [failed, setFailed] = useState(false);
  const muted = artist.active ? '' : 'grayscale opacity-70';
  if (artist.image && !failed) {
    return <img src={cdnImage(artist.image, { width: 128, fit: 'fill' })} alt="" decoding="async" className={`${size} shrink-0 rounded-[14px] object-cover ${muted}`} onError={() => setFailed(true)} />;
  }
  return (
    <span className={`flex ${size} shrink-0 items-center justify-center rounded-[14px] bg-[rgba(29,143,163,0.14)] ${text} font-extrabold text-[#146f80] ${muted}`} aria-hidden="true">
      {artist.stage_name.charAt(0).toUpperCase()}
    </span>
  );
}

// Cabecera de una pestana del editor: titulo con su conteo, la accion de agregar y, en children,
// acciones extra (p. ej. "Subir varias fotos" en Galeria).
export function SectionHeader({ title, count, actionLabel, onAction, showAction, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <h2 className="m-0 font-sans text-[22px] font-extrabold tracking-[-0.03em] text-ink">
        {title} <span className="text-[16px] font-bold text-muted">({count})</span>
      </h2>
      {(showAction || children) && (
        <div className="flex flex-wrap gap-3">
          {children}
          {showAction && <button type="button" className={BTN_INK_MD} onClick={onAction}><Icon name="pen" className="size-4" /> {actionLabel}</button>}
        </div>
      )}
    </div>
  );
}

// Que formulario esta abierto en una pestana: null, 'nueva' o el id de la fila. Abrir otro con
// cambios sin guardar pregunta antes; el formulario se lleva a la vista (id `${formPrefix}-<target>`).
export function useEditing(formPrefix) {
  const [editing, setEditing] = useState(null);
  function open(target) {
    if (editing !== null && !confirmDiscard()) return;
    setEditing(target);
    requestAnimationFrame(() => document.getElementById(`${formPrefix}-${target}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
  return { editing, open, close: () => setEditing(null) };
}

export const sortByOrden = (rows) => [...rows].sort((a, b) => a.orden - b.orden || a.id - b.id);

// Subir / bajar en una lista con `orden`: intercambia con el vecino y renumera 1..n (asi tambien se
// ordena una lista con ordenes repetidos); solo se guardan las filas cuyo orden cambio. Tras recargar,
// el foco vuelve a la flecha del elemento movido (o a la otra si quedo en un extremo) y se anuncia
// la nueva posicion. Las flechas usan ReorderButtons con idPrefix `${idPrefix}-<id>`.
export function useReorder({ rows, idPrefix, saveOrden, onChanged, nameOf }) {
  const action = useAction();
  const [focusTarget, setFocusTarget] = useState(null);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    if (!focusTarget) return;
    const [primary, fallback] = focusTarget;
    const target = document.getElementById(primary);
    (target && !target.disabled ? target : document.getElementById(fallback))?.focus();
    setFocusTarget(null);
  }, [rows, focusTarget]);

  async function move(item, delta) {
    const list = sortByOrden(rows);
    const from = list.findIndex((entry) => entry.id === item.id);
    const to = from + delta;
    if (to < 0 || to >= list.length) return;
    [list[from], list[to]] = [list[to], list[from]];
    const changes = list.map((entry, index) => [entry, index + 1]).filter(([entry, orden]) => entry.orden !== orden);
    const ok = await action.run(async () => {
      for (const [entry, orden] of changes) await saveOrden(entry, orden);
      await onChanged();
    });
    if (ok) {
      const [up, down] = [`${idPrefix}-${item.id}-up`, `${idPrefix}-${item.id}-down`];
      setFocusTarget(delta < 0 ? [up, down] : [down, up]);
      setAnnouncement(`«${nameOf(item)}» ahora va en la posición ${to + 1} de ${list.length}.`);
    }
  }

  return { move, busy: action.busy, error: action.error, announcement };
}
