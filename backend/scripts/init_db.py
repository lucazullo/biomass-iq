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
from pathlib import Path

# Ensure we can import from app/
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import engine, Base, SessionLocal  # noqa: E402
from app.models import *  # noqa: F401, F403, E402 — import all models to register with Base


def ensure_schema():
    print("Creating schema...")
    Base.metadata.create_all(engine)
    print("Schema ready.")


def ingest_if_needed():
    if os.getenv("BIOMASSIQ_SKIP_INGEST"):
        print("Skipping PHYLIS ingestion (BIOMASSIQ_SKIP_INGEST set).")
        return

    # Check if we already have data
    from app.models import SampleRecord
    db = SessionLocal()
    try:
        count = db.query(SampleRecord).count()
        if count > 0:
            print(f"DB already has {count} samples — skipping ingestion.")
            return
    finally:
        db.close()

    # Find parsed PHYLIS data
    raw_data_dir = Path(__file__).parent.parent / "app" / "adapters" / "phylis" / "raw_data"
    parsed_file = raw_data_dir / "parsed_samples.json"
    if not parsed_file.exists():
        print(f"No parsed PHYLIS data at {parsed_file}.")
        print("Either run the scraper first, or include parsed_samples.json in the deployment.")
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
    ensure_schema()
    ingest_if_needed()
    print("Done.")
