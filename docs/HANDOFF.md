# HANDOFF — traspaso entre sesiones/agentes

Registro corto de qué se hizo, qué falta y qué se decidió, para que
cualquier sesión nueva (Claude, Codex, u otra) no tenga que redescubrir el
contexto. Ver también `AGENTS.md` para las reglas del proyecto.

---

## 2026-09-19 — Setup de trabajo con dos agentes (Claude + Codex)

**Contexto:** el dueño quiere trabajar con Claude Code (arquitecto/
implementador, en VS Code) y Codex CLI (analista/revisor) juntos sobre este
repo, en vez de dos sesiones de Claude.

**Qué se hizo:**

- Se instaló Codex CLI (`codex-cli 0.155.1`) globalmente. Login ya estaba
  activo (ChatGPT).
- Se intentó registrar Codex como servidor MCP de Claude
  (`claude mcp add codex -- codex mcp-server`); esta versión de Codex **no
  trae** el subcomando `mcp-server`, así que falló (`CONNECTION_CLOSED`) y
  se revirtió el registro. La vía que sí funciona: Claude invoca a Codex por
  CLI (`codex exec`, `codex review`) cuando el dueño lo pide.
- Se revisó el estado del repo `tejido/` (dentro de `Tejido/tejido/`, no en
  la raíz `Tejido/`): ya era un repo git existente, con historial propio,
  rama activa `pruebas`, y remoto `origin` apuntando a
  `https://github.com/agentwhite11/tejido.git`.
- **Importante:** `agentwhite11` es la cuenta personal de un colaborador
  (Santiago Álvarez), NO la organización "White Project" del dueño. Sigue
  pendiente decidir/hacer la migración o el push a la organización
  White Project — no se tocó el remoto todavía.
- Había cambios sin commitear de una sesión anterior. Se revisaron y se
  commitearon en dos commits limpios:
  1. `chore:` limpieza de `backups/`, config de `.opencode/`, frontend
     vanilla JS legado, y otros archivos ya reemplazados por la migración.
  2. `feat:` integración de Tailwind CSS v4 (incremental, sin preflight) y
     rediseño de ArtistHeader/ArtistInfo/Footer/MoneystackScreen.
- Se agregó la sección 15 a `AGENTS.md` ("Trabajo con dos agentes") con las
  reglas de coexistencia (un agente escribe a la vez, puertos ya ocupados,
  deploy pausado, usar este archivo para traspasos).

**Qué falta / pendiente:**

- Decidir qué hacer con el remoto `agentwhite11/tejido`: ¿se mantiene y se
  agrega un segundo remoto hacia la organización White Project, o se migra
  el repo completo a la organización? Pendiente de confirmación del dueño.
- Instalar la extensión de Codex en VS Code (la hace el dueño manualmente,
  no se puede automatizar desde aquí).
- Cambiar el modelo de la sesión de Claude a Opus si se quiere ese como
  arquitecto (`/model`, lo hace el dueño).

**Recordatorios operativos (ver `AGENTS.md` sección 15):**

- Vite (5173) y el backend (8765) del dueño pueden estar corriendo ya — no
  matar esos procesos. Puerto 5174 para pruebas.
- Deploy/Docker/hosting sigue pausado hasta que el desarrollo esté maduro.

---

## 2026-09-19 (cont.) — Migración del remoto a WhiteProyect/Tejido + cierre de setup

**Qué se hizo:**

- Se confirmó que `agentwhite11` (remoto viejo) es la cuenta personal de un
  compañero, y que la organización **WhiteProyect** en GitHub es de ambos,
  con ese compañero ya agregado como colaborador ahí.
- Se migró el remoto: `origin` ahora es
  `https://github.com/WhiteProyect/Tejido.git`. Se subieron las ramas
  `pruebas` (rama de trabajo compartida, todo el historial y el trabajo
  reciente) y `main` (se fusionó con el README inicial que GitHub creó al
  hacer el repo). El remoto viejo (`colaborador` → `agentwhite11/tejido`) se
  eliminó de este checkout local una vez migrado.
- **Incidente y fix:** durante la migración se hizo `git checkout main`
  (rama vieja, pre-migración: SQLite + JS vanilla) y luego `git checkout
  pruebas` para volver, con Vite (5173) y el backend (8765) del dueño
  corriendo en caliente. Ese swap del working tree bajo servidores vivos
  corrompió ambos procesos: la pantalla de MoneyStack/artistas se veía
  rota y el backend reportaba fallas, aunque el árbol final en disco
  (`pruebas`) estaba correcto. Se diagnosticó, se reiniciaron ambos
  procesos con `scripts/INICIAR_TEJIDO.ps1`, y se confirmó
  `/api/health` → `{"status":"ok","database":"ok"}` y frontend 200.
  Regla agregada a `AGENTS.md` sección 15: parar los servidores antes de
  cualquier checkout/switch/merge que toque archivos trackeados.
