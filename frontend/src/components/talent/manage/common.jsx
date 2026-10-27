import Icon from '../../Icon.jsx';
import { apiRequest } from '../../../utils/api.js';
import { TALENT_STATUS_LABELS } from '../../../utils/publicationStatus.js';
import { BTN_INK_MD } from '../../uiStyles.js';

// Piezas comunes de la gestion de talento (admin y lider de rama).
// LIMITS: los mismos de backend/service/schemas/talent.py. Si cambian alla, cambian aqui.
export const LIMITS = {
  name: 120, tagline: 200, description: 2000, actNumber: 30,
  services: 10, serviceTitle: 100, serviceTag: 20, serviceDescription: 300, priceNote: 60, maxPrice: 100_000_000,
  specs: 12, specLabel: 60, specValue: 200,
  media: 16, mediaTitle: 100, mediaCaption: 150,
  milestones: 12, milestoneTitle: 100, milestoneDescription: 400,
  endorsements: 8, endorsementTitle: 100, endorsementText: 400,
  venues: 10, venueName: 100,
  windowDays: 366,
};

export const ALERT = 'm-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[14px] text-[#b3442b]';

export const talentApi = {
  list: () => apiRequest('/api/talent/manage'),
  detail: (id) => apiRequest(`/api/talent/manage/${id}`),
  create: (body) => apiRequest('/api/talent', { method: 'POST', body }),
  patch: (id, body) => apiRequest(`/api/talent/${id}`, { method: 'PATCH', body }),
  putList: (id, key, items) => apiRequest(`/api/talent/${id}/${key}`, { method: 'PUT', body: { items } }),
  putAvailability: (id, body) => apiRequest(`/api/talent/${id}/availability`, { method: 'PUT', body }),
  submit: (id) => apiRequest(`/api/talent/${id}/submit`, { method: 'POST' }),
  moderate: (id, status, note = '') => apiRequest(`/api/talent/${id}/status`, { method: 'PATCH', body: { status, note } }),
  remove: (id) => apiRequest(`/api/talent/${id}`, { method: 'DELETE' }),
};

export const TALENT_TOASTS = {
  approve: { tone: 'menta', eyebrow: 'Sello puesto', title: 'Talento aprobado', text: 'Ya se ve en el listado de talento.' },
  reject: { tone: 'menta', eyebrow: 'Hilo devuelto', title: 'Talento rechazado', text: 'Quien lo envió verá el motivo para ajustarlo.' },
  submit: { tone: 'menta', eyebrow: 'Hilo en camino', title: 'Enviado a revisión', text: 'El equipo de TEJIDO lo revisará pronto.' },
  publish: { tone: 'menta', eyebrow: 'Al aire', title: 'Talento publicado', text: 'Ya se ve en el listado de talento.' },
  archive: { tone: 'menta', title: 'Talento archivado', text: 'Ya no aparece en el sitio.' },
};

export function StatusBadge({ status }) {
  const [label, tone] = TALENT_STATUS_LABELS[status] || [status, TALENT_STATUS_LABELS.DRAFT[1]];
  return <span className={`whitespace-nowrap rounded-full py-1 px-3 text-[12px] font-bold ${tone}`}>{label}</span>;
}

// Rutas de la gestion segun el rol: el admin en su dashboard, el lider en el suyo.
export function managePath(role, id, tab) {
  const base = role === 'ADMIN' ? 'admin-dashboard/talento' : 'gestor-dashboard/talento';
  return [base, id, tab].filter((part) => part !== undefined && part !== null && part !== '').join('/');
}

// Pie de cada pestaña del editor: guardar (con su estado) y lo que se quiera al lado.
export function SaveBar({ busy, dirty, label = 'Guardar', disabledText = '', children }) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-t-line pt-5 max480:grid max480:grid-cols-1">
      <button type="submit" className={`${BTN_INK_MD} max480:w-full`} disabled={busy || Boolean(disabledText)}>
        <Icon name="check" className="size-4" /> {busy ? 'Guardando...' : disabledText || label}
      </button>
      {children}
      {dirty && !busy && <span className="text-[13px] font-semibold text-[#7a5c12]" role="status">Hay cambios sin guardar</span>}
    </div>
  );
}
