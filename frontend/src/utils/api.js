// Peticion JSON a la API con la sesion actual (Bearer de localStorage). Devuelve el cuerpo
// o lanza un Error con el mensaje del backend.
export async function apiRequest(url, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('tejido_token');
  const response = await fetch(url, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'No fue posible completar la acción.');
  return data;
}
