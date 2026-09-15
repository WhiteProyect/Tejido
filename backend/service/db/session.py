from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from backend.service.core.config import settings

# pool_pre_ping: valida la conexion con un SELECT 1 barato antes de usarla.
# Necesario contra Neon (Postgres serverless): las conexiones idle se pueden
# cerrar del lado del servidor sin avisar, y sin esto el primer query despues
# de un rato de inactividad fallaria con "connection already closed".
# pool_recycle: recicla conexiones cada 5 min por la misma razon, antes de
# que el servidor las cierre el solo.
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_recycle=300,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db():
    db: Session = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
