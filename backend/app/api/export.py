import csv
import io
import json

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import ObservationFilters

router = APIRouter()


@router.get("/observations/{substance_id}/csv")
def export_observations_csv(
    substance_id: str,
    basis: list[str] | None = Query(None),
    source_dataset: list[str] | None = Query(None),
    derivation: list[str] | None = Query(None),
    year_min: int | None = None,
    year_max: int | None = None,
    exclude_grouped_averages: bool = False,
    properties: list[str] | None = Query(None),
    exclude_sample_ids: list[str] | None = Query(None),
    db: Session = Depends(get_db),
):
    from app.services.observations import get_filtered_observations
    from app.services.export import observations_to_csv

    filters = ObservationFilters(
        basis=basis,
        source_dataset=source_dataset,
        derivation=derivation,
        year_min=year_min,
        year_max=year_max,
        exclude_grouped_averages=exclude_grouped_averages,
        properties=properties,
        exclude_sample_ids=exclude_sample_ids,
    )
    records = get_filtered_observations(db, substance_id, filters, page=1, page_size=10000)
    content = observations_to_csv(records)

    return StreamingResponse(
        io.StringIO(content),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=biomassiq_observations_{substance_id}.csv"},
    )


@router.get("/observations/{substance_id}/json")
def export_observations_json(
    substance_id: str,
    basis: list[str] | None = Query(None),
    source_dataset: list[str] | None = Query(None),
    derivation: list[str] | None = Query(None),
    year_min: int | None = None,
    year_max: int | None = None,
    exclude_grouped_averages: bool = False,
    properties: list[str] | None = Query(None),
    exclude_sample_ids: list[str] | None = Query(None),
    db: Session = Depends(get_db),
):
    from app.services.observations import get_filtered_observations

    filters = ObservationFilters(
        basis=basis,
        source_dataset=source_dataset,
        derivation=derivation,
        year_min=year_min,
        year_max=year_max,
        exclude_grouped_averages=exclude_grouped_averages,
        properties=properties,
        exclude_sample_ids=exclude_sample_ids,
    )
    records = get_filtered_observations(db, substance_id, filters, page=1, page_size=10000)

    data = [r.model_dump(mode="json") for r in records]
    content = json.dumps(data, indent=2)

    return StreamingResponse(
        io.StringIO(content),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=biomassiq_observations_{substance_id}.json"},
    )
