"""
Rate limiting / fuerza bruta en /api/auth/login (backend/service/core/rate_limit.py).

Usa un email que no existe en las cuentas demo para el caso "no bloquea" y
"bloquea", y la cuenta demo `ciudadano` para probar que un login exitoso no
cuenta como fallido. El fixture `client` de conftest.py es session-scoped
(se comparte con test_parity.py/test_business_flows.py), asi que el estado
del limiter (en memoria, vive en el proceso) se resetea antes y despues de
cada test de este archivo para no contaminar ni ser contaminado por otros
tests que tambien pegan a /api/auth/login.
"""
import pytest

from backend.service.core.rate_limit import reset_login_rate_limit

FAKE_EMAIL = "fuerza-bruta-test@tejido.co"
REAL_EMAIL = "ciudadano@tejido.co"
REAL_PASSWORD = "Ciudadano123!"
WRONG_PASSWORD = "clave-incorrecta"


@pytest.fixture(autouse=True)
def _clean_rate_limit_state():
    reset_login_rate_limit()
    yield
    reset_login_rate_limit()


def _login(client, email, password):
    return client.post("/api/auth/login", json={"email": email, "password": password})


def test_attempts_under_limit_are_not_blocked(client):
    for _ in range(4):
        resp = _login(client, FAKE_EMAIL, WRONG_PASSWORD)
        assert resp.status_code == 401
        assert resp.json()["error"] == "INVALID_CREDENTIALS"


def test_exceeding_limit_blocks_with_429(client):
    for _ in range(5):
        resp = _login(client, FAKE_EMAIL, WRONG_PASSWORD)
        assert resp.status_code == 401

    blocked = _login(client, FAKE_EMAIL, WRONG_PASSWORD)
    assert blocked.status_code == 429
    assert blocked.json()["error"] == "TOO_MANY_ATTEMPTS"


def test_successful_login_does_not_count_as_failure(client):
    for _ in range(4):
        resp = _login(client, REAL_EMAIL, WRONG_PASSWORD)
        assert resp.status_code == 401

    ok = _login(client, REAL_EMAIL, REAL_PASSWORD)
    assert ok.status_code == 200

    fifth_failure = _login(client, REAL_EMAIL, WRONG_PASSWORD)
    assert fifth_failure.status_code == 401

    sixth_failure = _login(client, REAL_EMAIL, WRONG_PASSWORD)
    assert sixth_failure.status_code == 429
