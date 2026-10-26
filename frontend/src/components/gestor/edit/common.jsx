import { useEffect, useId, useRef } from 'react';
import { BTN_INK_MD, BTN_INK_OUTLINE_MD, FORM_INPUT, FORM_LABEL } from '../../uiStyles.js';

// Piezas comunes de los editores del perfil publico (ProfilePreviewPanel).
// LIMITS: los mismos de backend/service/schemas/org_profiles.py (y users.py para nombre, bio y
// contacto privado). Si cambian alla, cambian aqui.
export const LIMITS = {
  name: 120, description: 2000, tagline: 140, municipality: 60, address: 200, opening_hours: 300,
  public_email: 120, whatsapp: 20, seeking_text: 300, achievements: 800, contact: 200,
  highlightTitle: 100, highlightWhen: 60, highlightDescription: 1200, imageText: 150, socialLabel: 40,
  socialLinks: 8, highlights: 8, highlightImages: 4, gallery: 12,
};
export const SOCIAL_PLATFORMS = [
  ['instagram', 'Instagram'], ['facebook', 'Facebook'], ['tiktok', 'TikTok'], ['youtube', 'YouTube'],
  ['spotify', 'Spotify'], ['x', 'X'], ['linkedin', 'LinkedIn'], ['otro', 'Otro'],
];
// WhatsApp: el backend quita espacios, guiones, puntos y parentesis y acepta + y 7 a 19 digitos.
export const normalizeWhatsapp = (value) => String(value || '').replace(/[\s\-().]/g, '');
export const WHATSAPP_OK = (value) => !value || /^\+?\d{7,19}$/.test(normalizeWhatsapp(value));

export const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';
export const HINT = 'm-0 text-[13px] font-medium normal-case tracking-normal leading-[1.45] text-[#53645c]';
const ALERT = 'm-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[14px] text-[#b3442b]';
// Boton solido de peligro (eliminar), misma talla que BTN_INK_MD.
const DANGER_MD = BTN_INK_MD.replace('bg-ink', 'bg-[#a8431f]').replace(/hover:bg-\S+/, 'hover:bg-[#8f3719]');

export const isBlank = (value) => value === null || value === undefined || String(value).trim() === '';

export function CharCount({ value, max }) {
  const length = String(value || '').length;
  return (
    <span className={`text-[12px] font-semibold normal-case tracking-normal ${length > max ? 'text-[#b3442b]' : 'text-[#53645c]'}`} aria-live="polite">
      {length} / {max}
    </span>
  );
}

// Campo de texto con etiqueta visible, pista opcional y contador.
export function TextField({ label, value, onChange, max, multiline = false, rows = 4, hint, counter = false, type = 'text', inputProps = {}, ...rest }) {
  const id = useId();
  const Tag = multiline ? 'textarea' : 'input';
  return (
    <div className="grid gap-1.5" {...rest}>
      <label htmlFor={id} className={`${FORM_LABEL} flex items-end justify-between gap-3`}>
        <span>{label}</span>
        {counter && max && <CharCount value={value} max={max} />}
      </label>
      <Tag
        id={id}
        className={`${FORM_INPUT} ${multiline ? 'resize-y leading-[1.55]' : ''}`}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        maxLength={max}
        {...(multiline ? { rows } : { type })}
        aria-describedby={hint ? `${id}-hint` : undefined}
        {...inputProps}
      />
      {hint && <p id={`${id}-hint`} className={HINT}>{hint}</p>}
    </div>
  );
}

