# Frontend — React + Vite

```
src/
├── App.jsx            # Enrutado por hash y composición de pantallas
├── components/        # Piezas reutilizables (Footer, SiteHeader, Hilo, artist/, ...)
├── screens/           # Pantallas (Home, Explore, Moneystack, Artist, Map, ...)
├── services/          # Clientes de API
├── styles/            # main.css, artist.css, moneystack.css (legado) + tailwind.css
└── utils/
public/
├── assets/artistas/<slug>/   # perfil.jpg, hero.jpg, galeria-N.jpg por artista
└── images/                   # logos y recursos del sitio
```

## Desarrollo

```powershell
npm install
npm run dev        # http://localhost:5173
```

Vite proxea `/api` al backend en `http://127.0.0.1:8765` y sirve `public/` directamente. Para levantar todo junto usa `scripts/INICIAR_TEJIDO.ps1` desde la raíz.

## Producción

```powershell
npm run build      # genera dist/, que el backend sirve como estático
```

## Convenciones

- Identidad visual y animaciones: `docs/MANUAL_ESENCIA_TEJIDO.md`.
- Imágenes de artistas: `public/assets/artistas/<slug>/` y la ruta se guarda en la base de datos (`artists.image`, `artist_media.url`).

## Tailwind

Tailwind CSS v4 (`@tailwindcss/vite`) está integrado de forma **incremental**. `src/styles/tailwind.css` importa solo `theme` + `utilities`, **sin `preflight`**, y se carga antes que el CSS legado en `main.jsx`. El CSS legado (`main.css`, `artist.css`, `moneystack.css`) no se ha tocado: el diseño actual está aprobado y no debe cambiar.

### Convención de migración

1. **Todo componente o pantalla NUEVO usa Tailwind.**
2. Lo existente se migra **de a una pantalla, cuando se toque**: se quitan sus clases legadas del JSX y las reglas CSS que queden huérfanas. Nunca mezclar clases legadas y utilidades sobre el mismo elemento.
3. Orden sugerido, de menor a mayor riesgo (**Moneystack ya migrada**; patrones abajo): Moneystack → Artista (`.ax-*`) → Login / Guardadas → Explorar / Talento / Oportunidades / Agenda → Inicio / Mapa. Ojo: "Moneystack" es `MoneystackScreen.jsx` y sus clases `moneystack-*` de `main.css`; `moneystack.css` (`.ms-*`) estiliza `ArtistDashboard.jsx` y se migra con Artista. `SiteHeader` y `Footer` son compartidos (variantes `site-header-moneystack`, `footer-moneystack-*`): migrarlos aparte.
4. Animaciones, SVG, `clip-path` y gradientes complejos pueden seguir en CSS propio o en framer-motion; no hay que forzarlos a utilidades.
5. Los colores, tipografías y radios salen de los tokens de `tailwind.css` (`bg-ink`, `text-cream`, `bg-ink-deep`, `font-display`, `rounded-footer`…). Apuntan a las variables de `:root`, así que no hay dos fuentes de verdad. Solo existen los colores de marca: no hay paleta por defecto (`bg-red-500` no genera nada). `font-display` (Playfair) solo está cargada en cursiva 700: usar `font-display italic font-bold`.

### El CSS legado siempre gana (verificado)

Las utilidades viven en `@layer utilities` y el CSS legado **no tiene capa**: una regla sin capa gana a una con capa, sin importar la especificidad. Probado en el navegador con estilos computados:

| Elemento con utilidad | Resultado con CSS legado presente |
|---|---|
| `<h2 class="m-8 font-display">` | pierde: margen 0, fuente DM Sans |
| `<a class="text-orange underline">` | pierde: hereda color, sin subrayado |
| `<button class="text-3xl font-bold">` | pierde: 16 px, peso 400 |
| `<nav class="block">` | pierde: sigue `display:flex` |
| `<footer class="bg-ink p-0">` | pierde: fondo `#0c241e`, padding 70 px |
| `<div class="bg-ink text-cream p-8">` (sin regla legada) | funciona |

Escape puntual: el modificador `!` (`m-8!`, `text-orange!`, `block!`) sí gana al legado; verificado en los mismos casos. Úsalo solo mientras el legado exista.

### Selectores de etiqueta globales (todos en `main.css`)

Afectan a **cualquier** elemento de esa etiqueta, también en componentes nuevos:

