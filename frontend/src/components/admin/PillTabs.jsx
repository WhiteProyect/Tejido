import { useEffect, useRef } from 'react';
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import Icon from '../Icon.jsx';

// Pestanas en pildora con el patron ARIA (tablist/tab): flechas, Inicio y Fin mueven y activan;
// solo la activa entra en el orden de tabulacion. Ids: `${idPrefix}-tab-<id>`, y el panel que las
// acompana debe llamarse `${idPrefix}-panel-<id>`. En <=480 px pierden el icono y el relleno baja;
// si aun asi no caben, la fila se desplaza sola (sin mover la pagina).
// tabs: [{ id, label, icon, badge, badgeLabel, badgeTone: 'alert' | 'neutral', disabled, disabledHint }]
// disabled: se ve con candado, aria-disabled, no se activa y las flechas la saltan; disabledHint es el
// motivo (tooltip y texto para lectores de pantalla).
// orientation="vertical" (dashboard del admin): columna con el icono ENCIMA de la etiqueta, indicador
// del activo que se desliza (framer-motion), aria-orientation="vertical" y flechas Arriba/Abajo, Inicio
// y Fin. collapsed: solo iconos de 44 px (la etiqueta queda para lectores de pantalla). className va al
// contenedor con desplazamiento propio. Sin orientation todo sigue exactamente como antes.
const TAB = 'inline-flex shrink-0 cursor-pointer items-center rounded-full border-0 font-bold whitespace-nowrap transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink max480:gap-1.5 max480:px-3 max480:text-[14px]';
// compact: para barras largas (las 7 secciones del editor de artista caben en un panel de escritorio).
const SIZES = {
  normal: 'gap-2 py-2.5 px-5 text-[15px]',
  compact: 'gap-1.5 py-2 px-3.5 text-[14px]',
};

function Badge({ tab, selected }) {
  if (tab.badge === undefined || tab.badge === null) return null;
  const tone = tab.badgeTone === 'alert'
    ? 'bg-[#a8431f] text-white'
    : selected ? 'bg-white/20 text-white' : 'bg-[rgba(23,63,54,.08)] text-ink';
  return (
    <span className={`rounded-full px-2 py-px text-[12px] ${tone}`}>
      {tab.badge}{tab.badgeLabel && <span className="sr-only"> {tab.badgeLabel}</span>}
    </span>
  );
}

export default function PillTabs({ orientation = 'horizontal', ...props }) {
  return orientation === 'vertical' ? <VerticalTabs {...props} /> : <HorizontalTabs {...props} />;
}

const VTAB = 'relative flex w-full cursor-pointer items-center justify-center border-0 bg-transparent font-sans font-bold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

function VerticalBadge({ tab, collapsed }) {
  if (tab.badge === undefined || tab.badge === null) return null;
  const tone = tab.badgeTone === 'alert' ? 'bg-[#b8502b] text-[#fff9ec]' : 'bg-ink text-[#fff9ec]';
  return (
    <span className={`absolute -top-2 -right-3 inline-flex min-w-5 items-center justify-center rounded-full px-1 text-[11px] leading-5 font-extrabold tabular-nums ${collapsed ? 'h-[18px] min-w-[18px] leading-[18px] -top-1.5 -right-2.5 text-[10px]' : 'h-5'} ${tone}`} data-badge>
      <span className="sr-only">, </span>{tab.badge}{tab.badgeLabel && <span className="sr-only"> {tab.badgeLabel}</span>}
    </span>
  );
}