- Se completó `AGENTS.md` sección 15 con los roles fijos y el estado del
  remoto/rama compartida, para que Codex arranque con contexto completo.

**Estado actual (fin de esta sesión de Claude):**

- Repo: solo remoto `origin` → `WhiteProyect/Tejido`, rama activa `pruebas`,
  working tree limpio, todo commiteado y pusheado.
- Servidores del dueño corriendo y verificados sanos: Vite 5173, backend
  8765 (`/api/health` ok, DB Neon ok).
- Roles a partir de ahora: **Claude Code (esta terminal, modelo Opus)** =
  arquitecto/implementador; **Codex CLI** = analista/revisor en solo
  lectura. No se van a correr dos sesiones de Claude en paralelo.

**Qué falta / pendiente:** (cerrado 2026-09-21: el dueño confirmó que los tres
puntos siguientes ya están resueltos)

- El compañero (`agentwhite11`) debe apuntar su propio remoto local a
  `WhiteProyect/Tejido` (el mismo cambio que se hizo aquí) y, si su backend
  local falla, revisar que tenga su propio `.env` con el `DATABASE_URL` de
  Neon (nunca viaja por git, está en `.gitignore`) — no se confirmó todavía
  si ese es su problema.
- Instalar la extensión de Codex en VS Code (manual, la hace el dueño).
- Confirmar que el modelo de esta sesión de Claude ya está en Opus
  (`/model`, lo hace el dueño).

---

## 2026-09-19 (2) — Migracion a Tailwind del perfil de artista: Partes 1-3 hechas

**Contexto:** migracion incremental a Tailwind v4 (sin `preflight`), pantalla por
pantalla, con el requisito de que el resultado sea **identico al pixel** (el diseno
esta aprobado). Convencion y patrones: `frontend/README.md`, seccion "Tailwind".

**Hecho hasta ahora (todo verificado con Playwright, antes/despues):**

- **Moneystack** (`MoneystackScreen.jsx`): 12 estados x 2 anchos -> 0 px. Se
  borraron 263 lineas de `main.css`.
- **Artista Parte 1** (`ArtistScreen.jsx` + `ArtistHeader.jsx`: hero, nav, perfil):
  69 capturas, 65 a 0 px y el resto ruido demostrado legado-vs-legado.
- **Artista Parte 2** (`ArtistInfo.jsx`: timeline/rio, territorio, eventos):
  84 capturas, 83 a 0 px (la otra es el `<animate>` del sol en `#inicio`).
- **Artista Parte 3** (`ArtistMedia.jsx`: discografia, galeria, lightbox, videos):
  128 capturas, 127 a 0 px; 0 diferencias de geometria y 36 de estilo computado,
  todas invisibles (color de un borde con `border-style: none`).
- `artist.css`: **1610 -> 447 lineas**. Ya no quedan los `@media` legados de 768 y
  480 px. Solo sobreviven: el tema `.ax-artist-page`, 4 `@keyframes`,
  `.ax-hero-grain`, `.ax-timeline-river-path`, `.ax-footer*` y los `mk-*`.
- Constantes compartidas en `frontend/src/components/artist/axStyles.js`
  (`AX_SECTION`, `AX_SECTION_TITLE`, `AX_BTN*`, `AX_STATE`).
- `tailwind.css`: variantes `max768`/`max480` (los `@media` legados son inclusivos
  y `max-[768px]:` NO lo es) y tokens `ax-*` de marca.

**Bug real corregido (no cosmetico):** en `ArtistMedia.jsx` el badge "Destacado"
comprobaba `track.featured === 1`, pero `tracks.featured` es `Mapped[bool]` en
`backend/service/models/tables.py` y la API envia `true`/`false`: el badge no se
mostraba nunca. Ahora usa la misma verdad que la tarjeta (ternario, para que un 0
no se pinte como texto). Es el unico cambio visual deliberado de la Parte 3.

**Qué falta / pendiente:**

