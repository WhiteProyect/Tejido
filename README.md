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
| Tests / CI | pytest (esquema temporal en una base de pruebas aparte: rama de Neon `TEST_DATABASE_URL`) + GitHub Actions |

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
TEST_DATABASE_URL=postgresql+psycopg://...   # solo pytest: rama de Neon de pruebas (ver Tests)
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

La suite **nunca** corre contra la base principal: usa `TEST_DATABASE_URL`, una rama de Neon dedicada a pruebas.

1. En la consola de Neon: *Branches → Create branch* (p. ej. `pruebas`, desde `main`). Copia su cadena de conexión (la del endpoint de esa rama, con `postgresql+psycopg://` y `?sslmode=require`).
2. Ponla en tu `.env` (o en el entorno) como `TEST_DATABASE_URL=...`. No la copies en archivos versionados.
3. Corre:

```bash
py -m pytest backend/tests_fastapi -v
```

`conftest.py` se niega a correr (código de salida 4) si falta `TEST_DATABASE_URL` o si apunta a la misma base que `DATABASE_URL` (mismo host, con o sin `-pooler`, y misma base de datos). Antes de importar la app cambia `settings.database_url` por la de pruebas: la app, el seed, los scripts y las pruebas de migración solo ven esa rama.

Cada corrida crea un schema `test_<12 hex>` con una tabla `_test_meta` (hora, proceso y equipo que lo creó) y lo borra al terminar. Si una corrida muere antes (proceso cortado, equipo suspendido), la siguiente borra al iniciar los `test_<12 hex>` con `_test_meta` de más de 6 horas que nadie esté usando; nunca toca otros schemas.

En GitHub Actions, `TEST_DATABASE_URL` apunta al Postgres del propio job (`.github/workflows/tests.yml`).

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
