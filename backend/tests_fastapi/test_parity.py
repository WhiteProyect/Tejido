"""
Smoke test de dominio de la API (status codes y forma de respuesta) contra
el backend FastAPI + SQLAlchemy sobre PostgreSQL.

Decisiones de diseño ya aprobadas que estos tests fijan:
  - /api/support y /api/support/stats se RETIRARON (tabla `supporters` nunca
    existió en schema.sql; solo los llamaba JS vanilla muerto que no se sirve
    desde frontend/dist/index.html). Ver test_support_endpoints_removed.
  - PUT /api/artists/:id (y /timeline/:id, /media/:id) ahora FUNCIONAN: el bug
    de imports faltantes en backend/app.py no existe en FastAPI porque los
    routers se registran explícitamente. Ver test_artist_put_routes_fixed.

Ejecutar con:  py -m pytest backend/tests_fastapi -v
"""
import pytest

from backend.tests_fastapi._report import record

DEMO_USERS = {
    "admin": {"email": "admin@tejido.co", "password": "Admin123!", "role": "ADMIN"},
    "gestor": {"email": "gestor@tejido.co", "password": "Gestor123!", "role": "GESTOR"},
    "ciudadano": {"email": "ciudadano@tejido.co", "password": "Ciudadano123!", "role": "CIUDADANO"},
}


def hit(client, domain, name, method, path, **kwargs):
    resp = client.request(method, path, **kwargs)
    try:
        body = resp.json()
        if isinstance(body, dict):
            keys = sorted(body.keys())
        elif isinstance(body, list):
            keys = ["<list>"]
        else:
            keys = []
    except ValueError:
        keys = []
    record(domain, name, method, path, resp.status_code, resp.status_code < 500, body_keys=keys)
    return resp


@pytest.fixture(scope="session")
def tokens(client):
    result = {}
    for key, info in DEMO_USERS.items():
        resp = hit(
            client, "auth", f"login_{key}", "POST", "/api/auth/login",
            json={"email": info["email"], "password": info["password"]},
        )
        assert resp.status_code == 200, f"Login de la cuenta demo {key} debe funcionar"
        body = resp.json()
        assert body["user"]["role"] == info["role"]
        result[key] = body["token"]
    return result


def auth_header(tokens, who):
    return {"Authorization": f"Bearer {tokens[who]}"}


# ───────────────────────── auth ─────────────────────────

