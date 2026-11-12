"""Carrusel del inicio elegido por el admin: elegidos en el builder (services/home_carousel.py) y la API
/api/admin/home-carousel (services/home_carousel_admin.py).

Las pruebas del builder usan la transaccion de test_home_carousel.py (se deshace al final). Las de la API
confirman en el schema de test y dejan el carrusel en automatico y sin las filas que crearon.
"""
import uuid
from datetime import timedelta

import pytest
from sqlalchemy import delete, func, select, update

from backend.service.db.session import get_db
from backend.service.main import app
from backend.service.models.tables import (Artist, Category, CulturalBranch, HomeCarouselPick, HomeCarouselSettings, Publication,
                                           TalentProfile, User)
from backend.service.services import home_carousel
from backend.service.services.auth import now_utc
from backend.tests_fastapi.test_home_carousel import (BRANCHES, TODAY, artist_keys, at, build, by_key, content, db, keys,  # noqa: F401
                                                      limits)
from backend.tests_fastapi.test_parity import auth_header, tokens  # noqa: F401

API = "/api/admin/home-carousel"


def pick(db, position, publication=None, talent=None, artist=None):
    db.add(HomeCarouselPick(position=position, publication_id=publication.id if publication else None,
                            talent_id=talent.id if talent else None, artist_id=artist.id if artist else None))
    db.flush()


def states(db, section="content"):
    composed = home_carousel.compose(db, today=TODAY)
    return [(entry["row"].id, entry["state"]) for entry in composed[section]]


# ─────────────────────────── builder con elegidos ───────────────────────────

def test_picks_go_first_in_their_order_and_fill_skips_their_branches(db, content):
    music_old = content.publication(branch="MUSICA")
    music_new = content.publication(branch="MUSICA")  # el relleno la elegiria; su rama ya tiene elegido
    dance = content.publication(branch="DANZA")
    theatre = content.publication(branch="TEATRO")
    chosen_talent = content.talent()
    newer_talent = content.talent(featured=True)  # el relleno no suma talento: ya hay uno elegido
    pick(db, 0, publication=theatre)
    pick(db, 1, talent=chosen_talent)
    pick(db, 2, publication=music_old)
    slides = build(db)
    content_keys = keys([s for s in slides if s["type"] != "ARTIST"])
    assert content_keys == [f"publication-{theatre.id}", f"talent-{chosen_talent.id}", f"publication-{music_old.id}",
                            f"publication-{dance.id}"]
    assert f"publication-{music_new.id}" not in content_keys and f"talent-{newer_talent.id}" not in content_keys


def test_content_limit_and_over_limit_state(db, content):
    pubs = [content.publication(branch=branch) for branch in BRANCHES[:4]]
    for position, row in enumerate(pubs):
        pick(db, position, publication=row)
    limits(db, content=2)
    assert keys(build(db)) == [f"publication-{pubs[0].id}", f"publication-{pubs[1].id}"]
    assert states(db) == [(pubs[0].id, "VISIBLE"), (pubs[1].id, "VISIBLE"), (pubs[2].id, "FUERA_DEL_LIMITE"),
                          (pubs[3].id, "FUERA_DEL_LIMITE")]
    limits(db, content=0, moneystack=1)
    assert build(db) == []


def test_expired_event_is_skipped_and_comes_back_when_extended(db, content):
    event = content.publication(kind="EVENTO", branch="MUSICA", start_date=at(TODAY - timedelta(days=3)),
                                end_date=at(TODAY - timedelta(days=1)))
    other = content.publication(kind="EVENTO", branch="MUSICA", start_date=at(TODAY + timedelta(days=9)))
    pick(db, 0, publication=event)
    assert f"publication-{event.id}" not in keys(build(db))
    assert states(db) == [(event.id, "FUERA_DE_VIGENCIA")]
    # Su rama no queda cubierta: el relleno pone otra de Musica.
    assert f"publication-{other.id}" in keys(build(db))
    event.end_date = at(TODAY + timedelta(days=2))
    db.flush()
    assert keys(build(db))[0] == f"publication-{event.id}" and states(db) == [(event.id, "VISIBLE")]
    assert db.execute(select(func.count()).select_from(HomeCarouselPick)).scalar() == 1


