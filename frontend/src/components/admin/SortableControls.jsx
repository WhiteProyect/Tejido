import Icon from '../Icon.jsx';

// Controles compartidos de las listas ordenables del dashboard del admin (Pulso y Carrusel): el asa de
// arrastre (framer-motion Reorder con dragListener={false}: solo el asa arrastra) y Subir/Bajar para el
// teclado. Todos de 44 px. moveFocus deja el foco en el boton que se uso (o en el otro, si la fila llego
// al extremo) despues de mover.
export const ICON_BTN = 'inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border-[1.5px] border-[#d9cfbe] bg-white text-ink transition-colors duration-200 hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[#d9cfbe]';

export function DragHandle({ controls, label }) {
  return (
    <button type="button" aria-label={`Arrastrar «${label}» para reordenar`} title="Arrastrar para reordenar" onPointerDown={(event) => controls.start(event)}
      className={`${ICON_BTN} cursor-grab touch-none border-transparent bg-transparent active:cursor-grabbing`} data-asa>
      <Icon name="grip" className="size-5" strokeWidth={2} />
    </button>
  );
}

export function MoveButtons({ label, index, total, onMove }) {
  return (
    <>
      <button type="button" className={ICON_BTN} aria-label={`Subir «${label}»`} disabled={index === 0} onClick={() => onMove(-1)} data-subir>
        <Icon name="arrow-up" className="size-4" strokeWidth={2.2} />
      </button>
      <button type="button" className={ICON_BTN} aria-label={`Bajar «${label}»`} disabled={index === total - 1} onClick={() => onMove(1)} data-bajar>
        <Icon name="arrow-down" className="size-4" strokeWidth={2.2} />
      </button>
    </>
  );
}

// Mueve el elemento `index` una posicion (delta -1 o 1). Devuelve la lista nueva, o null si no se puede.
export function moveItem(list, index, delta) {
  const target = index + delta;
  if (index < 0 || target < 0 || target >= list.length) return null;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function moveFocus(getRow, delta) {
  requestAnimationFrame(() => {
    const row = getRow();
    const own = row?.querySelector(delta < 0 ? '[data-subir]' : '[data-bajar]');
    (own && !own.disabled ? own : row?.querySelector(delta < 0 ? '[data-bajar]' : '[data-subir]'))?.focus();
  });
}