- **Parte 4 — `screens/ArtistMediaKit.jsx`** (154 lineas, 49 reglas `mk-*`).
  Notas: no usa ninguna clase `ax-*` (no hay solape con lo ya migrado); tiene un
  `@media (max-width: 600px)` con 4 reglas -> hace falta anadir
  `@custom-variant max600` en `tailwind.css`; es una pagina independiente que **no**
  lleva `body.ax-artist-page`, asi que los tokens `ax-*` del tema oscuro no
  resuelven ahi (hay que mirar que variables usan las reglas `mk-*` antes de
  traducir); no tiene estilos de impresion.
- **Parte 5 — `screens/ArtistDashboard.jsx` + `styles/moneystack.css`** (`.ms-*`,
  506 lineas, con su propio `@media` a 768 px).
- Fuera de esta serie, se migran aparte: `HomeFeaturedArtist.jsx`, `SiteHeader.jsx`,
  `Footer.jsx` y el `.ax-footer`.
- Al final de toda la migracion: activar `preflight` y borrar el CSS legado
  (hoy activarlo cambia el tamano de las 32 capturas de referencia).

**Estado del working tree al escribir esto:** cambios de la Parte 3 SIN commitear
(`ArtistMedia.jsx`, `ArtistInfo.jsx`, `axStyles.js`, `artist.css`, `tailwind.css`,
`frontend/README.md`). `npm run build` compila sin errores ni warnings.

**Revision de Codex (2026-09-19, solo lectura) — hallazgo verificado para la Parte 4:**
Codex reviso el diff de la Parte 3 y no encontro regresiones; confirmo el arreglo del
badge y que los ternarios de estado evitan las colisiones de utilidades. Su hallazgo
principal, **comprobado despues en el navegador**: `ArtistMediaKit` NO anade
`ax-artist-page` al body, pero 8 declaraciones `mk-*` usan `var(--ax-accent)`,
`var(--ax-accent-dim)` y `var(--ax-accent-border)`. En esa pagina esas variables no
existen: `--ax-accent` sale vacia y `.mk-label`, `.mk-section-title`,
`.mk-social-platform` y `.mk-contact-email` se pintan **blancos** en vez del dorado
`#d4a843`. Es un **bug preexistente**, no de la migracion.
Decision pendiente del dueno ANTES de migrar la Parte 4: o se replica el estado actual
(blanco, migracion neutra de verdad) o se arregla el acento (cambio visual deliberado,
como el badge). No sirve traducir a `text-ax-accent` sin mas: esa utilidad depende de
la misma variable ausente.
Otras notas de Codex: el lightbox y los `div` con `onClick` (releases, fotos) arrastran
deuda de accesibilidad previa (sin `role="dialog"`, sin foco ni Escape, no alcanzables
por teclado) — no es regresion de la migracion, pero conviene anotarlo aparte. Para la
Parte 4 pide capturar 600 y 601 px, el limite de 3 tracks, fecha de lanzamiento
ausente, redes con y sin `username`, y la imagen del hero rota.
**Resuelto 2026-09-21 (Parte 4, ver entrada siguiente):** el dueno eligio arreglar el acento.

Nota de entorno: `codex exec -s read-only` no pudo ejecutar comandos en esta maquina
(`.sandbox-bin` es de Administradores y falla `SetNamedSecurityInfoW`, error 5); la
revision se hizo pegandole el diff y los archivos dentro del prompt.

---

## 2026-09-21 — Parte 4 (Media Kit) migrada + bug del acento arreglado

**Hecho:**

- Parte 3 commiteada y pusheada (`365dbe3`).
- `screens/ArtistMediaKit.jsx` pasa a Tailwind. Se borraron las 314 lineas `mk-*`
  de `artist.css` (449 -> 135). Nueva variante `max600` en `tailwind.css`.
- **Bug del acento (hallazgo de Codex), arreglado por decision del dueno:**
  `ax-artist-page` va en el contenedor del Media Kit, asi que los tokens `ax-*`
  resuelven y los acentos salen dorados `#d4a843`: etiqueta, titulos, plataformas,
  fechas, email, "Volver" y el hover de las redes. La regla que oculta el
  header/footer/Hilo globales se limito a `body.ax-artist-page` (solo la pone
  `ArtistScreen`, que no cambia: 0 px).
- **Segundo bug de la misma familia, arreglado:** el `<footer>` del Media Kit
  recibia la pildora verde global de `main.css` (texto descentrado y franja crema
  debajo). Ahora se ve como decian sus reglas `mk-footer`: centrado, con borde
  superior, a todo el ancho.