def test_closed_opportunity_is_skipped_and_comes_back(db, content):
    call = content.publication(kind="OPORTUNIDAD", branch="DANZA", end_date=at(TODAY - timedelta(days=1), 23))
    pick(db, 0, publication=call)
    assert keys(build(db)) == [] and states(db) == [(call.id, "FUERA_DE_VIGENCIA")]
    reason = home_carousel.compose(db, today=TODAY)["content"][0]["reason"]
    assert reason == "La convocatoria cerró"
    call.end_date = at(TODAY, 23)
    db.flush()
    assert keys(build(db)) == [f"publication-{call.id}"]


def test_unpublished_deleted_archived_and_branch_off_are_skipped_but_kept(db, content):
    draft = content.publication(branch="MUSICA", status="DRAFT")
    gone = content.publication(branch="DANZA", deleted=True)
    off = content.publication(branch="TEATRO")
    talent_off = content.talent(branch="TEATRO")
    no_image = content.publication(branch=None, image=None, kind="LUGAR")
    archived = content.artist("Archivada", featured=True, active=False)
    review = content.artist("Revision", moneystack=False, status="REVIEW")
    for position, row in enumerate((draft, gone, off, no_image)):
        pick(db, position, publication=row)
    pick(db, 4, talent=talent_off)
    pick(db, 0, artist=archived)
    pick(db, 1, artist=review)
    db.execute(update(CulturalBranch).where(CulturalBranch.key == "TEATRO").values(active=False))
    db.flush()
    assert build(db) == []
    assert states(db) == [(draft.id, "NO_PUBLICADO"), (gone.id, "NO_PUBLICADO"), (off.id, "RAMA_DESACTIVADA"),
                          (no_image.id, "SIN_IMAGEN"), (talent_off.id, "RAMA_DESACTIVADA")]
    assert states(db, "artists") == [(archived.id, "NO_PUBLICADO"), (review.id, "NO_PUBLICADO")]
    reasons = [e["reason"] for e in home_carousel.compose(db, today=TODAY)["content"]]
    assert reasons[:3] == ["Está en borrador", "Se eliminó", "La rama Teatro está desactivada"]
    assert db.execute(select(func.count()).select_from(HomeCarouselPick)).scalar() == 7


def test_artist_picks_order_quota_and_fill_without_repeats(db, content):
    content.publication()
    money = [content.artist(f"M{i}", featured=i == 0) for i in range(3)]
    tejido = [content.artist(f"T{i}", moneystack=False) for i in range(3)]
    pick(db, 0, artist=tejido[2])
    pick(db, 1, artist=money[2])
    pick(db, 2, artist=tejido[1])
    limits(db, moneystack=2, tejido=1)
    assert artist_keys(build(db)) == [f"artist-{a.id}" for a in (tejido[2], money[2], money[0])]
    assert states(db, "artists") == [(tejido[2].id, "VISIBLE"), (money[2].id, "VISIBLE"), (tejido[1].id, "FUERA_DEL_LIMITE")]


def test_hard_delete_cascades_to_the_picks(db, content):
    row = content.publication()
    talent = content.talent()
    artist = content.artist("Borrable")
    pick(db, 0, publication=row)
    pick(db, 1, talent=talent)
    pick(db, 0, artist=artist)
    for item in (row, talent, artist):
        db.delete(item)
    db.flush()
    assert db.execute(select(func.count()).select_from(HomeCarouselPick)).scalar() == 0


# ─────────────────────────── API ───────────────────────────

@pytest.fixture
def admin(tokens):
    return auth_header(tokens, "admin")


