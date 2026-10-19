# CLAUDE.md — TEJIDO

Contexto de arranque para cualquier sesión nueva del analista en cualquier dispositivo.
Actualizar este archivo cuando cambien decisiones estructurales, el estado del proyecto, o las reglas de colaboración.

---

## Qué es TEJIDO

Portal cultural y turístico profesional de **Caucasia, Colombia** (Bajo Cauca antioqueño).
Empezó como proyecto académico (ADSO) pero es ahora un proyecto real y profesional — tratarlo con estándares de producción en todo.

- **Enfoque**: Caucasia como eje central. Los demás municipios del Bajo Cauca solo aparecen de forma puntual (artistas/eventos que vengan de allá), no son el eje.
- **Aliados**: Moneystack (sello musical, aliado principal con sección propia). Casa de la Cultura de Caucasia (aliado/patrocinador, aparece via etiqueta en publicaciones, sin sección dedicada).
- **Audiencias**: habitantes, turistas, artistas/gestores culturales — con rutas distintas, no una audiencia genérica.
- **Idioma**: español exclusivamente en el lanzamiento. Inglés diferido.
- **Dominio**: `tejido.com.co` (comprado en Namecheap, verificado en Resend).

---

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Frontend | React + Vite + JavaScript + Tailwind CSS v4 (incremental, sin preflight — el CSS legacy gana la cascada) |
| Backend | FastAPI + SQLAlchemy 2.0 + Alembic + Pydantic/pydantic-settings |
| Base de datos | PostgreSQL en Neon (neon.tech) — `DATABASE_URL` solo en `.env`, nunca hardcodeado |
| Animaciones | framer-motion (`AnimatePresence`, `motion.div`, `useReducedMotion`) |
| Email | Resend (free tier) — `RESEND_API_KEY` en `.env`, dominio `tejido.com.co` verificado |
| Hot-reload backend | nodemon vía `npm --prefix frontend run dev:backend` — SIEMPRE así, nunca `py server.py` directo |

**Arrancar el proyecto**: `scripts/INICIAR_TEJIDO.ps1` (inicia Vite en 5173 + backend en 8765).

**IMPORTANTE**: Las migraciones de Alembic NO corren solas — siempre manual: `py -m alembic upgrade head`.

---

## Variables de entorno (`.env` — jamás en Git)

```
DATABASE_URL=postgresql+psycopg://neondb_owner:...@.../neondb?sslmode=require&channel_binding=require
RESEND_API_KEY=re_...
EMAIL_FROM=TEJIDO <tejido@tejido.com.co>
FRONTEND_BASE_URL=http://localhost:5173
```

---

## Roles de usuario

| Rol | Descripción |
|-----|-------------|
| ADMIN | Publica directamente, modera todo, gestiona gestores e invitaciones |
| GESTOR | Crea publicaciones (quedan en DRAFT hasta que admin apruebe), tiene dashboard propio |
| CIUDADANO | Navega, guarda favoritos, edita su perfil |

**Flujo de invitación gestor**: admin crea gestor → tabla `invite_tokens` → email Resend → `AcceptInviteScreen`.

**Admins reales (ya activaron su cuenta; los links de invitación ya se usaron)**:
- id 4: Camilo (bryan.giraldo.0906@gmail.com)
- id 5: Santi (MONEYSTACK999@gmail.com)
- id 6: Daniel (danielopg1008@gmail.com)

---

## Modelo de publicaciones

**Tipos (`kind`)**: HISTORIA, EVENTO, OPORTUNIDAD, TALENTO, INICIATIVA, LUGAR

**Categorías culturales (`cultural_category`)** — campo opcional en cada publicación:
MUSICA, CINE_AUDIOVISUAL, DANZA, TEATRO, ARTES_VISUALES, LITERATURA, ARTESANIAS, PATRIMONIO_MEMORIA, GASTRONOMIA_CULTURAL, EMPRENDIMIENTO_CULTURAL

