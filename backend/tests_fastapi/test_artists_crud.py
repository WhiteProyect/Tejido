"""CRUD de artistas para admin (Fase 1): alta, slugs, archivado, canciones, sub-recursos,
permisos y validacion de URLs. Schema aislado del conftest, nunca Neon `public`.

No toca a Og Mauro ni a DJ Apolo del seed (otros tests dependen de su contenido): cada test
crea sus propios artistas y los archiva al final para que no aparezcan en los listados
publicos que revisan otros archivos. Usa client directo (no hit()) para no alterar el
reporte de linea base.
"""
import uuid

import pytest

from backend.tests_fastapi.test_parity import auth_header, tokens  # noqa: F401

LONG_URL = "https://example.com/" + "a" * 500
BAD_URLS = [
    "javascript:alert(1)", " JAVASCRIPT:alert(1)", "data:text/html,<b>x</b>", "vbscript:msgbox(1)",
    "//evil.com/x.png", "ftp://example.com/x.png", "https://", LONG_URL,
]
LOCAL_PATH = "/assets/artistas/prueba/perfil.jpg"


def _name(prefix="Prueba"):
    return f"{prefix} {uuid.uuid4().hex[:6]}"


@pytest.fixture
def admin(tokens):
    return auth_header(tokens, "admin")


@pytest.fixture
def gestor(tokens):
    return auth_header(tokens, "gestor")


@pytest.fixture
def gestor_id(client, gestor):
    return client.get("/api/me", headers=gestor).json()["user"]["id"]


@pytest.fixture
def make_artist(client, admin):
    created = []

    def make(**body):
        body.setdefault("stage_name", _name())
        resp = client.post("/api/artists", json=body, headers=admin)
        assert resp.status_code == 201, resp.text
        created.append(resp.json()["id"])
        return resp.json()

    yield make
    for artist_id in created:
        client.delete(f"/api/artists/{artist_id}", headers=admin)


def _profile(client, slug):
    return client.get(f"/api/artists/{slug}")


# ───────────────────────── permisos ─────────────────────────

def test_permission_matrix(client, tokens, admin, gestor, gestor_id, make_artist):
    own = make_artist(user_id=gestor_id)
    other = make_artist()
    track_id = client.post(f"/api/artists/{own['id']}/tracks", json={"title": "Base"}, headers=admin).json()["id"]

    def requests_for(artist):
        a = artist["id"]
        return [
            ("POST", "/api/artists", {"stage_name": _name()}),
            ("DELETE", f"/api/artists/{a}", None),
            ("POST", f"/api/artists/{a}/restore", None),
            ("GET", "/api/admin/artists", None),
            ("PUT", f"/api/artists/{a}", {"bio": "x"}),
            ("POST", f"/api/artists/{a}/tracks", {"title": "Nueva"}),
            ("PUT", f"/api/artists/{a}/tracks/{track_id}", {"title": "Otra"}),
            ("DELETE", f"/api/artists/{a}/tracks/{track_id}", None),
            ("GET", f"/api/artists/{a}/metrics", None),
            ("POST", f"/api/artists/{a}/metrics", {"tipo": "x", "valor": 1, "fecha": "2026-10-01"}),
        ]

    for headers in ({}, auth_header(tokens, "ciudadano")):
        for method, path, body in requests_for(own):
            resp = client.request(method, path, json=body, headers=headers)
            assert resp.status_code == 403, (method, path, resp.status_code)

    # Gestor dueno: edita su artista y sus sub-recursos.
    a = own["id"]
    assert client.put(f"/api/artists/{a}", json={"bio": "Bio del gestor"}, headers=gestor).status_code == 200
    assert client.post(f"/api/artists/{a}/tracks", json={"title": "Del gestor"}, headers=gestor).status_code == 201
    assert client.put(f"/api/artists/{a}/tracks/{track_id}", json={"album": "EP"}, headers=gestor).status_code == 200
    assert client.get(f"/api/artists/{a}/metrics", headers=gestor).status_code == 200
    # ...pero no lo que define identidad, visibilidad o propiedad, ni el alta/archivado.
    for field, value in (("slug", "otro-slug-gestor"), ("featured", True), ("active", False), ("user_id", None)):
        resp = client.put(f"/api/artists/{a}", json={field: value}, headers=gestor)
        assert resp.status_code == 403, (field, resp.text)
    assert client.post("/api/artists", json={"stage_name": _name()}, headers=gestor).status_code == 403
    assert client.delete(f"/api/artists/{a}", headers=gestor).status_code == 403
    assert client.post(f"/api/artists/{a}/restore", headers=gestor).status_code == 403
    assert client.get("/api/admin/artists", headers=gestor).status_code == 403

    # Gestor ajeno: nada sobre un artista que no es suyo.
    b = other["id"]
    assert client.put(f"/api/artists/{b}", json={"bio": "x"}, headers=gestor).status_code == 403
    assert client.post(f"/api/artists/{b}/tracks", json={"title": "x"}, headers=gestor).status_code == 403
    assert client.get(f"/api/artists/{b}/metrics", headers=gestor).status_code == 403

    # Admin: todo.
    resp = client.put(f"/api/artists/{b}", json={"featured": False, "user_id": gestor_id, "bio": "Admin"}, headers=admin)
    assert resp.status_code == 200, resp.text
    assert client.get("/api/admin/artists", headers=admin).status_code == 200


