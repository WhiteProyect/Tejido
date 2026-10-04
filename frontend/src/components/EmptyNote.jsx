import Icon from './Icon.jsx';

// Estado vacio ("Memoria Vacia" del Modelo de Alertas TEJIDO): recuadro punteado con icono
// morado, titulo, texto y una accion opcional (un enlace con EMPTY_NOTE_ACTION, por ejemplo).
// Ocupa el ancho de su contenedor; el espaciado de afuera lo pone quien lo usa. `compact`
// reduce el relleno para espacios bajos, como la lista lateral del mapa.
export const EMPTY_NOTE_ACTION = 'inline-flex items-center gap-2 rounded-full border border-ink bg-transparent py-2.5 px-5 text-[14px] font-bold text-ink transition-colors duration-200 hover:bg-ink hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

export default function EmptyNote({ icon, title, text, action, compact = false }) {
  return (
    <div className={`rounded-[20px] border border-dashed border-[#d9cfbe] text-center ${compact ? 'py-5 px-4' : 'py-10 px-6'}`}>
      <Icon name={icon} className="mx-auto size-8 text-purple" />
      <p className="mt-3 mb-1 text-[17px] font-bold text-ink">{title}</p>
      {text && <p className="mx-auto mt-0 mb-0 max-w-[420px] text-[14px] leading-[1.55] text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