def test_health(client):
    resp = hit(client, "misc", "health", "GET", "/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_login_invalid_credentials(client):
    resp = hit(
        client, "auth", "login_invalid", "POST", "/api/auth/login",
        json={"email": "admin@tejido.co", "password": "contrasena-incorrecta"},
    )
    assert resp.status_code == 401


def test_me_matches_token(client, tokens):
    for who, info in DEMO_USERS.items():
        resp = hit(client, "auth", f"me_{who}", "GET", "/api/me", headers=auth_header(tokens, who))
        assert resp.status_code == 200
        assert resp.json()["user"]["role"] == info["role"]


def test_me_without_token_is_null(client):
    resp = hit(client, "auth", "me_anonymous", "GET", "/api/me")
    assert resp.status_code == 200
    assert resp.json()["user"] is None


def test_logout(client, tokens):
    login = hit(
        client, "auth", "login_for_logout", "POST", "/api/auth/login",
        json={"email": "ciudadano@tejido.co", "password": "Ciudadano123!"},
    )
    token = login.json()["token"]
    logout = hit(client, "auth", "logout", "POST", "/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert logout.status_code == 200
    after = hit(client, "auth", "me_after_logout", "GET", "/api/me", headers={"Authorization": f"Bearer {token}"})
    assert after.json()["user"] is None


# ───────────────────── categorías / publicaciones ─────────────────────

def test_categories(client):
    resp = hit(client, "publications", "categories", "GET", "/api/categories")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 5
    assert {c["type"] for c in data} == {"HISTORIA", "EVENTO", "OPORTUNIDAD", "TALENTO", "INICIATIVA"}


def test_publications_public_list_and_detail(client):
    resp = hit(client, "publications", "list_public", "GET", "/api/publications")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) > 0
    assert all(p["status"] == "PUBLISHED" for p in items)

    first_id = items[0]["id"]
    detail = hit(client, "publications", "detail_public", "GET", f"/api/publications/{first_id}")
    assert detail.status_code == 200
    assert detail.json()["id"] == first_id


def test_publication_create_requires_auth(client):
    resp = hit(
        client, "publications", "create_no_auth", "POST", "/api/publications",
        json={"kind": "HISTORIA", "category_id": 1, "title": "x" * 10, "summary": "y" * 20, "content": "z" * 30},
    )
    assert resp.status_code == 403


def test_publication_create_and_moderation_flow(client, tokens):
    create = hit(
        client, "publications", "create_as_gestor", "POST", "/api/publications",
        json={
            "kind": "HISTORIA",
            "category_id": 1,
            "title": "Smoke test de Fase 1",
            "summary": "Publicacion creada por el smoke test automatizado de Fase 1.",
            "content": "Contenido de prueba generado automaticamente para validar el flujo de "
                       "creacion y moderacion en el backend FastAPI.",
        },
        headers=auth_header(tokens, "gestor"),
    )
    assert create.status_code == 201
    pub_id = create.json()["id"]

    submit = hit(
        client, "publications", "submit_as_gestor", "POST",
        f"/api/publications/{pub_id}/submit", headers=auth_header(tokens, "gestor"),
    )
    assert submit.status_code == 200

    moderate = hit(
        client, "publications", "moderate_as_admin", "PATCH",
        f"/api/publications/{pub_id}/status", json={"status": "PUBLISHED"}, headers=auth_header(tokens, "admin"),
    )
    assert moderate.status_code == 200

    favorite = hit(
        client, "publications", "favorite_as_ciudadano", "POST",
        f"/api/publications/{pub_id}/favorite", headers=auth_header(tokens, "ciudadano"),
    )
    assert favorite.status_code == 200

    unfavorite = hit(
        client, "publications", "unfavorite_as_ciudadano", "DELETE",
        f"/api/publications/{pub_id}/favorite", headers=auth_header(tokens, "ciudadano"),
    )
    assert unfavorite.status_code == 200


# ───────────────────────── colaboradores ─────────────────────────

def test_collaborators_public_reads(client):
    for name, path in [
        ("ranking", "/api/collaborators/ranking"),
        ("rewards", "/api/collaborators/rewards"),
        ("stats", "/api/collaborators/stats"),
        ("activity_types", "/api/collaborators/activity-types"),
    ]:
        resp = hit(client, "collaborators", name, "GET", path)
        assert resp.status_code == 200


def test_collaborators_register_share_profile(client, tokens):
    profile_before = hit(
        client, "collaborators", "profile_before_register", "GET",
        "/api/collaborators/profile", headers=auth_header(tokens, "ciudadano"),
    )
    assert profile_before.status_code == 200
    already_registered = profile_before.json()["collaborator"] is not None

    register = hit(
        client, "collaborators", "register_as_ciudadano", "POST",
        "/api/collaborators/register", headers=auth_header(tokens, "ciudadano"),
    )
    if already_registered:
        assert register.status_code == 400
    else:
        assert register.status_code == 201

    profile_after = hit(
        client, "collaborators", "profile_after_register", "GET",
        "/api/collaborators/profile", headers=auth_header(tokens, "ciudadano"),
    )
    assert profile_after.status_code == 200
    assert profile_after.json()["collaborator"] is not None


# ───────────────────────── artistas ─────────────────────────

def test_artists_list_and_home(client):
    listing = hit(client, "artists", "list", "GET", "/api/artists")
    assert listing.status_code == 200
    assert len(listing.json()) > 0

    home = hit(client, "artists", "home", "GET", "/api/artists/home")
    assert home.status_code == 200


def test_artist_profile_endpoints(client):
    slug = "og-mauro"
    for name, path in [
        ("profile", f"/api/artists/{slug}"),
        ("media_kit", f"/api/artists/{slug}/media-kit"),
        ("music", f"/api/artists/{slug}/music"),
        ("timeline", f"/api/artists/{slug}/timeline"),
        ("media", f"/api/artists/{slug}/media"),
        ("social", f"/api/artists/{slug}/social"),
        ("connections", f"/api/artists/{slug}/connections"),
    ]:
        resp = hit(client, "artists", name, "GET", path)
        assert resp.status_code == 200


def test_artist_dashboard_owner_vs_stranger(client, tokens):
    profile = hit(client, "artists", "profile_for_dashboard_id", "GET", "/api/artists/og-mauro")
    artist_id = profile.json()["artist"]["id"]

    owner = hit(
        client, "artists", "dashboard_as_owner_gestor", "GET",
        f"/api/artists/{artist_id}/dashboard", headers=auth_header(tokens, "gestor"),
    )
    assert owner.status_code == 200

    stranger = hit(
        client, "artists", "dashboard_as_ciudadano", "GET",
        f"/api/artists/{artist_id}/dashboard", headers=auth_header(tokens, "ciudadano"),
    )
    assert stranger.status_code == 403


def test_artist_timeline_crud(client, tokens):
    profile = hit(client, "artists", "profile_for_timeline_crud", "GET", "/api/artists/og-mauro")
    artist_id = profile.json()["artist"]["id"]

    created = hit(
        client, "artists", "create_timeline_entry", "POST",
        f"/api/artists/{artist_id}/timeline", json={"titulo": "Hito de prueba (smoke test Fase 1)"},
        headers=auth_header(tokens, "gestor"),
    )
    assert created.status_code == 201
    entry_id = created.json()["id"]

    deleted = hit(
        client, "artists", "delete_timeline_entry", "DELETE",
        f"/api/artists/{artist_id}/timeline/{entry_id}", headers=auth_header(tokens, "gestor"),
    )
    assert deleted.status_code == 200


# ───────────────────────── admin ─────────────────────────

def test_admin_endpoints_require_admin_role(client, tokens):
    stats_forbidden = hit(
        client, "admin", "stats_forbidden", "GET", "/api/admin/stats", headers=auth_header(tokens, "ciudadano"),
    )
    assert stats_forbidden.status_code == 403

    stats_ok = hit(client, "admin", "stats_as_admin", "GET", "/api/admin/stats", headers=auth_header(tokens, "admin"))
    assert stats_ok.status_code == 200

    suggestions = hit(
        client, "admin", "suggestions_as_admin", "GET", "/api/admin/suggestions", headers=auth_header(tokens, "admin"),
    )
    assert suggestions.status_code == 200


def test_suggestions_public_create(client):
    resp = hit(
        client, "misc", "create_suggestion", "POST", "/api/suggestions",
        json={"message": "Sugerencia de prueba generada por el smoke test de Fase 1."},
    )
    assert resp.status_code == 201


# ───────── decisiones de Fase 1 sobre los bugs de la Fase 0 ─────────

def test_support_endpoints_removed(client):
    """/api/support y /api/support/stats se retiraron a propósito (ver el
    docstring del módulo). Cualquier /api/* no encontrado debe dar 404 JSON
    real (nunca el HTML del SPA, que es el fallback correcto solo para rutas
    de frontend desconocidas)."""
    stats = hit(client, "misc", "support_stats_removed", "GET", "/api/support/stats")
    assert stats.status_code == 404
    assert stats.json()["error"] == "NOT_FOUND"


def test_artist_put_routes_fixed(client, tokens):
    """Regresión positiva: el bug de imports faltantes de la Fase 0
    (route_put_artist* no importadas en backend/app.py) ya no puede existir
    en FastAPI porque los routers se registran explícitamente. Antes esto
    cortaba la conexión sin respuesta; ahora debe responder 200."""
    profile = hit(client, "artists", "profile_for_put_fix", "GET", "/api/artists/og-mauro")
    artist_id = profile.json()["artist"]["id"]
    resp = hit(
        client, "artists", "put_artist_now_works", "PUT",
        f"/api/artists/{artist_id}", json={"bio": "actualizado via PUT en el backend FastAPI"},
        headers=auth_header(tokens, "gestor"),
    )
    assert resp.status_code == 200

    timeline_entry = hit(
        client, "artists", "create_timeline_for_put_fix", "POST",
        f"/api/artists/{artist_id}/timeline", json={"titulo": "Hito para probar PUT"},
        headers=auth_header(tokens, "gestor"),
    )
    entry_id = timeline_entry.json()["id"]
    put_timeline = hit(
        client, "artists", "put_artist_timeline_now_works", "PUT",
        f"/api/artists/{artist_id}/timeline/{entry_id}", json={"titulo": "Hito actualizado via PUT"},
        headers=auth_header(tokens, "gestor"),
    )
    assert put_timeline.status_code == 200
