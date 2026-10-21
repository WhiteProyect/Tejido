// Mismo criterio que backend/service/schemas/fields.py. Van como `pattern` de un input (el navegador
// lo ancla al valor completo): type="url" rechazaria las rutas locales y aceptaria javascript:.
// IMAGE_PATTERN: https://... o una ruta del sitio (/assets/...). LINK_PATTERN: solo http(s).
export const IMAGE_PATTERN = String.raw`(\/[^\/\s]\S*|https?:\/\/[^\s\/?#]+\S*)`;
export const LINK_PATTERN = String.raw`https?:\/\/[^\s\/?#]+\S*`;