// Interruptor accesible (role="switch") con su etiqueta visible.
export function Switch({ checked, onChange, label, description, disabled = false }) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-desc` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 cursor-pointer rounded-full border-0 transition-colors duration-200 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60 ${checked ? 'bg-ink' : 'bg-[#cfc5b4]'} ${FOCUS}`}
      >
        <span className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform duration-200 motion-reduce:transition-none ${checked ? 'translate-x-5' : ''}`} aria-hidden="true" />
      </button>
      <span className="grid gap-0.5">
        <span id={`${id}-label`} className="text-[14px] font-bold text-ink">{label}</span>
        {description && <span id={`${id}-desc`} className={HINT}>{description}</span>}
      </span>
    </div>
  );
}

// Contenedor de cada editor: titulo, campos, error del backend (role="alert") y Guardar/Cancelar.
// Al abrirse enfoca el primer campo; Esc cancela. busyText: si hay algo en curso (subidas), Guardar
// queda desactivado con ese texto.
export function EditorShell({ title, children, onSubmit, onCancel, saving, error, busyText = '', submitLabel = 'Guardar', footer }) {
  const formRef = useRef(null);
  useEffect(() => {
    const first = formRef.current?.querySelector('input:not([type=file]):not([disabled]), textarea, select, button[role=switch]');
    first?.focus();
  }, []);

  function handleKeyDown(event) {
    if (event.key === 'Escape' && !event.defaultPrevented) {
      event.preventDefault();
      onCancel();
    }
  }

  return (
    <form
      ref={formRef}
      className="grid gap-5 rounded-[24px] border-2 border-ink/80 bg-white p-6 max600:p-4"
      onSubmit={(event) => { event.preventDefault(); if (!saving && !busyText) onSubmit(); }}
      onKeyDown={handleKeyDown}
      aria-label={`Editar ${title}`}
      noValidate
    >
      <h3 className="m-0 font-sans text-[20px] font-extrabold tracking-[-0.02em] text-ink">{title}</h3>
      {children}
      {error && <p className={ALERT} role="alert">{error}</p>}
      <div className="flex flex-wrap items-center gap-3 max480:grid max480:grid-cols-1">
        <button type="submit" className={`${BTN_INK_MD} max480:w-full`} disabled={saving || Boolean(busyText)}>
          {saving ? 'Guardando...' : busyText || submitLabel}
        </button>
        <button type="button" className={`${BTN_INK_OUTLINE_MD} max480:w-full`} onClick={onCancel} disabled={saving}>Cancelar</button>
        {footer}
      </div>
    </form>
  );
}

// Dialogo de confirmacion accesible (alertdialog): foco en "Cancelar" al abrir, Esc cancela, Tab
// queda dentro y el foco vuelve a donde estaba al cerrar.
export function ConfirmDialog({ title, text, confirmLabel, onConfirm, onCancel, danger = false }) {
  const cancelRef = useRef(null);
  const boxRef = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    cancelRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  function handleKeyDown(event) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onCancel(); }
    if (event.key === 'Tab') {
      const buttons = [...boxRef.current.querySelectorAll('button')];
      const index = buttons.indexOf(document.activeElement);
      if (event.shiftKey && index <= 0) { event.preventDefault(); buttons.at(-1).focus(); }
      else if (!event.shiftKey && index === buttons.length - 1) { event.preventDefault(); buttons[0].focus(); }
    }
  }

  const id = useId();
  return (
    <div className="fixed inset-0 z-[210] grid place-items-center bg-[rgba(8,20,16,.55)] p-4" onKeyDown={handleKeyDown}>
      <div ref={boxRef} role="alertdialog" aria-modal="true" aria-labelledby={`${id}-t`} aria-describedby={`${id}-d`}
        className="grid w-full max-w-[440px] gap-4 rounded-[24px] bg-paper p-6 shadow-[0_24px_60px_rgba(8,20,16,.3)]">
        <h2 id={`${id}-t`} className="m-0 font-sans text-[21px] font-extrabold tracking-[-0.02em] text-ink">{title}</h2>
        <p id={`${id}-d`} className="m-0 text-[15px] leading-[1.55] text-[#3f514a]">{text}</p>
        <div className="flex flex-wrap justify-end gap-3 max480:grid max480:grid-cols-1">
          <button ref={cancelRef} type="button" className={`${BTN_INK_OUTLINE_MD} max480:w-full`} onClick={onCancel}>Cancelar</button>
          <button type="button" className={`${danger ? DANGER_MD : BTN_INK_MD} max480:w-full`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