def test_owner_must_be_a_gestor(client, tokens, admin, make_artist):
    ciudadano_id = client.get("/api/me", headers=auth_header(tokens, "ciudadano")).json()["user"]["id"]
    for user_id in (ciudadano_id, 999999):
        resp = client.post("/api/artists", json={"stage_name": _name(), "user_id": user_id}, headers=admin)
        assert resp.status_code == 400, resp.text
    artist = make_artist()
    assert client.put(f"/api/artists/{artist['id']}", json={"user_id": ciudadano_id}, headers=admin).status_code == 400


# ───────────────────────── slugs ─────────────────────────

def test_slugs(client, admin, make_artist):
    first = make_artist(stage_name="Ñandú Sónico Fase1")
    assert first["slug"] == "nandu-sonico-fase1"
    assert make_artist(stage_name="Ñandú Sónico Fase1")["slug"] == "nandu-sonico-fase1-2"
    assert make_artist(stage_name="123")["slug"].startswith("artista-123")
    assert make_artist(stage_name="Home")["slug"] == "home-2"

    created = client.post("/api/artists", json={"stage_name": _name(), "slug": "  Slug-Explicito-F1 "}, headers=admin)
    assert created.status_code == 201 and created.json()["slug"] == "slug-explicito-f1"
    client.delete(f"/api/artists/{created.json()['id']}", headers=admin)

    for bad in ("Mal Slug!", "con_guion_bajo", "-borde", "doble--guion", "canción", "123", "home", "admin", "media-kit"):
        resp = client.post("/api/artists", json={"stage_name": _name(), "slug": bad}, headers=admin)
        assert resp.status_code == 400, (bad, resp.text)
    # Unicidad sin distinguir mayusculas, tambien contra archivados (slug-explicito-f1 lo esta).
    for taken in ("NANDU-SONICO-FASE1", "slug-explicito-f1"):
        assert client.post("/api/artists", json={"stage_name": _name(), "slug": taken}, headers=admin).status_code == 409
    assert client.post("/api/artists", json={"stage_name": "x"}, headers=admin).status_code == 400
    assert client.post("/api/artists", json={}, headers=admin).status_code == 400

    # Cambio de slug: la URL nueva funciona, la vieja no; no puede pisar a otro; el propio si.
    a = first["id"]
    assert client.put(f"/api/artists/{a}", json={"slug": "nandu-renombrado-f1"}, headers=admin).status_code == 200
    assert _profile(client, "nandu-renombrado-f1").status_code == 200
    assert _profile(client, "nandu-sonico-fase1").status_code == 404
    assert client.put(f"/api/artists/{a}", json={"slug": "OG-MAURO"}, headers=admin).status_code == 409
    assert client.put(f"/api/artists/{a}", json={"slug": "nandu-renombrado-f1"}, headers=admin).status_code == 200
    assert client.put(f"/api/artists/{a}", json={"slug": None}, headers=admin).status_code == 400


# ───────────────────────── archivado ─────────────────────────

