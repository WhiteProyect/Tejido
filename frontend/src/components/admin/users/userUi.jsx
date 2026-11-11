import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Icon from '../../Icon.jsx';
import { LeaderBadge } from '../../gestor/GestorHeader.jsx';

// Piezas de la pestaña Usuarios: insignias de rol y estado (la señal nunca es solo el color: llevan
// texto), las acciones validas de cada usuario y el menu "Acciones" (patron menu de ARIA).

export const ROLE_LABELS = { ADMIN: 'Administrador', GESTOR: 'Gestor', CIUDADANO: 'Ciudadano' };
export const ROLE_PLURALS = { ADMIN: 'Administradores', GESTOR: 'Gestores', CIUDADANO: 'Ciudadanos' };
export const STATUS_LABELS = { ACTIVO: 'Activo', INACTIVO: 'Inactivo', INVITADO: 'Invitado' };
const ROLE_TONES = {
  ADMIN: 'border-ink bg-ink text-[#fff9ec]',
  GESTOR: 'border-[#2f8a63] bg-[#dcefe5] text-[#1f4d3a]',
  CIUDADANO: 'border-[#d9cfbe] bg-white text-ink',
};
const STATUS_TONES = {
  ACTIVO: ['bg-[#dcefe5] text-[#245a43]', 'bg-[#2f8a63]'],
  INACTIVO: ['bg-[#ece7df] text-[#3f4a46]', 'bg-[#6b7570]'],
  INVITADO: ['bg-[#f6ebcc] text-[#6b500f]', 'bg-[#b8902a]'],
};
const ROLE_ICONS = { ADMIN: 'seal', GESTOR: 'people', CIUDADANO: 'door' };

export function RoleBadge({ role }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[12px] font-bold whitespace-nowrap ${ROLE_TONES[role] || ROLE_TONES.CIUDADANO}`} data-rol={role}>
      <Icon name={ROLE_ICONS[role] || 'door'} className="size-3.5" strokeWidth={2} />{ROLE_LABELS[role] || role}
    </span>
  );
}

export function StatusBadge({ status }) {
  const [tone, dot] = STATUS_TONES[status] || STATUS_TONES.INACTIVO;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-bold whitespace-nowrap ${tone}`} data-estado={status}>
      <span className={`size-2 rounded-full ${dot}`} aria-hidden="true" />{STATUS_LABELS[status] || status}
    </span>
  );
}

export function BranchCell({ user }) {
  if (!user.branch_label) return <span className="text-[#53645c]">–</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="text-ink">{user.branch_label}</span>
      {user.is_leader && <LeaderBadge small />}
    </span>
  );
}

// Acciones validas segun el usuario. ctx: { lastAdmin } (true si es el unico admin activo).
// Cada accion: { id, label, disabled?, reason? }.
export function userActions(user, { lastAdmin = false } = {}) {
  const view = { id: 'ver', label: 'Ver ficha' };
  const edit = { id: 'editar', label: 'Editar' };
  if (user.status === 'INVITADO') {
    return user.role === 'GESTOR' ? [view, { id: 'reenviar', label: 'Reenviar invitación' }] : [view];
  }
  const toggle = user.active ? { id: 'desactivar', label: 'Desactivar…' } : { id: 'activar', label: 'Activar…' };
  if (user.role === 'ADMIN') {
    const reason = user.is_self ? 'No puedes hacerlo sobre tu propia cuenta' : lastAdmin && user.active ? 'Es el último administrador activo' : '';
    return [view, edit, { id: 'quitar-admin', label: 'Quitar rol de administrador…', disabled: Boolean(reason), reason },
      user.active ? { id: 'desactivar', label: 'Desactivar…', disabled: Boolean(reason), reason } : toggle];
  }
  if (user.role === 'GESTOR') {
    if (!user.active || !user.branch) return [view, edit, toggle];
    if (user.is_leader) return [view, edit, { id: 'quitar-liderazgo', label: 'Quitar liderazgo…' }, toggle];
    return [view, edit, { id: 'nombrar-lider', label: 'Nombrar líder de su rama…' }, { id: 'mover', label: 'Mover a otra rama…' },
      { id: 'mover-lider', label: 'Mover y nombrar líder…' }, { id: 'sacar', label: 'Sacar de la rama…' }, { id: 'hacer-admin', label: 'Hacer administrador…' }, toggle];
  }
  if (!user.active) return [view, edit, toggle];
  return [view, edit, { id: 'gestor', label: 'Convertir en gestor…' }, { id: 'gestor-lider', label: 'Convertir en gestor y líder…' },
    { id: 'hacer-admin', label: 'Hacer administrador…' }, toggle];
}

