"""
Seed idempotente para un Postgres nuevo (dev/CI/tests).

  - Usa `INSERT ... ON CONFLICT DO NOTHING`; `rewards.name` es UNIQUE para
    que el conflicto sea real y no se dupliquen filas al re-ejecutar.
  - Las fechas se insertan como `datetime`/`date` reales (columnas TIMESTAMPTZ,
    DateTime y Date), no como texto ISO.
"""
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from backend.service.core.security import hash_password
from backend.service.models.tables import (
    Artist,
    ArtistConnection,
    ArtistMedia,
    ArtistMetric,
    ArtistSocialLink,
    ArtistTimeline,
    Category,
    Event,
    Opportunity,
    Organization,
    Publication,
    Role,
    Track,
    User,
)


def now_utc():
    return datetime.now(timezone.utc)


def _iso_dt(value: str | None) -> datetime | None:
    """Parsea un ISO 8601 (fecha sola o fecha+hora) a datetime naive, o None."""
    return datetime.fromisoformat(value) if value else None


def _upsert_ignore(db: Session, model, rows: list[dict], conflict_cols: list[str]):
    if not rows:
        return
    stmt = pg_insert(model).values(rows).on_conflict_do_nothing(index_elements=conflict_cols)
    db.execute(stmt)


def seed_database(db: Session):
    _upsert_ignore(db, Role, [
        {"id": 1, "name": "ADMIN"}, {"id": 2, "name": "GESTOR"}, {"id": 3, "name": "CIUDADANO"},
    ], ["id"])

    demo_users = [
        (1, "Valentina Admin", "admin@tejido.co", "Admin123!"),
        (2, "Mateo Gestor", "gestor@tejido.co", "Gestor123!"),
        (3, "Sofia Ciudadana", "ciudadano@tejido.co", "Ciudadano123!"),
    ]
    _upsert_ignore(db, User, [
        {
            "id": uid, "role_id": uid, "name": name, "email": email,
            "password_hash": hash_password(password), "active": True, "created_at": now_utc(),
        }
        for uid, name, email, password in demo_users
    ], ["id"])

    categories = [
        ("Historias", "HISTORIA", "#805AD5"), ("Eventos", "EVENTO", "#F59E0B"),
        ("Oportunidades", "OPORTUNIDAD", "#16A085"), ("Talento", "TALENTO", "#EC4899"),
        ("Iniciativas", "INICIATIVA", "#3B82F6"),
    ]
    _upsert_ignore(db, Category, [
        {"name": n, "type": t, "color": c} for n, t, c in categories
    ], ["name"])

    _upsert_ignore(db, Organization, [{
        "id": 1, "user_id": 2, "name": "Colectivo Rio Vivo",
        "description": "Gestion cultural y ambiental desde Caucasia.", "contact": "hola@riovivo.co",
    }], ["id"])
    db.flush()

    if db.execute(select(Publication.id).limit(1)).first() is None:
        category_ids = {row.type: row.id for row in db.execute(select(Category)).scalars()}
        seed_publications = [
            dict(author_id=2, category_id=category_ids["EVENTO"], kind="EVENTO",
                 title="Festival Rio y Sabana 2026",
                 summary="Musica, gastronomia y emprendimiento junto al rio Cauca.",
                 content="Tres dias para encontrarnos alrededor de los sonidos, sabores e iniciativas "
                         "que nacen en el Bajo Cauca. Habra tarima local, mercado creativo y recorridos "
                         "ambientales.",
                 image="linear-gradient(135deg,#F6C453,#F08A5D)", location="Malecon de Caucasia",
                 start_date="2026-07-18T15:00", end_date="2026-07-20T22:00",
                 link="https://example.com/festival", featured=True, status="PUBLISHED", venue="Malecon de Caucasia"),
            dict(author_id=1, category_id=category_ids["HISTORIA"], kind="HISTORIA",
                 title="Las manos que tejen memoria",
                 summary="Artesanas de El Pando convierten fibras y relatos en piezas unicas.",
                 content="Un grupo de mujeres reune saberes heredados y diseno contemporaneo para "
                         "contar historias del territorio a traves del tejido.",
                 image="linear-gradient(135deg,#845EC2,#D65DB1)", location="El Pando, Caucasia",
                 start_date=None, end_date=None, link=None, featured=True, status="PUBLISHED"),
            dict(author_id=3, category_id=category_ids["OPORTUNIDAD"], kind="OPORTUNIDAD",
                 title="Convocatoria Semillas Creativas",
                 summary="Apoyo para jovenes con ideas culturales y comunitarias.",
                 content="La convocatoria entrega mentoria y capital semilla a diez proyectos liderados "
                         "por jovenes de 18 a 28 anios.",
                 image="linear-gradient(135deg,#00A896,#89C2D9)", location="Caucasia",
                 start_date=None, end_date="2026-08-15", link="https://example.com/semillas",
                 featured=True, status="PUBLISHED", organization_name="Alianza Bajo Cauca", deadline="2026-08-15"),
            dict(author_id=4, category_id=category_ids["TALENTO"], kind="TALENTO",
                 title="Samuel Torres: fotografia del territorio",
                 summary="Un lente joven que encuentra belleza en la vida cotidiana.",
                 content="Samuel recorre barrios y veredas documentando gestos, oficios y paisajes "
                         "que suelen pasar desapercibidos.",
                 image="linear-gradient(135deg,#264653,#2A9D8F)", location="Caucasia",
                 start_date=None, end_date=None, link=None, featured=False, status="PUBLISHED"),
            dict(author_id=5, category_id=category_ids["INICIATIVA"], kind="INICIATIVA",
                 title="Biblioteca al parque",
                 summary="Lecturas, juegos y conversacion cada sabado.",
                 content="Una red de voluntarios lleva libros y actividades a parques de distintos "
                         "barrios para acercar la lectura a ninnas, ninos y familias.",
                 image="linear-gradient(135deg,#3B82F6,#8B5CF6)", location="Parques de Caucasia",
                 start_date="2026-07-04T09:00", end_date=None, link=None, featured=False, status="PUBLISHED"),
            dict(author_id=2, category_id=category_ids["EVENTO"], kind="EVENTO",
                 title="Mercado Hecho en Caucasia",
                 summary="Emprendimientos locales, musica y cocina en un solo lugar.",
                 content="Encuentra marcas locales, productos agricolas, diseno y cocina del territorio. "
                         "Entrada libre.",
                 image="linear-gradient(135deg,#F59E0B,#EF4444)", location="Parque de las Banderas",
                 start_date="2026-07-11T10:00", end_date="2026-07-11T19:00", link=None,
                 featured=False, status="PUBLISHED", venue="Parque de las Banderas"),
        ]
        # author_id 4/5 no existen entre las 3 cuentas demo -- se reasignan al admin
        # para no violar la FK en un seed limpio (en data/tejido.db real si existian).
        for row in seed_publications:
            if row["author_id"] not in (1, 2, 3):
                row["author_id"] = 1
            row["start_date"] = _iso_dt(row.get("start_date"))
            row["end_date"] = _iso_dt(row.get("end_date"))

        for row in seed_publications:
            venue = row.pop("venue", None)
            organization_name = row.pop("organization_name", None)
            deadline = _iso_dt(row.pop("deadline", None))
            publication = Publication(created_at=now_utc(), updated_at=now_utc(), **row)
            db.add(publication)
            db.flush()
            if row["kind"] == "EVENTO":
                db.add(Event(publication_id=publication.id, venue=venue, capacity=300))
            if row["kind"] == "OPORTUNIDAD":
                db.add(Opportunity(publication_id=publication.id, organization_name=organization_name, deadline=deadline))

    from backend.service.models.tables import ActivityType, Reward

    activity_types = [
        ("INTERNAL_SHARE", "Compartir publicacion", 10, False, "Compartir una publicacion de TEJIDO en redes sociales"),
        ("EXTERNAL_SHARE", "Compartir en redes", 15, True, "Compartir contenido de TEJIDO en Instagram, Facebook, etc."),
        ("EXTERNAL_MENTION", "Mencionar TEJIDO", 25, True, "Mencionar TEJIDO en video, radio o blog"),
        ("EVENT_ATTEND", "Asistir a evento", 20, True, "Asistir a un evento presencial de TEJIDO"),
        ("COMMUNITY_MEET", "Reunion comunitaria", 30, True, "Organizar una reunion comunitaria sobre TEJIDO"),
        ("TEACH_TEJIDO", "Ensennar TEJIDO", 20, False, "Ensennar a alguien a usar la plataforma"),
        ("CONTENT_CREATE", "Crear contenido", 25, True, "Crear contenido sobre el Bajo Cauca inspirado en TEJIDO"),
        ("PHOTO_PLACE", "Foto en sitio cultural", 15, True, "Tomar foto en un sitio cultural del Bajo Cauca"),
        ("REFER_USER", "Referir usuario", 50, False, "Registrar un nuevo usuario en TEJIDO"),
        ("MUSIC_SHARE", "Compartir musica", 15, True, "Compartir musica de artistas Moneystack en redes sociales"),
        ("CONCERT_ATTEND", "Asistir a concierto", 30, True, "Asistir a un concierto o evento en vivo de Moneystack"),
    ]
    _upsert_ignore(db, ActivityType, [
        {"type": t, "name": n, "default_points": p, "requires_evidence": e, "description": d}
        for t, n, p, e, d in activity_types
    ], ["type"])

    rewards = [
        ("Entrada a evento premium", "Acceso a eventos exclusivos de TEJIDO", 200, "EVENTO", 50),
        ("Camiseta Tejido", "Camiseta oficial del proyecto TEJIDO", 500, "MERCH", 20),
        ("Poster Bajo Cauca", "Poster ilustrado del territorio", 300, "MERCH", 30),
        ("10% descuento artesanias", "Descuento en el marketplace de artesanias", 100, "DCTO", -1),
        ("Destacado en la web", "Tu perfil aparece destacado por 1 semana", 1000, "DESTACADO", -1),
        ("Stickers TEJIDO", "Pack de 5 stickers con disenos del Bajo Cauca", 150, "MERCH", 40),
        ("Taller premium gratis", "Acceso a un taller cultural exclusivo", 250, "EVENTO", 15),
        ("Mencion en redes", "TEJIDO te menciona en sus redes sociales", 400, "DESTACADO", -1),
        ("Camiseta Moneystack", "Merch oficial del sello Moneystack", 400, "MERCH", 25),
        ("Vinilo Og Mauro", "Vinilo firmado por Og Mauro", 800, "MERCH", 10),
        ("Sesion de estudio", "Una sesion en el estudio de Moneystack", 1500, "EXPERIENCIA", 5),
        ("Entrada concierto Moneystack", "Acceso a proximo concierto de Moneystack", 200, "EVENTO", 30),
    ]
    _upsert_ignore(db, Reward, [
        {"name": n, "description": d, "points_cost": p, "category": c, "stock": s}
        for n, d, p, c, s in rewards
    ], ["name"])
    db.flush()

    if db.execute(select(Artist.id).limit(1)).first() is None:
        ts = now_utc()
        artist = Artist(
            user_id=2, name="Oscar Mauro", stage_name="Og Mauro", slug="og-mauro", real_name="Oscar Mauro",
            bio="Artista del Bajo Cauca que lleva la esencia de nuestro territorio a cada escenario. "
                "Su musica conecta las raices del rio Cauca con el ritmo urbano, creando un sonido unico "
                "que representa la identidad del Bajo Cauca antioqueno. Bajo el sello Moneystack, "
                "Og Mauro ha consolidado una voz propia que habla del territorio, la calle y la cultura.",
            image="/assets/artistas/og-mauro/perfil.jpg", hero_image="/assets/artistas/og-mauro/hero.jpg",
            genre="Urbano / Rap / Hip-Hop", city="Caucasia", region="Bajo Cauca, Antioquia",
            featured=True, created_at=ts, updated_at=ts,
        )
        db.add(artist)
        db.flush()

        tracks = [
            ("Sustancias", "sustancias", "Single", "3:45",
             "Un tema que habla de las presiones de la calle y las decisiones que definen caminos.",
             "2024-03-15", True),
            ("Bajo Cauca", "bajo-cauca", "Single", "3:20",
             "Homenaje a la tierra que lo vio nacer. Un rap crudo sobre la vida en el Bajo Cauca.",
             "2024-08-20", False),
            ("Rio Cauca", "rio-cauca", "Single", "3:58",
             "El rio como testigo de historias, luchas y victorias del territorio.", "2025-02-10", False),
            ("Calle y Cultura", "calle-y-cultura", "EP", "4:12",
             "Cuatro pistas que narran la dualidad entre la vida urbana y las raices culturales.",
             "2025-09-05", False),
            ("Territorio", "territorio", "Single", "3:33",
             "Invocacion al territorio como identidad. Un himno para el Bajo Cauca.", "2026-04-01", False),
        ]
        for title, slug, album, duration, description, release_date, featured in tracks:
            db.add(Track(
                artist_id=artist.id, title=title, slug=slug, album=album, genre="Urbano",
                duration=duration, description=description, release_date=date.fromisoformat(release_date),
                status="published", featured=featured, created_at=ts,
            ))

        timeline = [
            ("Los inicios", "Og Mauro comienza a rapear en los barrios de Caucasia, influencers locales "
             "y fiestas comunitarias. Su voz rapida y su flow natural llaman la atencion.", "2022-06-01", 1),
            ("Moneystack lo detecta", "El sello independiente Moneystack lo contacta despues de viralizar "
             "un freestyle en redes. Firman un acuerdo de distribucion.", "2023-10-15", 2),
            ("Primer lanzamiento: Sustancias", "Su primer single oficial sale en todas las plataformas. "
             "Supera las 10,000 reproducciones en el primer mes.", "2024-03-15", 3),
            ("Calle y Cultura EP", "Lanza su primer EP con 4 pistas que consolidan su sonido. Recibe "
             "cobertura en medios locales del Bajo Cauca.", "2025-09-05", 4),
            ("Nueva etapa: Territorio", "Regresa con un single que define su identidad artistica. "
             "Prepara su primer concierto en Caucasia.", "2026-04-01", 5),
        ]
        for titulo, descripcion, fecha, orden in timeline:
            db.add(ArtistTimeline(
                artist_id=artist.id, titulo=titulo, descripcion=descripcion,
                fecha=date.fromisoformat(fecha), orden=orden,
            ))

        media = [
            ("image", "/assets/artistas/og-mauro/galeria-1.jpg", "Ensayo fotografico",
             "Sesion de fotos para la portada de Territorio", "2026-03-01", 1, True),
            ("image", "/assets/artistas/og-mauro/galeria-2.jpg", "En el estudio",
             "Grabando en el estudio de Moneystack", "2025-08-15", 2, False),
            ("image", "/assets/artistas/og-mauro/galeria-3.jpg", "En vivo",
             "Presentacion en el Festival Rio y Sabana", "2025-07-18", 3, True),
            ("image", "/assets/artistas/og-mauro/galeria-4.jpg", "Detras de escena",
             "Backstage antes del concierto", "2025-09-20", 4, False),
            ("video", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "Bajo Cauca - Video Oficial",
             "El video oficial del tema que define su carrera", "2024-08-20", 5, True),
            ("video", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "Freestyle Session",
             "Sesion de freestyle en el malecon de Caucasia", "2023-11-10", 6, False),
        ]
        for tipo, url, titulo, descripcion, fecha, orden, destacado in media:
            db.add(ArtistMedia(artist_id=artist.id, tipo=tipo, url=url, titulo=titulo, descripcion=descripcion,
                                fecha=date.fromisoformat(fecha), orden=orden, destacado=destacado))

        social = [
            ("spotify", "https://open.spotify.com/artist/og-mauro", "ogmauro", "spotify", 1),
            ("youtube", "https://youtube.com/@ogmauro", "ogmauro", "youtube", 2),
            ("instagram", "https://instagram.com/ogmauro", "@ogmauro", "instagram", 3),
            ("tiktok", "https://tiktok.com/@ogmauro", "@ogmauro", "tiktok", 4),
        ]
        for platform, url, username, icon, orden in social:
            db.add(ArtistSocialLink(artist_id=artist.id, platform=platform, url=url, username=username, icon=icon, orden=orden))

        connections = [
            ("collective", "Moneystack", "Sello independiente nacido en Caucasia. El sello que mueve la "
             "cultura del Bajo Cauca.", "/images/moneystack/logo.png", 1),
            ("place", "Caucasia", "Ciudad del Bajo Cauca, cuna del talento y la cultura urbana antioquena.", None, 2),
            ("event", "Festival Rio y Sabana 2026", "El festival mas importante del Bajo Cauca. Og Mauro "
             "participa como artista invitado.", None, 3),
            ("story", "Las manos que tejen memoria", "Historia de las artesanas de El Pando que inspira la "
             "conexion entre musica y territorio.", None, 4),
        ]
        for entity_type, titulo, descripcion, imagen_url, orden in connections:
            db.add(ArtistConnection(artist_id=artist.id, entity_type=entity_type, titulo=titulo,
                                     descripcion=descripcion, imagen_url=imagen_url, orden=orden))

        metrics = [
            ("monthly_listeners", 12500), ("total_streams", 85000), ("followers_spotify", 3200),
            ("followers_instagram", 5800), ("events_performed", 8), ("releases_count", 5),
        ]
        metrics_fecha = date.fromisoformat("2026-09-01")
        for tipo, valor in metrics:
            db.add(ArtistMetric(artist_id=artist.id, tipo=tipo, valor=valor, fecha=metrics_fecha))

    if db.execute(select(Artist.id).where(Artist.slug == "dj-apolo")).first() is None:
        ts = now_utc()
        db.add(Artist(
            name="DJ Apolo", stage_name="DJ Apolo", slug="dj-apolo",
            bio="DJ del Bajo Cauca bajo el sello Moneystack.",
            image="/assets/artistas/dj-apolo/perfil.jpg", hero_image="/assets/artistas/dj-apolo/perfil.jpg",
            genre="DJ / Electronica", city="Caucasia", region="Bajo Cauca, Antioquia",
            featured=False, created_at=ts, updated_at=ts,
        ))

    db.commit()