- Verificacion (script `cap_mk.py`: real, simulado completo con 5 tracks, sin fecha,
  redes con y sin `username`, imagen rota, minimo, carga y 404, a 1300/390/601/600 px,
  con hovers): la referencia contra si misma da 0 diferencias. Migrado contra
  referencia: las unicas diferencias son los acentos, el footer y la cadena de
  respaldo de `font-family` del tema (invisible). Carga 0 px; artista y Moneystack
  0 px.

**Falta:** Parte 5 (`ArtistDashboard.jsx` + `moneystack.css`); despues
`HomeFeaturedArtist`, `SiteHeader`, `Footer`, `.ax-footer`; al final `preflight`.

## 2026-09-21 (2) — Parte 5 (dashboard Money Stack) migrada: serie de Artista completa

**Hecho:**

- `screens/ArtistDashboard.jsx` pasa a Tailwind, con el mismo DOM (filas, stats y
  actividad ahora salen de arrays). En `moneystack.css` solo quedan los dos
  `@keyframes` (`msSpin`, `msPulse`): 506 -> 15 lineas.
- Trampas del legado cubiertas con `!`: `nav` (display y gap; la regla global lo
  oculta bajo 800 px y la barra lateral desapareceria entre 769 y 800), `button`
  (`font: inherit`), `a`, `h1`/`h2`/`h3`. Se replica que en el legado el hover le
  gana a la pestana activa (0,2,0 contra 0,1,0). README, patron 22.
- Verificacion (`cap_dash.py`, con sesion y datos simulados): 4 pestanas x 6 anchos
  (1300/801/800/769/768/390), hovers, carga y error de API -> **todo a 0 px**.
  Estilos computados: solo `border-right-color` en botones con `border: none`
  (invisible) y la opacidad del punto pulsante (ruido, tambien sale en ref vs ref).

**Falta:** `HomeFeaturedArtist.jsx`, `SiteHeader.jsx`, `Footer.jsx` y `.ax-footer`
(compartidos, se migran aparte); despues, el resto de pantallas en el orden del
README; al final, `preflight` y borrar el CSS legado.

## 2026-09-21 (3) — Fase de cierre de Tailwind: capa base + componentes compartidos

**Decision del dueno:** terminar la migracion y la limpieza del CSS antes de crear
contenido nuevo, de forma ordenada.

**Hecho:**

- `dc9dba2`: las reglas de etiqueta de `main.css` (`a`, `button, input`, `nav`,
  `h1`-`h3`, `footer`) pasan a `@layer base`. Las utilidades ya les ganan sin `!`.
  Neutro: 16 rutas x 2 anchos, 0 diferencias de estilo.
- Compartidos migrados: `SiteHeader`, `Footer`, `Logo`, `ScreenIntro` y el footer de
  `ArtistScreen` (`.ax-footer`). Se borraron `.site-header*`, `.brand*`, `.user-*`,
  `.footer-*` (salvo `.footer-threshold-line`, animacion SVG), `.screen-intro*`,
  `.ax-footer*`, la regla muerta `body.ax-artist-page .site-header/...` y la pildora
  global `footer {...}`. `main.css` 4492 -> 4388; `artist.css` 134 -> 83.
- **Cambio visual deliberado:** el footer del perfil de artista. La regla global
  `footer` lo convertia en un grid de 4 columnas, con "<- Moneystack" y "TEJIDO"
  apilados a la izquierda; ahora es la fila `space-between` que pedia `.ax-footer-inner`.
- Clases compartidas nuevas: `components/uiStyles.js` (`EYEBROW`, `H1`).
- Verificacion: `cap_all.py` (32 capturas + estilos de 3711 elementos) y `cap_states.py`
  (16 estados: hovers de header/footer, header oculto/reaparecido, menu de usuario,
  logo de Moneystack caido, anchos 801/800/601/600), comparando contra el legado
  servido desde un worktree en 5174. Resultado: solo cambia el footer del artista,
  mas el ruido conocido (medidas bimodales del texto: el mismo texto mide
  60,125/60,1406 px segun la corrida).

**Metodo para las siguientes partes:** 1) `cap_all.py ref` antes de tocar;
2) migrar la pantalla; 3) `prune.py` para borrar su CSS (en seco primero); 4)
`cap_all.py` + `diff_all.py`; 5) estados con `cap_states.py` contra el legado en 5174.
(Scripts en el scratchpad de la sesion, no en el repo.)

**Falta (en orden):** pantallas chicas (Login, Guardadas, Talento, NotFound, Agenda,
Oportunidades, Explorar + `PublicationCard`), Home (`HomeScreen`,
`HomeFeaturedArtist`, `ExploreSection`), las pesadas (`HeroInteractive`,
`HomeMapSection` + `MapScreen`, `CollaboratorScreen`, `HiloAssistant`,
`PassportSection`, `TimelineSection`) y el cierre (`preflight`, tokens a `@theme`,
borrar `main.css` y los `!` que sobran).

