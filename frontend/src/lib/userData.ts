/**
 * User-contributed sample data.
 *
 * Stored client-side in localStorage. Each sample is linked to a canonical
 * substance (by UUID) and flows into the same analysis pipeline as PHYLIS data,
 * tagged with source_dataset = "user".
 *
 * Design: keep the shape compatible with SampleRecord from the API so that
 * user samples can be merged into the observations list without conversion
 * beyond a minimal adapter.
 */

import type { AnalyticalBasis, Derivation, Measurement, SampleRecord } from "./types";

const STORAGE_KEY = "biomassiq.user_samples.v1";

export interface UserMeasurement {
  property_code: string;
  property_name: string;
  value: number;
  unit: string;
  basis: AnalyticalBasis;
}

export interface UserSample {
  id: string;                      // UUID
  substance_id: string;             // Linked canonical substance UUID
  substance_name: string;           // Denormalized for display
  original_name: string;            // User-provided sample label
  year: number | null;
  citation: string | null;
  citation_url: string | null;
  submitter: string | null;
  remarks: string | null;
  geography: string | null;
  process_state: string | null;
  measurements: UserMeasurement[];
  created_at: string;               // ISO timestamp
}

// --- CRUD ---

export function listUserSamples(): UserSample[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function listUserSamplesForSubstance(substanceId: string): UserSample[] {
  return listUserSamples().filter((s) => s.substance_id === substanceId);
}

/** Count user samples per canonical substance_id, returned as a Map. */
export function countUserSamplesBySubstance(): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of listUserSamples()) {
    m.set(s.substance_id, (m.get(s.substance_id) ?? 0) + 1);
  }
  return m;
}

/** Unique user-defined substances (those not linked to a PHYLIS UUID — id starts with "user:") */
export function listUserDefinedSubstances(): { id: string; name: string; count: number }[] {
  const m = new Map<string, { name: string; count: number }>();
  for (const s of listUserSamples()) {
    if (!s.substance_id.startsWith("user:")) continue;
    const existing = m.get(s.substance_id);
    if (existing) existing.count += 1;
    else m.set(s.substance_id, { name: s.substance_name, count: 1 });
  }
  return [...m.entries()].map(([id, { name, count }]) => ({ id, name, count }));
}

export function saveUserSample(sample: UserSample): void {
  if (typeof window === "undefined") return;
  const all = listUserSamples();
  const idx = all.findIndex((s) => s.id === sample.id);
  if (idx >= 0) all[idx] = sample;
  else all.push(sample);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function deleteUserSample(id: string): void {
  if (typeof window === "undefined") return;
  const all = listUserSamples().filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function clearUserSamples(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function generateId(): string {
  // Simple RFC4122-ish v4
  return "uuid-" + Math.random().toString(36).slice(2, 10) + "-" + Date.now().toString(36);
}

// --- Adapter: convert UserSample → SampleRecord (for merging with API responses) ---

export function userSampleToSampleRecord(sample: UserSample): SampleRecord {
  const measurements: Measurement[] = sample.measurements.map((m, i) => ({
    id: `${sample.id}-m${i}`,
    property_code: m.property_code,
    property_name: m.property_name,
    category: inferCategory(m.property_code),
    original_value: m.value,
    original_unit: m.unit,
    original_basis: m.basis,
    normalized_value: null,
    normalized_basis: null,
    derivation: "observed" as Derivation,
    conversion_note: null,
    quality_flag: null,
  }));

  return {
    id: sample.id,
    source_dataset: "user",
    source_record_id: sample.id,
    original_name: sample.original_name,
    geography: sample.geography,
    year: sample.year,
    process_state: sample.process_state,
    remarks: sample.remarks,
    citation: sample.citation,
    citation_url: sample.citation_url,
    citation_year: null,
    submitter: sample.submitter,
    is_grouped_average: false,
    measurements,
  };
}

function inferCategory(code: string): string {
  const def = COMMON_PROPERTIES.find((p) => p.code === code);
  return def?.category ?? "other";
}

// --- JSON import/export (full roundtrip) ---

export function exportUserSamplesJson(samples: UserSample[]): string {
  return JSON.stringify({
    format: "biomassiq-user-samples",
    version: 1,
    exported_at: new Date().toISOString(),
    samples,
  }, null, 2);
}

export interface ImportResult {
  ok: boolean;
  added: number;
  skipped: number;
  error?: string;
}

export function importUserSamplesJson(text: string, mode: "merge" | "replace"): ImportResult {
  try {
    const parsed = JSON.parse(text);
    let samples: UserSample[];
    if (Array.isArray(parsed)) {
      samples = parsed;
    } else if (parsed && Array.isArray(parsed.samples)) {
      samples = parsed.samples;
    } else {
      return { ok: false, added: 0, skipped: 0, error: "Unrecognized file format — expected array or { samples: [...] }" };
    }

    // Validate shape of each sample
    const valid: UserSample[] = [];
    for (const s of samples) {
      if (
        typeof s?.id === "string" &&
        typeof s?.substance_id === "string" &&
        typeof s?.substance_name === "string" &&
        typeof s?.original_name === "string" &&
        Array.isArray(s?.measurements)
      ) {
        valid.push({
          id: s.id,
          substance_id: s.substance_id,
          substance_name: s.substance_name,
          original_name: s.original_name,
          year: s.year ?? null,
          citation: s.citation ?? null,
          citation_url: s.citation_url ?? null,
          submitter: s.submitter ?? null,
          remarks: s.remarks ?? null,
          geography: s.geography ?? null,
          process_state: s.process_state ?? null,
          measurements: s.measurements,
          created_at: s.created_at ?? new Date().toISOString(),
        });
      }
    }

    const skipped = samples.length - valid.length;

    if (mode === "replace") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
      return { ok: true, added: valid.length, skipped };
    }

    // Merge: skip samples with duplicate IDs already in storage
    const existing = listUserSamples();
    const existingIds = new Set(existing.map((s) => s.id));
    const toAdd = valid.filter((s) => !existingIds.has(s.id));
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, ...toAdd]));
    return { ok: true, added: toAdd.length, skipped: skipped + (valid.length - toAdd.length) };
  } catch (e) {
    return { ok: false, added: 0, skipped: 0, error: e instanceof Error ? e.message : "Invalid JSON" };
  }
}

