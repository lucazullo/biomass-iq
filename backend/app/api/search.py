from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import CanonicalSubstance, SampleRecord
from app.schemas import SearchResultOut, SubstanceDetailOut, SubstanceSummaryOut
from app.services.search import search_substances, get_substance_detail

router = APIRouter()


@router.get("/substances", response_model=SearchResultOut)
def search(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return search_substances(db, q, limit)


@router.get("/substances/summary", response_model=list[SubstanceSummaryOut])
def bulk_summary(
    ids: str = Query(
        ...,
        description="Comma-separated list of substance UUIDs. "
        "Returns SubstanceSummary rows with fresh observation/source counts.",
    ),
    db: Session = Depends(get_db),
):
    """Cheap refresh endpoint for the basket + similar clients that cache
    `SubstanceSummary` snapshots. Returns only ids that still resolve — IDs
    that have been removed (e.g. merged via dedupe) are silently dropped."""
    id_list = [i.strip() for i in ids.split(",") if i.strip()]
    if not id_list:
        return []
    subs = (
        db.query(CanonicalSubstance)
        .filter(CanonicalSubstance.id.in_(id_list))
        .all()
    )
    # Aggregate sample counts + source counts in one query.
    agg_rows = (
        db.query(
            SampleRecord.substance_id,
            SampleRecord.source_dataset,
        )
        .filter(SampleRecord.substance_id.in_(id_list))
        .all()
    )
    obs_by_id: dict[str, int] = {}
    src_by_id: dict[str, set[str]] = {}
    for sid, dataset in agg_rows:
        obs_by_id[str(sid)] = obs_by_id.get(str(sid), 0) + 1
        if dataset:
            src_by_id.setdefault(str(sid), set()).add(dataset)
    out: list[SubstanceSummaryOut] = []
    for s in subs:
        sid = str(s.id)
        out.append(
            SubstanceSummaryOut(
                id=s.id,
                preferred_name=s.preferred_name,
                scientific_name=s.scientific_name,
                type=s.type,
                taxonomy_path=s.taxonomy_path,
                observation_count=obs_by_id.get(sid, 0),
                source_count=len(src_by_id.get(sid, set())),
            )
        )
    return out


@router.get("/substances/{substance_id}", response_model=SubstanceDetailOut)
def get_substance(
    substance_id: str,
    db: Session = Depends(get_db),
):
    return get_substance_detail(db, substance_id)
