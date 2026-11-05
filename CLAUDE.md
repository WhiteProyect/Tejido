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
SUPPORT_EMAIL=...          # avisos al equipo (una o varias, separadas por coma); vacía = no se envían
FRONTEND_BASE_URL=http://localhost:5173
CLOUDINARY_CLOUD_NAME=... / CLOUDINARY_API_KEY=... / CLOUDINARY_API_SECRET=...
TEST_DATABASE_URL=...      # solo pytest: rama de Neon dedicada a pruebas (nunca la principal)
```

---

## Roles de usuario

| Rol | Descripción |
|-----|-------------|
| ADMIN | Publica directamente, modera todo, gestiona gestores e invitaciones |
| GESTOR | Crea publicaciones solo en su rama (`organizations.branch`); quedan en DRAFT hasta que se aprueben; tiene dashboard propio y un **perfil público** (`#gestor/<slug>`). Puede ser **líder de su rama** (`organizations.is_leader`, no es un rol) |
| CIUDADANO | Navega, **es el único que guarda** (publicaciones y talento; pantalla `#guardadas`), edita su perfil y puede **pedir participar en una rama** ("Quiero participar") |

**Flujo de invitación gestor**: admin crea gestor → tabla `invite_tokens` → email Resend → `AcceptInviteScreen`.

**Líder por rama (decisión 2026-10-24, bloque cerrado el 2026-10-25)**: máximo un líder por rama (lo fuerza la base); solo el ADMIN lo nombra/cambia/quita (cobertura de ramas en el panel de Gestores, o `scripts/marcar_lider.py`). El líder aprueba las solicitudes de ingreso a su rama (`branch_join_requests`: el ciudadano aprobado pasa a GESTOR participante) y modera lo que publican sus participantes; lo del líder lo modera el ADMIN; sin líder, todo lo gestiona el ADMIN. El ADMIN modera todo. Permisos siempre en el backend con la rama de la base (`services/branches.py`).

**Admins reales (ya activaron su cuenta; los links de invitación ya se usaron)**:
- id 4: Camilo (bryan.giraldo.0906@gmail.com)
- id 5: Santi (MONEYSTACK999@gmail.com)
- id 6: Daniel (danielopg1008@gmail.com)

