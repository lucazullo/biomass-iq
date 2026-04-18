"""Internal scheduler — runs the source-drift check on a periodic loop.

Hosted inside the FastAPI process itself so we don't depend on host-specific
cron infrastructure (Render cron, systemd timers, etc.). Portable by design:
moving hosts only requires the same env vars.
"""

from __future__ import annotations

import threading
import time
from datetime import datetime

from app.config import settings
from app.database import SessionLocal
from app.services.source_check import run_source_checks


def _tick() -> None:
    db = SessionLocal()
    try:
        print(
            f"[scheduler] running source checks at {datetime.utcnow().isoformat()}Z",
            flush=True,
        )
        results = run_source_checks(db)
        for r in results:
            print(f"[scheduler]   {r}", flush=True)
    except Exception as exc:  # noqa: BLE001
        print(f"[scheduler] check failed: {type(exc).__name__}: {exc}", flush=True)
    finally:
        db.close()


def _loop(interval_seconds: float, initial_delay_seconds: float) -> None:
    # Delay first run so the app finishes its startup ingest before we hammer
    # the DB with additional queries.
    time.sleep(initial_delay_seconds)
    while True:
        _tick()
        time.sleep(interval_seconds)


def start_scheduler() -> None:
    if settings.source_check_disabled:
        print("[scheduler] disabled via BIOMASSIQ_SOURCE_CHECK_DISABLED", flush=True)
        return
    interval = max(60.0, settings.source_check_interval_hours * 3600.0)
    # First check happens ~5 minutes after boot, giving the initial ingest time
    # to settle and ensuring /api/sources returns something immediately.
    initial_delay = 300.0
    print(
        f"[scheduler] will check sources every {interval / 3600:.2f}h"
        f" (first check in {initial_delay / 60:.1f} min)",
        flush=True,
    )
    t = threading.Thread(
        target=_loop,
        args=(interval, initial_delay),
        daemon=True,
        name="biomassiq-source-checker",
    )
    t.start()