// Menu "Acciones": Enter/Espacio/Abajo abren y enfocan la primera; flechas, Inicio y Fin navegan; Escape
// y Tab cierran (Escape devuelve el foco al boton). Va en un portal con posicion fija para que la tabla
// (con desplazamiento) no lo recorte.
export function ActionsMenu({ user, actions, onAction }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const id = useId().replace(/:/g, '');
  const enabled = actions.filter((action) => !action.disabled);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const rect = buttonRef.current.getBoundingClientRect();
      const width = Math.min(280, window.innerWidth - 16);
      const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
      const below = window.innerHeight - rect.bottom;
      const height = menuRef.current?.offsetHeight || 320;
      const top = below < height + 12 && rect.top > height + 12 ? rect.top - height - 6 : rect.bottom + 6;
      setPos({ left, top, width });
    };
    place();
    // Al desplazar o cambiar el tamaño, el menu sigue a su boton.
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (!menuRef.current?.contains(event.target) && !buttonRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const items = () => [...(menuRef.current?.querySelectorAll('[role=menuitem]:not([aria-disabled=true])') || [])];
  const focusItem = (index) => { const list = items(); list[(index + list.length) % list.length]?.focus(); };

  function openMenu(focusLast = false) {
    setOpen(true);
    requestAnimationFrame(() => requestAnimationFrame(() => focusItem(focusLast ? -1 : 0)));
  }

  function onButtonKey(event) {
    if (['Enter', ' ', 'ArrowDown'].includes(event.key)) { event.preventDefault(); openMenu(); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); openMenu(true); }
  }

  function onMenuKey(event) {
    const list = items();
    const index = list.indexOf(document.activeElement);
    if (event.key === 'ArrowDown') { event.preventDefault(); focusItem(index + 1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); focusItem(index - 1); }
    else if (event.key === 'Home') { event.preventDefault(); focusItem(0); }
    else if (event.key === 'End') { event.preventDefault(); focusItem(-1); }
    else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); buttonRef.current?.focus(); }
    else if (event.key === 'Tab') setOpen(false);
  }

  function choose(action) {
    if (action.disabled) return;
    setOpen(false);
    onAction(action.id, user, buttonRef.current);
  }

  return (
    <>
      <button ref={buttonRef} type="button" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? `${id}-menu` : undefined}
        onClick={() => (open ? setOpen(false) : openMenu())} onKeyDown={onButtonKey} data-acciones-usuario={user.id}
        className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] border-[#d9cfbe] bg-white px-3.5 font-sans text-[14px] font-bold whitespace-nowrap text-ink transition-colors duration-200 hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
        Acciones<span className="sr-only"> para {user.name}</span>
        <Icon name="arrow-right" className={`size-3.5 transition-transform duration-200 motion-reduce:transition-none ${open ? '-rotate-90' : 'rotate-90'}`} strokeWidth={2.2} />
      </button>
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.ul ref={menuRef} id={`${id}-menu`} role="menu" aria-label={`Acciones para ${user.name}`} onKeyDown={onMenuKey}
              className="fixed z-[120] m-0 grid list-none gap-0.5 rounded-[16px] border border-[#ddd5c7] bg-[#fffdf6] p-1.5 [box-shadow:0_4px_14px_rgba(23,63,54,.14)]"
              style={pos ? { left: pos.left, top: pos.top, width: pos.width } : { visibility: 'hidden', left: 0, top: 0 }}
              initial={reduce ? false : { opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -4 }}
              transition={{ duration: reduce ? 0 : 0.15, ease: 'easeOut' }} data-menu-acciones={user.id}>
              {actions.map((action) => (
                <li key={action.id} role="none">
                  <button type="button" role="menuitem" tabIndex={-1} aria-disabled={action.disabled ? 'true' : undefined}
                    onClick={() => choose(action)} data-accion={action.id}
                    className={`flex w-full min-h-11 flex-col items-start justify-center rounded-[12px] border-0 bg-transparent px-3 py-2 text-left font-sans text-[14px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ink ${
                      action.disabled ? 'cursor-not-allowed text-[#6b7570]' : 'cursor-pointer text-ink hover:bg-[#f3e4c8] focus:bg-[#f3e4c8]'}`}>
                    {action.label}
                    {action.disabled && action.reason && <span className="text-[12px] font-medium text-[#6b500f]">{action.reason}</span>}
                  </button>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
