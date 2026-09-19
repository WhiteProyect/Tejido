# TEJIDO

Plataforma web de descubrimiento territorial para Caucasia y el Bajo Cauca (Antioquia). Integra historias, eventos, oportunidades y talento local, incluyendo el sello musical Moneystack y sus artistas.

Identidad visual y filosofía de diseño: [docs/MANUAL_ESENCIA_TEJIDO.md](docs/MANUAL_ESENCIA_TEJIDO.md).

---

## Stack

| Capa | Tecnología |
|------|------------|
| Backend | FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2 (pydantic-settings), Uvicorn |
| Base de datos | PostgreSQL (Neon), esquema versionado con Alembic |
| Frontend | React, Vite, framer-motion |
| Tests / CI | pytest (esquema temporal aislado en Postgres) + GitHub Actions |

## Estructura

```
tejido/
├── backend/
│   ├── alembic/             # Migraciones de esquema
│   ├── service/
│   │   ├── api/routes/      # Routers por dominio (auth, publications, artists, ...)
│   │   ├── core/            # Configuración, seguridad, logging
│   │   ├── db/              # Sesión SQLAlchemy
│   │   ├── models/          # Modelos ORM (tables.py)
│   │   ├── schemas/         # Validación Pydantic
│   │   ├── services/        # Lógica de negocio
│   │   ├── main.py          # App FastAPI
│   │   └── seed.py          # Datos iniciales idempotentes
│   └── tests_fastapi/       # Suite de tests
├── docs/                    # Manual de identidad de TEJIDO
├── frontend/
│   ├── public/              # Estáticos (assets/artistas/<slug>/, images/)
│   └── src/                 # App React (components, screens, styles, services)
├── scripts/                 # Arranque local (INICIAR_TEJIDO.ps1 / .bat)
├── AGENTS.md                # Reglas de trabajo del proyecto
├── alembic.ini
├── requirements.txt
└── server.py                # Punto de entrada (uvicorn)
```

## Arranque local

Requiere `.env` en la raíz con `DATABASE_URL` (ver `.env.example`).

```powershell
./scripts/INICIAR_TEJIDO.ps1
```

Levanta backend (`http://127.0.0.1:8765`) y frontend (`http://127.0.0.1:5173`) y abre el navegador. Solo el backend: `python server.py`. Solo el frontend: `npm run dev` dentro de `frontend/`.

Verificación: `curl http://127.0.0.1:8765/api/health` → `{"status":"ok","database":"ok",...}`.

## Configuración (`.env`)

```bash
DATABASE_URL=postgresql+psycopg://usuario:password@host:5432/tejido?sslmode=require  # requerido
HOST=127.0.0.1
PORT=8765
ENVIRONMENT=development   # "production" oculta /docs, /redoc y /openapi.json
LOG_LEVEL=INFO
MAX_BODY_BYTES=1000000
REQUEST_TIMEOUT_SECONDS=30
```

`.env` nunca se versiona.

## Base de datos

```bash
py -m alembic upgrade head        # aplicar migraciones
py -m alembic revision --autogenerate -m "descripcion"   # nueva migración
```

Todo cambio de esquema pasa por Alembic. El seed (`backend/service/seed.py`) es idempotente e incluye cuentas demo y los artistas Og Mauro y DJ Apolo.

## Tests

```bash
py -m pytest backend/tests_fastapi -v
```

## Roles

| Rol | Permisos |
|-----|----------|
| ADMIN | Moderar, estadísticas, gestión total |
| GESTOR | Crear/editar publicaciones, gestionar su perfil de artista |
| CIUDADANO | Ver publicado, guardar, reportar |

Cuentas demo (solo desarrollo): `admin@tejido.co`, `gestor@tejido.co`, `ciudadano@tejido.co`.

## Seguridad

- Contraseñas con PBKDF2-SHA256 (120.000 iteraciones); tokens Bearer de 8 horas persistidos en `sessions`.
- Rate limiting en login (5 intentos fallidos / 5 min por correo + IP → 429).
- Límite de tamaño de body y timeout por request; logging estructurado.
- Consultas parametrizadas vía SQLAlchemy.

## Estado

Backend migrado a FastAPI + PostgreSQL (Neon). El despliegue (hosting, Docker, dominio) está pendiente y se hará una vez cerrado el desarrollo de funcionalidades.