// --- CSV export (spreadsheet-friendly, not roundtrip) ---

export function exportUserSamplesCsv(samples: UserSample[]): string {
  const header = [
    "sample_id", "substance_name", "original_name", "year", "submitter", "citation", "citation_url",
    "geography", "process_state", "remarks",
    "property_code", "property_name", "value", "unit", "basis",
  ].join(",");

  const rows: string[] = [];
  for (const s of samples) {
    for (const m of s.measurements) {
      rows.push([
        s.id,
        `"${s.substance_name}"`,
        `"${s.original_name}"`,
        s.year ?? "",
        `"${s.submitter ?? ""}"`,
        `"${s.citation ?? ""}"`,
        s.citation_url ?? "",
        `"${s.geography ?? ""}"`,
        `"${s.process_state ?? ""}"`,
        `"${(s.remarks ?? "").replace(/"/g, "'")}"`,
        m.property_code,
        `"${m.property_name}"`,
        m.value,
        m.unit,
        m.basis,
      ].join(","));
    }
  }
  return `${header}\n${rows.join("\n")}\n`;
}

// Full property catalog — matches what's extracted from PHYLIS, grouped by category
export interface PropertyDef {
  code: string;
  name: string;
  defaultUnit: string;
  category: "proximate" | "ultimate" | "heating" | "ash_chemistry" | "trace_element";
}

