import statistics as stats
from collections import defaultdict

from sqlalchemy.orm import Session

from app.models import CanonicalSubstance, SampleRecord, Measurement, PropertyDefinition
from app.schemas import ObservationFilters, SummaryOut, PropertyStatisticsOut


def compute_summary(
    db: Session,
    substance_id: str,
    filters: ObservationFilters,
    include_subtypes: bool = False,
) -> SummaryOut:
    """Compute summary statistics for a substance under given filters.

    Critical invariant: statistics are ALWAYS computed per-basis.
    Mixing bases in a single statistical summary is never allowed.
    """
    substance = db.query(CanonicalSubstance).filter(CanonicalSubstance.id == substance_id).first()
    if not substance:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Substance not found")

    # Get substance IDs
    substance_ids = [substance_id]
    if include_subtypes:
        from app.models import SubstanceRelation
        subtypes = (
            db.query(SubstanceRelation.from_id)
            .filter(
                SubstanceRelation.to_id == substance_id,
                SubstanceRelation.relation_type == "broader",
            )
            .all()
        )
        substance_ids.extend([str(s[0]) for s in subtypes])

    # Build sample record query
    sample_query = db.query(SampleRecord.id).filter(SampleRecord.substance_id.in_(substance_ids))
    if filters.source_dataset:
        sample_query = sample_query.filter(SampleRecord.source_dataset.in_(filters.source_dataset))
    if filters.year_min is not None:
        sample_query = sample_query.filter(SampleRecord.year >= filters.year_min)
    if filters.year_max is not None:
        sample_query = sample_query.filter(SampleRecord.year <= filters.year_max)
    if filters.geography:
        sample_query = sample_query.filter(SampleRecord.geography.ilike(f"%{filters.geography}%"))
    if filters.exclude_grouped_averages:
        sample_query = sample_query.filter(SampleRecord.is_grouped_average == False)

    sample_ids = [r[0] for r in sample_query.all()]

    if not sample_ids:
        return SummaryOut(
            substance_id=substance.id,
            substance_name=substance.preferred_name,
            total_observations=0,
            total_sources=0,
            active_filters=filters,
            statistics=[],
        )

    # Get all matching measurements
    meas_query = db.query(Measurement).filter(Measurement.sample_record_id.in_(sample_ids))
    if filters.basis:
        meas_query = meas_query.filter(Measurement.original_basis.in_(filters.basis))
    if filters.derivation:
        meas_query = meas_query.filter(Measurement.derivation.in_(filters.derivation))
    if filters.properties:
        meas_query = meas_query.filter(Measurement.property_code.in_(filters.properties))

    # Exclude nonsensical combinations (moisture on dry/daf basis is definitionally zero)
    meas_query = meas_query.filter(
        ~((Measurement.property_code == "moisture") & (Measurement.original_basis.in_(["dry", "daf"])))
    )

    measurements = meas_query.all()

    # Group by (property_code, basis)
    groups: dict[tuple[str, str], list[float]] = defaultdict(list)
    derivation_flags: dict[tuple[str, str], bool] = defaultdict(lambda: False)
    source_sets: dict[tuple[str, str], set] = defaultdict(set)

    for m in measurements:
        key = (m.property_code, m.original_basis)
        groups[key].append(m.original_value)
        if m.derivation != "observed":
            derivation_flags[key] = True
        source_sets[key].add(m.sample_record_id)

    # Compute statistics per (property, basis) group
    prop_cache = {}
    statistics = []
    for (prop_code, basis), values in sorted(groups.items()):
        if prop_code not in prop_cache:
            prop_def = db.query(PropertyDefinition).filter(PropertyDefinition.code == prop_code).first()
            prop_cache[prop_code] = prop_def

        prop_def = prop_cache[prop_code]
        n = len(values)

        stat = PropertyStatisticsOut(
            property_code=prop_code,
            display_name=prop_def.display_name if prop_def else prop_code,
            category=prop_def.category if prop_def else "other",
            unit=prop_def.canonical_unit if prop_def else "",
            basis=basis,
            count=n,
            source_count=len(source_sets[(prop_code, basis)]),
            includes_derived=derivation_flags[(prop_code, basis)],
        )

        if n >= 1:
            stat.mean = round(stats.mean(values), 4)
            stat.min = round(min(values), 4)
            stat.max = round(max(values), 4)
        if n >= 2:
            stat.median = round(stats.median(values), 4)
            stat.std = round(stats.stdev(values), 4)
        if n >= 4:
            q = stats.quantiles(values, n=4)
            stat.q1 = round(q[0], 4)
            stat.q3 = round(q[2], 4)

        statistics.append(stat)

    # Count unique sources
    all_sources = set()
    for record_id_set in source_sets.values():
        all_sources.update(record_id_set)

    return SummaryOut(
        substance_id=substance.id,
        substance_name=substance.preferred_name,
        total_observations=len(measurements),
        total_sources=len(all_sources),
        active_filters=filters,
        statistics=statistics,
    )