**Cuentas en la base real (2026-10-25)**: solo los 3 admins (ids 4-6), el gestor Eze kiel (id 7, organización "Pizza party", rama GASTRONOMIA_CULTURAL, **líder de su rama** desde el 2026-10-24 con `scripts/marcar_lider.py`) y el ciudadano ezequiel (id 8). Las cuentas demo del seed (ids 1-3) y sus publicaciones se eliminaron con `scripts/eliminar_cuentas_demo.py`; Og Mauro quedó sin dueño (`user_id` NULL). `seed_database()` ya no corre con `ENVIRONMENT=production`.

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
- Explorar: portadas de las 10 categorías culturales (`CategoryCoversGrid`) → `CategoryScreen` con gestores, buscador por título y tarjetas horizontales. Las portadas viven en Cloudinary (tabla `cultural_category_covers`, `GET /api/cultural-categories/covers`, hook `utils/categoryCovers.js`); `frontend/public/images/categorias/<slug>.jpg` queda como respaldo
- Sistema de toast: `ToastContext.jsx`, `Toast.jsx`, 6 eventos cableados, 5 tonos (rio/menta/dorado/naranja/morado)
- Perfiles por rol (3 fases, verificadas): nombre/foto editables para todos (`PATCH /api/me`); ciudadano solo con "Tus guardados"; gestor con biografía pública (`/api/me/organization`) y **Dashboard de Gestor** (`#gestor-dashboard`, CRUD de sus publicaciones); admin con **Dashboard de Admin** (`#admin-dashboard`: pulso, moderación aprobar/rechazar, CRUD de todas las publicaciones, panel de gestores)
- Ciclo editorial completo en la UI: el gestor crea borradores y los envía; el admin aprueba o rechaza con motivo y puede publicar directo (`PublicationForm` compartido)
- Rediseño completo de HiloAssistant: lanzador compacto (cápsula + Hilo a la derecha), susurros contextuales, panel con cabecera de color sólido, Brújula 2x2, Chat Turístico con reglas de palabras clave (sin IA)
- Hero del inicio (propuesta definitiva del diseñador): fondo ilustrado claro (`arbol-tejido-claro.jpg`, original en `C:\Users\Bryan\Tejido\tejido-originales\`), Hilo grande al centro, saludo a la derecha (`GREETING_POSITION`), cápsula de estadísticas con conteo real, tarjetas glass y CTA de tinta
- Botones unificados en `uiStyles.js`: `BTN_INK_LG/MD/SM`, `BTN_INK_OUTLINE_MD`, `BTN_GHOST`, `BTN_DANGER`, `BTN_QUIET_SM` (misma altura por talla: MD 49 px, SM 37 px)
- VideoText en HomeScreen (efecto SVG mask + video sobre la palabra "TEJIDO")
- EmptyNote como componente extraído y reutilizable
- **Dashboard de gestor por categoría**: el gestor solo publica en su rama (validado en el backend), pestañas Mis publicaciones / Mi categoría; editar una PUBLISHED la devuelve a REVIEW
- **Cuentas demo eliminadas** de Neon (2026-10-22) y `seed_database()` bloqueado en producción
- **Bandeja del admin** (`#admin-dashboard/bandeja`): mensajes de Nosotros (`/api/admin/suggestions`, NEW/READ/ARCHIVED) y reportes de publicaciones (`/api/admin/reports`, OPEN/RESOLVED/DISMISSED con nota); los mosaicos del Pulso enlazan ahí
- **Correos** (Resend): avisos al equipo (`SUPPORT_EMAIL`) por sugerencia, reporte y publicación en revisión; al gestor por aprobada/rechazada; invitación. HTML de marca + texto plano (`services/email_templates.py`, `services/notifications.py`, BackgroundTasks tras el commit; nunca rompen la acción). Vista previa sin enviar: `py scripts/preview_correos.py <carpeta>`. Formulario de Nosotros con límite de 3 mensajes cada 10 min por IP
- **Migración a Cloudinary** de las fotos de Og Mauro y DJ Apolo y de las 10 portadas (`scripts/migrar_imagenes_a_cloudinary.py`, ya aplicado). Los archivos locales siguen en `frontend/public` (no borrados)
- **Página de cada publicación** (`#publicacion/<id>`, `PublicationScreen`): galería con vista ampliada, detalles de evento/oportunidad, "Publicado por"; guardar/compartir en `PublicationActions` (compartido con la tarjeta)
- **"El hilo del tiempo"** (landing) con hitos fijos editables en `frontend/src/utils/timelineItems.js` (los 3 actuales son de ejemplo)
- **Cobertura de ramas** en el panel de Gestores del admin (`BranchCoverage.jsx`): 10 tarjetas con estado, líder, participantes y solicitudes pendientes; "Crear gestor" con la rama preseleccionada (interruptor "Será el líder de esta rama"); desplegable de participantes con Nombrar líder / Quitar liderazgo / Sacar de la rama (`BranchParticipants.jsx`)
- **BLOQUE LÍDER POR RAMA (5 entregas, cerrado 2026-10-25)**:
  1. Backend: `organizations.is_leader`, `branch_join_requests`, `services/branches.py` (permisos siempre con la rama de la base), `/api/admin/branches[/{rama}/leader]`, `/api/branches/{rama}/requests|participants|review-queue`, `/api/branch-requests`, `/api/me/branch-request`; el líder modera lo de sus participantes; `GET /api/me` trae `branch` e `is_leader`
  2. **Perfil público del gestor** `#gestor/<slug>` (`GestorProfileScreen`, `components/gestor/`): slug único (`ensure_slug`, no cambia al renombrar), lema, portada, sede, contacto público con `show_*` (privado por defecto; `organizations.contact` nunca es público), redes, manifestaciones con fotos, galería, reconocimientos, publicaciones, equipo/líder. Admin puede ocultarlo (`profile_hidden`). `GET /api/gestores` trae `slug` (null si oculto)
  3. **Editor del perfil** dentro de Mi perfil del gestor ("Tu perfil público", `components/gestor/edit/`): vista previa con los mismos componentes públicos (`GET /api/me/profile/preview`), lápiz por sección, cambios en vivo al guardar, `MultiImageField` (subida múltiple a Cloudinary)
  4. **Dashboard del líder**: pestañas Por revisar / Solicitudes / Participantes con contadores (`components/gestor/leader/`); moderación compartida con el admin (`components/Moderation.jsx`); "Solicitudes de ingreso" en la Bandeja del admin (`GET /api/admin/branch-requests`, `join_requests` en `/api/admin/stats`)
  5. **"Quiero participar"** (`components/branch/`, `utils/useBranchRequest.js`): en la categoría, en el perfil del líder y en Mi perfil del ciudadano; al aprobarse pasa a gestor sin cerrar sesión. Aviso por correo "Te nombraron líder de {rama}"
- **Páginas legales** `#terminos` y `#privacidad` (`LegalScreen.jsx`, textos en `screens/legal/legalContent.jsx`, fecha en `LEGAL_UPDATED`); enlaces en el pie
- **BLOQUE TALENTO CONTRATABLE (4 subtareas, cerrado 2026-10-27)** — portafolios de contratación artística, aparte de las publicaciones:
  1. Modelo y API: `talent_profiles` + hijas `talent_services|specs|availability|media|milestones|endorsements|venues` y `talent_favorites` (`services/talent.py`, `api/routes/talent.py`, `schemas/talent.py`, `schemas/municipalities.py`). Público: `GET /api/talent` (filtros, facetas, `favorite`) y `GET /api/talent/{slug}`. Gestión: `/api/talent/manage[/{id}]`, `POST/PATCH/DELETE /api/talent[/{id}]`, `PUT /api/talent/{id}/<lista>|availability`, `submit` (líder), `status` (solo admin). Ciclo DRAFT → REVIEW → PUBLISHED/REJECTED: gestiona el ADMIN (todo) y el LÍDER de la rama (solo su rama; editar un publicado lo devuelve a REVIEW y puede seguir editando en REVIEW; no publica, verifica, pone acta ni destaca). Sello "Verificado por Tejido" exige número de acta (CHECK en la base). Avisos por correo de revisión y decisión. Upload scope `talent` (Cloudinary `tejido/talento`)
  2. Páginas públicas según las imágenes del diseñador: `#talento` (`TalentScreen`: filtros en el hash, fondo con los hilos animados del hero vía `ThreadsBackdrop.jsx`, banner Mesa Blanca y servicios técnicos en `utils/talentContent.js`) y `#talento/<slug>` (`TalentProfileScreen` → `components/talent/TalentProfileView.jsx`: calendario, portafolio con video que se reproduce en la página, trayectoria tejida, respaldo, mapa de presentaciones, talento parecido con Hilo, "Contratar" = aviso "muy pronto"). Sin degradados
  3. Guardar: solo el CIUDADANO guarda (publicaciones y talento; `POST/DELETE /api/publications/{id}/favorite` responde 403 a gestor/admin). `GET /api/me/saved` y pantalla `#guardadas` (`SavedScreen`) con filtros; el perfil del ciudadano solo muestra una tarjeta de acceso. El pie ya no enlaza "Guardadas"
  4. CRUD en los dashboards (`components/talent/manage/`): pestaña Talento del admin (`#admin-dashboard/talento[/<id>[/<pestaña>]]`, contador `stats.talent_review` y mosaico en el Pulso) y del líder (`#gestor-dashboard/talento...`, solo si `is_leader`); editor de 8 pestañas (Datos, Servicios, Ficha técnica, Disponibilidad, Portafolio, Trayectoria, Respaldo, Presentaciones) con aviso de cambios sin guardar; vista previa `#talento-vista-previa/<id>` (admin o líder de la rama, `noindex`). El tipo de publicación TALENTO ya no se ofrece al crear (las existentes se conservan y se editan)
- **Artistas — CRUD admin** (decisión 2026-10-20: la BD es la única fuente; ya no hay JSON ni scripts de carga): endpoints con permisos y validación de URLs (`/api/artists`, `/api/admin/artists[/{id}]`), pestaña Artistas del AdminDashboard (`#admin-dashboard/artistas`) con lista, alta y archivar/restaurar, y editor por pestañas (`#admin-dashboard/artistas/<id>/<pestaña>`: Datos, Música, Galería, Trayectoria, Redes, Conexiones, Métricas). Accesos solo para admin en Moneystack y en el perfil público. Solo admins crean/archivan; "eliminar" = archivar (`active=False`). DJ Apolo y Og Mauro tienen contenido de ejemplo (no real) que el admin reemplaza desde el editor
- **Registro con verificación de correo (Entrega A, 2026-10-29)**: nombre, apellido, municipio y aceptación de términos; verificación de correo y restablecer contraseña con tokens (solo hash), límites por IP/correo, `require_verified` en las escrituras del ciudadano, pantallas `#verificar` y `#restablecer`. Entrega B: `BackHomeButton` y plantilla global de correos. Carrusel del inicio (`GET /api/home/carousel` + `HomeCarousel`) y franja botánica en las letras TEJIDO (`VideoText`)
- **BLOQUE MUNICIPIOS (2026-10-30 / 11-01)**:
  1. Backend: `publications.municipality` y `artists.municipality` (uno de los 6 slugs o NULL, CHECK; la API ya lo exige al crear/editar) y `artists.moneystack`; `GET /api/municipalities/{slug}` (`services/municipalities.py`, solo lo público). `scripts/backfill_municipality.py` rellena las filas existentes desde `location`/`city` (dry-run por defecto; `--apply --yes` escribe)
  2. Pantallas `#municipios` (hub: píldoras `MunicipalityPill` que flotan; al clic la píldora crece hasta la portada con un FLIP manual, `utils/municipalityTransition.js`, porque `layoutId` no sobrevive al cambio de pantalla) y `#municipio/<slug>` (`MunicipalityScreen` + `components/municipality/`: portada, datos rápidos, memoria, mini mapa, publicaciones con filtros, talento y artistas, "Sigue tejiendo"). Fuente única de los municipios: `utils/municipalities.js` (textos de memoria, datos y `mapCaption` marcados PROVISIONAL)
  3. **Geografía del inicio rediseñada** (`HomeMapSection` + `components/geo/WovenMap.jsx`, sección `id="geografia"`): mapa real con Hilo y hebras vivas (un bucle rAF que se pausa fuera de pantalla), ríos trenzados, corregimientos, vista previa al pasar el cursor y clic = destello + zoom + `#municipio/<slug>`; al volver con Atrás la página baja a la sección (`utils/mapReturn.js`). Geometría estática en `utils/geoMap.js` (límites y centros poblados del DANE MGN 2025; ríos de OpenStreetMap, ODbL, con crédito en la sección), compartida con el mini mapa. Ya no hay modal ni esquema abstracto. "Ver Mapa" sigue llevando a la ruta `#mapa` (MapScreen)
- **Navegación y cuenta (2026-11-01 / 11-02)**:
  - **Header como tab bar**: las 9 pestañas centradas en un contenedor crema con pastilla tinta que se desliza (layoutId); las pantallas hijas cuentan para su pestaña (`utils/navSections.js`: `NAV_LINKS`, `activeSection`, `navIndex`, `NAV_DESCRIPTIONS`). Por debajo de **1280 px** (variante `navcompact`, `NAV_COMPACT_QUERY`) pasa al menú móvil
  - **Menú móvil** (`components/MobileMenu.jsx` + `ThreadsIcon.jsx`): botón "tres hebras", panel en portal a `<body>` (cajón de 384 px desde 640 px), app `inert` mientras está abierto, enlaces con micro-descripciones (sin fila Municipios), Moneystack aparte, territorios y cuenta
  - **Contenido que se desliza** entre pestañas según la dirección (App.jsx, `custom` en AnimatePresence); otras navegaciones con el fundido vertical. El scroll sube al terminar de salir la pantalla anterior (inmediato si la clave no cambia); un enlace al hash actual sube al principio
  - **Login/registro**: "Volver al inicio" minimalista con salida animada (`utils/useLeaveTransition.js`, también en la invitación); pestañas con pastilla deslizante, campos que cambian de lado y alturas animadas (`components/AutoHeight.jsx`); el contenido se ancla arriba para que el h1 no se mueva. `sessionStorage.tejido_login_mode = 'signup'` abre directo la pestaña de registro
- **Carrusel del inicio (2026-11-03)**: eslogan (`publications.tagline`, 100) y etiquetas (`publications.tags`, hasta 3) opcionales en el formulario (`TagsInput`); artistas de Moneystack destacados SIEMPRE presentes (hasta `MAX_FEATURED_ARTISTS` = 6; los demás rellenan huecos en ciclo, sin repetir seguido). `GET /api/home/carousel` y `/api/agenda` responden con `Cache-Control: public, no-cache` + ETag (`api/caching.py`): los cambios se ven en la siguiente carga
- **TAREA 3 · AGENDA Y OPORTUNIDADES (2026-11-04 / 11-05)**:
  1. **Agenda** (`#agenda?mun=&cat=&anteriores=1`, `AgendaScreen` + `components/agenda/AgendaCard.jsx`): solo EVENTO. `GET /api/agenda` (`services/agenda.py`) por bloques: `upcoming` (incluye en curso; por inicio), `traditions` (sin fecha, o con `tradition_text` y sin fecha futura), `recent_past` (15 días) o, con `past=1`, `archive` de a 24 con `offset`. Filtros `municipality`/`category` por slug (422 en español). "Hoy" = `home_carousel.today_bogota`. Campo nuevo `publications.tradition_text` (80, solo EVENTO; en otros tipos se ignora)
  2. **Calendario** `components/DatePicker.jsx` (sin librerías): mismo formato que el antiguo datetime-local (sin hora = `T00:00`), píldora Fecha/Rango, `single` para el cierre de oportunidades, teclado completo; popover de 340 px (≥1024), modal (768-1023) y panel inferior (<768)
  3. **Oportunidades** (`#oportunidades?mun=&tipo=&cat=&pronto=1`, `OpportunitiesScreen` + `components/opportunities/`): `GET /api/opportunities` (`services/opportunities.py`) con `open` (cierre hoy o después), `open_ended` (sin cierre) y `closed` (de a 12, "Cargar más"); `soon=1` = cierran en ≤7 días. Tipos administrables `opportunity_types` (slug fijo, etiqueta, orden, activo, `color` de la paleta ocre/menta/morado/amarillo/crema; un tipo en uso no se borra, se desactiva): `GET /api/opportunity-types` y `/api/admin/opportunity-types[...]` (pestaña Oportunidades del admin, `components/admin/OpportunityTypesPanel.jsx`). Detalle en `opportunities` (UPSERT, ya no se borra y recrea; lo mismo en `events`): `type_id`, `organizer` (reemplaza a `organization_name`, que queda sin uso), `requirements` (≤8), `prize`, `audience`; enlace de postulación obligatorio
  4. **Postulación fase 1** (`OpportunityApply`): el ciudadano pulsa "Postularme" → abre el enlace y la guarda (Favorite); sin sesión, aviso `AuthDialog` que vuelve a la oportunidad tras entrar; gestor/admin solo ven una nota; cerrada = "Plazo finalizado". Avisos de cierre a 3 y 1 día (`services/opportunity_reminders.py`, tabla `opportunity_reminders`, sin repetir; solo ciudadanos activos con correo verificado): comando `py -m backend.service.scripts.send_opportunity_reminders` (dry-run; `--send` envía). Fases 2 (formulario propio) y 3 (WhatsApp) NO hechas
  5. **Rediseño del diseñador** (Agenda, Oportunidades, detalle, calendario, panel de tipos): colores y variantes en UN solo lugar (`uiStyles.js`: `TERRITORY`, `TYPE_COLORS`, `PILL_COLORS`, `NOTICE_COLORS`, `pillStyle`/`noticeStyle`); piezas compartidas en `components/territory/` (entrada, barra de filtros con panel inferior en móvil, barras de bloque, píldoras, avisos, Hilo, esqueletos). Sin degradados. Ocre de texto `#a44727` para texto pequeño sobre crema (el `#b8502b` no llega a 4,5:1). En móvil el detalle de oportunidad lleva barra fija (publica `--barra-inferior`; el lanzador de Hilo sube sobre ella)
- **Pruebas aisladas de la base principal (2026-11-04)**: pytest corre contra `TEST_DATABASE_URL` (rama de Neon de pruebas). `backend/tests_fastapi/conftest.py` se niega a correr (salida 4) si falta o si apunta a la misma base que `DATABASE_URL`, y cambia `settings.database_url` antes de importar la app. Cada corrida marca su schema `test_<12 hex>` con `_test_meta`; al iniciar se borran los marcados de más de 6 h sin bloqueos. Se borraron de Neon los 10 schemas `test_*` huérfanos. En CI, `TEST_DATABASE_URL` es el Postgres del job

### Pendiente / En progreso
- **Hero, `GREETING_POSITION`**: a 1300 px el título "¡Bienvenido!" se sale por la derecha (bloque de 333 px más angosto que el título) y su centro queda ~110 px más abajo que el de Hilo — el user lo está cuadrando a mano
- **Hero a 1024 px**: el sol del fondo queda a medias por el recorte de `object-cover`; opción: usar ahí el tratamiento de móvil
- **"Quiero Participar" en móvil**: la fila del correo desborda a 390 px (input de 280 px fijo); propuesta: apilarla en ≤480 px
- **"Crear mi primera publicación"** (dashboard de gestor vacío) se parte en dos líneas a ≤390 px; se resuelve con un texto más corto
- **Hero, "Volver" desde un municipio** vuelve directo al saludo, no a Historias (lógica de `goBack`)
- **Cloudinary (Fases A y B hechas, 2026-10-21)**: subida firmada desde el backend (`POST /api/uploads/sign`, el navegador sube directo), `ImageField` único, subida múltiple en Galería y entrega optimizada. Claves `CLOUDINARY_*` solo en `.env`. Las fotos locales ya se migraron; falta decidir si se borran de `frontend/public`
- **Migraciones aplicadas en Neon hasta `a6d2e8f4c1b9`** (color de los tipos de oportunidad; antes `f3c1a9e7b5d2` tipos y detalle de oportunidades, `e8b3c5d7f9a2` texto de tradición, `d4f6a8c1e3b5` eslogan y etiquetas, `c5e8a1d4f7b2` municipio)
- **Al desplegar**: programar una vez al día (p. ej. 8:00 de Bogotá) `py -m backend.service.scripts.send_opportunity_reminders --send` (avisos de cierre; necesita `RESEND_API_KEY`)
- **Municipios, pendientes**: `py scripts/backfill_municipality.py --apply --yes` espera autorización del user (hasta entonces los contadores del mapa del inicio salen en 0); después, migración con el NOT NULL. Textos PROVISIONAL de `utils/municipalities.js` por reemplazar con datos reales. `tagline` repite los valores de `theme` (se pueden unificar). `VenuesMap` (perfil de talento) aún usa su copia del esquema viejo del mapa. Licencia de uso del MGN del DANE por confirmar
- **Talento, pendientes del dueño**: textos definitivos de `utils/talentContent.js` (Mesa Blanca y servicios técnicos) y decidir qué hacer con las 2 publicaciones de tipo TALENTO que quedan en la base. Todavía no hay talento real cargado
- **Pruebas en el navegador que escriben datos**: backend TEMPORAL en otro puerto (8766) contra un schema aislado de la rama de pruebas (`TEST_DATABASE_URL`), nunca contra la base principal, con `RESEND_API_KEY` y `SUPPORT_EMAIL` vacías; Playwright sobre Vite 5173 reencaminando `/api` a ese backend (o interceptando la API con `page.route`). El schema se borra al terminar y se comparan los conteos de la base principal antes/después. Siempre con autorización del user
- **Decisión de producto (2026-10-20)**: los artistas del apartado Moneystack (tabla `artists`, administrados solo por admin) son APARTE de los artistas de la sección Música de TEJIDO (los subirán/administrarán los gestores de la rama MUSICA; modelo por analizar, puede haber artistas en ambos). El contenido de la pantalla Moneystack (textos, chips, logo) se queda fijo en el código; solo la lista de artistas es administrable. El dashboard propio del artista (`ArtistDashboard`) NO aplica a Moneystack y queda diferido para los artistas de TEJIDO
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
- **Migraciones manuales siempre**: `py -m alembic upgrade head` después de cada cambio de modelo. Nunca se aplican a Neon sin autorización del user: primero se muestra el SQL (`py -m alembic upgrade <rev>:<rev> --sql`). Mientras el modelo pide columnas que Neon aún no tiene, el backend 8765 responde 500 en esas rutas
- **pytest nunca contra la base principal**: requiere `TEST_DATABASE_URL`. La suite completa tarda ~40 min: correrla en primer plano y por partes (un proceso en segundo plano puede cortarse por memoria y dejar su schema; la siguiente corrida lo limpia si tiene más de 6 h)

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
| `backend/service/seed.py` | Datos semilla para tests (roles, usuarios demo, admins reales); bloqueado en producción |
| `scripts/INICIAR_TEJIDO.ps1` | Arrancar frontend + backend |
| `scripts/links_invitacion_admins.py` | Genera links de invitación para admins ids 4-6 |
| `backend/service/services/branches.py` | Líder por rama, participantes, solicitudes y permisos de moderación |
| `backend/service/services/notifications.py` + `email_templates.py` | Avisos por correo (HTML de marca + texto) |
| `backend/service/api/routes/admin_inbox.py` | Bandeja del admin (mensajes y reportes) |
| `frontend/src/screens/PublicationScreen.jsx` | Página de cada publicación (`#publicacion/<id>`) |
| `frontend/src/components/admin/BandejaPanel.jsx` / `BranchCoverage.jsx` | Bandeja del admin / cobertura de ramas |
| `scripts/marcar_lider.py` | Nombra líder de una rama (dry-run por defecto, `--aplicar`) |
| `backend/service/services/org_profiles.py` + `api/routes/profiles.py` | Perfil público del gestor: slug, lectura pública sin fugas, edición propia (`/api/me/profile`) |
| `frontend/src/screens/GestorProfileScreen.jsx` + `components/gestor/` | Página `#gestor/<slug>` (cabecera y secciones), editor en `gestor/edit/`, dashboard del líder en `gestor/leader/` |
| `frontend/src/components/branch/` + `utils/useBranchRequest.js` | Flujo "Quiero participar" (bloque, diálogo y tarjeta del ciudadano) |
| `frontend/src/components/admin/BranchParticipants.jsx` | Participantes de una rama con acciones del admin (líder, sacar) |
| `backend/service/services/talent.py` + `api/routes/talent.py` + `schemas/talent.py` | Talento contratable: lectura pública, gestión con permisos por rama, estados, guardados |
| `frontend/src/screens/TalentScreen.jsx` / `TalentProfileScreen.jsx` / `TalentPreviewScreen.jsx` | Listado `#talento`, perfil `#talento/<slug>` y vista previa `#talento-vista-previa/<id>` |
| `frontend/src/components/talent/` (+ `manage/`) | Piezas del perfil público (`TalentProfileView`) y el CRUD de los dashboards (`TalentManager`, `TalentEditor`) |
| `frontend/src/utils/talent.js` / `talentContent.js` / `videoEmbed.js` | Utilidades del talento, contenido fijo del listado y embebido de videos |
| `frontend/src/components/ThreadsBackdrop.jsx` | Hilos animados del hero como fondo reutilizable (respeta movimiento reducido) |
| `frontend/src/screens/SavedScreen.jsx` | Guardadas del ciudadano (`#guardadas`, `GET /api/me/saved`) |
| `frontend/src/utils/municipalities.js` | Fuente única de los 6 municipios (textos, colores, `tagline`, datos de la pantalla) |
| `frontend/src/utils/geoMap.js` | Geometría del Bajo Cauca (DANE + OSM): siluetas, límites, ríos, nudos y corregimientos |
| `frontend/src/screens/MunicipalitiesScreen.jsx` / `MunicipalityScreen.jsx` + `components/municipality/` | Hub `#municipios` y pantalla `#municipio/<slug>` |
| `frontend/src/screens/HomeMapSection.jsx` + `components/geo/` | Sección Geografía del inicio (mapa tejido, hebras, vista previa) |
| `frontend/src/components/SiteHeader.jsx` + `MobileMenu.jsx` + `utils/navSections.js` | Header (tab bar y menú móvil) y las pestañas compartidas con App |
| `frontend/src/utils/useLeaveTransition.js` / `components/AutoHeight.jsx` | Salida animada antes de navegar / altura animada de un bloque |
| `backend/service/services/municipalities.py` + `api/routes/municipalities.py` | `GET /api/municipalities/{slug}` |
| `scripts/backfill_municipality.py` | Rellena el municipio de publicaciones y artistas (dry-run por defecto) |
| `backend/service/services/agenda.py` + `api/routes/agenda.py` | `GET /api/agenda` por bloques |
| `backend/service/services/opportunities.py` / `opportunity_types.py` / `opportunity_reminders.py` + `api/routes/opportunities.py` | Oportunidades: lista pública por bloques, tipos (público y admin) y avisos de cierre |
| `backend/service/scripts/send_opportunity_reminders.py` | Comando de avisos de cierre (dry-run por defecto, `--send`) |
| `backend/service/api/caching.py` | Respuesta JSON con ETag y `Cache-Control: public, no-cache` |
| `frontend/src/screens/AgendaScreen.jsx` / `OpportunitiesScreen.jsx` + `components/agenda/`, `components/opportunities/` | Agenda y Oportunidades (tarjetas, detalle, postulación, aviso sin sesión) |
| `frontend/src/components/territory/` | Piezas y estilos compartidos del rediseño (entrada, filtros, barras, píldoras, Hilo, esqueletos) |
| `frontend/src/components/DatePicker.jsx` | Calendario de fechas del formulario |
| `frontend/src/utils/agenda.js` / `opportunities.js` | Filtros en el hash, URLs de la API y textos de fecha |
| `backend/tests_fastapi/conftest.py` | Suite aislada en `TEST_DATABASE_URL`, limpieza de schemas `test_*` viejos |
