from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import ComparisonRequest, SummaryOut

router = APIRouter()


@router.post("/substances", response_model=list[SummaryOut])
def compare_substances(
    request: ComparisonRequest,
    db: Session = Depends(get_db),
):
    from app.services.aggregation import compute_summary
    from app.schemas import ObservationFilters

    results = []
    for item in request.items:
        filters = item.filters or ObservationFilters()
        if request.properties:
            filters.properties = request.properties
        summary = compute_summary(db, str(item.substance_id), filters)
        results.append(summary)
    return results
