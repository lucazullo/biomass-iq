"""
Parse scraped PHYLIS JSON data into intermediate records.

Takes the output of scraper.py (parsed_samples.json) and maps
property names to canonical codes for the BiomassIQ schema.
"""

import json
from dataclasses import dataclass, field
from pathlib import Path

RAW_DATA_DIR = Path(__file__).parent / "raw_data"


@dataclass
class PhylisProperty:
    """A single property measurement from PHYLIS."""
    code: str
    name: str
    value: float
    unit: str
    basis: str  # ar, dry, daf, ash
    category: str  # proximate, ultimate, heating, ash_chemistry, trace_element, other


@dataclass
class PhylisSample:
    """A parsed PHYLIS sample record."""
    phylis_id: int
    name: str
    taxonomy_path: list[str]
    category_id: str
    submitter: str | None = None
    literature: str | None = None
    literature_url: str | None = None
    literature_year: int | None = None
    ash_type: str | None = None
    remarks: str | None = None
    properties: list[PhylisProperty] = field(default_factory=list)


# Map PHYLIS property names → (canonical_code, category, canonical_unit)
# Keys are lowercased, stripped property names from the HTML
PROPERTY_MAP: dict[str, tuple[str, str, str]] = {
    # Proximate analysis
    "moisture content": ("moisture", "proximate", "wt%"),
    "ash content": ("ash", "proximate", "wt%"),
    "ash content at 550°c": ("ash_550", "proximate", "wt%"),
    "ash content at 815°c": ("ash_815", "proximate", "wt%"),
    "volatile matter": ("volatile_matter", "proximate", "wt%"),
    "fixed carbon": ("fixed_carbon", "proximate", "wt%"),
    # Ultimate analysis
    "carbon": ("C", "ultimate", "wt%"),
    "hydrogen": ("H", "ultimate", "wt%"),
    "nitrogen": ("N", "ultimate", "wt%"),
    "sulphur": ("S", "ultimate", "wt%"),
    "sulfur": ("S", "ultimate", "wt%"),
    "oxygen": ("O", "ultimate", "wt%"),
    "chlorine (cl)": ("Cl", "ultimate", "mg/kg"),
    "fluorine (f)": ("F", "ultimate", "mg/kg"),
    "bromine (br)": ("Br", "ultimate", "mg/kg"),
    # Heating values
    "net calorific value (lhv)": ("LHV", "heating", "MJ/kg"),
    "gross calorific value (hhv)": ("HHV", "heating", "MJ/kg"),
    "hhvmilne": ("HHV_Milne", "heating", "MJ/kg"),
    # Ash chemistry (wt% of ash)
    "sio2": ("SiO2", "ash_chemistry", "wt%"),
    "al2o3": ("Al2O3", "ash_chemistry", "wt%"),
    "fe2o3": ("Fe2O3", "ash_chemistry", "wt%"),
    "cao": ("CaO", "ash_chemistry", "wt%"),
    "mgo": ("MgO", "ash_chemistry", "wt%"),
    "na2o": ("Na2O", "ash_chemistry", "wt%"),
    "k2o": ("K2O", "ash_chemistry", "wt%"),
    "p2o5": ("P2O5", "ash_chemistry", "wt%"),
    "tio2": ("TiO2", "ash_chemistry", "wt%"),
    "so3": ("SO3", "ash_chemistry", "wt%"),
    "mn3o4": ("Mn3O4", "ash_chemistry", "wt%"),
    "bao": ("BaO", "ash_chemistry", "wt%"),
    "sro": ("SrO", "ash_chemistry", "wt%"),
    "co2": ("CO2_ash", "ash_chemistry", "wt%"),
    "cl": ("Cl_ash", "ash_chemistry", "wt%"),
    "undetermined": ("undetermined_ash", "ash_chemistry", "wt%"),
    # Trace elements (mg/kg dry basis or ash basis)
    "cadmium (cd)": ("Cd", "trace_element", "mg/kg"),
    "copper (cu)": ("Cu", "trace_element", "mg/kg"),
    "mercury (hg)": ("Hg", "trace_element", "mg/kg"),
    "lead (pb)": ("Pb", "trace_element", "mg/kg"),
    "zinc (zn)": ("Zn", "trace_element", "mg/kg"),
    "nickel (ni)": ("Ni", "trace_element", "mg/kg"),
    "chromium (cr)": ("Cr", "trace_element", "mg/kg"),
    "arsenic (as)": ("As", "trace_element", "mg/kg"),
    "cobalt (co)": ("Co", "trace_element", "mg/kg"),
    "manganese (mn)": ("Mn", "trace_element", "mg/kg"),
    "molybdenum (mo)": ("Mo", "trace_element", "mg/kg"),
    "antimony (sb)": ("Sb", "trace_element", "mg/kg"),
    "selenium (se)": ("Se", "trace_element", "mg/kg"),
    "tin (sn)": ("Sn", "trace_element", "mg/kg"),
    "tellurium (te)": ("Te", "trace_element", "mg/kg"),
    "thallium (tl)": ("Tl", "trace_element", "mg/kg"),
    "vanadium (v)": ("V", "trace_element", "mg/kg"),
    "barium (ba)": ("Ba", "trace_element", "mg/kg"),
    "beryllium (be)": ("Be", "trace_element", "mg/kg"),
    # Also handle ash-basis trace elements (same names without parentheses)
    "pb": ("Pb_ash", "trace_element", "mg/kg"),
    "cd": ("Cd_ash", "trace_element", "mg/kg"),
    "cu": ("Cu_ash", "trace_element", "mg/kg"),
    "hg": ("Hg_ash", "trace_element", "mg/kg"),
    "zn": ("Zn_ash", "trace_element", "mg/kg"),
    "ni": ("Ni_ash", "trace_element", "mg/kg"),
    "cr": ("Cr_ash", "trace_element", "mg/kg"),
    "as": ("As_ash", "trace_element", "mg/kg"),
}

