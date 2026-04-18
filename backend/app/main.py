import threading
import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app.config import settings
from app.api import search, observations, summary, compare, export
from app.database import engine, Base, SessionLocal
from app import models  # noqa: F401 — registers all SQLAlchemy models with Base.metadata

app = FastAPI(
    title="BiomassIQ API",
    description="Biomass characterization data platform",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(search.router, prefix="/api/search", tags=["search"])
app.include_router(observations.router, prefix="/api/observations", tags=["observations"])
app.include_router(summary.router, prefix="/api/summary", tags=["summary"])
app.include_router(compare.router, prefix="/api/compare", tags=["compare"])
app.include_router(export.router, prefix="/api/export", tags=["export"])


# Expose initialization status so we can see what's going on via the API
init_status = {
    "db_connected": False,
    "schema_ready": False,
    "ingest_status": "pending",  # pending | running | done | skipped | error
    "ingest_message": "",
    "sample_count": 0,
}


@app.get("/api/health")
def health():
    """Minimal healthcheck — always returns OK so Railway's healthcheck passes."""
    return {"status": "ok"}


@app.get("/api/status")
def status():
    """Detailed initialization + data status."""
    return init_status


def _wait_for_db(max_attempts: int = 30, delay: float = 2.0) -> bool:
    for attempt in range(1, max_attempts + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            init_status["db_connected"] = True
            print(f"[init] DB connected (attempt {attempt})", flush=True)
            return True
        except OperationalError as e:
            print(f"[init] [{attempt}/{max_attempts}] DB not ready: {type(e).__name__}", flush=True)
            time.sleep(delay)
        except Exception as e:
            print(f"[init] unexpected DB error: {type(e).__name__}: {e}", flush=True)
            time.sleep(delay)
    print("[init] DB never became reachable — giving up.", flush=True)
    return False


def _init_schema() -> bool:
    try:
        Base.metadata.create_all(engine)
        init_status["schema_ready"] = True
        print("[init] schema ready", flush=True)
        return True
    except Exception as e:
        print(f"[init] schema error: {e}", flush=True)
        init_status["ingest_message"] = f"schema error: {e}"
        return False


def _ingest_phylis() -> None:
    import os
    from pathlib import Path
    from app.models import SampleRecord

    if os.environ.get("BIOMASSIQ_SKIP_INGEST"):
        init_status["ingest_status"] = "skipped"
        init_status["ingest_message"] = "BIOMASSIQ_SKIP_INGEST=1"
        print("[ingest] skipped via env flag", flush=True)
        return

    db = SessionLocal()
    try:
        count = db.query(SampleRecord).count()
        init_status["sample_count"] = count
        if count > 0:
            init_status["ingest_status"] = "done"
            init_status["ingest_message"] = f"already had {count} samples"
            print(f"[ingest] already have {count} samples — skipping", flush=True)
            return
    finally:
        db.close()

    parsed = Path(__file__).parent / "adapters" / "phylis" / "raw_data" / "parsed_samples.json"
    if not parsed.exists():
        init_status["ingest_status"] = "skipped"
        init_status["ingest_message"] = "no parsed_samples.json bundled"
        print(f"[ingest] no parsed_samples.json at {parsed}", flush=True)
        return

    init_status["ingest_status"] = "running"
    print(f"[ingest] starting from {parsed}", flush=True)
    try:
        from app.adapters.phylis.parser import load_and_parse
        from app.adapters.phylis.mapper import map_samples_to_db
        samples = load_and_parse()
        db = SessionLocal()
        try:
            stats = map_samples_to_db(db, samples)
            init_status["ingest_status"] = "done"
            init_status["ingest_message"] = f"{stats}"
            init_status["sample_count"] = stats.get("samples", 0)
            print(f"[ingest] done: {stats}", flush=True)
        finally:
            db.close()
    except Exception as e:
        import traceback
        traceback.print_exc()
        init_status["ingest_status"] = "error"
        init_status["ingest_message"] = str(e)
        print(f"[ingest] error: {e}", flush=True)


def _background_init() -> None:
    """Full init sequence running in a background thread — doesn't block uvicorn."""
    if _wait_for_db():
        if _init_schema():
            _ingest_phylis()


@app.on_event("startup")
def on_startup() -> None:
    """Kick off init in a background thread so healthcheck passes immediately."""
    print("[startup] FastAPI ready — launching background init", flush=True)
    t = threading.Thread(target=_background_init, daemon=True)
    t.start()
