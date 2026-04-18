from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import SampleRecordOut, ObservationFilters

router = APIRouter()


@router.get("/{substance_id}", response_model=list[SampleRecordOut])
def get_observations(
    substance_id: str,
    basis: list[str] | None = Query(None),
    source_dataset: list[str] | None = Query(None),
    derivation: list[str] | None = Query(None),
    year_min: int | None = None,
    year_max: int | None = None,
    geography: str | None = None,
    exclude_grouped_averages: bool = False,
    properties: list[str] | None = Query(None),
    exclude_sample_ids: list[str] | None = Query(None),
    include_subtypes: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    from app.services.observations import get_filtered_observations

    filters = ObservationFilters(
        basis=basis,
        source_dataset=source_dataset,
        derivation=derivation,
        year_min=year_min,
        year_max=year_max,
        geography=geography,
        exclude_grouped_averages=exclude_grouped_averages,
        properties=properties,
        exclude_sample_ids=exclude_sample_ids,
    )
    return get_filtered_observations(
        db, substance_id, filters,
        include_subtypes=include_subtypes,
        page=page, page_size=page_size,
    )
