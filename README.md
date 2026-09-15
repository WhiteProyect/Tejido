# TEJIDO - Descubre lo que mueve a Caucasia

## 📊 Proyecto Reorganizado (v2.0)

TEJIDO es una plataforma web académica para descubrimiento territorial que integra historias, eventos, oportunidades y talentos locales en Caucasia, Antioquia.

**Estado:** ✅ Funcional | **Última actualización:** 2026-09-14

---

## 🏗️ Estructura del Proyecto

```
tejido/
├── .config/                      # Configuración de tooling (agentes, workflows)
├── .git/                         # Control de versiones
├── backend/
│   ├── alembic/                  # Migraciones de esquema (PostgreSQL)
│   ├── scripts/                  # Scripts puntuales (ej. migración a Neon)
│   ├── service/                  # Backend FastAPI
│   │   ├── api/routes/           # Routers por dominio
│   │   ├── core/                 # Config (pydantic-settings) y logging
│   │   ├── db/                   # Sesión SQLAlchemy
│   │   ├── models/                # Modelos ORM (tables.py)
│   │   ├── schemas/               # Validación Pydantic
│   │   ├── services/              # Lógica de negocio
│   │   └── main.py                # App FastAPI
│   └── tests_fastapi/            # Suite de tests (paridad + flujos de negocio)
├── backups/                      # Snapshots históricos previos a features riesgosas
├── docs/                         # Documentación académica (informes, guía)
├── frontend/                     # React + Vite (a cargo del equipo de frontend)
├── scripts/                      # Scripts de arranque
│   ├── INICIAR_TEJIDO.ps1        # PowerShell (recomendado)
│   ├── INICIAR_TEJIDO.bat        # Cmd (invoca el .ps1)
│   └── README.md
├── AGENTS.md                     # Reglas del proyecto
├── alembic.ini                   # Config de Alembic
├── requirements.txt              # Dependencias del backend
├── server.py                     # Punto de entrada (uvicorn)
├── README.md                     # Este archivo
└── .gitignore                    # Exclusiones de Git
```

---

## 🚀 Arrancar el Proyecto

### Opción 1: PowerShell (recomendado -- levanta todo y abre el navegador)
```powershell
cd C:\Users\Bryan\Tejido\tejido
./scripts/INICIAR_TEJIDO.ps1
```
Levanta el backend (FastAPI) y el frontend (Vite) cada uno en su propia
ventana de PowerShell, y abre `http://127.0.0.1:5173/` en tu **navegador por
defecto del sistema** (Chrome/Edge/Brave/Firefox -- nunca el "Simple Browser"
integrado de VS Code; el `--open` de Vite y el `Start-Process` de este script
usan el manejador de URL del sistema operativo, verificado en la práctica).

### Opción 2: Solo el backend (Python directo)
```bash
cd C:\Users\Bryan\Tejido\tejido
python server.py
```
No abre navegador ni levanta el frontend -- util para probar solo la API.

**La API estará en:** `http://127.0.0.1:8765` (requiere `.env` con `DATABASE_URL`, ver `.env.example`)

---

## ✅ Verificar Funcionamiento

```bash
# Test de salud del servidor
curl http://127.0.0.1:8765/api/health

# Validar sintaxis JavaScript
node --check frontend/public/js/app.js

# Validar todos los módulos
node --check frontend/public/js/utils/helpers.js
node --check frontend/public/js/state/store.js
node --check frontend/public/js/services/api.js
```

Respuesta esperada:
```json
{"status": "ok", "database": "ok", "time": "2026-08-30T..."}
```

---

## 📦 Componentes Principales

### Backend
- **Framework:** FastAPI + SQLAlchemy 2.0 -- `backend/service/main.py`
- **Autenticación:** `backend/service/services/auth.py` - Token Bearer de 8 horas
- **Base de Datos:** PostgreSQL (Neon) -- ver `DATABASE_URL` en `.env`
- **Validación:** Pydantic -- `backend/service/schemas/`

### Frontend
- **React + Vite:** `frontend/src/`
- **Desarrollo:** `npm run dev` desde `frontend/`
- **Respaldo vanilla:** `frontend/public/` durante la migración
- **CSS:** `frontend/src/styles.css` y estilos vanilla heredados
- **JavaScript Modular heredado:**
  - `js/utils/` - Funciones base
  - `js/state/` - Gestión de estado
  - `js/services/` - Cliente HTTP
  - `js/components/` - Componentes reutilizables
  - `js/core/` - Orquestación
  - `js/modules/` - UI e Hilo (asistente)
  - `js/app.js` - Aplicación principal

### Datos
- PostgreSQL (Neon), esquema versionado con Alembic (`backend/alembic/versions/`)
- Modelos SQLAlchemy en `backend/service/models/tables.py`
- Seed idempotente en `backend/service/seed.py`