def test_archive_and_restore(client, admin, gestor, gestor_id, make_artist):
    artist = make_artist(user_id=gestor_id, image=LOCAL_PATH)
    a, slug = artist["id"], artist["slug"]
    client.post(f"/api/artists/{a}/tracks", json={"title": "Uno"}, headers=admin)
    assert slug in [x["slug"] for x in client.get("/api/artists").json()]

    archived = client.delete(f"/api/artists/{a}", headers=admin)
    assert archived.status_code == 200 and archived.json()["active"] is False
    again = client.delete(f"/api/artists/{a}", headers=admin)
    assert again.status_code == 200 and "ya estaba archivado" in again.json()["message"]

    assert slug not in [x["slug"] for x in client.get("/api/artists").json()]
    assert _profile(client, slug).status_code == 404
    listing = client.get("/api/admin/artists", headers=admin).json()
    row = next(x for x in listing if x["id"] == a)
    assert row["active"] is False and row["slug"] == slug and row["image"] == LOCAL_PATH
    assert row["counts"] == {"tracks": 1, "media": 0, "timeline": 0, "social": 0, "connections": 0, "metrics": 0}
    actives = [x["active"] for x in listing]
    assert actives == sorted(actives, reverse=True), "activos primero"

    # El admin sigue gestionando al archivado; para el gestor dueno no existe.
    assert client.put(f"/api/artists/{a}", json={"bio": "Archivado"}, headers=admin).status_code == 200
    assert client.post(f"/api/artists/{a}/tracks", json={"title": "Dos"}, headers=admin).status_code == 201
    assert client.put(f"/api/artists/{a}", json={"bio": "x"}, headers=gestor).status_code == 404

    restored = client.post(f"/api/artists/{a}/restore", headers=admin)
    assert restored.status_code == 200 and restored.json()["active"] is True
    assert "ya estaba activo" in client.post(f"/api/artists/{a}/restore", headers=admin).json()["message"]
    assert _profile(client, slug).status_code == 200
    assert client.delete("/api/artists/999999", headers=admin).status_code == 404
    assert client.post("/api/artists/999999/restore", headers=admin).status_code == 404


def test_admin_detail_includes_archived_and_drafts(client, tokens, admin, gestor, gestor_id, make_artist):
    artist = make_artist(user_id=gestor_id, bio="Bio completa", city="Cáceres")
    a = artist["id"]
    client.post(f"/api/artists/{a}/tracks", json={"title": "Publicada"}, headers=admin)
    client.post(f"/api/artists/{a}/tracks", json={"title": "En borrador", "status": "draft"}, headers=admin)
    client.post(f"/api/artists/{a}/metrics", json={"tipo": "monthly_listeners", "valor": 10, "fecha": "2026-10-01"}, headers=admin)
    client.delete(f"/api/artists/{a}", headers=admin)

    resp = client.get(f"/api/admin/artists/{a}", headers=admin)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["artist"]["active"] is False and data["artist"]["bio"] == "Bio completa" and data["artist"]["city"] == "Cáceres"
    assert sorted(t["title"] for t in data["tracks"]) == ["En borrador", "Publicada"]
    assert [m["tipo"] for m in data["metrics"]] == ["monthly_listeners"]
    assert set(data) == {"artist", "tracks", "timeline", "media", "social_links", "connections", "metrics"}

    for headers in ({}, auth_header(tokens, "ciudadano"), gestor):
        assert client.get(f"/api/admin/artists/{a}", headers=headers).status_code == 403
    assert client.get("/api/admin/artists/999999", headers=admin).status_code == 404


# ───────────────────────── canciones ─────────────────────────

