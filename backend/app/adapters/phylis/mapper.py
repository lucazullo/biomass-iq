"""
Map parsed PHYLIS data to the canonical BiomassIQ schema.

Creates canonical substances from the PHYLIS taxonomy tree,
then maps sample records and measurements.
"""

import uuid
import re
from collections import defaultdict

from sqlalchemy.orm import Session

from app.models import CanonicalSubstance, Alias, SubstanceRelation, SampleRecord, Measurement, PropertyDefinition
from app.adapters.phylis.parser import PhylisSample


# Substance type inference from taxonomy path
TYPE_KEYWORDS = {
    "agricultural_residue": ["straw", "stover", "husk", "bagasse", "residue", "shell", "cob", "bran", "chaff"],
    "woody": ["wood", "bark", "sawdust", "chip", "forest", "timber", "tree", "pine", "oak", "birch", "willow", "poplar", "eucalyptus", "spruce", "beech"],
    "grass_plant": ["grass", "plant", "reed", "bamboo", "miscanthus", "switchgrass", "hemp", "flax", "jute", "kenaf"],
    "processed": ["pellet", "briquette", "torrefied", "char", "biochar", "pyrolysis", "hydrochar", "treated"],
    "aquatic": ["algae", "seaweed", "marine", "microalgae", "macroalgae"],
    "waste": ["sludge", "manure", "rdf", "msw", "refuse", "waste"],
    "ash": ["ash"],
    "fossil": ["coal", "peat", "lignite", "fossil"],
}


def infer_substance_type(taxonomy_path: list[str]) -> str:
    """Infer substance type from the full taxonomy path."""
    combined = " ".join(taxonomy_path).lower()
    for stype, keywords in TYPE_KEYWORDS.items():
        if any(kw in combined for kw in keywords):
            return stype
    return "other"


def canonical_name_from_taxonomy(taxonomy_path: list[str]) -> str:
    """
    Derive the canonical material name from the taxonomy path.

    The taxonomy path looks like:
      ["untreated wood", "beech", "beech wood", "beech wood (#1234)"]

    The canonical name is the second-to-last element (the material class),
    NOT the leaf (which includes the sample number).
    """
    if len(taxonomy_path) >= 2:
        # Remove the sample-level entry (contains #number)
        for i in range(len(taxonomy_path) - 1, -1, -1):
            if "(#" not in taxonomy_path[i]:
                return taxonomy_path[i]
    return taxonomy_path[-1] if taxonomy_path else "Unknown"


