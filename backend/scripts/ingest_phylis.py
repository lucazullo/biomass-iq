"""
Ingest PHYLIS data into an already-initialized schema.
Runs in the background after uvicorn starts, so a slow bulk insert doesn't
delay Railway's healthcheck.
"""
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text  # noqa: E402
from sqlalchemy.exc import OperationalError  # noqa: E402

from app.database import engine, SessionLocal  # noqa: E402
from app.models import SampleRecord  # noqa: E402


def wait_for_db(max_attempts=60, delay=2.0):
    for attempt in range(1, max_attempts + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return True
        except OperationalError:
            time.sleep(delay)
    return False


if __name__ == "__main__":
    if os.getenv("BIOMASSIQ_SKIP_INGEST"):
        print("[ingest] skipped (BIOMASSIQ_SKIP_INGEST set)")
        sys.exit(0)

    if not wait_for_db():
        print("[ingest] DB unreachable; aborting")
        sys.exit(0)

    # Skip if data already present
    db = SessionLocal()
    try:
        count = db.query(SampleRecord).count()
        if count > 0:
            print(f"[ingest] DB already has {count} samples — skipping")
            sys.exit(0)
    finally:
        db.close()

    parsed_file = Path(__file__).parent.parent / "app" / "adapters" / "phylis" / "raw_data" / "parsed_samples.json"
    if not parsed_file.exists():
        print(f"[ingest] No parsed data at {parsed_file}")
        sys.exit(0)

    try:
        print(f"[ingest] starting from {parsed_file}...")
        from app.adapters.phylis.parser import load_and_parse
        from app.adapters.phylis.mapper import map_samples_to_db

        samples = load_and_parse()
        db = SessionLocal()
        try:
            stats = map_samples_to_db(db, samples)
            print(f"[ingest] done: {stats}")
        finally:
            db.close()
    except Exception as e:
        print(f"[ingest] error: {e}")
        import traceback
        traceback.print_exc()
    sys.exit(0)