## 2026-09-21 (4) — Pantallas chicas migradas

- Login, Guardadas, Talento, NotFound, Agenda, Oportunidades, Explorar
  (`ExploreSection`) y `PublicationCard` pasan a Tailwind. Clases compartidas nuevas
  en `uiStyles.js` (`SECTION`, `SCREEN_SECTION`, `STATUS(_ERROR)`, `PUB_KIND`,
  `SCREEN_LIST*`, `URGENCY_PILL`/`URGENCY`, `SMALL_DATE`, `PRIMARY_BUTTON`).
- Se borraron sus reglas en `main.css` (4388 -> 4214). Siguen `.section`,
  `.screen-section`, `.status`, `.error` y `.eyebrow` (las usan Mapa, Inicio y
  Colaborador).
- Verificado: 32 capturas de rutas con 0 diferencias de estilo, y 30 estados
  contra el legado en 5174 (urgencias con fechas simuladas, chips, busqueda, error de
  API, menu de compartir, login con error/cargando/foco, anchos 801/800/601/600).
- **Observacion para el dueno (no se cambio):** el boton "Ingresar" del login usa
  `btn btn-primary`, que nunca tuvieron reglas CSS: se ve como boton nativo del
  navegador. Se migro tal cual; si se quiere con el estilo de la marca, es un
  cambio de diseno aparte.

## 2026-09-21 (5) — Inicio migrado (salvo Hero y mapa)

- `HomeScreen` (invitacion), `HomeFeaturedArtist`, `PassportSection` y
  `TimelineSection` pasan a Tailwind; la insignia de `MoneystackScreen` usa `BADGE_LIGHT`.
  Nuevas en `uiStyles.js`: `BADGE(_LIGHT)`, `SECTION_TITLE`, `BTN_CULTURAL(_BASE)`.
- Variantes de breakpoint reordenadas de ancha a angosta en `tailwind.css` y nueva
  `max1024`.
- `main.css` 4214 -> 3570. Siguen `.section-badge`, `.section-title` (las usa
  `HomeMapSection`) y `.btn-primary-cultural` (Hero, Colaborador).
- Verificado: rutas sin diferencias de estilo; 25 estados contra el legado (pasaporte
  vacio/parcial/completo, artista sin imagen/solo YouTube/sin enlaces/sin tema,
  hovers, foco, anchos 1025/1024/769/768/601/600). Unica correccion durante la
  verificacion: `bg-transparent` en `BTN_CULTURAL` (README 32).
- Pendiente detectado: mucho CSS muerto de un `ArtistScreen` antiguo
  (`.artist-screen*`, `.artist-hero*`, `.artist-track*`, `.artist-events*`, ...).
  Va en un barrido aparte.

## 2026-09-21 (6) — Barrido de CSS muerto en main.css

- Se borraron las reglas de 133 clases que ningun `.js`/`.jsx` usa (un `ArtistScreen`
  antiguo: `.artist-screen*`, `.artist-hero*`, `.artist-track*`, `.artist-events*`;
  un hero anterior: `.hero-cultural*`, `.hero-sun*`, `.hero-snake-*`; `.impact-*`,
  `.gallery-*`, `.territory-*`, `.testimonial-*`, `.visual-card*`, `.track-*`, etc.) y 5
  `@keyframes` que solo usaban ellas (`riverFlow`, `snakeGlow`, `sunGlow`, `sunHalo`,
  `sunRaysSpin`). `main.css` 3570 -> 2261.
- La deteccion considera prefijos dinamicos (`p${i}`, `hero-bg-${x}`, `hilo-card-${id}`):
  un primer intento sin prefijos sin guion borro `.p9`-`.p12` (particulas del hero); la
  verificacion lo detecto y se rehizo el barrido antes de commitear.
- Verificado: 32 capturas de rutas y los 3 grupos de estados, sin diferencias de estilo.

## 2026-09-21 (7) — Mapa migrado

- `MapScreen` pasa a Tailwind (variante nueva `max900`). Se borraron sus 29 reglas
  `.map-*`; `main.css` 2261 -> 1957. Se quitaron las clases sin reglas `.map-screen` y
  la de tipo en minusculas del punto de color.
- Verificado: 13 estados (filtros, sin resultados, detalle, hovers, 1300/901/900/601/
  600/390) con 0 px y 0 diferencias de estilo contra el legado; rutas sin cambios.
