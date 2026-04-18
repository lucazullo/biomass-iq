from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import SearchResultOut, SubstanceDetailOut
from app.services.search import search_substances, get_substance_detail

router = APIRouter()


@router.get("/substances", response_model=SearchResultOut)
def search(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return search_substances(db, q, limit)


@router.get("/substances/{substance_id}", response_model=SubstanceDetailOut)
def get_substance(
    substance_id: str,
    db: Session = Depends(get_db),
):
    return get_substance_detail(db, substance_id)
