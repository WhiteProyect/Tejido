// Peticion JSON a la API con la sesion actual (Bearer de localStorage). Devuelve el cuerpo
// o lanza un Error con el mensaje del backend (el codigo HTTP en error.status y el del backend,
// p. ej. EMAIL_NOT_VERIFIED, en error.code). signal (opcional): AbortController para cancelar.
export async function apiRequest(url, { method = 'GET', body, signal } = {}) {
  const token = localStorage.getItem('tejido_token');
  const response = await fetch(url, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || 'No fue posible completar la acción.');
    error.status = response.status;
    error.code = data.error;
    throw error;
  }
  return data;
}
