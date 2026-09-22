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
