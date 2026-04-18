"""
Fast schema-only initialization. Creates tables if missing.
Called synchronously from entrypoint.sh so the API has tables ready before
uvicorn starts. Ingestion is handled separately (ingest_phylis.py in background).
"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text  # noqa: E402
from sqlalchemy.exc import OperationalError  # noqa: E402

from app.database import engine, Base  # noqa: E402
from app.models import *  # noqa: F401, F403, E402


def wait_for_db(max_attempts=30, delay=2.0):
    for attempt in range(1, max_attempts + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            print(f"DB connection established (attempt {attempt})")
            return True
        except OperationalError as e:
            print(f"[{attempt}/{max_attempts}] DB not ready: {type(e).__name__}")
            time.sleep(delay)
    return False


if __name__ == "__main__":
    if not wait_for_db():
        print("WARNING: DB unreachable — starting without schema.")
        sys.exit(0)
    try:
        print("Creating schema...")
        Base.metadata.create_all(engine)
        print("Schema ready.")
    except Exception as e:
        print(f"Schema init error: {e}")
    sys.exit(0)