def ensure_property_definitions(db: Session):
    """Ensure all standard property definitions exist."""
    definitions = [
        # Proximate
        ("moisture", "Moisture", "proximate", "wt%", ["ar"]),
        ("ash", "Ash", "proximate", "wt%", ["ar", "dry"]),
        ("ash_550", "Ash (550\u00b0C)", "proximate", "wt%", ["ar", "dry"]),
        ("ash_815", "Ash (815\u00b0C)", "proximate", "wt%", ["ar", "dry"]),
        ("volatile_matter", "Volatile Matter", "proximate", "wt%", ["ar", "dry", "daf"]),
        ("fixed_carbon", "Fixed Carbon", "proximate", "wt%", ["ar", "dry", "daf"]),
        # Ultimate
        ("C", "Carbon", "ultimate", "wt%", ["ar", "dry", "daf"]),
        ("H", "Hydrogen", "ultimate", "wt%", ["ar", "dry", "daf"]),
        ("N", "Nitrogen", "ultimate", "wt%", ["ar", "dry", "daf"]),
        ("S", "Sulfur", "ultimate", "wt%", ["ar", "dry", "daf"]),
        ("O", "Oxygen", "ultimate", "wt%", ["ar", "dry", "daf"]),
        ("Cl", "Chlorine", "ultimate", "mg/kg", ["ar", "dry", "daf"]),
        ("F", "Fluorine", "ultimate", "mg/kg", ["ar", "dry", "daf"]),
        ("Br", "Bromine", "ultimate", "mg/kg", ["ar", "dry", "daf"]),
        # Heating values
        ("HHV", "Higher Heating Value", "heating", "MJ/kg", ["ar", "dry", "daf"]),
        ("LHV", "Lower Heating Value", "heating", "MJ/kg", ["ar", "dry", "daf"]),
        ("HHV_Milne", "HHV (Milne)", "heating", "MJ/kg", ["ar", "dry", "daf"]),
        # Ash chemistry
        ("SiO2", "Silicon Dioxide", "ash_chemistry", "wt%", ["ash"]),
        ("Al2O3", "Aluminium Oxide", "ash_chemistry", "wt%", ["ash"]),
        ("Fe2O3", "Iron Oxide", "ash_chemistry", "wt%", ["ash"]),
        ("CaO", "Calcium Oxide", "ash_chemistry", "wt%", ["ash"]),
        ("MgO", "Magnesium Oxide", "ash_chemistry", "wt%", ["ash"]),
        ("Na2O", "Sodium Oxide", "ash_chemistry", "wt%", ["ash"]),
        ("K2O", "Potassium Oxide", "ash_chemistry", "wt%", ["ash"]),
        ("P2O5", "Phosphorus Pentoxide", "ash_chemistry", "wt%", ["ash"]),
        ("TiO2", "Titanium Dioxide", "ash_chemistry", "wt%", ["ash"]),
        ("SO3", "Sulfur Trioxide", "ash_chemistry", "wt%", ["ash"]),
        ("Mn3O4", "Manganese Oxide", "ash_chemistry", "wt%", ["ash"]),
        ("BaO", "Barium Oxide", "ash_chemistry", "wt%", ["ash"]),
        ("SrO", "Strontium Oxide", "ash_chemistry", "wt%", ["ash"]),
        ("CO2_ash", "Carbon Dioxide (ash)", "ash_chemistry", "wt%", ["ash"]),
        ("Cl_ash", "Chlorine (ash)", "ash_chemistry", "wt%", ["ash"]),
        # Trace elements (dry basis)
        ("Cd", "Cadmium", "trace_element", "mg/kg", ["dry"]),
        ("Cu", "Copper", "trace_element", "mg/kg", ["dry"]),
        ("Hg", "Mercury", "trace_element", "mg/kg", ["dry"]),
        ("Pb", "Lead", "trace_element", "mg/kg", ["dry"]),
        ("Zn", "Zinc", "trace_element", "mg/kg", ["dry"]),
        ("Ni", "Nickel", "trace_element", "mg/kg", ["dry"]),
        ("Cr", "Chromium", "trace_element", "mg/kg", ["dry"]),
        ("As", "Arsenic", "trace_element", "mg/kg", ["dry"]),
        ("Co", "Cobalt", "trace_element", "mg/kg", ["dry"]),
        ("Mn", "Manganese", "trace_element", "mg/kg", ["dry"]),
        ("Mo", "Molybdenum", "trace_element", "mg/kg", ["dry"]),
        ("Sb", "Antimony", "trace_element", "mg/kg", ["dry"]),
        ("Se", "Selenium", "trace_element", "mg/kg", ["dry"]),
        ("V", "Vanadium", "trace_element", "mg/kg", ["dry"]),
        ("Ba", "Barium", "trace_element", "mg/kg", ["dry"]),
    ]

    for code, display_name, category, unit, bases in definitions:
        existing = db.query(PropertyDefinition).filter(PropertyDefinition.code == code).first()
        if not existing:
            db.add(PropertyDefinition(
                code=code,
                display_name=display_name,
                category=category,
                canonical_unit=unit,
                allowed_bases=bases,
            ))

    db.commit()


