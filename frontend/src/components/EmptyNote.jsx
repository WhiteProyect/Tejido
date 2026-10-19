import Icon from './Icon.jsx';
import { BTN_INK_OUTLINE_MD } from './uiStyles.js';

// Estado vacio ("Memoria Vacia" del Modelo de Alertas TEJIDO): recuadro punteado con icono
// morado, titulo, texto y una accion opcional (un enlace con EMPTY_NOTE_ACTION, por ejemplo).
// Ocupa el ancho de su contenedor; el espaciado de afuera lo pone quien lo usa. `compact`
// reduce el relleno para espacios bajos, como la lista lateral del mapa.
export const EMPTY_NOTE_ACTION = BTN_INK_OUTLINE_MD;

export default function EmptyNote({ icon, title, text, action, compact = false }) {
  return (
    <div className={`rounded-[20px] border border-dashed border-[#d9cfbe] text-center ${compact ? 'py-5 px-4' : 'py-10 px-6 max480:px-4'}`}>
      <Icon name={icon} className="mx-auto size-8 text-purple" />
      <p className="mt-3 mb-1 text-[17px] font-bold text-ink">{title}</p>
      {text && <p className="mx-auto mt-0 mb-0 max-w-[420px] text-[14px] leading-[1.55] text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