export const COMMON_PROPERTIES: PropertyDef[] = [
  // Proximate analysis
  { code: "moisture", name: "Moisture", defaultUnit: "wt%", category: "proximate" },
  { code: "ash", name: "Ash", defaultUnit: "wt%", category: "proximate" },
  { code: "ash_550", name: "Ash (550\u00b0C)", defaultUnit: "wt%", category: "proximate" },
  { code: "ash_815", name: "Ash (815\u00b0C)", defaultUnit: "wt%", category: "proximate" },
  { code: "volatile_matter", name: "Volatile Matter", defaultUnit: "wt%", category: "proximate" },
  { code: "fixed_carbon", name: "Fixed Carbon", defaultUnit: "wt%", category: "proximate" },

  // Ultimate analysis
  { code: "C", name: "Carbon", defaultUnit: "wt%", category: "ultimate" },
  { code: "H", name: "Hydrogen", defaultUnit: "wt%", category: "ultimate" },
  { code: "N", name: "Nitrogen", defaultUnit: "wt%", category: "ultimate" },
  { code: "S", name: "Sulfur", defaultUnit: "wt%", category: "ultimate" },
  { code: "O", name: "Oxygen", defaultUnit: "wt%", category: "ultimate" },
  { code: "Cl", name: "Chlorine", defaultUnit: "mg/kg", category: "ultimate" },
  { code: "F", name: "Fluorine", defaultUnit: "mg/kg", category: "ultimate" },
  { code: "Br", name: "Bromine", defaultUnit: "mg/kg", category: "ultimate" },

  // Heating values
  { code: "HHV", name: "Higher Heating Value", defaultUnit: "MJ/kg", category: "heating" },
  { code: "LHV", name: "Lower Heating Value", defaultUnit: "MJ/kg", category: "heating" },
  { code: "HHV_Milne", name: "HHV (Milne)", defaultUnit: "MJ/kg", category: "heating" },

  // Ash chemistry (wt% of ash)
  { code: "SiO2", name: "Silicon Dioxide", defaultUnit: "wt%", category: "ash_chemistry" },
  { code: "Al2O3", name: "Aluminium Oxide", defaultUnit: "wt%", category: "ash_chemistry" },
  { code: "Fe2O3", name: "Iron Oxide", defaultUnit: "wt%", category: "ash_chemistry" },
  { code: "CaO", name: "Calcium Oxide", defaultUnit: "wt%", category: "ash_chemistry" },
  { code: "MgO", name: "Magnesium Oxide", defaultUnit: "wt%", category: "ash_chemistry" },
  { code: "Na2O", name: "Sodium Oxide", defaultUnit: "wt%", category: "ash_chemistry" },
  { code: "K2O", name: "Potassium Oxide", defaultUnit: "wt%", category: "ash_chemistry" },
  { code: "P2O5", name: "Phosphorus Pentoxide", defaultUnit: "wt%", category: "ash_chemistry" },
  { code: "TiO2", name: "Titanium Dioxide", defaultUnit: "wt%", category: "ash_chemistry" },
  { code: "SO3", name: "Sulfur Trioxide", defaultUnit: "wt%", category: "ash_chemistry" },
  { code: "Mn3O4", name: "Manganese Oxide", defaultUnit: "wt%", category: "ash_chemistry" },
  { code: "BaO", name: "Barium Oxide", defaultUnit: "wt%", category: "ash_chemistry" },
  { code: "SrO", name: "Strontium Oxide", defaultUnit: "wt%", category: "ash_chemistry" },
  { code: "CO2_ash", name: "Carbon Dioxide (ash)", defaultUnit: "wt%", category: "ash_chemistry" },
  { code: "Cl_ash", name: "Chlorine (ash)", defaultUnit: "wt%", category: "ash_chemistry" },

  // Trace elements
  { code: "Cd", name: "Cadmium", defaultUnit: "mg/kg", category: "trace_element" },
  { code: "Cu", name: "Copper", defaultUnit: "mg/kg", category: "trace_element" },
  { code: "Hg", name: "Mercury", defaultUnit: "mg/kg", category: "trace_element" },
  { code: "Pb", name: "Lead", defaultUnit: "mg/kg", category: "trace_element" },
  { code: "Zn", name: "Zinc", defaultUnit: "mg/kg", category: "trace_element" },
  { code: "Ni", name: "Nickel", defaultUnit: "mg/kg", category: "trace_element" },
  { code: "Cr", name: "Chromium", defaultUnit: "mg/kg", category: "trace_element" },
  { code: "As", name: "Arsenic", defaultUnit: "mg/kg", category: "trace_element" },
  { code: "Co", name: "Cobalt", defaultUnit: "mg/kg", category: "trace_element" },
  { code: "Mn", name: "Manganese", defaultUnit: "mg/kg", category: "trace_element" },
  { code: "Mo", name: "Molybdenum", defaultUnit: "mg/kg", category: "trace_element" },
  { code: "Sb", name: "Antimony", defaultUnit: "mg/kg", category: "trace_element" },
  { code: "Se", name: "Selenium", defaultUnit: "mg/kg", category: "trace_element" },
  { code: "V", name: "Vanadium", defaultUnit: "mg/kg", category: "trace_element" },
  { code: "Ba", name: "Barium", defaultUnit: "mg/kg", category: "trace_element" },
];

export const CATEGORY_LABELS: Record<PropertyDef["category"], string> = {
  proximate: "Proximate Analysis",
  ultimate: "Ultimate Analysis",
  heating: "Heating Values",
  ash_chemistry: "Ash Chemistry",
  trace_element: "Trace Elements",
};
