/**
 * Iniciales para avatares sin foto (Nosotros, Perfil).
 *
 * - Dos o mas palabras: primera letra de la primera y de la ultima
 *   ("Santiago Alvarez" -> "SA", "María del Mar" -> "MM").
 * - Una palabra: su primera letra ("Camilo" -> "C").
 * - Ignora espacios repetidos; conserva acentos (normaliza a NFC para que "Á" sea un solo
 *   caracter aunque venga descompuesto) y pasa a mayusculas en espanol.
 * - Vacio o no texto: "?".
 */
export function getInitials(name) {
  if (typeof name !== 'string') return '?';
  const words = name.normalize('NFC').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = Array.from(words[0])[0];
  const last = words.length > 1 ? Array.from(words[words.length - 1])[0] : '';
  return `${first}${last}`.toLocaleUpperCase('es');
}