- Quedan: `HiloAssistant`, `CollaboratorScreen`, `HomeMapSection`, `HeroInteractive`.

## 2026-09-21 (8) — Hilo (asistente) migrado

- `HiloAssistant` pasa a Tailwind (variante nueva `max400`). Los colores por tarjeta
  (`.hilo-card-<clave>`) son ahora un mapa `CARD_COLORS` con las mismas variables CSS
  (`--card-accent`, `--card-art-bg`; `--card-icon` no la usaba ninguna regla y se
  omitio). `.sr-only` pasa a la utilidad de Tailwind. Siguen en CSS los keyframes
  `hilo-float` y `hiloConfettiFall`. `main.css` 1957 -> 1932.
- Verificado: 12 estados (cerrado, hover, abierto, hover de tarjeta, busqueda con y sin
  resultado, 1300/601/600/401/400/390) con 0 px y 0 diferencias de estilo contra el
  legado; rutas sin cambios.

## 2026-09-21 (9) — Colaborador migrado

- `CollaboratorScreen` pasa a Tailwind (todas sus vistas: sin sesion, cargando, registro
  y panel). Se borraron las 71 reglas `.collab-*` y `.btn-cancel`; `main.css` 1932 -> 1486.
  `.btn-primary-cultural` sigue en CSS solo por `HeroInteractive`.
- Verificado: 18 estados con sesion y datos simulados (niveles, formulario con exito y
  error, listas vacias, posicion > 10, canje habilitado/deshabilitado, hovers,
  1300/769/768/390) con 0 px y 0 diferencias de estilo contra el legado; rutas sin cambios.
- Quedan: `HomeMapSection` y `HeroInteractive`, y el cierre.

## 2026-09-22 — Mapa del inicio (HomeMapSection) migrado

- La parte HTML de `HomeMapSection` (seccion, encabezado, escenario, tarjeta de hover,
  tarjetas de municipio y modal) pasa a Tailwind. El arte SVG (region, rutas, rio,
  particulas, anillos y contadores) conserva sus clases en CSS: son animaciones y
  trazos SVG, y el JS busca `.geo-muni`. Se borraron `.section-badge` y
  `.section-title` (ya sin usos). `main.css` 1486 -> 1159.
- Verificado: 11 estados (hover de municipio, modal, cierre, tarjetas, 769/768/481/480/390)
  con 0 diferencias de estilo contra el legado (solo el host de las URLs); rutas sin cambios.
- **Imagenes faltantes (preexistente, no se toco):** `utils/constants.js` usa
  `/assets/municipios/{caucasia,caceres,taraza,nechi,elbagre,zaragoza}.jpg`, pero
  `frontend/public/assets/municipios/` no existe. La tarjeta de hover y el modal
  muestran solo el fondo crema. Ruta esperada: `frontend/public/assets/municipios/<id>.jpg`.

## 2026-09-22 (2) — Hero del inicio (HeroInteractive) migrado

- La parte HTML del hero (seccion, Hilo y su mensaje, opciones, publicaciones y
  etiquetas de municipio, estadisticas, CTA y boton Volver) pasa a Tailwind. Los fondos
  por escena (`.hero-bg-*`) son ahora un mapa `HERO_BG` de degradados. El contenedor de
  fondo (`.hero-interactive-bg`) y todo su arte animado (rio-serpiente, sol, agua,
  figuras, montana, particulas) conservan sus clases en CSS. Se borro
  `.btn-primary-cultural` (ya sin usos). `main.css` 1159 -> 856.
- Verificado: 16 estados (saludo, historias, 3 municipios con publicaciones, gente,
  musica, Moneystack, hovers, 769/768/481/480/390) con 0 diferencias de estilo contra el
  legado. Los pixeles distintos son solo el arte animado (sol, guiones del rio, montana)
  segun el instante de la captura.
- Con esto no queda ninguna pantalla con clases legadas de layout. Lo que queda en
  `main.css` es: tokens de `:root`, reglas de etiqueta en `@layer base`, marcadores
  (`.section`, `.status`, `.error`, `.eyebrow`, `.screen-section`, `html:has(.moneystack-section)`)
  si siguen en uso, el arte SVG/animado del hero y del mapa, y los `@keyframes`.
  Siguiente paso: el cierre.

## 2026-09-22 (3) — main.css y moneystack.css eliminados

