"""Parser for CSIRO's 'Database of chemical properties of Australian biomass
and waste' (CC BY 4.0, DOI 10.25919/3yhq-8a44).

Input: a single denormalized CSV where each row is one biomass sample with
~79 columns covering metadata, proximate/ultimate/calorific/ash-chemistry
on four analytical bases (as-received `ar`, air-dried `ad`, dry basis `db`,
dry-ash-free `daf`), plus geography.

Output: a list of `CsiroSample` dataclasses carrying the full property set.
"""

from __future__ import annotations

import csv
from dataclasses import dataclass, field
from pathlib import Path


RAW_DATA_DIR = Path(__file__).parent / "raw_data"

# --- Column → property mapping --------------------------------------------

# Per-basis measurements: (column prefix, property_code, unit, category)
# The CSV always names the basis with the trailing token; we enumerate all
# (prefix, basis) combinations and pull whatever exists.
_PER_BASIS_PROPS: list[tuple[str, str, str, str]] = [
    ("Moist", "moisture", "wt%", "proximate"),
    ("Ash", "ash", "wt%", "proximate"),
    ("VM", "volatile_matter", "wt%", "proximate"),
    ("FC", "fixed_carbon", "wt%", "proximate"),
    ("CV MJ/kg", "HHV", "MJ/kg", "heating"),
    ("C", "C", "wt%", "ultimate"),
    ("H", "H", "wt%", "ultimate"),
    ("N", "N", "wt%", "ultimate"),
    ("S", "S", "wt%", "ultimate"),
    ("O", "O", "wt%", "ultimate"),
    ("Cl mg/kg", "Cl", "mg/kg", "ultimate"),
]

# Bases CSIRO uses; we map "db" → "dry" to align with our canonical basis
# vocabulary. "ad" (air-dried) is new and handled end-to-end.
_BASIS_MAP = {"ar": "ar", "ad": "ad", "db": "dry", "daf": "daf"}

# Ash-chemistry oxide columns (always single column, ash basis).
# Note: CSIRO's "K2O3" column is almost certainly a typo for K2O (potassium
# oxide) — the chemistry doesn't support a stable K2O3 species. We map it to
# our canonical `K2O` code and keep a note.
_ASH_OXIDES: list[tuple[str, str]] = [
    ("Na2O", "Na2O"),
    ("MgO", "MgO"),
    ("Al2O3", "Al2O3"),
    ("SiO2", "SiO2"),
    ("P2O5", "P2O5"),
    ("K2O3", "K2O"),  # CSIRO typo → canonical K2O
    ("CaO", "CaO"),
    ("TiO2", "TiO2"),
    ("Mn3O4", "Mn3O4"),
    ("Fe2O3", "Fe2O3"),
]


# --- Data types -----------------------------------------------------------


@dataclass
class CsiroProperty:
    code: str          # canonical property_code (aligned with PHYLIS vocab)
    name: str          # human display name
    category: str      # proximate | ultimate | heating | ash_chemistry
    unit: str          # wt% | MJ/kg | mg/kg
    basis: str         # ar | ad | dry | daf | ash
    value: float


@dataclass
class CsiroSample:
    csiro_id: str
    name: str
    biomass_type: str
    class_name: str
    subclass: str
    state: str | None
    location_notes: str | None
    full_description: str | None
    notes: str | None
    analysis_note: str | None
    source_code: str | None       # CSIRO provenance handle, e.g. "B2"
    last_mod: str | None
    longitude: float | None
    latitude: float | None
    properties: list[CsiroProperty] = field(default_factory=list)

    @property
    def taxonomy_path(self) -> list[str]:
        parts = [self.biomass_type, self.class_name, self.subclass]
        return [p.strip() for p in parts if p and p.strip()]


# --- Helpers --------------------------------------------------------------


def _parse_float(s: str | None) -> float | None:
    if s is None:
        return None
    s = s.strip()
    if not s or s in {"-", "—", "N/A", "n/a", "NA", "na"}:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _opt_str(s: str | None) -> str | None:
    if s is None:
        return None
    s = s.strip()
    return s or None


