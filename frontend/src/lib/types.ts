// --- Substance ---

export interface Alias {
  label: string;
  alias_type: string;
  source: string | null;
}

export interface SubstanceRelation {
  related_id: string;
  related_name: string;
  relation_type: string;
}

export interface SubstanceSummary {
  id: string;
  preferred_name: string;
  scientific_name: string | null;
  type: string;
  taxonomy_path: string[];
  observation_count: number;
  source_count: number;
}

export interface PropertyCoverage {
  property_code: string;
  display_name: string;
  category: string;
  observation_count: number;
  bases_available: string[];
  sources: string[];
}

export interface SubstanceDetail {
  id: string;
  preferred_name: string;
  scientific_name: string | null;
  type: string;
  taxonomy_path: string[];
  aliases: Alias[];
  relations: SubstanceRelation[];
  property_coverage: Record<string, PropertyCoverage>;
}

// --- Search ---

export interface SearchResult {
  exact_matches: SubstanceSummary[];
  broader_matches: SubstanceSummary[];
  narrower_matches: SubstanceSummary[];
  related_matches: SubstanceSummary[];
}

// --- Observations ---

export interface Measurement {
  id: string;
  property_code: string;
  property_name: string;
  category: string;
  original_value: number;
  original_unit: string;
  original_basis: AnalyticalBasis;
  normalized_value: number | null;
  normalized_basis: AnalyticalBasis | null;
  derivation: Derivation;
  conversion_note: string | null;
  quality_flag: string | null;
}

export interface SampleRecord {
  id: string;
  source_dataset: string;
  source_record_id: string;
  original_name: string;
  geography: string | null;
  year: number | null;
  process_state: string | null;
  remarks: string | null;
  citation: string | null;
  citation_url: string | null;
  citation_year: number | null;
  submitter: string | null;
  is_grouped_average: boolean;
  measurements: Measurement[];
}

export type AnalyticalBasis = "ar" | "dry" | "daf";
export type Derivation = "observed" | "converted" | "imputed";

export interface ObservationFilters {
  basis?: AnalyticalBasis[];
  source_dataset?: string[];
  derivation?: Derivation[];
  year_min?: number;
  year_max?: number;
  geography?: string;
  exclude_grouped_averages?: boolean;
  properties?: string[];
}

// --- Summary ---

export interface PropertyStatistics {
  property_code: string;
  display_name: string;
  category: string;
  unit: string;
  basis: AnalyticalBasis;
  count: number;
  mean: number | null;
  median: number | null;
  std: number | null;
  min: number | null;
  max: number | null;
  q1: number | null;
  q3: number | null;
  missing_count: number;
  source_count: number;
  includes_derived: boolean;
}

export interface Summary {
  substance_id: string;
  substance_name: string;
  total_observations: number;
  total_sources: number;
  active_filters: ObservationFilters;
  statistics: PropertyStatistics[];
}

// --- Property categories for display ---

export const PROPERTY_CATEGORIES = {
  proximate: "Proximate Analysis",
  ultimate: "Ultimate Analysis",
  heating: "Heating Values",
  ash_chemistry: "Ash Chemistry",
  other: "Other",
} as const;

export const BASIS_LABELS: Record<AnalyticalBasis, string> = {
  ar: "As Received",
  dry: "Dry",
  daf: "Dry Ash-Free",
};

export const DERIVATION_LABELS: Record<Derivation, string> = {
  observed: "Observed",
  converted: "Converted",
  imputed: "Imputed",
};
