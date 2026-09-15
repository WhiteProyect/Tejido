"""Copia aislada de backend/tests/_report.py para que esta suite no comparta
la lista RESULTS con backend/tests/ si ambas corren en el mismo proceso pytest.
"""

RESULTS = []


def record(domain, name, method, path, status_code, ok, notes="", body_keys=None):
    RESULTS.append(
        {
            "domain": domain,
            "name": name,
            "method": method,
            "path": path,
            "status_code": status_code,
            "ok": ok,
            "notes": notes,
            "body_keys": body_keys or [],
        }
    )
