# TEJIDO — REGLAS GENERALES PARA AGENTES

## 1. IDENTIDAD DEL PROYECTO

TEJIDO es una aplicación web académica para descubrir:

- eventos;
- historias;
- oportunidades;
- talentos locales.

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

El backend usa FastAPI de forma deliberada y autorizada (no es una excepción
temporal) -- ver sección 3.

---

## 3. TECNOLOGÍAS NO INTRODUCIR SIN AUTORIZACIÓN

FastAPI, SQLAlchemy, Alembic, Pydantic y PostgreSQL **ya están autorizados y
en producción** (migración completada, ver sección 2) -- no aplican como
restricción.

No introducir sin autorización explícita:

- Flask, Django (otros frameworks backend además del ya adoptado)
- Vue, Angular
- Webpack
- Docker/docker-compose (deploy queda pausado hasta que el desarrollo esté
  más maduro -- ver el estado del proyecto antes de proponerlo)
- frameworks CSS nuevos

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

No sobrescribir backups.

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

Los archivos principales están en:

public/

Principalmente:

- index.html
- styles.css
- app.js

Antes de modificar JavaScript:

- buscar dónde se utiliza la función;
- revisar eventos relacionados;
- comprobar llamadas al backend.

Antes de agregar imágenes:

- comprobar que el archivo exista;
- comprobar exactamente la ruta;
- respetar mayúsculas y minúsculas.

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

## 9. ARQUITECTURA DE AGENTES

TEJIDO utiliza cuatro agentes:

### ARQUITECTO

Planifica y analiza.

No modifica código.

### BACKEND BUILDER

Construye y modifica backend.

### FRONTEND BUILDER

Construye y modifica frontend.

### QA / DOCUMENTADOR

Revisa, prueba y documenta.

No modifica código de producción.

---

## 10. FLUJO DE TRABAJO

El flujo recomendado es:

ARQUITECTO
↓
PLAN
↓
BACKEND BUILDER / FRONTEND BUILDER
↓
IMPLEMENTACIÓN
↓
QA / DOCUMENTADOR
↓
VERIFICACIÓN
↓
APROBACIÓN

No realizar cambios grandes sin planificación.

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

## 15. REGLA FINAL

El objetivo no es hacer la mayor cantidad de cambios.

El objetivo es hacer:

EL CAMBIO CORRECTO,
EN EL LUGAR CORRECTO,
CON EL MENOR RIESGO POSIBLE.
