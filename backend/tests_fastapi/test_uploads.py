"""POST /api/uploads/sign: firma de subidas a Cloudinary. Sin red ni Cloudinary real: las claves
son falsas (monkeypatch de settings) y solo se comprueba la firma, los permisos y la carpeta.
Usa client directo (no hit()) para no alterar el reporte de linea base."""
import hashlib

import pytest

from backend.tests_fastapi.test_parity import auth_header, tokens  # noqa: F401

SIGN = "/api/uploads/sign"
FAKE = {"cloudinary_cloud_name": "tejido-test", "cloudinary_api_key": "123456789", "cloudinary_api_secret": "secreto-de-prueba"}


@pytest.fixture
def configured(monkeypatch):
    from backend.service.core.config import settings
    from backend.service.core.rate_limit import reset_login_rate_limit

    for key, value in FAKE.items():
        monkeypatch.setattr(settings, key, value)
    reset_login_rate_limit()
    yield
    reset_login_rate_limit()


@pytest.fixture
def artist(client):
    return client.get("/api/artists/og-mauro").json()["artist"]


def test_signature_matches_cloudinary_documented_examples():
    from backend.service.services.uploads import sign_params

    # Ejemplos de https://cloudinary.com/documentation/authentication_signatures (secret "abcd").
    assert sign_params({"timestamp": 1315060510}, "abcd") == "a21ad0f63beb4de2e5575204b79ab90bffb02c10"
    assert sign_params(
        {"timestamp": 1315060510, "public_id": "sample_image", "eager": "w_400,h_300,c_pad|w_260,h_200,c_crop"}, "abcd"
    ) == "bfd09f95f331f558cbd1320e67aa8d488770583e"
    # file, cloud_name, resource_type y api_key no entran en la firma.
    assert sign_params({"timestamp": 1, "file": "x", "cloud_name": "c", "resource_type": "image", "api_key": "k"}, "s") == \
        sign_params({"timestamp": 1}, "s")


def test_signed_response_is_verifiable_and_never_leaks_the_secret(client, tokens, configured):
    resp = client.post(SIGN, json={"scope": "avatar"}, headers=auth_header(tokens, "ciudadano"))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert FAKE["cloudinary_api_secret"] not in resp.text
    assert body["cloud_name"] == "tejido-test" and body["api_key"] == "123456789"
    assert body["upload_url"] == "https://api.cloudinary.com/v1_1/tejido-test/image/upload"
    assert body["folder"] == "tejido/perfiles"
    assert body["allowed_formats"] == "jpg,jpeg,png,webp"
    assert body["transformation"].startswith("c_limit,")
    signed = {key: body[key] for key in ("allowed_formats", "folder", "timestamp", "transformation")}
    to_sign = "&".join(f"{key}={signed[key]}" for key in sorted(signed)) + FAKE["cloudinary_api_secret"]
    assert body["signature"] == hashlib.sha1(to_sign.encode()).hexdigest()


@pytest.mark.parametrize("who, allowed", [
    ("ciudadano", {"avatar"}),
    ("gestor", {"avatar", "publication", "organization"}),
    ("admin", {"avatar", "publication", "artist"}),
])
def test_permissions_by_scope_and_role(client, tokens, configured, artist, who, allowed):
    for scope in ("avatar", "publication", "organization", "artist"):
        body = {"scope": scope, **({"ref": artist["id"]} if scope == "artist" else {})}
        resp = client.post(SIGN, json=body, headers=auth_header(tokens, who))
        assert resp.status_code == (200 if scope in allowed else 403), (who, scope, resp.text)


def test_anonymous_is_rejected(client, configured):
    assert client.post(SIGN, json={"scope": "avatar"}).status_code == 401


def test_server_decides_the_folder(client, tokens, configured, artist):
    admin = auth_header(tokens, "admin")
    resp = client.post(SIGN, json={"scope": "artist", "ref": artist["id"]}, headers=admin)
    assert resp.json()["folder"] == "tejido/artistas/og-mauro"
    # Un ref en otro scope se ignora; uno que no es entero (ruta, carpeta) no pasa la validacion.
    resp = client.post(SIGN, json={"scope": "publication", "ref": artist["id"]}, headers=admin)
    assert resp.json()["folder"] == "tejido/publicaciones"
    for bad in ("../../otra", "tejido/hackeado", "1; drop", 1.5, True):
        assert client.post(SIGN, json={"scope": "artist", "ref": bad}, headers=admin).status_code == 400, bad
    assert client.post(SIGN, json={"scope": "artist", "ref": 999999}, headers=admin).status_code == 404
    assert client.post(SIGN, json={"scope": "artist"}, headers=admin).status_code == 400
    # Campos extra (folder, public_id...) se ignoran: la carpeta firmada no cambia.
    resp = client.post(SIGN, json={"scope": "avatar", "folder": "otra", "public_id": "x"}, headers=admin)
    assert resp.json()["folder"] == "tejido/perfiles" and "public_id" not in resp.json()


def test_invalid_scope(client, tokens, configured):
    for scope in ("artistas", "", None, "../avatar"):
        resp = client.post(SIGN, json={"scope": scope}, headers=auth_header(tokens, "admin"))
        assert resp.status_code == 400 and resp.json()["error"] == "VALIDATION", scope


def test_not_configured_returns_503(client, tokens, monkeypatch):
    from backend.service.core.config import settings

    monkeypatch.setattr(settings, "cloudinary_api_secret", "")
    resp = client.post(SIGN, json={"scope": "avatar"}, headers=auth_header(tokens, "ciudadano"))
    assert resp.status_code == 503
    assert "no está configurada" in resp.json()["message"] and "CLOUDINARY" not in resp.text


def test_rate_limit_per_user(client, tokens, configured):
    ciudadano, gestor = auth_header(tokens, "ciudadano"), auth_header(tokens, "gestor")
    for _ in range(30):
        assert client.post(SIGN, json={"scope": "avatar"}, headers=ciudadano).status_code == 200
    blocked = client.post(SIGN, json={"scope": "avatar"}, headers=ciudadano)
    assert blocked.status_code == 429 and "Espera un minuto" in blocked.json()["message"]
    # El limite es por usuario: otro usuario sigue pudiendo.
    assert client.post(SIGN, json={"scope": "avatar"}, headers=gestor).status_code == 200
