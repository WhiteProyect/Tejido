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
