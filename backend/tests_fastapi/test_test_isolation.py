"""Aislamiento de la suite (conftest.py): no corre contra la base principal y limpia lo que dejan las
corridas muertas. Las pruebas de limpieza crean schemas en la rama de pruebas y los borran al final.
"""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine, text

from backend.service.core.config import settings
from backend.tests_fastapi import conftest

MAIN = "postgresql+psycopg://u:clave@ep-principal-123-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"


@pytest.mark.parametrize("test_url", [
    "",
    MAIN,
    MAIN.replace("-pooler.", "."),  # el endpoint directo de la misma base
    MAIN.replace("u:clave", "otro:otra"),  # otro usuario, misma base
    "esto no es una url",
])
def test_refuses_missing_or_main_database(monkeypatch, test_url):
    monkeypatch.setattr(settings, "database_url", MAIN)
    monkeypatch.setattr(settings, "test_database_url", test_url)
    with pytest.raises(pytest.exit.Exception):
        conftest._test_database_url()


def test_accepts_another_branch(monkeypatch):
    other = MAIN.replace("ep-principal-123", "ep-pruebas-456")
    monkeypatch.setattr(settings, "database_url", MAIN)
    monkeypatch.setattr(settings, "test_database_url", other)
    assert conftest._test_database_url() == other


def test_suite_runs_on_the_test_branch():
    assert conftest._target(settings.database_url) == conftest._target(settings.test_database_url)


def test_drops_only_stale_marked_test_schemas():
    engine = create_engine(settings.database_url.replace("-pooler.", "."))
    hexes = [uuid.uuid4().hex[:12] for _ in range(4)]
    stale, fresh, unmarked = (f"test_{h}" for h in hexes[:3])
    other = f"test_mig_{hexes[3]}"  # otro patron: no se toca aunque sea viejo
    old = datetime.now(timezone.utc) - conftest.STALE_AFTER - timedelta(minutes=5)
    try:
        with engine.begin() as conn:
            for name, created in ((stale, old), (fresh, datetime.now(timezone.utc)), (other, old)):
                conn.execute(text(f'CREATE SCHEMA "{name}"'))
                conn.execute(text(f'CREATE TABLE "{name}"._test_meta (created_at timestamptz NOT NULL, pid integer NOT NULL, host text NOT NULL)'))
                conn.execute(text(f'INSERT INTO "{name}"._test_meta VALUES (:c, 1, :h)'), {"c": created, "h": "prueba"})
            conn.execute(text(f'CREATE SCHEMA "{unmarked}"'))
        conftest._drop_stale_schemas(engine)
        with engine.connect() as conn:
            left = {r[0] for r in conn.execute(text("SELECT nspname FROM pg_namespace WHERE nspname = ANY(:n)"),
                                                {"n": [stale, fresh, unmarked, other]})}
        assert left == {fresh, unmarked, other}
    finally:
        with engine.begin() as conn:
            for name in (stale, fresh, unmarked, other):
                conn.execute(text(f'DROP SCHEMA IF EXISTS "{name}" CASCADE'))
        engine.dispose()
