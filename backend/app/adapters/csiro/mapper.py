"""Map parsed CSIRO samples into canonical BiomassIQ DB rows.

Reuses existing canonical substances (e.g. those created by the PHYLIS
ingest) where a fuzzy name match succeeds; otherwise creates new substances
with the CSIRO taxonomy path. This is what lets per-substance analyses pool
data across PHYLIS and CSIRO."""

from __future__ import annotations

import re
import uuid

from sqlalchemy.orm import Session

from app.models import (
    CanonicalSubstance,
    Alias,
    SampleRecord,
    Measurement,
    PropertyDefinition,
)
from app.adapters.csiro.parser import CsiroSample


# CC BY 4.0 citation prepended to every CSIRO sample's citation field.
CSIRO_CITATION = (
    "CSIRO (2024). Database of chemical properties of Australian biomass "
    "and waste, v69. https://doi.org/10.25919/3yhq-8a44 "
    "(CC BY 4.0)"
)


# --- Substance resolution -------------------------------------------------


_STRIP_PARENS = re.compile(r"\s*\([^)]*\)\s*")
_WHITESPACE = re.compile(r"\s+")


def _normalize_name(name: str) -> str:
    """Collapse minor variants so PHYLIS 'wheat straw' and CSIRO
    'Wheat straw (dry)' both normalize to 'wheat straw'."""
    s = name.lower()
    s = _STRIP_PARENS.sub(" ", s)
    s = _WHITESPACE.sub(" ", s)
    return s.strip()


def _candidate_names(sample: CsiroSample) -> list[str]:
    """Return a prioritized list of names to try when finding an existing
    canonical substance. We check the full 'Short Description' first
    (most specific) and fall back to the Subclass (broader family)."""
    candidates: list[str] = []
    for raw in (sample.name, sample.subclass, sample.class_name):
        if not raw:
            continue
        n = _normalize_name(raw)
        if n and n not in candidates:
            candidates.append(n)
    return candidates


def _infer_substance_type(taxonomy: list[str]) -> str:
    """Very rough type inference so CSIRO-originated substances look the
    same shape as PHYLIS ones in search results."""
    lower = " ".join(taxonomy).lower()
    if "timber" in lower or "wood" in lower or "forest" in lower:
        return "woody_biomass"
    if "agric" in lower or "straw" in lower or "husk" in lower or "manure" in lower:
        return "agricultural_residue"
    if "urban" in lower or "msw" in lower or "waste" in lower or "sewage" in lower:
        return "waste"
    if "industrial" in lower:
        return "industrial_residue"
    return "biomass"


# --- Property definition additions ---------------------------------------


# Additional properties or basis-expansions we must ensure exist before
# CSIRO measurements land. We deliberately include the "ad" basis on every
# proximate/ultimate/heating property since CSIRO reports on it heavily.
_CSIRO_PROPERTY_EXTRAS = [
    # (code, display, category, unit, bases)
    ("moisture", "Moisture", "proximate", "wt%", ["ar", "ad"]),
    ("ash", "Ash", "proximate", "wt%", ["ar", "ad", "dry"]),
    ("volatile_matter", "Volatile Matter", "proximate", "wt%", ["ar", "ad", "dry", "daf"]),
    ("fixed_carbon", "Fixed Carbon", "proximate", "wt%", ["ar", "ad", "dry", "daf"]),
    ("HHV", "Higher Heating Value", "heating", "MJ/kg", ["ar", "ad", "dry", "daf"]),
    ("C", "Carbon", "ultimate", "wt%", ["ar", "ad", "dry", "daf"]),
    ("H", "Hydrogen", "ultimate", "wt%", ["ar", "ad", "dry", "daf"]),
    ("N", "Nitrogen", "ultimate", "wt%", ["ar", "ad", "dry", "daf"]),
    ("S", "Sulfur", "ultimate", "wt%", ["ar", "ad", "dry", "daf"]),
    ("O", "Oxygen", "ultimate", "wt%", ["ar", "ad", "dry", "daf"]),
    ("Cl", "Chlorine", "ultimate", "mg/kg", ["ar", "ad", "dry", "daf"]),
    # Ash chemistry (single basis)
    ("Na2O", "Sodium Oxide", "ash_chemistry", "wt%", ["ash"]),
    ("MgO", "Magnesium Oxide", "ash_chemistry", "wt%", ["ash"]),
    ("Al2O3", "Aluminium Oxide", "ash_chemistry", "wt%", ["ash"]),
    ("SiO2", "Silicon Dioxide", "ash_chemistry", "wt%", ["ash"]),
    ("P2O5", "Phosphorus Pentoxide", "ash_chemistry", "wt%", ["ash"]),
    ("K2O", "Potassium Oxide", "ash_chemistry", "wt%", ["ash"]),
    ("CaO", "Calcium Oxide", "ash_chemistry", "wt%", ["ash"]),
    ("TiO2", "Titanium Dioxide", "ash_chemistry", "wt%", ["ash"]),
    ("Mn3O4", "Manganese Oxide", "ash_chemistry", "wt%", ["ash"]),
    ("Fe2O3", "Iron Oxide", "ash_chemistry", "wt%", ["ash"]),
]