def test_tracks_crud_and_single_featured(client, admin, make_artist):
    artist, other = make_artist(), make_artist()
    a, slug = artist["id"], artist["slug"]

    def track(artist_id, **body):
        resp = client.post(f"/api/artists/{artist_id}/tracks", json=body, headers=admin)
        assert resp.status_code == 201, resp.text
        return resp.json()

    other_featured = track(other["id"], title="Ajena", featured=True)
    t1 = track(a, title="Canción Uno", duration="3:40", featured=True, release_date="2026-01-10")
    assert t1["slug"] == "cancion-uno"
    assert track(a, title="Canción Uno")["slug"] == "cancion-uno-2"
    t2 = track(a, title="Set largo", duration="1:05:30", featured=True, spotify_url="https://open.spotify.com/")

    def featured_titles(s):
        return [t["title"] for t in _profile(client, s).json()["tracks"] if t["featured"]]

    assert featured_titles(slug) == ["Set largo"]
    assert _profile(client, slug).json()["featured_track"]["id"] == t2["id"]
    assert client.put(f"/api/artists/{a}/tracks/{t1['id']}", json={"featured": True}, headers=admin).status_code == 200
    assert featured_titles(slug) == ["Canción Uno"]
    assert featured_titles(other["slug"]) == ["Ajena"], "destacar en un artista no toca a otro"

    draft = track(a, title="Borrador", status="draft")
    assert "Borrador" not in [t["title"] for t in _profile(client, slug).json()["tracks"]]
    assert client.put(f"/api/artists/{a}/tracks/{draft['id']}", json={"status": "published"}, headers=admin).status_code == 200
    assert "Borrador" in [t["title"] for t in _profile(client, slug).json()["tracks"]]

    for bad in ({"duration": "3:4"}, {"duration": "abc"}, {"duration": "1:60:00"}, {"status": "hidden"},
                {"title": ""}, {"title": "x" * 181}, {"featured": None}, {"release_date": "10-01-2026"}):
        resp = client.post(f"/api/artists/{a}/tracks", json={"title": "Valida", **bad}, headers=admin)
        assert resp.status_code == 400, (bad, resp.text)
    assert client.post(f"/api/artists/{a}/tracks", json={"album": "Sin titulo"}, headers=admin).status_code == 400

    assert client.put(f"/api/artists/{a}/tracks/{t2['id']}", json={"slug": "cancion-uno"}, headers=admin).status_code == 409
    assert client.put(f"/api/artists/{a}/tracks/{t2['id']}", json={"title": "Set renombrado"}, headers=admin).status_code == 200
    assert client.put(f"/api/artists/{a}/tracks/{t2['id']}", json={}, headers=admin).status_code == 400
    assert client.put(f"/api/artists/{other['id']}/tracks/{t2['id']}", json={"title": "x"}, headers=admin).status_code == 404
    assert client.delete(f"/api/artists/{other['id']}/tracks/{t2['id']}", headers=admin).status_code == 404
    assert client.delete(f"/api/artists/{a}/tracks/{t2['id']}", headers=admin).status_code == 200
    assert client.delete(f"/api/artists/{a}/tracks/{t2['id']}", headers=admin).status_code == 404
    assert other_featured["id"] in [t["id"] for t in _profile(client, other["slug"]).json()["tracks"]]


# ───────────────────────── URLs y textos ─────────────────────────

def _url_targets(client, admin, artist_id):
    """(metodo, ruta, campo, familia) por cada campo de URL; los sub-recursos se crean validos."""
    a = artist_id

    def create(path, body):
        resp = client.post(f"/api/artists/{a}/{path}", json=body, headers=admin)
        assert resp.status_code == 201, resp.text
        return resp.json()["id"]

    track = create("tracks", {"title": "Con enlaces"})
    social = create("social", {"platform": "instagram", "url": "https://www.instagram.com/"})
    conn = create("connections", {"entity_type": "place", "titulo": "Caucasia"})
    media = create("media", {"url": LOCAL_PATH})
    entry = create("timeline", {"titulo": "Hito"})
    targets = [(f"/api/artists/{a}", field, "image") for field in ("image", "hero_image")]
    targets += [(f"/api/artists/{a}", f, "link") for f in ("spotify_url", "youtube_url", "instagram_url", "tiktok_url")]
    targets += [(f"/api/artists/{a}/tracks/{track}", "cover_image", "image")]
    targets += [(f"/api/artists/{a}/tracks/{track}", f, "link")
                for f in ("spotify_url", "youtube_url", "apple_music_url", "amazon_music_url")]
    targets += [(f"/api/artists/{a}/social/{social}", "url", "link")]
    targets += [(f"/api/artists/{a}/connections/{conn}", f, "image") for f in ("imagen_url", "url")]
    targets += [(f"/api/artists/{a}/media/{media}", "url", "image")]
    targets += [(f"/api/artists/{a}/timeline/{entry}", "imagen_url", "image"),
                (f"/api/artists/{a}/timeline/{entry}", "video_url", "link")]
    return targets