@pytest.fixture
def rows(client, admin):
    """Una publicacion, un talento y dos artistas confirmados; al final, carrusel automatico y sin ellos."""
    gen = app.dependency_overrides[get_db]()
    session = next(gen)
    user_id = session.execute(select(func.min(User.id))).scalar_one()
    category_id = session.execute(select(Category.id).where(Category.type == "HISTORIA")).scalar_one()
    now = now_utc()
    tag = uuid.uuid4().hex[:6]
    pub = Publication(author_id=user_id, category_id=category_id, kind="HISTORIA", title=f"Carrusel {tag}", summary="Resumen",
                      content="Contenido", image="https://img.test/c.jpg", status="PUBLISHED", cultural_category="DANZA",
                      created_at=now, updated_at=now)
    talent = TalentProfile(slug=f"carrusel-{tag}", name=f"Talento {tag}", category="DANZA", origin="caucasia", tagline="Frase",
                           cover_url="https://img.test/t.jpg", created_by=user_id, representative_user_id=user_id, status="PUBLISHED",
                           created_at=now, updated_at=now, published_at=now)
    money = Artist(user_id=user_id, name=f"Money {tag}", stage_name=f"Money {tag}", slug=f"money-{tag}", image="https://img.test/a.jpg",
                   moneystack=True, created_at=now)
    tejido = Artist(user_id=user_id, name=f"Tejido {tag}", stage_name=f"Tejido {tag}", slug=f"tejido-{tag}", image="https://img.test/a.jpg",
                    moneystack=False, genre="Champeta", municipality="caucasia", created_at=now)
    session.add_all([pub, talent, money, tejido])
    session.commit()
    try:
        yield {"pub": pub.id, "talent": talent.id, "money": money.id, "tejido": tejido.id, "tag": tag}
    finally:
        client.delete(API, headers=admin)
        session.execute(delete(HomeCarouselPick))
        for model, item_id in ((Publication, pub.id), (TalentProfile, talent.id), (Artist, money.id), (Artist, tejido.id)):
            session.execute(delete(model).where(model.id == item_id))
        session.commit()
        gen.close()


def body(rows, content_limit=10, moneystack=3, tejido=3, content=None, artists=None):
    return {
        "settings": {"content_limit": content_limit, "moneystack_limit": moneystack, "tejido_limit": tejido},
        "content": content if content is not None else [{"type": "TALENT", "id": rows["talent"]}, {"type": "PUBLICATION", "id": rows["pub"]}],
        "artists": artists if artists is not None else [{"type": "ARTIST", "id": rows["tejido"]}, {"type": "ARTIST", "id": rows["money"]}],
    }


def test_only_admin(client, tokens, rows):
    for headers in (auth_header(tokens, "gestor"), auth_header(tokens, "ciudadano"), {}):
        assert client.get(API, headers=headers).status_code == 403
        assert client.put(API, json=body(rows), headers=headers).status_code == 403
        assert client.delete(API, headers=headers).status_code == 403
        assert client.get(f"{API}/candidates", headers=headers).status_code == 403


def test_put_saves_in_order_and_get_shows_states_and_preview(client, admin, rows):
    resp = client.put(API, json=body(rows, moneystack=1), headers=admin)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["settings"] == {"content_limit": 10, "moneystack_limit": 1, "tejido_limit": 3}
    assert [(i["type"], i["id"], i["status"]) for i in data["content"]] == [("TALENT", rows["talent"], "VISIBLE"),
                                                                           ("PUBLICATION", rows["pub"], "VISIBLE")]
    assert [(i["id"], i["sello"], i["status"]) for i in data["artists"]] == [(rows["tejido"], "TEJIDO", "VISIBLE"),
                                                                             (rows["money"], "MONEYSTACK", "VISIBLE")]
    assert data["content"][1]["branch_label"] == "Danza" and data["artists"][0]["sello_label"] == "TEJIDO"
    public = client.get("/api/home/carousel").json()["slides"]
    assert data["preview"] == public
    assert keys(public)[:2] == [f"talent-{rows['talent']}", "artist-%d" % rows["tejido"]]
    assert client.get(API, headers=admin).json()["content"] == data["content"]


