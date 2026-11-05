"""
La suite corre contra una base APARTE de la principal: TEST_DATABASE_URL (una rama de Neon dedicada a
pruebas), en el entorno o en el .env. Sin ella, o si apunta a la misma base que DATABASE_URL, la suite
no arranca. Antes de importar la app, settings.database_url se cambia por esa URL: la app, el seed,
los scripts y las pruebas de migracion solo ven la rama de pruebas.

Cada corrida crea un schema test_<12 hex> con una tabla _test_meta (hora y proceso que lo creo), lo
siembra (backend/service/seed.py) y lo borra al terminar. Si una corrida muere sin llegar a borrarlo
(proceso cortado, equipo suspendido), la siguiente borra al iniciar los test_<12 hex> con _test_meta
de mas de STALE_AFTER que nadie este usando.
"""
import json
import os
import re
import socket
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

from backend.service.core.config import settings

REPORT_PATH = Path(__file__).resolve().parent / "baseline_report_fastapi.json"
SCHEMA_NAME = re.compile(r"^test_[0-9a-f]{12}$")
STALE_AFTER = timedelta(hours=6)


def _target(url: str) -> tuple[str, str]:
    """(host sin "-pooler", base) para comparar dos URLs de Neon sin mirar la clave."""
    parsed = make_url(url)
    return ((parsed.host or "").lower().replace("-pooler.", "."), parsed.database or "")


def _test_database_url() -> str:
    url = (settings.test_database_url or "").strip()
    if not url:
        pytest.exit("Falta TEST_DATABASE_URL (rama de pruebas de Neon). Ver README, seccion "
                    "'Pruebas del backend'. La suite no corre contra la base principal.", returncode=4)
    try:
        test_target, main_target = _target(url), _target(settings.database_url)
    except Exception:
        pytest.exit("TEST_DATABASE_URL no es una URL de base de datos valida.", returncode=4)
    if not test_target[0] or test_target == main_target:
        pytest.exit("TEST_DATABASE_URL apunta a la base principal (mismo host y base que DATABASE_URL): "
                    "la suite no corre ahi. Usa la rama de pruebas.", returncode=4)
    return url


# Antes de que cualquier modulo cree el motor de la app (backend/service/db/session.py lo crea al
# importarse): desde aqui todo lo que lea settings.database_url ve la rama de pruebas.
settings.database_url = _test_database_url()


def _drop_stale_schemas(engine) -> None:
    """Borra los test_<12 hex> que dejaron corridas muertas: solo los que tienen _test_meta, con mas
    de STALE_AFTER y sin bloqueos de otras conexiones. Nunca otro schema."""
    with engine.begin() as conn:
        rows = conn.execute(text("SELECT oid, nspname FROM pg_namespace WHERE nspname ~ :pattern"),
                            {"pattern": SCHEMA_NAME.pattern}).all()
        for oid, name in rows:
            if not SCHEMA_NAME.match(name):
                continue
            if conn.execute(text("SELECT to_regclass(:t)"), {"t": f'"{name}"._test_meta'}).scalar_one() is None:
                continue
            created = conn.execute(text(f'SELECT min(created_at) FROM "{name}"._test_meta')).scalar_one()
            if created is None or datetime.now(timezone.utc) - created < STALE_AFTER:
                continue
            locks = conn.execute(text(
                "SELECT count(*) FROM pg_locks l JOIN pg_class c ON c.oid = l.relation "
                "WHERE c.relnamespace = :oid AND l.pid <> pg_backend_pid()"), {"oid": oid}).scalar_one()
            if locks:
                continue
            conn.execute(text(f'DROP SCHEMA "{name}" CASCADE'))


@pytest.fixture(scope="session")
def client():
    from backend.service.db.session import get_db
    from backend.service.main import app
    from backend.service.models.tables import Base
    from backend.service.seed import seed_database

    # El pooler de Neon (pgbouncer, modo transaccion) rechaza el parametro de arranque
    # `options=-csearch_path=...` que aisla los tests en su schema: se usa el endpoint directo.
    direct_url = settings.database_url.replace("-pooler.", ".")

    schema = f"test_{uuid.uuid4().hex[:12]}"
    admin_engine = create_engine(direct_url)
    _drop_stale_schemas(admin_engine)
    # Schema y _test_meta en la misma transaccion: nadie ve el schema sin su marca.
    with admin_engine.begin() as conn:
        conn.execute(text(f'CREATE SCHEMA "{schema}"'))
        conn.execute(text(f'CREATE TABLE "{schema}"._test_meta (created_at timestamptz NOT NULL DEFAULT now(), '
                          'pid integer NOT NULL, host text NOT NULL)'))
        conn.execute(text(f'INSERT INTO "{schema}"._test_meta (pid, host) VALUES (:pid, :host)'),
                     {"pid": os.getpid(), "host": socket.gethostname()})

    try:
        test_engine = create_engine(direct_url, connect_args={"options": f"-csearch_path={schema}"})
        try:
            Base.metadata.create_all(bind=test_engine)
            TestSessionLocal = sessionmaker(bind=test_engine, autoflush=False, autocommit=False)

            seed_db = TestSessionLocal()
            try:
                seed_database(seed_db)
                # El gestor demo (user 2) no tiene rama en el seed y un gestor sin rama no puede
                # publicar (409). Solo en el schema de test se le da una que ningun test filtra.
                seed_db.execute(text("UPDATE organizations SET branch = 'PATRIMONIO_MEMORIA' WHERE user_id = 2"))
                seed_db.commit()
            finally:
                seed_db.close()

            def override_get_db():
                db = TestSessionLocal()
                try:
                    yield db
                    db.commit()
                except Exception:
                    db.rollback()
                    raise
                finally:
                    db.close()

            app.dependency_overrides[get_db] = override_get_db
            try:
                with TestClient(app) as test_client:
                    yield test_client
            finally:
                app.dependency_overrides.clear()
        finally:
            test_engine.dispose()
    finally:
        with admin_engine.begin() as conn:
            conn.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
        admin_engine.dispose()


@pytest.fixture(autouse=True)
def _no_real_email(monkeypatch):
    """Ningun test golpea Resend, aunque el .env tenga RESEND_API_KEY y SUPPORT_EMAIL: el envio
    real falla siempre (como sin API key). Los tests que revisan avisos reemplazan las funciones
    de services/email.py por encima de esto."""
    import resend

    def blocked(*args, **kwargs):
        raise RuntimeError("Resend bloqueado en los tests")

    monkeypatch.setattr(resend.Emails, "send", blocked)


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    # Los limites viven en memoria y son por IP: todos los tests comparten la IP del TestClient.
    from backend.service.core.rate_limit import reset_login_rate_limit

    reset_login_rate_limit()
    yield
    reset_login_rate_limit()


@pytest.fixture(scope="session", autouse=True)
def _write_baseline_report():
    yield
    from backend.tests_fastapi._report import RESULTS

    REPORT_PATH.write_text(json.dumps(RESULTS, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n[Fase 2] Reporte de linea base (FastAPI + Postgres) escrito en: {REPORT_PATH}")
