from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import SummaryOut, ObservationFilters

router = APIRouter()


@router.get("/{substance_id}", response_model=SummaryOut)
def get_summary(
    substance_id: str,
    basis: list[str] | None = Query(None),
    source_dataset: list[str] | None = Query(None),
    derivation: list[str] | None = Query(None),
    year_min: int | None = None,
    year_max: int | None = None,
    geography: str | None = None,
    exclude_grouped_averages: bool = False,
    properties: list[str] | None = Query(None),
    include_subtypes: bool = False,
    db: Session = Depends(get_db),
):
    from app.services.aggregation import compute_summary

    filters = ObservationFilters(
        basis=basis,
        source_dataset=source_dataset,
        derivation=derivation,
        year_min=year_min,
        year_max=year_max,
        geography=geography,
        exclude_grouped_averages=exclude_grouped_averages,
        properties=properties,
    )
    return compute_summary(db, substance_id, filters, include_subtypes=include_subtypes)