# Properties to skip (computed totals, not primary measurements)
SKIP_PROPERTIES = {
    "total (with halides)",
    "total (without halides)",
    "sum of ash constituents",
}


def map_property(name: str, unit: str, basis: str, value: float) -> PhylisProperty | None:
    """Map a scraped property to a canonical PhylisProperty."""
    name_lower = name.strip().lower()

    if name_lower in SKIP_PROPERTIES:
        return None

    if name_lower in PROPERTY_MAP:
        code, category, canonical_unit = PROPERTY_MAP[name_lower]
        return PhylisProperty(
            code=code,
            name=name.strip(),
            value=value,
            unit=unit or canonical_unit,
            basis=basis,
            category=category,
        )

    # Unmapped property — still store it with a generated code
    code = name_lower.replace(" ", "_").replace("(", "").replace(")", "")[:50]
    return PhylisProperty(
        code=code,
        name=name.strip(),
        value=value,
        unit=unit,
        basis=basis,
        category="other",
    )


def parse_scraped_samples(raw_samples: list[dict]) -> list[PhylisSample]:
    """Convert scraped JSON records into PhylisSample objects."""
    samples = []

    for raw in raw_samples:
        sample = PhylisSample(
            phylis_id=raw["sample_id"],
            name=raw.get("material", "Unknown"),
            taxonomy_path=raw.get("taxonomy_path", []),
            category_id=raw.get("category_id", ""),
            submitter=raw.get("submitter"),
            literature=raw.get("literature"),
            literature_url=raw.get("literature_url"),
            literature_year=raw.get("literature_year"),
            ash_type=raw.get("ash_type"),
            remarks=raw.get("remarks"),
        )

        for prop_raw in raw.get("properties", []):
            prop = map_property(
                prop_raw["name"],
                prop_raw.get("unit", ""),
                prop_raw["basis"],
                prop_raw["value"],
            )
            if prop:
                sample.properties.append(prop)

        if sample.properties:
            samples.append(sample)

    return samples


def load_and_parse() -> list[PhylisSample]:
    """Load scraped PHYLIS data from disk and parse it."""
    path = RAW_DATA_DIR / "parsed_samples.json"
    if not path.exists():
        raise FileNotFoundError(f"Scraped data not found at {path}. Run the scraper first.")

    with open(path) as f:
        raw_data = json.load(f)

    return parse_scraped_samples(raw_data)
