import { useEffect, useRef } from 'react';
import Icon from '../Icon.jsx';

// Pestanas en pildora con el patron ARIA (tablist/tab): flechas, Inicio y Fin mueven y activan;
// solo la activa entra en el orden de tabulacion. Ids: `${idPrefix}-tab-<id>`, y el panel que las
// acompana debe llamarse `${idPrefix}-panel-<id>`. En <=480 px pierden el icono y el relleno baja;
// si aun asi no caben, la fila se desplaza sola (sin mover la pagina).
// tabs: [{ id, label, icon, badge, badgeLabel, badgeTone: 'alert' | 'neutral' }]
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

export default function PillTabs({ tabs, active, onChange, idPrefix, label, size = 'normal' }) {
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

  function handleKeyDown(event) {
    const index = ids.indexOf(active);
    const next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: ids.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const id = ids[(next + ids.length) % ids.length];
    onChange(id);
    // Si el cambio se cancelo (cambios sin guardar), el foco vuelve a la pestana activa.
    requestAnimationFrame(() => rowRef.current?.querySelector('[role=tab][aria-selected=true]')?.focus());
  }

  return (
    <div ref={rowRef} className="relative max-w-full overflow-x-auto">
      <div className="inline-flex gap-1 rounded-full bg-cream p-1" role="tablist" aria-label={label} onKeyDown={handleKeyDown}>
        {tabs.map((tab) => {
          const selected = active === tab.id;
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