function VerticalTabs({ tabs, active, onChange, idPrefix, label, collapsed = false, className = '' }) {
  const scrollRef = useRef(null);
  const reduce = useReducedMotion();
  const enabled = tabs.filter((tab) => !tab.disabled).map((tab) => tab.id);

  // La pestaña activa queda a la vista si la columna se desplaza (ventanas bajas). Solo se mueve la columna.
  useEffect(() => {
    const box = scrollRef.current;
    const tab = document.getElementById(`${idPrefix}-tab-${active}`);
    if (!box || !tab || box.scrollHeight <= box.clientHeight) return;
    const top = tab.offsetTop - box.offsetTop;
    if (top < box.scrollTop) box.scrollTop = top;
    else if (top + tab.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = top + tab.offsetHeight - box.clientHeight;
  }, [active, idPrefix, collapsed]);

  function handleKeyDown(event) {
    const index = enabled.indexOf(active);
    const next = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: enabled.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const id = enabled[(next + enabled.length) % enabled.length];
    if (id !== active) onChange(id);
    requestAnimationFrame(() => scrollRef.current?.querySelector('[role=tab][aria-selected=true]')?.focus());
  }

  return (
    <div ref={scrollRef} className={`overflow-y-auto overscroll-contain [scrollbar-width:thin] ${className}`}>
      <LayoutGroup id={`${idPrefix}-tabs`}>
        <div className={`flex flex-col ${collapsed ? 'items-center gap-1.5' : 'gap-1'}`} role="tablist" aria-orientation="vertical" aria-label={label} onKeyDown={handleKeyDown}>
          {tabs.map((tab) => {
            const selected = active === tab.id;
            const shape = collapsed ? 'size-11 shrink-0 rounded-full' : 'min-h-[64px] flex-col gap-1.5 rounded-[22px] px-1.5 py-2.5 text-[13px] leading-[1.15] text-center';
            if (tab.disabled) {
              return (
                <button key={tab.id} id={`${idPrefix}-tab-${tab.id}`} type="button" role="tab" aria-selected="false" aria-disabled="true" tabIndex={-1}
                  title={tab.disabledHint} data-bloqueada className={`${VTAB} ${shape} cursor-not-allowed text-[#4d5a55]`}>
                  <Icon name="lock" className="size-5" />
                  <span className={collapsed ? 'sr-only' : ''}>{tab.label}</span>
                  {tab.disabledHint && <span className="sr-only">. {tab.disabledHint}</span>}
                </button>
              );
            }
            return (
              <button
                key={tab.id}
                id={`${idPrefix}-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`${idPrefix}-panel-${tab.id}`}
                tabIndex={selected ? 0 : -1}
                title={collapsed ? tab.label : undefined}
                className={`${VTAB} ${shape} ${selected ? 'text-[#fff9ec]' : 'text-ink hover:bg-[rgba(23,63,54,.08)]'}`}
                onClick={() => onChange(tab.id)}
              >
                {selected && (
                  <motion.span layoutId={`${idPrefix}-activo`} className={`absolute inset-0 bg-ink ${collapsed ? 'rounded-full' : 'rounded-[22px]'}`}
                    transition={reduce ? { duration: 0 } : { duration: 0.25, ease: 'easeInOut' }} aria-hidden="true" data-indicador />
                )}
                {/* La etiqueta va primero en el DOM (nombre accesible "Publicaciones, 3 en revisión") y se pinta debajo del icono. */}
                <span className={collapsed ? 'sr-only' : 'relative order-2'}>{tab.label}</span>
                <span className="relative order-1 inline-flex">
                  {tab.icon && <Icon name={tab.icon} className="size-6" />}
                  <VerticalBadge tab={tab} collapsed={collapsed} />
                </span>
              </button>
            );
          })}
        </div>
      </LayoutGroup>
    </div>
  );
}

function HorizontalTabs({ tabs, active, onChange, idPrefix, label, size = 'normal' }) {
  const rowRef = useRef(null);
  const ids = tabs.map((tab) => tab.id);

  // La pestana activa queda a la vista si la fila se desplaza. Solo se mueve la fila:
  // scrollIntoView tambien desplazaria la pagina en vertical. Los contadores y la fuente web
  // llegan despues y cambian el ancho de las pestanas: se recalcula con ellos.
  const badges = tabs.map((tab) => tab.badge ?? '').join('|');
  useEffect(() => {
    let alive = true;
    function reveal() {
      const row = rowRef.current;
      const tab = document.getElementById(`${idPrefix}-tab-${active}`);
      if (!alive || !row || !tab) return;
      if (tab.offsetLeft < row.scrollLeft) row.scrollLeft = tab.offsetLeft;
      else if (tab.offsetLeft + tab.offsetWidth > row.scrollLeft + row.clientWidth) row.scrollLeft = tab.offsetLeft + tab.offsetWidth - row.clientWidth;
    }
    reveal();
    document.fonts?.ready.then(reveal);
    return () => { alive = false; };
  }, [active, idPrefix, badges]);

  const enabled = tabs.filter((tab) => !tab.disabled).map((tab) => tab.id);

  function handleKeyDown(event) {
    const index = enabled.indexOf(active);
    const next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: enabled.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const id = enabled[(next + enabled.length) % enabled.length];
    if (id !== active) onChange(id);
    // Si el cambio se cancelo (cambios sin guardar), el foco vuelve a la pestana activa.
    requestAnimationFrame(() => rowRef.current?.querySelector('[role=tab][aria-selected=true]')?.focus());
  }

  return (
    <div ref={rowRef} className="relative max-w-full overflow-x-auto">
      <div className="inline-flex gap-1 rounded-full bg-cream p-1" role="tablist" aria-label={label} onKeyDown={handleKeyDown}>
        {tabs.map((tab) => {
          const selected = active === tab.id;
          if (tab.disabled) {
            return (
              <button key={tab.id} id={`${idPrefix}-tab-${tab.id}`} type="button" role="tab" aria-selected="false" aria-disabled="true" tabIndex={-1}
                title={tab.disabledHint} data-bloqueada className={`${TAB} ${SIZES[size]} cursor-not-allowed bg-transparent text-[#4d5a55]`}>
                <Icon name="lock" className="size-4" /> {tab.label}
                {tab.disabledHint && <span className="sr-only">. {tab.disabledHint}</span>}
              </button>
            );
          }
          return (
            <button
              key={tab.id}
              id={`${idPrefix}-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${idPrefix}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              className={`${TAB} ${SIZES[size]} ${selected ? 'bg-ink text-white' : 'bg-transparent text-ink hover:bg-[rgba(23,63,54,.08)]'}`}
              onClick={() => onChange(tab.id)}
            >
              {tab.icon && <Icon name={tab.icon} className="size-4 max480:hidden" />} {tab.label}
              <Badge tab={tab} selected={selected} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