- `a` (`color`, `text-decoration`); `button, input` (`font`); `nav` (`display`, `gap`, `font-*`; **`display:none` bajo 800 px**).
- `h1`, `h2` (`font-family`, `letter-spacing`, `margin`, `font-size`, `line-height`) y `h3` (los mismos salvo `line-height`). `h4`–`h6` están libres.
- `footer`, `footer > div`, `footer a`, `footer > div > b`, `footer > div:nth-child(3)`: convierten cualquier `<footer>` en la píldora verde del sitio (ya mordió a `.ax-footer`).
- `:root`, `*` (`box-sizing`), `body` (`margin`), `html:has(.moneystack-section)` (fondo).

En componentes nuevos, para esas etiquetas usa `div`/`span`/`p` con la utilidad, `h4`–`h6`, o el modificador `!`.

### Colisiones de nombres

De las 775 clases del CSS legado y 654 de los `className`, solo dos coinciden con utilidades de Tailwind: **`.sr-only`** (`HiloAssistant.jsx`; Tailwind añade `margin:-1px; padding:0; border-width:0`, sin efecto visible) y **`.visible`** (`HeroInteractive.jsx`, `TimelineSection.jsx`; añade `visibility:visible`, inerte porque ningún CSS usa `visibility`). No existen `.container`, `.flex`, `.grid`, `.hidden`, `.card`, `.relative`, `.absolute` en el legado. Al agregar clases legadas nuevas, evitar nombres que sean utilidades.

### Preflight (al final de la migración)

No activar hasta que ya no quede CSS legado. Con él activo hoy, las 32 capturas de referencia (16 rutas × 2 anchos) cambian de tamaño. Al terminar: añadir `@import "tailwindcss/preflight.css" layer(base);` en `tailwind.css`, mover los valores de `:root` al bloque `@theme` (y quitar `inline`), borrar los CSS legados y revisar h1–h6, listas, `img` y botones pantalla por pantalla.

### Editor y verificación

VS Code marca `@theme`/`@source` como "regla desconocida": instalar la extensión *Tailwind CSS IntelliSense* lo resuelve. Antes de dar por migrada una pantalla, comparar capturas completas (1300 px y 390 px) antes y después; la migración debe ser idéntica al píxel. El brillo del sol del hero (`<animate>` SMIL) produce ruido de ~0,005 %: es normal y no cuenta como diferencia.

### Patrones aprendidos (Moneystack)

Pantalla piloto: `MoneystackScreen.jsx`, idéntica al píxel en 6 estados (normal, hover, logo caído, error de API, lista vacía, carga) a 1300, 390, 768 y 769 px. Se borraron sus 263 líneas de CSS `moneystack-*` de `main.css`.

1. **`!` solo donde hace falta, y se mantienen las etiquetas semánticas.** `h1`/`h2`/`h3` y `a` conservan su etiqueta (SEO y accesibilidad) y solo llevan `!` en las propiedades que la regla global fija Y que hay que cambiar: `h1`/`h2` → `font-size`, `margin`, `letter-spacing`, `line-height`; `h3` → `font-size`, `margin`, `letter-spacing`. Lo demás (`font-extrabold`, `text-white`, `mb-*` en `p`) no necesita `!`, porque ninguna regla global lo fija y todo estilo de autor gana al del navegador. `a` hereda `color` del contenedor: ponerlo en el padre, no en el enlace. Solo si una etiqueta no aporta semántica se cambia a `div`/`span`.
2. **Colores con transparencia: `rgba()` exacto, no `/NN`.** `text-white/70` se compila a `oklab(...)`, y en píxeles cambia el texto hasta 11 niveles de canal (medido; los fondos planos coincidieron y los bordes diferían en 1). Para igualar el legado: `text-[rgba(255,255,255,0.7)]`, `border-[rgba(...)]`, `bg-[rgba(...)]`. En componentes nuevos, sin requisito de píxel, `text-white/70` está bien.
3. **Breakpoint legado: `max768:`.** `@media (max-width: 768px)` es inclusivo; `max-[768px]:` y `max-md:` generan `width < 768px` y a 768 px exactos se ve el diseño de escritorio (medido: 1934 vs 1944 px de alto). Se definió `@custom-variant max768` en `tailwind.css`; para otros breakpoints legados (600, 800, 900) añadir su variante igual. No usar `max-[769px]`: falla con anchos fraccionarios por zoom.
4. **Hover de hijos con `group`.** `.card:hover .hijo` → `group` en la tarjeta y `group-hover:` en el hijo. La transición legada se copia exacta: `ease-[ease]` (no `ease-in-out`, que es otra curva), `duration-300`, `transition-[color]` para una sola propiedad. `hover:-translate-y-1` y `scale-*` usan las propiedades `translate`/`scale` y no `transform`: visualmente idéntico. Ojo: el `hover:` de Tailwind solo actúa en dispositivos con hover real; el `:hover` legado también se quedaba "pegado" al tocar en móvil.
5. **Tamaños y `img`.** `text-[16px]` en lugar de `text-base`/`text-lg`, que añaden su propio `line-height`. Espaciado con la escala (`p-5` = 20 px, `gap-2.5` = 10 px) o valores arbitrarios (`py-7.5`). Un `img` que es hijo flex/grid ya es bloque; `block` solo hace falta si su padre es de bloque (aquí no se necesitó). `grid-cols-[1fr_1fr]` y no `grid-cols-2` (que es `minmax(0,1fr)`).
6. **Se quedó en CSS propio.** `html:has(.moneystack-section)` (fondo negro tras el footer flotante) y su clase marcador `moneystack-section`; `section-badge` (compartida con otras pantallas). Un estado de clase puesto por JS (`classList.add` en `onError` del logo) se cambió por estado de React (`logoFailed`).

