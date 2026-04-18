from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import SourceStatus
from app.services.source_check import VERSION_BASED_SOURCES

router = APIRouter()


class SourceStatusOut(BaseModel):
    id: str
    display_name: str
    url: str | None
    description: str | None
    notes: str | None
    status: str
    last_ingested_at: datetime | None
    last_checked_at: datetime | None
    known_record_count: int
    upstream_record_count: int | None
    needs_update: bool
    last_check_error: str | None
    # "count" — record count from last scrape; "version" — DAP version number.
    baseline_kind: Literal["count", "version"]

    model_config = {"from_attributes": True}


def _row_to_out(src: SourceStatus) -> SourceStatusOut:
    return SourceStatusOut(
        id=src.id,
        display_name=src.display_name,
        url=src.url,
        description=src.description,
        notes=src.notes,
        status=src.status,
        last_ingested_at=src.last_ingested_at,
        last_checked_at=src.last_checked_at,
        known_record_count=src.known_record_count,
        upstream_record_count=src.upstream_record_count,
        needs_update=src.needs_update,
        last_check_error=src.last_check_error,
        baseline_kind="version" if src.id in VERSION_BASED_SOURCES else "count",
    )


@router.get("", response_model=list[SourceStatusOut])
def list_sources(db: Session = Depends(get_db)):
    rows = db.query(SourceStatus).order_by(SourceStatus.status, SourceStatus.display_name).all()
    return [_row_to_out(r) for r in rows]


@router.post("/check", response_model=list[dict])
def force_check(db: Session = Depends(get_db)):
    """Trigger a source-drift check immediately (admin-only in practice)."""
    from app.services.source_check import run_source_checks

    return run_source_checks(db)


@router.post("/{source_id}/acknowledge", response_model=SourceStatusOut)
def acknowledge(source_id: str, db: Session = Depends(get_db)):
    """Clear the `needs_update` flag — e.g. after the admin has re-ingested
    the source. Safer to drive this from the ingest pipeline directly via
    `mark_ingested()`, but the manual escape hatch is useful."""
    src = db.query(SourceStatus).filter(SourceStatus.id == source_id).one_or_none()
    if not src:
        raise HTTPException(status_code=404, detail="unknown source")
    src.needs_update = False
    src.last_check_error = None
    db.commit()
    db.refresh(src)
    return _row_to_out(src)
