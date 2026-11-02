// Volver al mapa del inicio: al entrar a un municipio desde la seccion Geografia queda una marca en
// sessionStorage; si se vuelve al inicio (Atras o el enlace Inicio) la seccion se pone a la vista y la
// marca se borra. App la borra al ir a cualquier otra pantalla, para que no aparezca mas tarde.
// sessionStorage puede fallar (modo privado, almacenamiento bloqueado): entonces no hay retorno.
const KEY = 'tejido_volver_al_mapa';

export function markMapReturn() {
  try { sessionStorage.setItem(KEY, '1'); } catch { /* sin almacenamiento: no hay retorno */ }
}

export function clearMapReturn() {
  try { sessionStorage.removeItem(KEY); } catch { /* idem */ }
}

// true si habia marca (y la borra).
export function consumeMapReturn() {
  try {
    const marked = sessionStorage.getItem(KEY) === '1';
    sessionStorage.removeItem(KEY);
    return marked;
  } catch {
    return false;
  }
}
