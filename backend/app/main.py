import threading
import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app.config import settings
from app.api import search, observations, summary, compare, export, sources as sources_api
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
app.include_router(sources_api.router, prefix="/api/sources", tags=["sources"])


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


def _redact_url(url: str) -> str:
    """Strip credentials from a DB URL for safe logging."""
    import re
    return re.sub(r"://[^@]*@", "://***:***@", url)


def _wait_for_db(max_attempts: int = 30, delay: float = 2.0) -> bool:
    import os
    # Log the (redacted) target on first attempt so we can see WHERE it's trying to connect
    db_url = os.environ.get("DATABASE_URL", "")
    print(f"[init] DB target: {_redact_url(db_url)}", flush=True)

    for attempt in range(1, max_attempts + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            init_status["db_connected"] = True
            print(f"[init] DB connected (attempt {attempt})", flush=True)
            return True
        except OperationalError as e:
            msg = str(e)[:200]
            print(f"[init] [{attempt}/{max_attempts}] DB not ready: {type(e).__name__}: {msg}", flush=True)
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
        # Seed source_status rows on first boot.
        try:
            from app.services.source_check import seed_sources_if_empty
            db = SessionLocal()
            try:
                seed_sources_if_empty(db)
            finally:
                db.close()
        except Exception as seed_err:
            print(f"[init] source seed warning: {seed_err}", flush=True)
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

    # Pre-compute the "scraped leaf count" from the bundled JSON so we can
    # baseline source_status against PHYLIS as-scraped, not against the
    # subset that parses successfully. Otherwise the drift checker will
    # report a false positive for every sample we don't yet parse.
    parsed = Path(__file__).parent / "adapters" / "phylis" / "raw_data" / "parsed_samples.json"
    scraped_count = 0
    if parsed.exists():
        try:
            import json as _json
            with open(parsed) as _f:
                scraped_count = len(_json.load(_f))
        except Exception:  # noqa: BLE001
            scraped_count = 0

    db = SessionLocal()
    try:
        count = db.query(SampleRecord).count()
        init_status["sample_count"] = count
        if count > 0:
            init_status["ingest_status"] = "done"
            init_status["ingest_message"] = f"already had {count} samples"
            print(f"[ingest] already have {count} samples — skipping", flush=True)
            # Baseline source_status against the scraped leaf count (falls back to DB count).
            try:
                from app.services.source_check import mark_ingested
                mark_ingested(db, "phylis", scraped_count or count)
            except Exception as exc:  # noqa: BLE001
                print(f"[ingest] mark_ingested warning: {exc}", flush=True)
            return
    finally:
        db.close()

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
            # Baseline against the scraped leaf count (tracks upstream drift correctly,
            # even if some samples are dropped downstream for not having parseable
            # property tables).
            try:
                from app.services.source_check import mark_ingested
                baseline = scraped_count or int(stats.get("samples", 0))
                mark_ingested(db, "phylis", baseline)
            except Exception as exc:  # noqa: BLE001
                print(f"[ingest] mark_ingested warning: {exc}", flush=True)
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
            # Start the periodic source-drift scheduler once the DB is ready.
            try:
                from app.services.scheduler import start_scheduler
                start_scheduler()
            except Exception as exc:  # noqa: BLE001
                print(f"[init] scheduler failed to start: {exc}", flush=True)


@app.on_event("startup")
def on_startup() -> None:
    """Kick off init in a background thread so healthcheck passes immediately."""
    print("[startup] FastAPI ready — launching background init", flush=True)
    t = threading.Thread(target=_background_init, daemon=True)
    t.start()
