import { apiRequest } from '../utils/api.js';

// Llamadas del panel del admin que no viven en un componente concreto (pestaña Usuarios y lideres de
// rama). Usan apiRequest: misma sesion y mismos errores en espanol (error.message, error.code).

// Listado de usuarios: { items, total, page, page_size, counts }. Filtros opcionales q, role, status,
// branch, page, page_size. signal: para cancelar busquedas viejas.
export function listUsers({ q = '', role = '', status = '', branch = '', page = 1, pageSize = 25 } = {}, { signal } = {}) {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (q.trim()) params.set('q', q.trim());
  if (role) params.set('role', role);
  if (status) params.set('status', status);
  if (branch) params.set('branch', branch);
  return apiRequest(`/api/admin/users?${params}`, { signal });
}

// Buscador del dialogo "Nombrar líder": cuentas activas (ciudadanos, gestores y admins; el dialogo decide
// cuales se pueden elegir).
export const searchUsers = (q, { signal, pageSize = 10 } = {}) => listUsers({ q, status: 'ACTIVO', pageSize }, { signal }).then((data) => data.items);

export const getUser = (id) => apiRequest(`/api/admin/users/${id}`);
export const updateUser = (id, fields) => apiRequest(`/api/admin/users/${id}`, { method: 'PATCH', body: fields });
export const makeGestor = (id, { branch, organizationName = '', leader = false }) =>
  apiRequest(`/api/admin/users/${id}/make-gestor`, { method: 'POST', body: { branch, organization_name: organizationName || null, leader } });
export const moveGestor = (id, { branch, lead = false }) => apiRequest(`/api/admin/users/${id}/move`, { method: 'POST', body: { branch, lead } });
export const removeFromBranch = (id) => apiRequest(`/api/admin/users/${id}/remove-from-branch`, { method: 'POST' });
export const makeAdmin = (id) => apiRequest(`/api/admin/users/${id}/make-admin`, { method: 'POST' });
export const revokeAdmin = (id) => apiRequest(`/api/admin/users/${id}/revoke-admin`, { method: 'POST' });
export const resendInvite = (id) => apiRequest(`/api/admin/gestores/${id}/resend-invite`, { method: 'POST' });

// Lider de rama (rutas existentes): nombrar a un participante, quitar el liderazgo, participantes y resumen.
export const setLeader = (branch, gestorId) => apiRequest(`/api/admin/branches/${branch}/leader`, { method: 'PUT', body: { gestor_id: gestorId } });
export const clearLeader = (branch) => apiRequest(`/api/admin/branches/${branch}/leader`, { method: 'DELETE' });
export const branchParticipants = (branch) => apiRequest(`/api/branches/${branch}/participants`);
export const branchesOverview = () => apiRequest('/api/admin/branches');

// Convierte a un ciudadano en gestor y lider de la rama (el lider anterior queda como participante).
export const promoteToLeader = (branch, userId, organizationName) =>
  apiRequest(`/api/admin/branches/${branch}/leader/promote`, { method: 'POST', body: { user_id: userId, organization_name: organizationName || null } });
