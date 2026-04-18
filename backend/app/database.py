from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

# Railway/Heroku provide URLs starting with postgres:// — SQLAlchemy 2.x needs postgresql://
db_url = settings.database_url
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

# SSL behavior:
# - Railway internal network (.railway.internal) — no SSL needed
# - Railway public TCP proxy (.proxy.rlwy.net, .rlwy.net) — SSL required, but the
#   proxy may not speak SSL at all ports; prefer sslmode=require, fall back to disable
# Let the URL's own sslmode win if it's already set.
connect_args: dict = {"connect_timeout": 10}
if db_url.startswith("postgresql") and "sslmode=" not in db_url:
    if ".railway.internal" in db_url:
        connect_args["sslmode"] = "disable"
    else:
        # For anything else (public proxy, external DB), require SSL
        connect_args["sslmode"] = "require"

engine = create_engine(
    db_url,
    pool_pre_ping=True,
    connect_args=connect_args,
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