- `main.css` se dividio: fuente, tokens (`:root`) y estilos base de etiqueta ->
  `tailwind.css` (`@layer base`); arte SVG animado (hero, mapa, borde del footer),
  `html:has(.moneystack-section)` y TODOS los `@keyframes` -> `art.css` (nuevo).
  Los dos `@keyframes` de `moneystack.css` tambien pasaron a `art.css`; se borraron
  ambos archivos. `main.jsx` importa `tailwind.css`, `art.css` y `artist.css`.
- Antes se borraron las ultimas clases legadas sin uso (`.hero`, `.eyebrow`, `.section`,
  `.status`, `.error`, `.screen-section`, `.pin-*`).
- Verificado: 32 capturas de rutas y los 8 grupos de estados sin diferencias de estilo
  (solo el texto de las cuentas regresivas, que cambio con la fecha, y ruido de 1 px).
- Pendiente (menor, sin prisa segun el dueno): comentarios del JSX que aun citan
  `main.css`, y quitar los `!` que ya sobran en Artista/Media Kit/dashboard.
- Pendiente de decision del dueno: `preflight` (ver README).

## 2026-09-22 (4) — Rediseño del Login

- `LoginScreen.jsx`: pantalla centrada y editorial (logo sin enlace, antetitulo, "Tu
  territorio / *te espera.*", formulario con subrayado, boton en pildora tinta, cuentas
  demo en 3 columnas / 1 en movil). Arte: tres ondas concentricas que respiran y los tres
  puntos de la marca (disco menta, aro tinta, punto morado) flotando sobre ellas; en movil
  se oculta el aro tinta. Animaciones con `motion-safe:` (`loginBreath`, `loginFloat` en
  `art.css`). Enlace "← Volver al inicio" arriba a la izquierda (`#inicio`).
- `App.jsx`: en la ruta `login` no se renderizan `SiteHeader`, `Footer` ni `HiloAssistant`
  (`isLoginRoute`). El login del dashboard (ruta de artista) ya iba sin ellos.
- Logica intacta (fetch, errores, carga, token, return-to). Solo se sumo `autoComplete`.
- Verificado a 1300/390: normal, foco por teclado, error, cargando, volver al inicio,
  login con return-to (colaborador -> login -> colaborador), rutas con header/footer/Hilo.
- Ojo al probar: el backend bloquea 5 min tras 5 intentos fallidos por IP.

## 2026-09-22 (5) — Cronología horizontal e iconos del landing

- `TimelineSection.jsx`: bloque oscuro propio (`bg-ink-deep`, radio 40 px como el artista
  destacado), pista horizontal también en móvil (snap, flechas anterior/siguiente cuando
  hay desborde, región enfocable con teclado). Río SVG segmentado dorado -> menta -> río
  que fluye (`.tl-river-flow`, dashoffset lineal de 7 s en `art.css`; quieto con
  reduced-motion). Nodos con halo fijo e icono estático; año en Playfair. Se quitó la
  entrada fade/slide por tarjeta (`timelineItemIn` borrado de `art.css`).
  `HomeScreen` ya no lo envuelve en `SECTION` (así no queda una caja vacía sin hitos).
- `components/Icon.jsx` (nuevo): sistema de iconos de trazo. Reemplaza los emojis del hero,
  el pasaporte y la cronología, y los SVG sueltos del artista destacado y del mapa.
  Se quitó el giro de la X del modal y el deslizamiento de la flecha de la lista del mapa.
  `KIND_ICONS` (emojis) se borró de `constants.js` (ya no tenía usos).
- Sin tocar: Hilo, logos, arte del hero, SVG del mapa, rutas fuera del landing.
- Quedan animaciones de contenedor (no de icono): entrada `heroOptionIn`/`geoCardIn`
  (con rebote), `stampAppear` y `badgeGlow` (las dos del manual). Decisión pendiente del
  dueño si se suavizan.

## 2026-09-22 (6) — Acceso del header con icono