# --- Public API -----------------------------------------------------------


def find_data_csv() -> Path:
    """Locate `sample_data_geo.csv` inside whatever version folder is
    currently in `raw_data/`."""
    candidates = list(RAW_DATA_DIR.rglob("sample_data_geo.csv"))
    if not candidates:
        raise FileNotFoundError(
            f"CSIRO sample_data_geo.csv not found under {RAW_DATA_DIR}. "
            "Drop the unzipped DAP bundle in that directory."
        )
    # Prefer the newest version folder name sort if multiple exist.
    candidates.sort(reverse=True)
    return candidates[0]


def load_and_parse(path: Path | None = None) -> list[CsiroSample]:
    csv_path = path or find_data_csv()
    samples: list[CsiroSample] = []
    with open(csv_path, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            sample = _parse_row(row)
            if sample is not None:
                samples.append(sample)
    return samples


def _parse_row(row: dict) -> CsiroSample | None:
    sid = _opt_str(row.get("SampleID"))
    name = _opt_str(row.get("Short Description"))
    if not sid or not name:
        return None  # skip empty/placeholder lines

    sample = CsiroSample(
        csiro_id=sid,
        name=name,
        biomass_type=_opt_str(row.get("Biomass.Type")) or "",
        class_name=_opt_str(row.get("Class")) or "",
        subclass=_opt_str(row.get("Subclass")) or "",
        state=_opt_str(row.get("State")),
        location_notes=_opt_str(row.get("Location.Notes")),
        full_description=_opt_str(row.get("Full Description")),
        notes=_opt_str(row.get("Notes")),
        analysis_note=_opt_str(row.get("Analysis.Note.1")),
        source_code=_opt_str(row.get("Source")),
        last_mod=_opt_str(row.get("Last_Mod")),
        longitude=_parse_float(row.get("Longitude")),
        latitude=_parse_float(row.get("Latitude")),
    )

    # --- per-basis properties ---
    for prefix, code, unit, category in _PER_BASIS_PROPS:
        for basis_raw, basis in _BASIS_MAP.items():
            colname = f"{prefix} {basis_raw}"
            if colname not in row:
                continue
            val = _parse_float(row[colname])
            if val is None:
                continue
            sample.properties.append(
                CsiroProperty(
                    code=code,
                    name=_display_name_for(code),
                    category=category,
                    unit=unit,
                    basis=basis,
                    value=val,
                )
            )

    # --- ash chemistry ---
    for csiro_col, code in _ASH_OXIDES:
        val = _parse_float(row.get(csiro_col))
        if val is None:
            continue
        sample.properties.append(
            CsiroProperty(
                code=code,
                name=_display_name_for(code),
                category="ash_chemistry",
                unit="wt%",
                basis="ash",
                value=val,
            )
        )

    return sample


_DISPLAY_NAMES = {
    "moisture": "Moisture",
    "ash": "Ash",
    "volatile_matter": "Volatile Matter",
    "fixed_carbon": "Fixed Carbon",
    "HHV": "Higher Heating Value",
    "C": "Carbon",
    "H": "Hydrogen",
    "N": "Nitrogen",
    "S": "Sulfur",
    "O": "Oxygen",
    "Cl": "Chlorine",
    "Na2O": "Sodium Oxide",
    "MgO": "Magnesium Oxide",
    "Al2O3": "Aluminium Oxide",
    "SiO2": "Silicon Dioxide",
    "P2O5": "Phosphorus Pentoxide",
    "K2O": "Potassium Oxide",
    "CaO": "Calcium Oxide",
    "TiO2": "Titanium Dioxide",
    "Mn3O4": "Manganese Oxide",
    "Fe2O3": "Iron Oxide",
}


def _display_name_for(code: str) -> str:
    return _DISPLAY_NAMES.get(code, code)
