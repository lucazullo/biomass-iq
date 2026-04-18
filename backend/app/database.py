from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

# Railway/Heroku provide URLs starting with postgres:// — SQLAlchemy 2.x needs postgresql://
db_url = settings.database_url
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

# Explicit connect_timeout prevents indefinite hangs when the DB isn't reachable
engine = create_engine(
    db_url,
    pool_pre_ping=True,
    connect_args={"connect_timeout": 5} if db_url.startswith("postgresql") else {},
)
SessionLocal = sessionmaker(bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
