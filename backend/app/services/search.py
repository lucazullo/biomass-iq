from uuid import UUID

from sqlalchemy import func, or_, text
from sqlalchemy.orm import Session

from app.models import CanonicalSubstance, Alias, SubstanceRelation
from app.schemas import SearchResultOut, SubstanceSummaryOut, SubstanceDetailOut, AliasOut, SubstanceRelationOut, PropertyCoverageOut


def search_substances(db: Session, query: str, limit: int = 20) -> SearchResultOut:
    """Search for substances using full-text and trigram matching."""
    normalized = query.strip().lower()

    # Exact match on preferred_name
    exact = (
        db.query(CanonicalSubstance)
        .filter(func.lower(CanonicalSubstance.preferred_name) == normalized)
        .all()
    )

    # Alias matches
    alias_hits = (
        db.query(Alias.substance_id)
        .filter(func.lower(Alias.label).contains(normalized))
        .distinct()
        .limit(limit)
        .all()
    )
    alias_substance_ids = {a[0] for a in alias_hits}
    exact_ids = {s.id for s in exact}

    # Broader matches (parent taxonomy)
    broader = []
    narrower = []
    related = []

    if exact:
        substance = exact[0]
        # Find broader (parents in taxonomy)
        if len(substance.taxonomy_path) > 1:
            parent_path = substance.taxonomy_path[:-1]
            broader = (
                db.query(CanonicalSubstance)
                .filter(CanonicalSubstance.taxonomy_path == parent_path)
                .limit(5)
                .all()
            )

        # Find narrower (children)
        narrower = (
            db.query(CanonicalSubstance)
            .filter(
                CanonicalSubstance.taxonomy_path[1:len(substance.taxonomy_path)] == substance.taxonomy_path,
                func.array_length(CanonicalSubstance.taxonomy_path, 1) == len(substance.taxonomy_path) + 1,
                CanonicalSubstance.id != substance.id,
            )
            .limit(10)
            .all()
        )

        # Related via substance_relation
        related_ids = (
            db.query(SubstanceRelation.to_id)
            .filter(SubstanceRelation.from_id == substance.id)
            .union(
                db.query(SubstanceRelation.from_id)
                .filter(SubstanceRelation.to_id == substance.id)
            )
            .all()
        )
        if related_ids:
            related = (
                db.query(CanonicalSubstance)
                .filter(CanonicalSubstance.id.in_([r[0] for r in related_ids]))
                .all()
            )

    # Fuzzy matches from aliases (not already in exact)
    fuzzy_substances = []
    remaining_ids = alias_substance_ids - exact_ids
    if remaining_ids:
        fuzzy_substances = (
            db.query(CanonicalSubstance)
            .filter(CanonicalSubstance.id.in_(remaining_ids))
            .limit(limit)
            .all()
        )

    # Also do a LIKE search on preferred_name for non-exact matches
    like_matches = (
        db.query(CanonicalSubstance)
        .filter(
            func.lower(CanonicalSubstance.preferred_name).contains(normalized),
            CanonicalSubstance.id.notin_(exact_ids | remaining_ids),
        )
        .limit(limit)
        .all()
    )

    all_additional = fuzzy_substances + like_matches

    def to_summary(s: CanonicalSubstance) -> SubstanceSummaryOut:
        return SubstanceSummaryOut(
            id=s.id,
            preferred_name=s.preferred_name,
            scientific_name=s.scientific_name,
            type=s.type,
            taxonomy_path=s.taxonomy_path,
            observation_count=len(s.sample_records) if s.sample_records else 0,
        )

    # Deduplicate: a substance should only appear in one category.
    # Priority: exact > broader > narrower/additional > related
    seen_ids: set = set()

    exact_out = []
    for s in exact:
        exact_out.append(to_summary(s))
        seen_ids.add(s.id)

    broader_out = []
    for s in broader:
        if s.id not in seen_ids:
            broader_out.append(to_summary(s))
            seen_ids.add(s.id)

    narrower_out = []
    for s in list(narrower) + all_additional:
        if s.id not in seen_ids:
            narrower_out.append(to_summary(s))
            seen_ids.add(s.id)

    related_out = []
    for s in related:
        if s.id not in seen_ids:
            related_out.append(to_summary(s))
            seen_ids.add(s.id)

    return SearchResultOut(
        exact_matches=exact_out,
        broader_matches=broader_out,
        narrower_matches=narrower_out,
        related_matches=related_out,
    )


def get_substance_detail(db: Session, substance_id: str) -> SubstanceDetailOut:
    """Get full detail for a substance including property coverage."""
    substance = db.query(CanonicalSubstance).filter(CanonicalSubstance.id == substance_id).first()
    if not substance:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Substance not found")

    # Build property coverage
    from app.models import Measurement, SampleRecord, PropertyDefinition
    from sqlalchemy import distinct

    coverage = {}
    props = db.query(PropertyDefinition).all()
    for prop in props:
        measurements = (
            db.query(Measurement)
            .join(SampleRecord)
            .filter(
                SampleRecord.substance_id == substance.id,
                Measurement.property_code == prop.code,
            )
            .all()
        )
        if measurements:
            bases = list({m.original_basis for m in measurements})
            sources = list({
                db.query(SampleRecord.source_dataset)
                .filter(SampleRecord.id == m.sample_record_id)
                .scalar()
                for m in measurements
            })
            coverage[prop.code] = PropertyCoverageOut(
                property_code=prop.code,
                display_name=prop.display_name,
                category=prop.category,
                observation_count=len(measurements),
                bases_available=bases,
                sources=sources,
            )

    # Relations
    relations = []
    for rel in substance.relations_from:
        relations.append(SubstanceRelationOut(
            related_id=rel.to_id,
            related_name=rel.to_substance.preferred_name,
            relation_type=rel.relation_type,
        ))
    for rel in substance.relations_to:
        relations.append(SubstanceRelationOut(
            related_id=rel.from_id,
            related_name=rel.from_substance.preferred_name,
            relation_type=f"inverse_{rel.relation_type}",
        ))

    return SubstanceDetailOut(
        id=substance.id,
        preferred_name=substance.preferred_name,
        scientific_name=substance.scientific_name,
        type=substance.type,
        taxonomy_path=substance.taxonomy_path,
        aliases=[AliasOut.model_validate(a) for a in substance.aliases],
        relations=relations,
        property_coverage=coverage,
    )