def map_samples_to_db(db: Session, samples: list[PhylisSample]) -> dict:
    """
    Map parsed PHYLIS samples to canonical DB records.

    Groups samples by their canonical material name (derived from taxonomy),
    creates canonical substances, then maps sample records and measurements.

    Returns stats dict.
    """
    ensure_property_definitions(db)

    # Group samples by canonical material name
    groups: dict[str, list[PhylisSample]] = defaultdict(list)
    for sample in samples:
        canonical_name = canonical_name_from_taxonomy(sample.taxonomy_path)
        groups[canonical_name].append(sample)

    substance_count = 0
    sample_count = 0
    measurement_count = 0
    substance_map: dict[str, uuid.UUID] = {}  # canonical_name → substance_id

    for canonical_name, group_samples in groups.items():
        representative = group_samples[0]

        # Build taxonomy path (strip the sample-level leaf)
        tax_path = [t for t in representative.taxonomy_path if "(#" not in t]

        substance_id = uuid.uuid4()
        substance = CanonicalSubstance(
            id=substance_id,
            preferred_name=canonical_name,
            type=infer_substance_type(tax_path),
            taxonomy_path=tax_path,
        )
        db.add(substance)
        substance_map[canonical_name] = substance_id

        # Add alias
        db.add(Alias(
            substance_id=substance_id,
            label=canonical_name,
            alias_type="source_label",
            source="phylis",
        ))

        # Map each sample
        for sample in group_samples:
            record = SampleRecord(
                id=uuid.uuid4(),
                substance_id=substance_id,
                source_dataset="phylis",
                source_record_id=str(sample.phylis_id),
                original_name=sample.name,
                remarks=sample.remarks,
                citation=sample.literature,
                citation_url=sample.literature_url,
                citation_year=sample.literature_year,
                submitter=sample.submitter,
                ash_type=sample.ash_type,
                is_grouped_average=False,
                mapping_confidence=1.0,
            )
            db.add(record)
            sample_count += 1

            for prop in sample.properties:
                # Ensure property definition exists for unmapped properties
                existing = db.query(PropertyDefinition).filter(
                    PropertyDefinition.code == prop.code
                ).first()
                if not existing:
                    db.add(PropertyDefinition(
                        code=prop.code,
                        display_name=prop.name,
                        category=prop.category,
                        canonical_unit=prop.unit,
                        allowed_bases=[prop.basis],
                    ))
                    db.flush()

                measurement = Measurement(
                    id=uuid.uuid4(),
                    sample_record_id=record.id,
                    property_code=prop.code,
                    original_value=prop.value,
                    original_unit=prop.unit,
                    original_basis=prop.basis,
                    derivation="observed",
                )
                db.add(measurement)
                measurement_count += 1

        substance_count += 1

    db.commit()

    # Build substance relations (broader/narrower) from taxonomy
    _build_taxonomy_relations(db, substance_map, samples)

    stats = {
        "substances": substance_count,
        "samples": sample_count,
        "measurements": measurement_count,
    }
    print(f"Mapped {substance_count} substances, {sample_count} samples, {measurement_count} measurements")
    return stats


def _build_taxonomy_relations(
    db: Session,
    substance_map: dict[str, uuid.UUID],
    samples: list[PhylisSample],
):
    """
    Build broader/narrower relations between substances based on taxonomy.

    If "wheat straw" and "wheat straw (Danish)" both exist,
    and they share a common parent in the taxonomy, create a relation.
    """
    # Group substances by their parent taxonomy path
    parent_children: dict[str, list[str]] = defaultdict(list)
    name_to_path: dict[str, list[str]] = {}

    for sample in samples:
        name = canonical_name_from_taxonomy(sample.taxonomy_path)
        if name not in name_to_path:
            tax_path = [t for t in sample.taxonomy_path if "(#" not in t]
            name_to_path[name] = tax_path
            if len(tax_path) >= 2:
                parent = tax_path[-2]
                parent_children[parent].append(name)

    # For each parent with multiple children, if the parent is also a substance, create relations
    relations_created = 0
    for parent_name, children in parent_children.items():
        if parent_name in substance_map and len(children) > 1:
            parent_id = substance_map[parent_name]
            for child_name in children:
                if child_name != parent_name and child_name in substance_map:
                    child_id = substance_map[child_name]
                    db.add(SubstanceRelation(
                        from_id=child_id,
                        to_id=parent_id,
                        relation_type="narrower",
                    ))
                    relations_created += 1

    if relations_created:
        db.commit()
        print(f"Created {relations_created} taxonomy relations")