---

## Estado actual del proyecto (oct 2026)

### Completado ✓
- Migración completa SQLite/stdlib → FastAPI/PostgreSQL (Neon), Fases 0–6.1
- Sistema de autenticación: login, signup ciudadano, invitación gestor/admin, 3 admins reales (ya activos). Cerrar sesión lleva al login; volver a entrar desde ahí lleva al perfil
- Explorar: portadas de las 10 categorías culturales (`CategoryCoversGrid`, imágenes en `frontend/public/images/categorias/<slug>.jpg`, ya subidas) → `CategoryScreen` con gestores, buscador por título y tarjetas horizontales
- Sistema de toast: `ToastContext.jsx`, `Toast.jsx`, 6 eventos cableados, 5 tonos (rio/menta/dorado/naranja/morado)
- Perfiles por rol (3 fases, verificadas): nombre/foto editables para todos (`PATCH /api/me`); ciudadano solo con "Tus guardados"; gestor con biografía pública (`/api/me/organization`) y **Dashboard de Gestor** (`#gestor-dashboard`, CRUD de sus publicaciones); admin con **Dashboard de Admin** (`#admin-dashboard`: pulso, moderación aprobar/rechazar, CRUD de todas las publicaciones, panel de gestores)
- Ciclo editorial completo en la UI: el gestor crea borradores y los envía; el admin aprueba o rechaza con motivo y puede publicar directo (`PublicationForm` compartido)
- Rediseño completo de HiloAssistant: lanzador compacto (cápsula + Hilo a la derecha), susurros contextuales, panel con cabecera de color sólido, Brújula 2x2, Chat Turístico con reglas de palabras clave (sin IA)
- Hero del inicio (propuesta definitiva del diseñador): fondo ilustrado claro (`arbol-tejido-claro.jpg`, original en `C:\Users\Bryan\Tejido\tejido-originales\`), Hilo grande al centro, saludo a la derecha (`GREETING_POSITION`), cápsula de estadísticas con conteo real, tarjetas glass y CTA de tinta
- Botones unificados en `uiStyles.js`: `BTN_INK_LG/MD/SM`, `BTN_INK_OUTLINE_MD`, `BTN_GHOST`, `BTN_DANGER`, `BTN_QUIET_SM` (misma altura por talla: MD 49 px, SM 37 px)
- VideoText en HomeScreen (efecto SVG mask + video sobre la palabra "TEJIDO")
- EmptyNote como componente extraído y reutilizable

### Pendiente / En progreso
- **Hero, `GREETING_POSITION`**: a 1300 px el título "¡Bienvenido!" se sale por la derecha (bloque de 333 px más angosto que el título) y su centro queda ~110 px más abajo que el de Hilo — el user lo está cuadrando a mano
- **Hero a 1024 px**: el sol del fondo queda a medias por el recorte de `object-cover`; opción: usar ahí el tratamiento de móvil
- **"Quiero Participar" en móvil**: la fila del correo desborda a 390 px (input de 280 px fijo); propuesta: apilarla en ≤480 px
- **"Crear mi primera publicación"** (dashboard de gestor vacío) se parte en dos líneas a ≤390 px; se resuelve con un texto más corto
- **`cine-audiovisual.jpg`** pesa ~7.9 MB (las demás portadas 20–750 KB): comprimir
- **Hero, "Volver" desde un municipio** vuelve directo al saludo, no a Historias (lógica de `goBack`)
- **Cloudinary**: imágenes actualmente como URLs pegadas por el user — integración diferida
- **Tailwind**: migración incremental en curso (Moneystack + Artista migrados); resto de pantallas pendiente

### No tocar todavía (diferido)
- Hosting, Docker, dominio en producción — terminar el desarrollo antes de infra
- Soporte en inglés

---

## Workflow de dos sesiones

> Si estás leyendo esto desde la **terminal** (Opus 5.5) eres el ARQUITECTO: implementas los prompts que te pase el user. Las reglas del analista de abajo NO aplican a ti. Si estás en el chat de VS Code eres el ANALISTA.

**La sesión del chat de VS Code (extension) = ANALISTA**
- Lee el código del repo para entender el estado actual antes de opinar
- Entrega prompts en español, autocontenidos, al arquitecto
- NO escribe código directamente (excepto si el usuario lo autoriza explícitamente para ese caso puntual)
- Herramientas permitidas: Read, Grep, Glob, Bash read-only

**Sesión del arquitecto (terminal, modelo Opus 5.5) = IMPLEMENTADOR**
- Recibe el prompt del analista, lo ejecuta, hace los cambios en el repo
- Es la única sesión que escribe código, corre migraciones, hace commits

**Regla de arranque para cualquier dispositivo**:
1. `git pull` para traer el estado actual del repo
2. Abrir VS Code → esta sesión (el analista) lee CLAUDE.md → ya sabe por dónde vamos
3. Abrir terminal → sesión arquitecto lista para recibir prompts

---

## Reglas de colaboración

- **No matar los servidores de dev** — Vite 5173 y backend 8765 suelen estar corriendo; si se necesita un puerto para tests, usar 5174
- **Backend siempre con nodemon**: `npm --prefix frontend run dev:backend`, nunca `py server.py` directo
- **Respuestas cortas y directas** — sin resúmenes al final de cada respuesta, sin narrar el proceso interno
- **Sin comentarios innecesarios en el código** — solo cuando el POR QUÉ no es obvio
- **Sin funcionalidades extra no pedidas** — no anticipar requisitos futuros hipotéticos
- **No push a producción hasta que el user lo pida** — desarrollo primero, infra después
- **Migraciones manuales siempre**: `py -m alembic upgrade head` después de cada cambio de modelo

---

## Archivos clave

| Archivo | Propósito |
|---------|-----------|
| `frontend/src/components/HiloAssistant.jsx` | Asistente Hilo completo (lanzador + panel + chat) |
| `frontend/src/components/PublicationCard.jsx` | Tarjeta horizontal de publicación |
| `frontend/src/components/CategoryCoversGrid.jsx` | Grid de portadas de categorías culturales |
| `frontend/src/screens/CategoryScreen.jsx` | Pantalla de categoría con buscador y gestores |
| `frontend/src/screens/ProfileScreen.jsx` | Perfil (ciudadano/gestor/admin) |
| `frontend/src/screens/GestorDashboard.jsx` | Dashboard de Gestor (`#gestor-dashboard`) |
| `frontend/src/screens/AdminDashboard.jsx` | Dashboard de Admin (`#admin-dashboard`) |
| `frontend/src/components/PublicationForm.jsx` | Formulario de publicación compartido (gestor y admin) |
| `frontend/src/components/HeroInteractive.jsx` | Hero del inicio (escenas con Hilo, fondo, saludo) |
| `frontend/src/components/uiStyles.js` | Clases compartidas, incluida la familia de botones `BTN_*` |
| `frontend/src/components/ProfileHeader.jsx` | Edición de nombre y avatar |
| `frontend/src/components/Toast.jsx` + `context/ToastContext.jsx` | Sistema de toasts |
| `frontend/src/components/EmptyNote.jsx` | Estado vacío reutilizable |
| `frontend/src/utils/constants.js` | KIND_COLORS, KIND_LABELS, CULTURAL_CATEGORIES, TOAST_TONES |
| `backend/service/schemas/cultural_categories.py` | Claves y labels de categorías (backend) |
| `backend/service/api/routes/auth.py` | Auth: login, signup, me, accept-invite |
| `backend/service/seed.py` | Datos semilla (roles, usuarios demo, admins reales) |
| `scripts/INICIAR_TEJIDO.ps1` | Arrancar frontend + backend |
| `scripts/links_invitacion_admins.py` | Genera links de invitación para admins ids 4-6 |
