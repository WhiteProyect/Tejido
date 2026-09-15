"""
Fase 4 del plan de migracion TEJIDO -- cobertura de flujos de negocio que
test_parity.py (Fase 1, smoke de paridad) no ejercita: imagenes de
publicaciones, reportes, edicion/borrado de publicaciones, la economia de
colaboradores (compartir/reportar actividad/canjear), sub-recursos de
artistas (media/social/connections/metrics) y las ramas de error 400/403/404
que antes solo se probaban en el happy path.

Reutiliza el mismo client/tokens de conftest.py (schema aislado en Neon,
sembrado con backend/service/seed.py) y el helper hit()/auth_header() de
test_parity.py para no duplicar el logging del reporte.

Convencion para no chocar con las cuentas usadas en test_parity.py:
  - "gestor" es la cuenta dedicada a los tests de colaboradores aqui (en
    test_parity.py solo "ciudadano" se registra como colaborador), asi los
    dos archivos no compiten por los mismos puntos/registro.
  - Las publicaciones que necesitan un id PUBLISHED real (favoritos, reportes)
    usan la primera publicacion sembrada por seed_database, no una creada
    por el propio test, para no depender del flujo completo de moderacion.

Ejecutar con:  py -m pytest backend/tests_fastapi -v
"""
import pytest

from backend.tests_fastapi.test_parity import DEMO_USERS, auth_header, hit, tokens  # noqa: F401


@pytest.fixture(scope="module")
def category_ids(client):
    resp = client.get("/api/categories")
    return {c["type"]: c["id"] for c in resp.json()}


@pytest.fixture(scope="module")
def published_publication_id(client):
    resp = client.get("/api/publications")
    items = resp.json()
    assert items, "El seed debe dejar al menos una publicacion PUBLISHED"
    return items[0]["id"]


@pytest.fixture(scope="module")
def artist_id(client):
    resp = client.get("/api/artists/og-mauro")
    return resp.json()["artist"]["id"]