Proceso que funcionó: 1) capturas de referencia (dos veces, para medir el ruido); 2) migrar; 3) **borrar el CSS legado antes de verificar** (si no, sus reglas, que ganan, ocultan errores de traducción); 4) comparar píxel a píxel; 5) comprobar transiciones con `getComputedStyle`, porque las capturas con `animations: "disabled"` saltan al estado final y no las prueban.

**Añadidos con Artista (Parte 1: hero, nav, perfil):**

7. **`body.ax-artist-page` se queda como marcador de tema.** Los tokens `bg-ax-*`, `text-ax-dim`, `border-ax-border`… emiten `var(--ax-*)`, que se resuelven en el `body`, así que dan los mismos valores computados que el legado (verificado con `getComputedStyle`). Otras clases se conservan solo como marcadores porque el JS las consulta (`querySelector('.ax-profile')`, `.ax-discography`): sin reglas propias, con un comentario.
8. **Keyframes: se quedan en `artist.css` y se referencian con `animate-[axSpin_0.8s_linear_infinite]`.** No los borres al limpiar. Lo que exige data-URI o máscaras (`.ax-hero-grain`) se queda como una clase propia, sola en su elemento.
9. **Constantes compartidas, sin choques de borde.** Los botones viven en `components/artist/axStyles.js` (`AX_BTN` + variante). No pongas `border-0` en la base y `border` en una variante: compiten y gana el equivocado (se perdió el borde del botón fantasma, +2 px de altura). Cada variante declara el suyo. Para `@media` de 480 px existe `max480:`.
10. **Un ±1 en un estado no es una regresión hasta compararlo con el legado.** Se sirvió el código original desde una copia en otro puerto: legado contra legado ya dio la misma diferencia (229 px, ±1 nivel en el borde de las letras) que migrado contra legado (105–128 px).
11. **SVG con gradiente: el `<svg>` va con utilidades y el trazo se queda en CSS.** Caja, tamaño, `z-index`, `pointer-events` y el ocultarlo en móvil (`max768:hidden`) se traducen sin problema; lo que depende de `stroke: url(#gradiente)`, `stroke-dasharray`, `vector-effect` y de un `@keyframes` (el río del timeline) se queda como una clase propia sola en su `<path>`.
12. **Pseudo-elementos que solo existen en un breakpoint: `max768:before:*`.** `before:content-['']` más `max768:before:absolute/top-0/left-5/w-0.5/bg-[…]` reproduce el `::before` del `@media`, pixel a pixel (probado a 768/769 px). Se declara en una constante junto al comentario de por qué existe.
13. **Elementos alternados por índice: una constante por lado + los overrides móviles en la base.** `ITEM_LEFT`/`ITEM_RIGHT` solo llevan lo propio de cada lado; lo que las dos comparten en móvil (`max768:pl-13 max768:pr-0 max768:justify-start`) va en la base, y al ser variante gana a ambas. `calc()` con operadores necesita guiones bajos (`pr-[calc(50%_+_40px)]`).
14. **Clase compartida entre dos partes de una migración: constante nueva, regla vieja intacta.** `AX_SECTION_TITLE` (en `axStyles.js`) la usa el componente ya migrado; la regla `.ax-section-title` de `artist.css` sigue mientras haya otro componente con la clase, y ningún elemento lleva a la vez clase y utilidades. Se borra cuando el último la adopta. Para comparar estilos computados: `transform` vs `translate` y `box-shadow` con sombras transparentes de relleno son solo representación (el `getBoundingClientRect` ya incluye el desplazamiento); `border-ax-border` colorea los 4 lados aunque solo haya `border-b`, invisible con ancho 0.
