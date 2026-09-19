# TEJIDO — REGLAS GENERALES PARA AGENTES

## 1. IDENTIDAD DEL PROYECTO

TEJIDO es una plataforma web profesional de descubrimiento territorial para Caucasia y el Bajo Cauca. Reúne:

- eventos;
- historias;
- oportunidades;
- talentos locales;
- el sello Moneystack y sus artistas.

El proyecto debe mantenerse simple, estable y fácil de mantener.

---

## 2. TECNOLOGÍAS OFICIALES

Backend (actualizado 2026-09-14, migración de stack ya autorizada y completa):

- Python 3.9+
- FastAPI
- SQLAlchemy 2.0 (ORM) + Alembic (migraciones de esquema)
- Pydantic / pydantic-settings
- hashlib, secrets (hashing y tokens, sin cambios)

Base de datos principal:

- PostgreSQL, hosteada en Neon (neon.tech)
- Conexión vía `DATABASE_URL` en `.env` (ver `.env.example`), leída con
  pydantic-settings en `backend/service/core/config.py`
- Esquema versionado con Alembic (`backend/alembic/versions/`), modelos en
  `backend/service/models/tables.py`

Frontend:

- React
- Vite
- JavaScript
- Tailwind CSS v4 (`tailwindcss` + `@tailwindcss/vite`), autorizado por el
  dueño (2026-09-19) y adoptado de forma incremental: solo `theme` +
  `utilities`, sin `preflight`. Convención en `frontend/README.md`, sección
  "Tailwind".

El backend usa FastAPI de forma deliberada y autorizada (no es una excepción
temporal) -- ver sección 3.

---

## 3. TECNOLOGÍAS NO INTRODUCIR SIN AUTORIZACIÓN

FastAPI, SQLAlchemy, Alembic, Pydantic y PostgreSQL **ya están autorizados y
en producción** (migración completada, ver sección 2), y **Tailwind CSS v4 ya
está autorizado** en el frontend (ver sección 2 y 7) -- no aplican como
restricción.

No introducir sin autorización explícita:

- Flask, Django (otros frameworks backend además del ya adoptado)
- Vue, Angular
- Webpack
- Docker/docker-compose (deploy queda pausado hasta que el desarrollo esté
  más maduro -- ver el estado del proyecto antes de proponerlo)
- otros frameworks CSS (Bootstrap, Material UI, Chakra, styled-components,
  etc.): Tailwind es el único autorizado

No convertir TEJIDO en otro tipo de proyecto.

---

## 4. REGLA PRINCIPAL

Antes de modificar cualquier archivo:

1. Leer el archivo.
2. Comprender su función.
3. Revisar sus conexiones con otros archivos.
4. Realizar el cambio mínimo necesario.
5. Probar el resultado.

No reescribir archivos completos cuando un cambio pequeño sea suficiente.

---

## 5. PROTECCIÓN DEL PROYECTO

No borrar:

- archivos;
- tablas;
- datos;
- funcionalidades;
- imágenes;

sin una razón técnica clara y autorización cuando corresponda.

No eliminar la base de datos para solucionar errores.

---

## 6. BASE DE DATOS

La base de datos principal es PostgreSQL, hosteada en Neon. La conexión se
configura con `DATABASE_URL` en `.env` (nunca hardcodeada en el código).

Antes de cambiar la estructura:

- revisar los modelos en `backend/service/models/tables.py`;
- revisar relaciones y foreign keys;
- revisar las queries en `backend/service/services/`;
- comprobar dependencias;
- considerar los datos existentes.

Todo cambio de esquema se hace con una migración de Alembic
(`py -m alembic revision --autogenerate -m "..."` y `py -m alembic upgrade head`),
nunca editando la base directamente. Los cambios de base de datos deben ser
compatibles con el proyecto.

---

## 7. FRONTEND

El código vive en `frontend/src/` (React + Vite):

- `screens/`: pantallas;
- `components/`: piezas reutilizables;
- `styles/`: `main.css`, `artist.css`, `moneystack.css` (CSS legado, aprobado
  visualmente) y `tailwind.css` (integración de Tailwind y tokens de marca);
- `frontend/public/`: estáticos (`assets/artistas/<slug>/`, `images/`).

Estilos con Tailwind (detalle en `frontend/README.md`, sección "Tailwind"):

- todo componente o pantalla NUEVO usa Tailwind;
- lo existente se migra de a una pantalla cuando se toque, quitando sus clases
  legadas y las reglas CSS huérfanas; no mezclar ambas en un mismo elemento;
- el CSS legado no tiene capa y siempre gana a las utilidades (y sus
  selectores de etiqueta globales, como `footer`, `nav`, `h1`–`h3`, `a`,
  `button`, se filtran a los componentes nuevos);
- no activar `preflight` ni borrar CSS legado hasta terminar la migración;
- cualquier migración de pantalla debe verificarse con capturas antes/después
  (1300 px y 390 px) sin diferencias visuales.

Antes de modificar un componente:

- buscar dónde se utiliza;
- revisar eventos y estilos relacionados;
- comprobar llamadas al backend.

Antes de agregar imágenes:

- comprobar que el archivo exista;
- comprobar exactamente la ruta;
- respetar mayúsculas y minúsculas.

Respetar la identidad definida en `docs/MANUAL_ESENCIA_TEJIDO.md`.

---

## 8. BACKEND

El backend principal usa FastAPI. `server.py` en la raíz es solo el punto de
arranque (uvicorn) -- los endpoints viven en `backend/service/api/routes/`,
por dominio (auth, publications, collaborators, artists, admin, misc).

Antes de modificar un endpoint:

- localizarlo en `backend/service/api/routes/`;
- revisar la lógica de negocio en `backend/service/services/`;
- revisar la respuesta y los códigos de error (`backend/service/errors.py`);
- comprobar qué parte del frontend lo utiliza;
- si el cambio es de comportamiento, agregar o actualizar el test
  correspondiente en `backend/tests_fastapi/`.

No crear endpoints duplicados.

---

## 9. FLUJO DE TRABAJO

Analizar → planificar → implementar → verificar (tests y prueba visual) → aprobar.

No realizar cambios grandes sin planificación. No modificar código de
producción sin que el cambio haya sido solicitado.

---

## 10. HERRAMIENTAS DE VERIFICACIÓN

- Backend: `py -m pytest backend/tests_fastapi -v`.
- Arranque completo: `scripts/INICIAR_TEJIDO.ps1`.
- Cambios de esquema: solo con migración de Alembic.

---

## 11. COORDINACIÓN

Backend y Frontend deben respetar las interfaces existentes.

Si una tarea necesita cambios en ambas partes:

1. identificar primero la dependencia;
2. implementar backend;
3. implementar frontend;
4. verificar integración.

No crear soluciones duplicadas.

---

## 12. HILO

Hilo es un elemento visual importante de TEJIDO.

Las imágenes de Hilo deben utilizar rutas reales existentes.

No inventar nombres de imágenes.

Si una imagen falta:

- reportar el problema;
- indicar la ruta esperada;
- no ocultar silenciosamente el error.

---

## 13. SEGURIDAD

No exponer:

- contraseñas;
- secretos;
- claves;
- credenciales;
- información sensible.

Las contraseñas deben manejarse mediante mecanismos seguros existentes en el proyecto.

No introducir credenciales directamente en el código.

---

## 14. CALIDAD

Cada cambio debe intentar mantener:

- simplicidad;
- estabilidad;
- legibilidad;
- compatibilidad;
- seguridad;
- mantenibilidad.

No agregar complejidad sin necesidad.

---

## 15. TRABAJO CON DOS AGENTES (CLAUDE + CODEX)

Este proyecto se trabaja con dos agentes a la vez. Ambos leen este mismo
archivo (Codex lo hace automáticamente por convención de nombre).

**Roles (fijos, no dos sesiones de Claude):**

- **Claude Code** (terminal, modelo Opus): arquitecto e implementador. Es
  quien edita código, corre tests, hace commits y decide el diseño técnico.
- **Codex CLI**: analista y revisor, en modo **solo lectura**
  (`codex exec -s read-only`, `codex review`). Da segunda opinión sobre
  diffs, busca bugs y cuestiona el diseño; no escribe código de producción
  salvo que el dueño lo pida explícitamente para una tarea puntual.

**Reglas de convivencia:**

- **Un solo agente escribe código a la vez.** No editar el mismo archivo
  desde los dos agentes en paralelo.
- **Antes de cualquier `git checkout`/`switch`/`merge` que cambie archivos
  trackeados, detener primero Vite (5173) y el backend (8765) si están
  corriendo**, y volver a levantarlos después con
  `scripts/INICIAR_TEJIDO.ps1`. Cambiar el working tree con los servidores
  vivos los corrompe (pasó el 2026-09-19: la pantalla de MoneyStack y el
  backend se rompieron por un checkout con los servidores en caliente, ver
  `docs/HANDOFF.md`). Si no están corriendo, no hace falta.
- **Puertos ya ocupados por servidores del dueño:** Vite en 5173 y el backend
  en 8765 pueden estar corriendo ya -- no matar esos procesos sin avisar.
  Usar el puerto 5174 para pruebas aisladas.
- **Deploy sigue pausado** (ver sección 3) hasta que el dueño lo autorice
  explícitamente -- ningún agente debe proponer Docker, hosting o dominio
  todavía.
- **Git:** el remoto `origin` es `https://github.com/WhiteProyect/Tejido.git`
  (organización compartida del dueño y su compañero). La rama de trabajo
  compartida es `pruebas` -- ahí se suben y se toman los cambios entre
  equipos. `main` existe pero va detrás.
- **Traspaso entre sesiones/agentes:** dejar un resumen breve en
  `docs/HANDOFF.md` (qué se hizo, qué falta, qué se decidió) al cerrar una
  tarea relevante, para que el otro agente no tenga que redescubrir el
  contexto.

---

## 16. REGLA FINAL

El objetivo no es hacer la mayor cantidad de cambios.

El objetivo es hacer:

EL CAMBIO CORRECTO,
EN EL LUGAR CORRECTO,
CON EL MENOR RIESGO POSIBLE.
