import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from './api.js';

// Solicitud del ciudadano para participar en una rama (GET/DELETE /api/me/branch-request y
// POST /api/branch-requests). Solo un CIUDADANO con sesion hace la llamada; para gestores, admins
// y visitantes queda { enabled: false, request: null }.
// request: la mas reciente ({ id, branch, message, status, decision_note, created_at, decided_at }) o null.
export default function useBranchRequest(user) {
  const enabled = user?.role === 'CIUDADANO';
  const [state, setState] = useState({ loading: enabled, request: null, error: '' });

  const reload = useCallback(async () => {
    if (!enabled) {
      setState({ loading: false, request: null, error: '' });
      return;
    }
    try {
      const request = await apiRequest('/api/me/branch-request');
      setState({ loading: false, request, error: '' });
    } catch (error) {
      setState({ loading: false, request: null, error: error.message });
    }
  }, [enabled]);

  useEffect(() => { reload(); }, [reload, user?.id]);

  // Lanza el error del backend (409 ya pendiente o ya gestor, 429 limite) para mostrarlo en el formulario.
  async function send(branch, message) {
    const request = await apiRequest('/api/branch-requests', { method: 'POST', body: { branch, message: message || null } });
    setState({ loading: false, request, error: '' });
    return request;
  }

  async function cancel() {
    await apiRequest('/api/me/branch-request', { method: 'DELETE' });
    await reload();
  }

  return { ...state, enabled, send, cancel, reload };
}