def _ensure_csiro_property_definitions(db: Session) -> None:
    """Merge the CSIRO-required property defs into whatever is already in
    the DB (PHYLIS seeds most of these on first boot). If an existing row is
    missing a basis that CSIRO uses, union it in."""
    for code, display, category, unit, bases in _CSIRO_PROPERTY_EXTRAS:
        existing = db.query(PropertyDefinition).filter(PropertyDefinition.code == code).first()
        if not existing:
            db.add(
                PropertyDefinition(
                    code=code,
                    display_name=display,
                    category=category,
                    canonical_unit=unit,
                    allowed_bases=list(bases),
                )
            )
            continue
        # Union the basis set (so "ad" ends up on existing rows).
        current = set(existing.allowed_bases or [])
        merged = sorted(current.union(bases))
        if merged != sorted(current):
            existing.allowed_bases = merged
    db.commit()


# --- Main ingest ----------------------------------------------------------


def map_samples_to_db(db: Session, samples: list[CsiroSample]) -> dict:
    _ensure_csiro_property_definitions(db)

    # Pre-index existing canonical substances + aliases by normalized name
    # so the match step is O(1) per sample instead of O(N).
    by_name: dict[str, uuid.UUID] = {}
    for sub in db.query(CanonicalSubstance).all():
        if sub.preferred_name:
            by_name.setdefault(_normalize_name(sub.preferred_name), sub.id)
    for alias in db.query(Alias).all():
        if alias.label:
            by_name.setdefault(_normalize_name(alias.label), alias.substance_id)

    new_substances = 0
    reused_substances = 0
    sample_count = 0
    measurement_count = 0

    for sample in samples:
        substance_id, was_new = _resolve_or_create_substance(db, sample, by_name)
        if was_new:
            new_substances += 1
        else:
            reused_substances += 1

        # Build an honest citation so every export can trace back to CSIRO.
        citation_parts = [CSIRO_CITATION]
        if sample.source_code:
            citation_parts.append(f"CSIRO source ref {sample.source_code}")
        citation = "; ".join(citation_parts)

        # Compose remarks: Full Description + Notes + location context
        remarks_parts = []
        for bit in (sample.full_description, sample.notes, sample.analysis_note):
            if bit and bit not in remarks_parts:
                remarks_parts.append(bit)
        if sample.state or sample.location_notes:
            geo = " / ".join(x for x in (sample.state, sample.location_notes) if x)
            if geo:
                remarks_parts.append(f"Location: {geo}")
        remarks = "\n\n".join(remarks_parts) if remarks_parts else None

        # Assemble a geography label (human-readable) for the sample record.
        geo_label: str | None = None
        if sample.state:
            geo_label = f"Australia — {sample.state}"
            if sample.location_notes:
                geo_label += f" ({sample.location_notes})"
        elif sample.location_notes:
            geo_label = sample.location_notes

        record = SampleRecord(
            id=uuid.uuid4(),
            substance_id=substance_id,
            source_dataset="csiro",
            source_record_id=sample.csiro_id,
            original_name=sample.name,
            geography=geo_label,
            year=None,  # CSIRO bundles samples without explicit publication year
            remarks=remarks,
            citation=citation,
            citation_url="https://doi.org/10.25919/3yhq-8a44",
            citation_year=2024,
            submitter="CSIRO Energy",
            ash_type=None,
            is_grouped_average=False,
            mapping_confidence=0.85,
        )
        db.add(record)
        sample_count += 1

        for prop in sample.properties:
            db.add(
                Measurement(
                    id=uuid.uuid4(),
                    sample_record_id=record.id,
                    property_code=prop.code,
                    original_value=prop.value,
                    original_unit=prop.unit,
                    original_basis=prop.basis,
                    derivation="observed",
                )
            )
            measurement_count += 1

    db.commit()
    print(
        f"[csiro] reused {reused_substances} existing substances, "
        f"created {new_substances} new; "
        f"{sample_count} samples; {measurement_count} measurements",
        flush=True,
    )
    return {
        "substances_new": new_substances,
        "substances_reused": reused_substances,
        "samples": sample_count,
        "measurements": measurement_count,
    }


def _resolve_or_create_substance(
    db: Session,
    sample: CsiroSample,
    by_name: dict[str, uuid.UUID],
) -> tuple[uuid.UUID, bool]:
    """Return (substance_id, was_new)."""
    for candidate in _candidate_names(sample):
        hit = by_name.get(candidate)
        if hit is not None:
            # Record the CSIRO-specific spelling as an additional alias so
            # future searches find it via either source's phrasing.
            _add_alias_if_missing(db, hit, sample.name, "source_label", "csiro")
            _add_alias_if_missing(db, hit, sample.subclass, "common", "csiro")
            return hit, False

    # Create fresh canonical substance keyed on the most specific CSIRO label.
    substance_id = uuid.uuid4()
    preferred = sample.subclass or sample.name
    db.add(
        CanonicalSubstance(
            id=substance_id,
            preferred_name=preferred,
            type=_infer_substance_type(sample.taxonomy_path),
            taxonomy_path=sample.taxonomy_path,
        )
    )
    by_name[_normalize_name(preferred)] = substance_id
    _add_alias_if_missing(db, substance_id, sample.name, "source_label", "csiro")
    return substance_id, True


def _add_alias_if_missing(
    db: Session,
    substance_id: uuid.UUID,
    label: str | None,
    alias_type: str,
    source: str,
) -> None:
    if not label:
        return
    existing = (
        db.query(Alias)
        .filter(Alias.substance_id == substance_id, Alias.label == label)
        .first()
    )
    if existing:
        return
    db.add(
        Alias(
            substance_id=substance_id,
            label=label,
            alias_type=alias_type,
            source=source,
        )
    )
