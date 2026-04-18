from sqlalchemy.orm import Session

from app.models import SampleRecord, Measurement, PropertyDefinition, CanonicalSubstance, SubstanceRelation
from app.schemas import ObservationFilters, SampleRecordOut, MeasurementOut


def get_filtered_observations(
    db: Session,
    substance_id: str,
    filters: ObservationFilters,
    include_subtypes: bool = False,
    page: int = 1,
    page_size: int = 50,
) -> list[SampleRecordOut]:
    """Get filtered observations for a substance with full provenance."""
    # Collect substance IDs to query
    substance_ids = [substance_id]
    if include_subtypes:
        subtypes = (
            db.query(SubstanceRelation.from_id)
            .filter(
                SubstanceRelation.to_id == substance_id,
                SubstanceRelation.relation_type == "broader",
            )
            .all()
        )
        substance_ids.extend([str(s[0]) for s in subtypes])

    # Build query
    query = db.query(SampleRecord).filter(SampleRecord.substance_id.in_(substance_ids))

    # Apply sample-level filters
    if filters.source_dataset:
        query = query.filter(SampleRecord.source_dataset.in_(filters.source_dataset))
    if filters.year_min is not None:
        query = query.filter(SampleRecord.year >= filters.year_min)
    if filters.year_max is not None:
        query = query.filter(SampleRecord.year <= filters.year_max)
    if filters.geography:
        query = query.filter(SampleRecord.geography.ilike(f"%{filters.geography}%"))
    if filters.exclude_grouped_averages:
        query = query.filter(SampleRecord.is_grouped_average == False)

    # Paginate
    offset = (page - 1) * page_size
    records = query.offset(offset).limit(page_size).all()

    # Build output with filtered measurements
    result = []
    for record in records:
        measurements = db.query(Measurement).filter(Measurement.sample_record_id == record.id)

        # Apply measurement-level filters
        if filters.basis:
            measurements = measurements.filter(Measurement.original_basis.in_(filters.basis))
        if filters.derivation:
            measurements = measurements.filter(Measurement.derivation.in_(filters.derivation))
        if filters.properties:
            measurements = measurements.filter(Measurement.property_code.in_(filters.properties))

        # Exclude nonsensical combinations (moisture on dry/daf basis is definitionally zero)
        measurements = measurements.filter(
            ~((Measurement.property_code == "moisture") & (Measurement.original_basis.in_(["dry", "daf"])))
        )

        measurement_list = measurements.all()
        if not measurement_list:
            continue  # Skip records with no matching measurements

        # Get property display names
        prop_cache = {}
        measurement_outs = []
        for m in measurement_list:
            if m.property_code not in prop_cache:
                prop_def = db.query(PropertyDefinition).filter(PropertyDefinition.code == m.property_code).first()
                prop_cache[m.property_code] = prop_def

            prop_def = prop_cache[m.property_code]
            measurement_outs.append(MeasurementOut(
                id=m.id,
                property_code=m.property_code,
                property_name=prop_def.display_name if prop_def else m.property_code,
                category=prop_def.category if prop_def else "other",
                original_value=m.original_value,
                original_unit=m.original_unit,
                original_basis=m.original_basis,
                normalized_value=m.normalized_value,
                normalized_basis=m.normalized_basis,
                derivation=m.derivation,
                conversion_note=m.conversion_note,
                quality_flag=m.quality_flag,
            ))

        result.append(SampleRecordOut(
            id=record.id,
            source_dataset=record.source_dataset,
            source_record_id=record.source_record_id,
            original_name=record.original_name,
            geography=record.geography,
            year=record.year,
            process_state=record.process_state,
            remarks=record.remarks,
            citation=record.citation,
            citation_url=record.citation_url,
            citation_year=record.citation_year,
            submitter=record.submitter,
            is_grouped_average=record.is_grouped_average,
            measurements=measurement_outs,
        ))

    return result
