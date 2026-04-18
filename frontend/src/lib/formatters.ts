import type { AnalyticalBasis, Derivation } from "./types";
import { BASIS_LABELS, DERIVATION_LABELS } from "./types";

export function formatBasis(basis: AnalyticalBasis): string {
  return BASIS_LABELS[basis] || basis;
}

export function formatDerivation(derivation: Derivation): string {
  return DERIVATION_LABELS[derivation] || derivation;
}

export function formatValue(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined) return "—";
  return value.toFixed(decimals);
}

export function formatSubstanceType(type: string): string {
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function formatTaxonomyPath(path: string[]): string {
  return path.join(" > ");
}