---

## 👥 Roles y Permisos

| Rol | Permisos |
|-----|----------|
| **ADMIN** | Ver todo, moderar, estadísticas, eliminar |
| **GESTOR** | Crear/editar publicaciones, enviar a revisión |
| **CIUDADANO** | Ver publicado, guardar, reportar |

### Cuentas de Demo
- Admin: `admin@tejido.co` / `Admin123!`
- Gestor: `gestor@tejido.co` / `Gestor123!`
- Ciudadano: `ciudadano@tejido.co` / `Ciudadano123!`

---

## 🔧 Configuración

### Variables de entorno (`.env`, ver `.env.example`)
```bash
DATABASE_URL=postgresql+psycopg://usuario:password@host:5432/tejido?sslmode=require  # requerido
HOST=127.0.0.1
PORT=8765
ENVIRONMENT=development   # "production" oculta /docs, /redoc, /openapi.json
LOG_LEVEL=INFO
MAX_BODY_BYTES=1000000
REQUEST_TIMEOUT_SECONDS=30
```
Se leen vía `pydantic-settings` en `backend/service/core/config.py`.

---

## 📋 Tipos de Contenido

| Tipo | Descripción | Uso |
|------|-------------|-----|
| **HISTORIA** | Relatos y crónicas | Narrativa del territorio |
| **EVENTO** | Actividades y encuentros | Agenda territorial |
| **OPORTUNIDAD** | Convocatorias y proyectos | Participación |
| **TALENTO** | Personas y artistas | Visibilidad local |
| **INICIATIVA** | Proyectos comunitarios | Colaboración |

---

## 🎯 Estado de la Migración de Backend/BD

La migración de backend (stdlib `http.server` + SQLite → FastAPI + SQLAlchemy +
PostgreSQL/Neon) va por Fase 4 de 5: framework nuevo, datos en Neon, env vars y
logging endurecidos, y ahora cobertura de tests de flujos de negocio
(`backend/tests_fastapi/test_business_flows.py`). El deploy (hosting, Docker,
dominio) queda deliberadamente pausado hasta que el desarrollo esté más maduro.

El roadmap del frontend (migración a React, retiro del vanilla JS heredado)
lo lleva el equipo de frontend por separado -- no se documenta aquí para
evitar que quede desactualizado como pasaba con el plan anterior.

---

## 📚 Documentación Importante

- **[AGENTS.md](AGENTS.md)** - Reglas generales del proyecto
- **[frontend/README.md](frontend/README.md)** - Arquitectura frontend
- **[scripts/README.md](scripts/README.md)** - Cómo arrancar

---

## 🐛 Problemas Comunes

### "No se encuentra server.py"
```powershell
# ✗ Incorrecto:
cd C:\Users\Bryan\Tejido
python server.py

# ✓ Correcto:
cd C:\Users\Bryan\Tejido\tejido
python server.py
```

### "Puerto 8765 ya está en uso"
```powershell
# Cambiar PORT en .env, o matar el proceso que lo esta usando:
Get-Process -Name python | Stop-Process -Force
```

### Problemas con el esquema de la base de datos
```bash
# La base es PostgreSQL (Neon), gestionada con Alembic:
py -m alembic upgrade head
```

---

## 🔒 Seguridad

- Contraseñas con PBKDF2-SHA256 (120,000 iteraciones)
- Token Bearer con expiración de 8 horas
- Validación de entrada en todos los endpoints
- CORS no habilitado por defecto (solo localhost)
- SQL injection prevenido con parametrización

---

## 📊 Estadísticas del Proyecto

| Métrica | Valor |
|---------|-------|
| Backend Lines | ~500 LOC |
| Frontend Lines | ~2000 LOC |
| BD Tablas | 15 |
| Endpoints API | 25+ |
| Componentes | 10+ |
| Módulos JS | 8 |

---

## 👨‍💻 Contribución

Para contribuir al proyecto:

1. Leer [AGENTS.md](AGENTS.md)
2. Seguir la estructura de carpetas
3. Documentar cambios en README.md
4. Probar antes de hacer commit (`py -m pytest backend/tests_fastapi -v`)

---

## 📞 Soporte

- **Problemas técnicos:** Ver sección "Problemas Comunes"
- **Reglas del código:** Ver [AGENTS.md](AGENTS.md)

---

## 📄 Licencia

TEJIDO - Proyecto académico | ADSO 2026

Hecho con orgullo en Caucasia, Antioquia.

---

**Última actualización:** 2026-09-14  
**Versión:** 3.0 (Backend FastAPI + PostgreSQL/Neon)  
**Estado:** ✅ Funcional
