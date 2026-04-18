from uuid import UUID

from pydantic import BaseModel


# --- Substance ---

class AliasOut(BaseModel):
    label: str
    alias_type: str
    source: str | None = None

    model_config = {"from_attributes": True}


class SubstanceRelationOut(BaseModel):
    related_id: UUID
    related_name: str
    relation_type: str


class SubstanceSummaryOut(BaseModel):
    id: UUID
    preferred_name: str
    scientific_name: str | None = None
    type: str
    taxonomy_path: list[str]
    observation_count: int = 0
    source_count: int = 0

    model_config = {"from_attributes": True}


class SubstanceDetailOut(BaseModel):
    id: UUID
    preferred_name: str
    scientific_name: str | None = None
    type: str
    taxonomy_path: list[str]
    aliases: list[AliasOut]
    relations: list[SubstanceRelationOut]
    property_coverage: dict[str, "PropertyCoverageOut"]

    model_config = {"from_attributes": True}


class PropertyCoverageOut(BaseModel):
    property_code: str
    display_name: str
    category: str
    observation_count: int
    bases_available: list[str]
    sources: list[str]


# --- Search ---

class SearchResultOut(BaseModel):
    exact_matches: list[SubstanceSummaryOut]
    broader_matches: list[SubstanceSummaryOut]
    narrower_matches: list[SubstanceSummaryOut]
    related_matches: list[SubstanceSummaryOut]


# --- Observations ---

class MeasurementOut(BaseModel):
    id: UUID
    property_code: str
    property_name: str
    category: str
    original_value: float
    original_unit: str
    original_basis: str
    normalized_value: float | None = None
    normalized_basis: str | None = None
    derivation: str
    conversion_note: str | None = None
    quality_flag: str | None = None

    model_config = {"from_attributes": True}


class SampleRecordOut(BaseModel):
    id: UUID
    source_dataset: str
    source_record_id: str
    original_name: str
    geography: str | None = None
    year: int | None = None
    process_state: str | None = None
    remarks: str | None = None
    citation: str | None = None
    citation_url: str | None = None
    citation_year: int | None = None
    submitter: str | None = None
    is_grouped_average: bool
    measurements: list[MeasurementOut]

    model_config = {"from_attributes": True}


class ObservationFilters(BaseModel):
    basis: list[str] | None = None        # ar, dry, daf
    source_dataset: list[str] | None = None
    derivation: list[str] | None = None   # observed, converted, imputed
    year_min: int | None = None
    year_max: int | None = None
    geography: str | None = None
    exclude_grouped_averages: bool = False
    properties: list[str] | None = None


# --- Summary ---

class PropertyStatisticsOut(BaseModel):
    property_code: str
    display_name: str
    category: str
    unit: str = ""
    basis: str
    count: int
    mean: float | None = None
    median: float | None = None
    std: float | None = None
    min: float | None = None
    max: float | None = None
    q1: float | None = None
    q3: float | None = None
    missing_count: int = 0
    source_count: int = 0
    includes_derived: bool = False


class SummaryOut(BaseModel):
    substance_id: UUID
    substance_name: str
    total_observations: int
    total_sources: int
    active_filters: ObservationFilters
    statistics: list[PropertyStatisticsOut]


# --- Compare ---

class ComparisonRequestItem(BaseModel):
    substance_id: UUID
    filters: ObservationFilters | None = None


class ComparisonRequest(BaseModel):
    items: list[ComparisonRequestItem]
    properties: list[str] | None = None
