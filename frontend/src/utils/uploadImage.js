import { apiRequest } from './api.js';

// Subida de imagenes a Cloudinary: el backend firma (POST /api/uploads/sign decide carpeta, formatos
// y transformacion) y el navegador sube directo, sin pasar el archivo por nuestro servidor. Se
// guarda solo el secure_url que devuelve Cloudinary.

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Antes de pedir la firma: no gastar una firma (ni el limite por minuto) en un archivo que no sirve.
export function validateImageFile(file) {
  if (!file) throw new Error('No se eligió ninguna imagen.');
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new Error('Formato no permitido: sube una imagen JPG, PNG o WebP.');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1).replace('.', ',');
    throw new Error(`La imagen pesa ${mb} MB y el máximo es 10 MB. Redúcela e inténtalo de nuevo.`);
  }
}

export function signUpload(scope, ref) {
  return apiRequest('/api/uploads/sign', { method: 'POST', body: ref === undefined || ref === null ? { scope } : { scope, ref } });
}

// XMLHttpRequest (y no fetch) para tener progreso real de la subida y poder cancelarla.
export function uploadToCloudinary(file, signed, { onProgress, signal } = {}) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);
    for (const key of ['api_key', 'timestamp', 'folder', 'allowed_formats', 'transformation', 'signature']) {
      form.append(key, signed[key]);
    }
    const xhr = new XMLHttpRequest();
    xhr.open('POST', signed.upload_url);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      let body = {};
      try { body = JSON.parse(xhr.responseText); } catch { /* respuesta sin JSON */ }
      if (xhr.status >= 200 && xhr.status < 300 && body.secure_url) {
        resolve(body.secure_url);
        return;
      }
      const detail = body.error?.message || '';
      reject(new Error(/format/i.test(detail)
        ? 'Formato no permitido: sube una imagen JPG, PNG o WebP.'
        : `No se pudo subir la imagen${detail ? ` (${detail})` : ''}. Inténtalo de nuevo.`));
    };
    xhr.onerror = () => reject(new Error('Sin conexión: revisa tu internet e inténtalo de nuevo.'));
    xhr.onabort = () => reject(new DOMException('Subida cancelada', 'AbortError'));
    if (signal) {
      if (signal.aborted) { reject(new DOMException('Subida cancelada', 'AbortError')); return; }
      signal.addEventListener('abort', () => xhr.abort(), { once: true });
    }
    xhr.send(form);
  });
}

export async function uploadImage(file, scope, ref, options = {}) {
  validateImageFile(file);
  let signed;
  try {
    signed = await signUpload(scope, ref);
  } catch (error) {
    // fetch sin red lanza TypeError ("Failed to fetch"); el resto ya trae el mensaje del backend.
    throw error instanceof TypeError ? new Error('Sin conexión: revisa tu internet e inténtalo de nuevo.') : error;
  }
  if (options.signal?.aborted) throw new DOMException('Subida cancelada', 'AbortError');
  return uploadToCloudinary(file, signed, options);
}