- `SiteHeader.jsx`: el CTA textual "Ingresar" (sin sesion) pasa a un boton de icono
  (`LoginIcon`, SVG propio: usuario en --orange + flecha de entrada, trazo en el color de
  texto del header: tinta o #f7f7f5 en Moneystack). `aria-label="Iniciar sesión"`,
  tooltip visual en hover/foco, 51x51 px (misma altura que el CTA viejo: el header sigue
  en 88 px). Mismo `onLogin` (return-to intacto). Avatar/menu con sesion sin cambios.
- Rediseño del icono (pedido del dueño): silueta sólida --orange sin contorno (brillo --paper),
  flecha ondulada en --river que entra en un umbral en currentColor. Tooltip invertido en
  Moneystack (fondo #f7f7f5). Comportamiento, tamaño (51 px) y alto del header sin cambios.

## 2026-09-22 (7) — Mapa del inicio: más grande y tarjeta de hover sin recorte

- `HomeMapSection.jsx`: el marco del mapa (`relative overflow-hidden rounded-[28px]`) contenía
  el SVG y la tarjeta de hover, y la recortaba al subir por encima del punto. Ahora hay un
  contenedor exterior `relative z-1` sin recorte (capa de interacción, `ref={mapRef}`, donde
  vive la tarjeta) y dentro el marco con `overflow-hidden` solo para el arte. La tarjeta se
  mide antes de pintar (`useLayoutEffect`): arriba del punto si cabe bajo el header, si no
  debajo (`geoHoverInBelow` nuevo en `art.css`), y acotada al viewport en horizontal.
- Ancho máximo del mapa 900 -> 1020 px (+13 %, SVG proporcional). Móvil sin cambios.
- Pendiente (ya pasaba antes): no existe `frontend/public/assets/municipios/`; las 6 imágenes
  `/assets/municipios/<id>.jpg` de `MUNICIPALITIES_DATA` faltan (tarjeta y modal muestran el
  fondo crema).

## 2026-09-22 (8) — Tarjetas de Explorar

- `PublicationCard.jsx` (único consumidor: `ExploreSection`): tarjeta redondeada (24 px) sin
  `overflow-hidden`; solo el marco de la imagen recorta (inset de 8 px, radio 18), así el menú
  de compartir nunca se corta. Señal de categoría = punto con `KIND_COLORS` + nombre en
  mayúsculas discretas. Título a 2 líneas y resumen a 3 con altura mínima: tarjetas parejas.
  Pie: ubicación (icono `pin`) a la izquierda y Compartir (icono `share` nuevo en `Icon.jsx`)
  a la derecha; el menú se abre hacia arriba alineado a la derecha. Hover/foco: -2 px, borde
  con el tono de la categoría, imagen a 1.04 (todo con `motion-safe:`).
- `ExploreSection.jsx`: reacomodo al filtrar/buscar con Framer Motion (`layout` + fundido y
  escala 0.97 al entrar/salir, `AnimatePresence popLayout`, sin animación inicial, apagado con
  `useReducedMotion`). Lógica de filtros, búsqueda, orden y estados sin cambios.
- Encontrado: el título/antetítulo de Explorar ya venía cambiado en el working tree por otra
  mano ("Voces desde capital" / "Descubre el tejido de la cultura"); se respetó.
- Existente, sin tocar: `ExploreSection` no pasa `user` a la tarjeta, así que "+10 pts" nunca
  se muestra; en móvil el Hilo flotante puede tapar el Compartir de una tarjeta.

## 2026-09-22 (9) — Nosotros y perfil por rol (Colaborar retirado del frontend)

- Eliminado `screens/CollaboratorScreen.jsx` (autorizado). Backend, tablas y endpoints de
  colaboradores intactos. `#colaborador` redirige a `#nosotros` en `getRoute()` (replaceState).
- Nuevo `screens/NosotrosScreen.jsx` (`#nosotros`): Qué es TEJIDO, Propósito, Equipo
  (`TEAM_MEMBERS`, FICTICIO y temporal, iniciales sin fotos), Contacto (POST
  `/api/suggestions`; nombre/contacto opcionales van como encabezado del `message`) y
  Colabora (el CTA lleva al formulario con texto sugerido). Única animación: el equipo.
- Nuevo `screens/ProfileScreen.jsx` (`#perfil`): cabecera común + módulo por `user.role`.
  ADMIN: `/api/admin/stats` + `/api/admin/suggestions`. GESTOR: `/api/publications?mine=1` +
  artista con `user_id` propio (enlaces a su perfil y a `#artista/<slug>/dashboard`).
  CIUDADANO: `/api/publications` con sesión (`favorite`) + pasaporte local; sin puntos.
- `App.jsx`: estado `authReady` (evita mandar a login mientras `/api/me` responde); `#perfil`
  sin sesión -> `#login` con `tejido_return_to=perfil`.
- Header: "Colaborar" -> "Nosotros"; menú de usuario "Mi Dashboard" -> "Mi perfil".
  Footer: "Acerca de TEJIDO" (#inicio) -> "Nosotros" (#nosotros).
- Pendiente/honesto: no hay UI para guardar favoritos (el endpoint existe), así que los
  guardados reales hoy están vacíos. El bundle pasó 500 kB (aviso de Vite, no error).