def create_publication(client, tokens, category_ids, who="gestor", kind="HISTORIA", **overrides):
    payload = {
        "kind": kind,
        "category_id": category_ids[kind],
        "title": overrides.pop("title", "Publicacion de prueba Fase 4"),
        "summary": overrides.pop(
            "summary", "Resumen de prueba generado por los tests de Fase 4 de la migracion."
        ),
        "content": overrides.pop(
            "content",
            "Contenido de prueba generado automaticamente para ejercitar flujos de negocio "
            "que antes no tenian ningun test.",
        ),
        **overrides,
    }
    resp = hit(
        client, "business", f"create_pub_{who}_{kind}", "POST", "/api/publications",
        json=payload, headers=auth_header(tokens, who),
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


# ───────────────────────── imagenes de publicaciones ─────────────────────────

def test_publication_images_crud_and_permissions(client, tokens, category_ids):
    pub_id = create_publication(client, tokens, category_ids, who="gestor")

    # GET publico sobre una publicacion DRAFT (no PUBLISHED) sin auth -> 403
    anon_get = hit(
        client, "business", "images_get_anon_draft", "GET",
        f"/api/publications/{pub_id}/images",
    )
    assert anon_get.status_code == 403

    # POST como no-dueno (ciudadano, ni autor ni admin) -> 403
    forbidden = hit(
        client, "business", "image_add_not_owner", "POST",
        f"/api/publications/{pub_id}/images", json={"url": "https://example.com/foto.jpg"},
        headers=auth_header(tokens, "ciudadano"),
    )
    assert forbidden.status_code == 403

    # POST con URL no-HTTPS -> 400
    bad_url = hit(
        client, "business", "image_add_bad_url", "POST",
        f"/api/publications/{pub_id}/images", json={"url": "ftp://example.com/foto.jpg"},
        headers=auth_header(tokens, "gestor"),
    )
    assert bad_url.status_code == 400
    assert bad_url.json()["error"] == "VALIDATION"

    # POST valido como dueno -> 201, position 0 (primera imagen)
    created = hit(
        client, "business", "image_add_ok", "POST",
        f"/api/publications/{pub_id}/images", json={"url": "https://example.com/foto.jpg"},
        headers=auth_header(tokens, "gestor"),
    )
    assert created.status_code == 201, created.text
    assert created.json()["position"] == 0
    image_id = created.json()["id"]

    # POST con position duplicada -> 409
    conflict = hit(
        client, "business", "image_add_conflict", "POST",
        f"/api/publications/{pub_id}/images",
        json={"url": "https://example.com/otra.jpg", "position": 0},
        headers=auth_header(tokens, "gestor"),
    )
    assert conflict.status_code == 409
    assert conflict.json()["error"] == "CONFLICT"

    # GET como dueno -> 200, la imagen creada aparece
    owner_get = hit(
        client, "business", "images_get_owner", "GET",
        f"/api/publications/{pub_id}/images", headers=auth_header(tokens, "gestor"),
    )
    assert owner_get.status_code == 200
    assert any(img["id"] == image_id for img in owner_get.json())

    # DELETE como no-dueno -> 403
    delete_forbidden = hit(
        client, "business", "image_delete_not_owner", "DELETE",
        f"/api/publications/{pub_id}/images/{image_id}", headers=auth_header(tokens, "ciudadano"),
    )
    assert delete_forbidden.status_code == 403

    # DELETE como dueno -> 200
    delete_ok = hit(
        client, "business", "image_delete_ok", "DELETE",
        f"/api/publications/{pub_id}/images/{image_id}", headers=auth_header(tokens, "gestor"),
    )
    assert delete_ok.status_code == 200

    # DELETE de nuevo (ya no existe) -> 404
    delete_again = hit(
        client, "business", "image_delete_again", "DELETE",
        f"/api/publications/{pub_id}/images/{image_id}", headers=auth_header(tokens, "gestor"),
    )
    assert delete_again.status_code == 404


# ───────────────────────── reportar publicacion ─────────────────────────

def test_publication_report(client, tokens, published_publication_id):
    no_auth = hit(
        client, "business", "report_pub_no_auth", "POST",
        f"/api/publications/{published_publication_id}/report", json={"reason": "motivo valido"},
    )
    assert no_auth.status_code == 401

    too_short = hit(
        client, "business", "report_pub_short_reason", "POST",
        f"/api/publications/{published_publication_id}/report", json={"reason": "abc"},
        headers=auth_header(tokens, "ciudadano"),
    )
    assert too_short.status_code == 400

    not_found = hit(
        client, "business", "report_pub_not_found", "POST",
        "/api/publications/999999999/report", json={"reason": "motivo suficientemente largo"},
        headers=auth_header(tokens, "ciudadano"),
    )
    assert not_found.status_code == 404

    ok = hit(
        client, "business", "report_pub_ok", "POST",
        f"/api/publications/{published_publication_id}/report",
        json={"reason": "Motivo de reporte suficientemente detallado"},
        headers=auth_header(tokens, "ciudadano"),
    )
    assert ok.status_code == 201


# ───────────────────────── editar / borrar publicaciones ─────────────────────────

def test_publication_update_permissions_and_state(client, tokens, category_ids):
    pub_id = create_publication(client, tokens, category_ids, who="gestor", title="Editar - Fase 4")

    payload = {
        "kind": "HISTORIA",
        "category_id": category_ids["HISTORIA"],
        "title": "Editar - Fase 4 (actualizado)",
        "summary": "Resumen actualizado por el test de edicion de Fase 4.",
        "content": "Contenido actualizado por el test de edicion de Fase 4, con longitud suficiente.",
    }

    # Rol sin permiso de edicion (CIUDADANO no es GESTOR/ADMIN) -> 403
    role_forbidden = hit(
        client, "business", "update_pub_role_forbidden", "PUT",
        f"/api/publications/{pub_id}", json=payload, headers=auth_header(tokens, "ciudadano"),
    )
    assert role_forbidden.status_code == 403

    # GESTOR valido, dueno, en DRAFT -> 200
    ok = hit(
        client, "business", "update_pub_ok", "PUT",
        f"/api/publications/{pub_id}", json=payload, headers=auth_header(tokens, "gestor"),
    )
    assert ok.status_code == 200

    # Enviar a revision y luego intentar editar como GESTOR -> 409 (no esta en DRAFT/REJECTED)
    submit = hit(
        client, "business", "update_pub_submit", "POST",
        f"/api/publications/{pub_id}/submit", headers=auth_header(tokens, "gestor"),
    )
    assert submit.status_code == 200

    invalid_state = hit(
        client, "business", "update_pub_invalid_state", "PUT",
        f"/api/publications/{pub_id}", json=payload, headers=auth_header(tokens, "gestor"),
    )
    assert invalid_state.status_code == 409

    # ADMIN si puede editar contenido en REVIEW (no aplica la restriccion de estado)
    admin_edit = hit(
        client, "business", "update_pub_admin_bypass", "PUT",
        f"/api/publications/{pub_id}", json=payload, headers=auth_header(tokens, "admin"),
    )
    assert admin_edit.status_code == 200

    # Publicacion de otro autor (admin) editada por gestor (no dueno) -> 403
    admin_pub_id = create_publication(
        client, tokens, category_ids, who="admin", title="Editar - Fase 4 (de admin)"
    )
    not_owner = hit(
        client, "business", "update_pub_not_owner", "PUT",
        f"/api/publications/{admin_pub_id}", json=payload, headers=auth_header(tokens, "gestor"),
    )
    assert not_owner.status_code == 403


def test_publication_delete_permissions(client, tokens, category_ids):
    pub_id = create_publication(client, tokens, category_ids, who="gestor", title="Borrar - Fase 4")

    role_forbidden = hit(
        client, "business", "delete_pub_role_forbidden", "DELETE",
        f"/api/publications/{pub_id}", headers=auth_header(tokens, "ciudadano"),
    )
    assert role_forbidden.status_code == 403

    ok = hit(
        client, "business", "delete_pub_ok", "DELETE",
        f"/api/publications/{pub_id}", headers=auth_header(tokens, "gestor"),
    )
    assert ok.status_code == 200

    # El borrado es logico (deleted=True): el detalle ya no se puede ver.
    after = hit(
        client, "business", "delete_pub_then_get", "GET",
        f"/api/publications/{pub_id}", headers=auth_header(tokens, "gestor"),
    )
    assert after.status_code == 404

    # Un id que nunca existio (o ya no es tuyo) no distingue 404 de 403: el
    # UPDATE no afecta filas y la ruta responde 403 "No puedes eliminar este
    # contenido" (mismo comportamiento que el backend legado, documentado
    # aqui a proposito -- no es un bug nuevo de la migracion).
    missing = hit(
        client, "business", "delete_pub_missing_id", "DELETE",
        "/api/publications/999999999", headers=auth_header(tokens, "gestor"),
    )
    assert missing.status_code == 403


# ───────────────────────── economia de colaboradores ─────────────────────────
# Se usa la cuenta "gestor" (no "ciudadano") para no interferir con el
# registro/puntos que test_parity.py ya ejercita sobre "ciudadano".

def test_collaborators_economy_flow(client, tokens):
    profile_before = hit(
        client, "business", "collab_profile_before", "GET",
        "/api/collaborators/profile", headers=auth_header(tokens, "gestor"),
    )
    already_registered = profile_before.json()["collaborator"] is not None

    register = hit(
        client, "business", "collab_register", "POST",
        "/api/collaborators/register", headers=auth_header(tokens, "gestor"),
    )
    if already_registered:
        assert register.status_code == 400
    else:
        assert register.status_code == 201
        assert register.json()["points"] == 0

    # Compartir sin autenticacion -> 401
    share_no_auth = hit(
        client, "business", "collab_share_no_auth", "POST", "/api/collaborators/share", json={},
    )
    assert share_no_auth.status_code == 401

    # Compartir sin publication_id -> 400
    share_bad = hit(
        client, "business", "collab_share_bad", "POST", "/api/collaborators/share", json={},
        headers=auth_header(tokens, "gestor"),
    )
    assert share_bad.status_code == 400

    # Canjear sin puntos suficientes: recompensa mas barata del catalogo cuesta
    # 100 puntos y "gestor" solo se registra en este test (0 puntos hasta ahora).
    rewards = hit(client, "business", "collab_rewards_catalog", "GET", "/api/collaborators/rewards")
    cheapest = min(rewards.json(), key=lambda r: r["points_cost"])

    insufficient = hit(
        client, "business", "collab_redeem_insufficient", "POST", "/api/collaborators/redeem",
        json={"reward_id": cheapest["id"]}, headers=auth_header(tokens, "gestor"),
    )
    assert insufficient.status_code == 400

    # Canjear sin reward_id -> 400
    redeem_no_id = hit(
        client, "business", "collab_redeem_no_id", "POST", "/api/collaborators/redeem", json={},
        headers=auth_header(tokens, "gestor"),
    )
    assert redeem_no_id.status_code == 400

    # Canjear una recompensa inexistente -> 400
    redeem_missing = hit(
        client, "business", "collab_redeem_missing_reward", "POST", "/api/collaborators/redeem",
        json={"reward_id": 999999}, headers=auth_header(tokens, "gestor"),
    )
    assert redeem_missing.status_code == 400

    # Reportar actividad sin autenticacion -> 401
    report_no_auth = hit(
        client, "business", "collab_report_no_auth", "POST", "/api/collaborators/report", json={},
    )
    assert report_no_auth.status_code == 401

    # Reportar actividad con campos vacios -> 400
    report_empty = hit(
        client, "business", "collab_report_empty", "POST", "/api/collaborators/report", json={},
        headers=auth_header(tokens, "gestor"),
    )
    assert report_empty.status_code == 400

    # Reportar un tipo de actividad que no existe en activity_types -> 400
    report_bad_type = hit(
        client, "business", "collab_report_bad_type", "POST", "/api/collaborators/report",
        json={"type": "TIPO_QUE_NO_EXISTE", "description": "Una descripcion cualquiera"},
        headers=auth_header(tokens, "gestor"),
    )
    assert report_bad_type.status_code == 400

    # Reportar actividad valida -> 201, suma puntos
    report_ok = hit(
        client, "business", "collab_report_ok", "POST", "/api/collaborators/report",
        json={"type": "EVENT_ATTEND", "description": "Asisti a un evento de prueba de Fase 4"},
        headers=auth_header(tokens, "gestor"),
    )
    assert report_ok.status_code == 201
    assert report_ok.json()["points_earned"] == 20


def test_collaborators_share_publication_flow(client, tokens, published_publication_id):
    # Compartir una publicacion real (gestor ya deberia estar registrado por
    # test_collaborators_economy_flow, que corre antes en este mismo archivo).
    share_ok = hit(
        client, "business", "collab_share_ok", "POST", "/api/collaborators/share",
        json={"publication_id": published_publication_id}, headers=auth_header(tokens, "gestor"),
    )
    assert share_ok.status_code == 200
    assert share_ok.json()["points_earned"] == 10

    # Compartir la misma publicacion otra vez no debe dar puntos de nuevo.
    share_again = hit(
        client, "business", "collab_share_again", "POST", "/api/collaborators/share",
        json={"publication_id": published_publication_id}, headers=auth_header(tokens, "gestor"),
    )
    assert share_again.status_code == 200
    assert share_again.json()["points_earned"] == 0


# ───────────────────────── sub-recursos de artistas ─────────────────────────

def test_artist_media_crud_and_permissions(client, tokens, artist_id):
    forbidden = hit(
        client, "business", "artist_media_forbidden", "POST",
        f"/api/artists/{artist_id}/media", json={"url": "https://example.com/img.jpg"},
        headers=auth_header(tokens, "ciudadano"),
    )
    assert forbidden.status_code == 403

    created = hit(
        client, "business", "artist_media_create", "POST",
        f"/api/artists/{artist_id}/media", json={"url": "https://example.com/img.jpg", "tipo": "image"},
        headers=auth_header(tokens, "gestor"),
    )
    assert created.status_code == 201, created.text
    media_id = created.json()["id"]

    update_forbidden = hit(
        client, "business", "artist_media_update_forbidden", "PUT",
        f"/api/artists/{artist_id}/media/{media_id}", json={"titulo": "no deberia aplicar"},
        headers=auth_header(tokens, "ciudadano"),
    )
    assert update_forbidden.status_code == 403

    update_ok = hit(
        client, "business", "artist_media_update_ok", "PUT",
        f"/api/artists/{artist_id}/media/{media_id}", json={"titulo": "Actualizado por Fase 4/6"},
        headers=auth_header(tokens, "gestor"),
    )
    assert update_ok.status_code == 200

    update_missing = hit(
        client, "business", "artist_media_update_missing", "PUT",
        f"/api/artists/{artist_id}/media/999999999", json={"titulo": "no existe"},
        headers=auth_header(tokens, "gestor"),
    )
    assert update_missing.status_code == 404

    delete_forbidden = hit(
        client, "business", "artist_media_delete_forbidden", "DELETE",
        f"/api/artists/{artist_id}/media/{media_id}", headers=auth_header(tokens, "ciudadano"),
    )
    assert delete_forbidden.status_code == 403

    delete_ok = hit(
        client, "business", "artist_media_delete_ok", "DELETE",
        f"/api/artists/{artist_id}/media/{media_id}", headers=auth_header(tokens, "gestor"),
    )
    assert delete_ok.status_code == 200

    delete_again = hit(
        client, "business", "artist_media_delete_again", "DELETE",
        f"/api/artists/{artist_id}/media/{media_id}", headers=auth_header(tokens, "gestor"),
    )
    assert delete_again.status_code == 404


def test_artist_social_crud_and_permissions(client, tokens, artist_id):
    forbidden = hit(
        client, "business", "artist_social_forbidden", "POST",
        f"/api/artists/{artist_id}/social", json={"platform": "twitter", "url": "https://x.com/ogmauro"},
        headers=auth_header(tokens, "ciudadano"),
    )
    assert forbidden.status_code == 403

    missing_fields = hit(
        client, "business", "artist_social_missing_fields", "POST",
        f"/api/artists/{artist_id}/social", json={"platform": "twitter"},
        headers=auth_header(tokens, "gestor"),
    )
    assert missing_fields.status_code == 400

    created = hit(
        client, "business", "artist_social_create", "POST",
        f"/api/artists/{artist_id}/social", json={"platform": "twitter", "url": "https://x.com/ogmauro"},
        headers=auth_header(tokens, "gestor"),
    )
    assert created.status_code == 201, created.text
    link_id = created.json()["id"]

    delete_ok = hit(
        client, "business", "artist_social_delete_ok", "DELETE",
        f"/api/artists/{artist_id}/social/{link_id}", headers=auth_header(tokens, "gestor"),
    )
    assert delete_ok.status_code == 200

    delete_again = hit(
        client, "business", "artist_social_delete_again", "DELETE",
        f"/api/artists/{artist_id}/social/{link_id}", headers=auth_header(tokens, "gestor"),
    )
    assert delete_again.status_code == 404


def test_artist_connections_crud_and_permissions(client, tokens, artist_id):
    forbidden = hit(
        client, "business", "artist_connection_forbidden", "POST",
        f"/api/artists/{artist_id}/connections", json={"entity_type": "place", "titulo": "Caucasia"},
        headers=auth_header(tokens, "ciudadano"),
    )
    assert forbidden.status_code == 403

    missing_fields = hit(
        client, "business", "artist_connection_missing_fields", "POST",
        f"/api/artists/{artist_id}/connections", json={"entity_type": "place"},
        headers=auth_header(tokens, "gestor"),
    )
    assert missing_fields.status_code == 400

    created = hit(
        client, "business", "artist_connection_create", "POST",
        f"/api/artists/{artist_id}/connections", json={"entity_type": "place", "titulo": "Caucasia"},
        headers=auth_header(tokens, "gestor"),
    )
    assert created.status_code == 201, created.text
    connection_id = created.json()["id"]

    delete_ok = hit(
        client, "business", "artist_connection_delete_ok", "DELETE",
        f"/api/artists/{artist_id}/connections/{connection_id}", headers=auth_header(tokens, "gestor"),
    )
    assert delete_ok.status_code == 200

    delete_again = hit(
        client, "business", "artist_connection_delete_again", "DELETE",
        f"/api/artists/{artist_id}/connections/{connection_id}", headers=auth_header(tokens, "gestor"),
    )
    assert delete_again.status_code == 404


def test_artist_metrics_create_and_permissions(client, tokens, artist_id):
    forbidden = hit(
        client, "business", "artist_metric_forbidden", "POST",
        f"/api/artists/{artist_id}/metrics", json={"tipo": "monthly_listeners", "valor": 100, "fecha": "2026-09-14"},
        headers=auth_header(tokens, "ciudadano"),
    )
    assert forbidden.status_code == 403

    missing_fields = hit(
        client, "business", "artist_metric_missing_fields", "POST",
        f"/api/artists/{artist_id}/metrics", json={"tipo": "monthly_listeners"},
        headers=auth_header(tokens, "gestor"),
    )
    assert missing_fields.status_code == 400

    created = hit(
        client, "business", "artist_metric_create", "POST",
        f"/api/artists/{artist_id}/metrics",
        json={"tipo": "monthly_listeners", "valor": 13000, "fecha": "2026-09-14"},
        headers=auth_header(tokens, "gestor"),
    )
    assert created.status_code == 201, created.text


# ───────────────────────── moderacion: rama de rechazo ─────────────────────────

def test_publication_status_rejected_branch(client, tokens, category_ids):
    pub_id = create_publication(client, tokens, category_ids, who="gestor", title="Moderar - Fase 4")
    submit = hit(
        client, "business", "moderate_submit", "POST",
        f"/api/publications/{pub_id}/submit", headers=auth_header(tokens, "gestor"),
    )
    assert submit.status_code == 200

    role_forbidden = hit(
        client, "business", "moderate_role_forbidden", "PATCH",
        f"/api/publications/{pub_id}/status", json={"status": "REJECTED", "note": "motivo valido"},
        headers=auth_header(tokens, "ciudadano"),
    )
    assert role_forbidden.status_code == 403

    invalid_status = hit(
        client, "business", "moderate_invalid_status", "PATCH",
        f"/api/publications/{pub_id}/status", json={"status": "DRAFT", "note": ""},
        headers=auth_header(tokens, "admin"),
    )
    assert invalid_status.status_code == 400

    note_too_short = hit(
        client, "business", "moderate_reject_short_note", "PATCH",
        f"/api/publications/{pub_id}/status", json={"status": "REJECTED", "note": "no"},
        headers=auth_header(tokens, "admin"),
    )
    assert note_too_short.status_code == 400

    rejected = hit(
        client, "business", "moderate_reject_ok", "PATCH",
        f"/api/publications/{pub_id}/status",
        json={"status": "REJECTED", "note": "Falta informacion de contacto verificable"},
        headers=auth_header(tokens, "admin"),
    )
    assert rejected.status_code == 200

    detail = hit(
        client, "business", "moderate_reject_then_get", "GET",
        f"/api/publications/{pub_id}", headers=auth_header(tokens, "gestor"),
    )
    assert detail.status_code == 200
    assert detail.json()["status"] == "REJECTED"
    assert detail.json()["moderation_note"] == "Falta informacion de contacto verificable"

    # Ya no esta en REVIEW -> no se puede volver a moderar
    already_moderated = hit(
        client, "business", "moderate_already_moderated", "PATCH",
        f"/api/publications/{pub_id}/status", json={"status": "PUBLISHED", "note": ""},
        headers=auth_header(tokens, "admin"),
    )
    assert already_moderated.status_code == 409


# ───────────────────────── validacion 400 al crear publicaciones ─────────────────────────

def test_publication_create_validation_errors(client, tokens, category_ids):
    base = {
        "kind": "HISTORIA",
        "category_id": category_ids["HISTORIA"],
        "title": "Titulo valido de prueba",
        "summary": "Resumen valido de prueba con longitud suficiente.",
        "content": "Contenido valido de prueba con longitud suficiente para pasar la validacion.",
    }
    headers = auth_header(tokens, "gestor")

    def expect_400(name, **overrides):
        payload = {**base, **overrides}
        resp = hit(client, "business", name, "POST", "/api/publications", json=payload, headers=headers)
        assert resp.status_code == 400, f"{name}: se esperaba 400, llego {resp.status_code} -> {resp.text}"

    expect_400("create_pub_title_too_short", title="abc")
    expect_400("create_pub_summary_too_short", summary="corto")
    expect_400("create_pub_content_too_short", content="muy corto")
    expect_400("create_pub_invalid_kind", kind="NO_EXISTE")
    expect_400("create_pub_category_not_found", category_id=999999)
    expect_400("create_pub_category_kind_mismatch", kind="EVENTO", category_id=category_ids["HISTORIA"])


# ───────────────────────── regresion: busqueda case-insensitive (bug de la migracion) ─────────────────────────
# SQLite es case-insensitive con LIKE por defecto; Postgres no. La migracion a
# Postgres uso .like() donde el backend legado (implicitamente, via SQLite)
# se comportaba como .ilike() -- buscar "caucasia" en minuscula dejo de
# encontrar contenido titulado/ubicado "Caucasia". Fix: backend/service/
# services/publications.py y backend/service/services/artists.py ahora usan
# .ilike(). Estos tests fallan si alguien vuelve a .like() por error.

def test_publication_search_is_case_insensitive(client):
    # El seed tiene una publicacion PUBLISHED con location="Malecon de
    # Caucasia" (con mayuscula). Buscar en minuscula debe encontrarla.
    resp = hit(client, "business", "search_lowercase_finds_uppercase", "GET", "/api/publications?search=caucasia")
    assert resp.status_code == 200
    items = resp.json()
    assert any("Caucasia" in (p.get("location") or "") for p in items), (
        "La busqueda en minuscula 'caucasia' deberia encontrar contenido con 'Caucasia' "
        "(mayuscula) -- si esto falla, alguien volvio a usar .like() en vez de .ilike()."
    )


def test_artist_upcoming_events_match_is_case_insensitive(client, tokens, category_ids, artist_id):
    # El stage_name del artista sembrado es "Og Mauro" (mezcla de mayus/minus).
    # Un evento PUBLISHED cuyo titulo lo menciona en mayuscula debe aparecer
    # en "upcoming_events" del perfil del artista.
    pub_id = create_publication(
        client, tokens, category_ids, who="gestor", kind="EVENTO",
        title="Concierto especial de OG MAURO en el malecon",
        start_date="2026-12-01T20:00",
    )
    submit = hit(
        client, "business", "search_event_submit", "POST",
        f"/api/publications/{pub_id}/submit", headers=auth_header(tokens, "gestor"),
    )
    assert submit.status_code == 200

    publish = hit(
        client, "business", "search_event_publish", "PATCH",
        f"/api/publications/{pub_id}/status", json={"status": "PUBLISHED", "note": ""},
        headers=auth_header(tokens, "admin"),
    )
    assert publish.status_code == 200

    profile = hit(client, "business", "search_artist_profile", "GET", "/api/artists/og-mauro")
    assert profile.status_code == 200
    titles = [e["title"] for e in profile.json()["upcoming_events"]]
    assert any("OG MAURO" in t for t in titles), (
        "El evento en mayuscula deberia aparecer en upcoming_events pese a que "
        "stage_name es 'Og Mauro' -- si esto falla, alguien volvio a usar .like()."
    )
