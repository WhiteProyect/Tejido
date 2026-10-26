import Icon from '../../Icon.jsx';
import { BTN_INK_SM } from '../../uiStyles.js';
import { FOCUS } from './common.jsx';

// Marco de una seccion del perfil en modo edicion (ProfilePreviewPanel).
// - Con contenido: la seccion publica tal cual, borde discontinuo suave al pasar o enfocar, y un
//   boton de lapiz arriba a la derecha, siempre visible (no depende del hover: tactil y teclado).
// - Vacia (la pagina publica la omite): bloque con borde discontinuo, el titulo de la seccion, un
//   texto de invitacion y el boton de agregar.
// buttonRef recibe el boton (lapiz o agregar) para devolverle el foco al cerrar el editor.
// action: reemplaza el lapiz (p. ej. un enlace en las secciones que se gestionan en otro lado).
// readOnly: sin lapiz ni accion (solo se muestra).
const EDIT_BUTTON = `inline-flex size-10 cursor-pointer items-center justify-center rounded-full border border-line bg-white text-ink shadow-[0_2px_8px_rgba(12,36,30,.08)] transition-colors duration-200 hover:bg-cream motion-reduce:transition-none ${FOCUS}`;

export default function EditableFrame({ label, title, onEdit, buttonRef, empty = false, emptyText, addLabel = 'Agregar', action, readOnly = false, children }) {
  if (empty) {
    return (
      <section className="grid justify-items-start gap-3 rounded-[24px] border-2 border-dashed border-[#d9cfbe] bg-paper p-6 max600:p-5" aria-label={title}>
        <h2 className="m-0 font-sans text-[22px] font-extrabold tracking-[-0.03em] text-ink">{title}</h2>
        <p className="m-0 max-w-[560px] text-[15px] leading-[1.55] text-[#53645c]">{emptyText}</p>
        {action || (
          <button ref={buttonRef} type="button" className={`${BTN_INK_SM} max480:w-full`} onClick={onEdit}>
            <Icon name="pen" className="size-3.5" /> {addLabel}
          </button>
        )}
      </section>
    );
  }
  return (
    <div className="relative rounded-[24px] border-2 border-dashed border-transparent p-4 transition-colors duration-200 hover:border-[#d9cfbe] focus-within:border-[#d9cfbe] motion-reduce:transition-none max600:p-2">
      {!readOnly && <div className="absolute top-3 right-3 z-[5] max600:top-2 max600:right-2">
        {action || (
          <button ref={buttonRef} type="button" className={EDIT_BUTTON} onClick={onEdit} aria-label={`Editar ${label}`} title={`Editar ${label}`}>
            <Icon name="pen" className="size-4" />
          </button>
        )}
      </div>}
      {children}
    </div>
  );
}
