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

**Qué falta / pendiente:**

- El compañero (`agentwhite11`) debe apuntar su propio remoto local a
  `WhiteProyect/Tejido` (el mismo cambio que se hizo aquí) y, si su backend
  local falla, revisar que tenga su propio `.env` con el `DATABASE_URL` de
  Neon (nunca viaja por git, está en `.gitignore`) — no se confirmó todavía
  si ese es su problema.
- Instalar la extensión de Codex en VS Code (manual, la hace el dueño).
- Confirmar que el modelo de esta sesión de Claude ya está en Opus
  (`/model`, lo hace el dueño).
