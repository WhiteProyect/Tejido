// Transicion hub (#municipios) -> municipio (#municipio/<slug>): la pildora pulsada se expande hasta
// la portada del municipio.
// No usa layoutId: en el mismo render React desmonta la pildora (sale de su pila de layoutId) antes
// de montar la portada, y la portada ya no encuentra de donde crecer; para que convivieran, App
// tendria que pasar TODAS las pantallas a AnimatePresence "popLayout". En su lugar, el hub guarda la
// caja de la pildora al hacer clic y la portada hace el morph a mano (FLIP: se pone encima de la
// pildora antes de pintarse y anima hasta su tamaño). App hace que el cambio de hub a municipio sea
// un solo render, sin su fundido.
// La marca caduca sola (MORPH_TTL): una carga directa, el boton Atras o el modulo 7 nunca la ven.
const MORPH_TTL = 1200;
let pending = null;

export function startMorph(slug, rect) {
  pending = { slug, rect, at: performance.now() };
}

// { slug, rect } de la transicion en curso, o null.
export function pendingMorph() {
  if (!pending) return null;
  if (performance.now() - pending.at > MORPH_TTL) {
    pending = null;
    return null;
  }
  return pending;
}