def test_put_validation_is_atomic(client, admin, rows):
    assert client.put(API, json=body(rows), headers=admin).status_code == 200
    before = client.get(API, headers=admin).json()
    bad = [
        (body(rows, content=[{"type": "PUBLICATION", "id": rows["pub"]}] * 2), "DUPLICATE_ITEM"),
        (body(rows, artists=[{"type": "ARTIST", "id": 99999999}]), "ITEM_NOT_FOUND"),
        (body(rows, content=[{"type": "TALENT", "id": 99999999}]), "ITEM_NOT_FOUND"),
        (body(rows, content=[{"type": "ARTIST", "id": rows["money"]}]), "INVALID_ITEM"),
        (body(rows, content_limit=13), "INVALID_SETTINGS"),
        (body(rows, moneystack=7), "INVALID_SETTINGS"),
        (body(rows, tejido=-1), "INVALID_SETTINGS"),
        (body(rows, content_limit="5"), "INVALID_SETTINGS"),
        (body(rows, content_limit=0, moneystack=0, tejido=0), "EMPTY_CAROUSEL"),
        ({"content": []}, "INVALID_SETTINGS"),
    ]
    for payload, code in bad:
        resp = client.put(API, json=payload, headers=admin)
        assert resp.status_code == 422 and resp.json()["error"] == code, (code, resp.text)
    msg = client.put(API, json=body(rows, content_limit=0, moneystack=0, tejido=0), headers=admin).json()["message"]
    assert msg.startswith("El carrusel no puede quedar vacío")
    assert client.get(API, headers=admin).json() == before


def test_delete_goes_back_to_automatic(client, admin, rows):
    assert client.put(API, json=body(rows, content_limit=4, moneystack=0, tejido=6), headers=admin).status_code == 200
    resp = client.delete(API, headers=admin)
    data = resp.json()
    assert resp.status_code == 200 and data["settings"] == {"content_limit": 10, "moneystack_limit": 3, "tejido_limit": 3}
    assert data["content"] == [] and data["artists"] == []


def test_etag_changes_when_saving(client, admin, rows):
    first = client.get("/api/home/carousel")
    etag = first.headers["etag"]
    assert client.get("/api/home/carousel", headers={"If-None-Match": etag}).status_code == 304
    assert client.put(API, json=body(rows, content=[{"type": "PUBLICATION", "id": rows["pub"]}], artists=[], content_limit=1,
                                     moneystack=0, tejido=0), headers=admin).status_code == 200
    after = client.get("/api/home/carousel", headers={"If-None-Match": etag})
    assert after.status_code == 200 and after.headers["etag"] != etag
    assert keys(after.json()["slides"]) == [f"publication-{rows['pub']}"]


def test_candidates_exclude_picks_and_filter(client, admin, rows):
    def search(**params):
        resp = client.get(f"{API}/candidates", params=params, headers=admin)
        assert resp.status_code == 200, resp.text
        return resp.json()

    found = search(section="content", q=rows["tag"])
    assert {(i["type"], i["id"]) for i in found["items"]} == {("PUBLICATION", rows["pub"]), ("TALENT", rows["talent"])}
    assert [i["type"] for i in search(section="content", q=rows["tag"], kind="TALENT")["items"]] == ["TALENT"]
    assert [i["type"] for i in search(section="content", q=rows["tag"], kind="HISTORIA", category="DANZA")["items"]] == ["PUBLICATION"]
    assert search(section="content", q=rows["tag"], category="MUSICA")["items"] == []
    artists = search(section="artists", q=rows["tag"])
    assert {i["id"] for i in artists["items"]} == {rows["money"], rows["tejido"]}
    assert [i["sello"] for i in search(section="artists", q=rows["tag"], sello="tejido")["items"]] == ["TEJIDO"]
    for bad in ({"section": "otra"}, {"section": "artists", "sello": "x"}, {"section": "content", "kind": "RAP"}):
        assert client.get(f"{API}/candidates", params=bad, headers=admin).status_code == 422
    # Lo elegido ya no aparece.
    assert client.put(API, json=body(rows), headers=admin).status_code == 200
    assert search(section="content", q=rows["tag"])["items"] == []
    assert search(section="artists", q=rows["tag"])["items"] == []


def test_candidates_paginate(client, admin):
    first = client.get(f"{API}/candidates", params={"section": "content"}, headers=admin).json()
    assert len(first["items"]) <= 10
    if first["next_offset"] is not None:
        second = client.get(f"{API}/candidates", params={"section": "content", "offset": first["next_offset"]}, headers=admin).json()
        assert not {(i["type"], i["id"]) for i in first["items"]} & {(i["type"], i["id"]) for i in second["items"]}
