"""
Fase 2: arranca la app FastAPI contra un SCHEMA temporal y aislado dentro del
mismo Postgres real (Neon) -- nunca contra el schema `public` que ya tiene
los datos migrados de produccion. Se crea, se siembra (backend/service/seed.py)
y se destruye en cada corrida de la suite.
"""
import json
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

REPORT_PATH = Path(__file__).resolve().parent / "baseline_report_fastapi.json"


@pytest.fixture(scope="session")
def client():
    from backend.service.core.config import settings
    from backend.service.db.session import get_db
    from backend.service.main import app
    from backend.service.models.tables import Base
    from backend.service.seed import seed_database

    # El pooler de Neon (pgbouncer, modo transaccion) rechaza el parametro de
    # arranque `options=-csearch_path=...` que necesitamos para aislar los
    # tests en un schema temporal. Para ESTA conexion de test se usa el
    # endpoint directo de Neon (sin "-pooler" en el host); la app en si sigue
    # usando settings.database_url (pooled) tal cual en runtime normal.
    direct_url = settings.database_url.replace("-pooler.", ".")

    schema = f"test_{uuid.uuid4().hex[:12]}"
    admin_engine = create_engine(direct_url)
    with admin_engine.begin() as conn:
        conn.execute(text(f'CREATE SCHEMA "{schema}"'))

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
        # Pase lo que pase arriba, nunca dejar un schema de test huerfano en Neon.
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