def test_url_validation_on_every_field(client, admin, make_artist):
    artist = make_artist()
    for path, field, family in _url_targets(client, admin, artist["id"]):
        for bad in BAD_URLS:
            resp = client.put(path, json={field: bad}, headers=admin)
            assert resp.status_code == 400, (path, field, bad, resp.status_code)
        local = client.put(path, json={field: LOCAL_PATH}, headers=admin)
        assert local.status_code == (200 if family == "image" else 400), (path, field, local.text)
        ok = client.put(path, json={field: "https://example.com/recurso"}, headers=admin)
        assert ok.status_code == 200, (path, field, ok.text)

    # Al crear tambien se valida.
    for body in ({"stage_name": _name(), "image": "javascript:alert(1)"}, {"stage_name": _name(), "hero_image": "data:x"}):
        assert client.post("/api/artists", json=body, headers=admin).status_code == 400
    a = artist["id"]
    assert client.post(f"/api/artists/{a}/social", json={"platform": "x", "url": "javascript:alert(1)"}, headers=admin).status_code == 400
    assert client.post(f"/api/artists/{a}/media", json={"url": "javascript:alert(1)"}, headers=admin).status_code == 400
    assert client.post(f"/api/artists/{a}/media", json={"url": LOCAL_PATH, "tipo": "video"}, headers=admin).status_code == 400
    video = client.post(f"/api/artists/{a}/media", json={"url": "https://www.youtube.com/watch?v=x", "tipo": "video"}, headers=admin)
    assert video.status_code == 201
    # Un video guardado no puede pasar a ruta local aunque el PUT no reenvie el tipo.
    assert client.put(f"/api/artists/{a}/media/{video.json()['id']}", json={"url": LOCAL_PATH}, headers=admin).status_code == 400

    # Cadena vacia = quitar el valor; los obligatorios no aceptan vacio.
    assert client.put(f"/api/artists/{a}", json={"image": "", "spotify_url": "  "}, headers=admin).status_code == 200
    profile = _profile(client, artist["slug"]).json()["artist"]
    assert profile["image"] is None and profile["spotify_url"] is None
    for body in ({"stage_name": ""}, {"name": None}, {"bio": "x" * 5001}, {"genre": "x" * 121}, {"featured": None}):
        assert client.put(f"/api/artists/{a}", json=body, headers=admin).status_code == 400, body


# ───────────────────────── social, conexiones y metricas ─────────────────────────

def test_social_connections_metrics_isolated_between_artists(client, admin, make_artist):
    a, b = make_artist()["id"], make_artist()["id"]

    social = client.post(f"/api/artists/{a}/social", json={"platform": "tiktok", "url": "https://www.tiktok.com/"},
                         headers=admin).json()["id"]
    assert client.put(f"/api/artists/{b}/social/{social}", json={"username": "@x"}, headers=admin).status_code == 404
    assert client.put(f"/api/artists/{a}/social/{social}", json={"username": "@prueba", "orden": 2}, headers=admin).status_code == 200
    assert client.put(f"/api/artists/{a}/social/{social}", json={"platform": ""}, headers=admin).status_code == 400
    assert client.put(f"/api/artists/{a}/social/{social}", json={}, headers=admin).status_code == 400
    assert client.put(f"/api/artists/{a}/social/999999", json={"orden": 1}, headers=admin).status_code == 404

    conn = client.post(f"/api/artists/{a}/connections", json={"entity_type": "place", "titulo": "Caucasia"},
                       headers=admin).json()["id"]
    assert client.put(f"/api/artists/{b}/connections/{conn}", json={"titulo": "x"}, headers=admin).status_code == 404
    assert client.put(f"/api/artists/{a}/connections/{conn}", json={"titulo": "Caucasia, Antioquia", "url": "/agenda"},
                      headers=admin).status_code == 200
    assert client.put(f"/api/artists/{a}/connections/{conn}", json={"titulo": None}, headers=admin).status_code == 400

    def metric(artist_id, tipo, valor):
        resp = client.post(f"/api/artists/{artist_id}/metrics", json={"tipo": tipo, "valor": valor, "fecha": "2026-10-01"},
                           headers=admin)
        assert resp.status_code == 201, resp.text
        return resp.json()["id"]

    m1, m2 = metric(a, "monthly_listeners", 100), metric(a, "releases_count", 2)
    mb = metric(b, "monthly_listeners", 999)
    listed = client.get(f"/api/artists/{a}/metrics", headers=admin).json()
    assert sorted(m["id"] for m in listed) == sorted([m1, m2])

    assert client.put(f"/api/artists/{a}/metrics/{m1}", json={"valor": 150, "fecha": "2026-10-15"}, headers=admin).status_code == 200
    latest = client.get(f"/api/artists/{a}/dashboard", headers=admin).json()["latest"]
    assert latest["monthly_listeners"]["valor"] == 150
    for body in ({"valor": None}, {"tipo": ""}, {"fecha": "ayer"}, {}):
        assert client.put(f"/api/artists/{a}/metrics/{m1}", json=body, headers=admin).status_code == 400, body
    assert client.put(f"/api/artists/{b}/metrics/{m1}", json={"valor": 1}, headers=admin).status_code == 404
    assert client.delete(f"/api/artists/{b}/metrics/{m1}", headers=admin).status_code == 404
    assert client.delete(f"/api/artists/{a}/metrics/{m1}", headers=admin).status_code == 200
    assert client.delete(f"/api/artists/{a}/metrics/{m1}", headers=admin).status_code == 404
    assert [m["id"] for m in client.get(f"/api/artists/{b}/metrics", headers=admin).json()] == [mb]
