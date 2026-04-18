"""
Initialize the database schema and optionally ingest PHYLIS data.

Run on first deploy:
    python scripts/init_db.py

Environment:
    DATABASE_URL — Postgres connection string (Railway provides this)
    BIOMASSIQ_SKIP_INGEST=1 to skip PHYLIS ingestion (schema-only)
"""

import os
import sys
import time
from pathlib import Path

# Ensure we can import from app/
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.exc import OperationalError  # noqa: E402

from app.database import engine, Base, SessionLocal  # noqa: E402
from app.models import *  # noqa: F401, F403, E402


def wait_for_db(max_attempts: int = 30, delay: float = 2.0):
    """Retry connecting to the DB — useful on first Railway start when Postgres may not be ready yet."""
    for attempt in range(1, max_attempts + 1):
        try:
            with engine.connect() as conn:
                conn.execute(__import__("sqlalchemy").text("SELECT 1"))
            print(f"DB connection established (attempt {attempt})")
            return True
        except OperationalError as e:
            print(f"[{attempt}/{max_attempts}] DB not ready: {type(e).__name__}. Retrying in {delay}s...")
            time.sleep(delay)
    print("ERROR: Could not connect to DB after retries.")
    return False


def ensure_schema():
    print("Creating schema...")
    Base.metadata.create_all(engine)
    print("Schema ready.")


def ingest_if_needed():
    if os.getenv("BIOMASSIQ_SKIP_INGEST"):
        print("Skipping PHYLIS ingestion (BIOMASSIQ_SKIP_INGEST set).")
        return

    from app.models import SampleRecord
    db = SessionLocal()
    try:
        count = db.query(SampleRecord).count()
        if count > 0:
            print(f"DB already has {count} samples — skipping ingestion.")
            return
    finally:
        db.close()

    raw_data_dir = Path(__file__).parent.parent / "app" / "adapters" / "phylis" / "raw_data"
    parsed_file = raw_data_dir / "parsed_samples.json"
    if not parsed_file.exists():
        print(f"No parsed PHYLIS data at {parsed_file}. Starting with empty DB.")
        return

    print(f"Ingesting PHYLIS data from {parsed_file}...")
    from app.adapters.phylis.parser import load_and_parse
    from app.adapters.phylis.mapper import map_samples_to_db

    samples = load_and_parse()
    db = SessionLocal()
    try:
        stats = map_samples_to_db(db, samples)
        print(f"Ingested: {stats}")
    finally:
        db.close()


if __name__ == "__main__":
    if not wait_for_db():
        # Don't crash — let the web server boot so healthchecks can report status.
        # Next request will fail but at least the process stays up for debugging.
        print("WARNING: Booting web server without DB init.")
        sys.exit(0)
    try:
        ensure_schema()
        ingest_if_needed()
    except Exception as e:
        print(f"ERROR during init: {e}")
        # Still exit 0 so the web server boots
        sys.exit(0)
    print("Init complete.")
