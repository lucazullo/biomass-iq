"use client";

import type { ObservationFilters, AnalyticalBasis, Derivation } from "@/lib/types";
import { BASIS_LABELS, DERIVATION_LABELS } from "@/lib/types";

interface FilterBarProps {
  filters: ObservationFilters;
  onFiltersChange: (filters: ObservationFilters) => void;
}

export function FilterBar({ filters, onFiltersChange }: FilterBarProps) {
  const toggleBasis = (basis: AnalyticalBasis) => {
    const current = filters.basis || [];
    const updated = current.includes(basis)
      ? current.filter((b) => b !== basis)
      : [...current, basis];
    onFiltersChange({ ...filters, basis: updated.length > 0 ? updated : undefined });
  };

  const toggleDerivation = (deriv: Derivation) => {
    const current = filters.derivation || [];
    const updated = current.includes(deriv)
      ? current.filter((d) => d !== deriv)
      : [...current, deriv];
    onFiltersChange({ ...filters, derivation: updated.length > 0 ? updated : undefined });
  };

  const activeCount = [
    filters.basis?.length,
    filters.derivation?.length,
    filters.exclude_grouped_averages ? 1 : 0,
  ].filter(Boolean).length;

  return (
    <div className="flex flex-wrap items-center gap-4 text-sm">
      {/* Basis filters */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-gray-400 mr-1">Basis:</span>
        {(Object.entries(BASIS_LABELS) as [AnalyticalBasis, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => toggleBasis(key)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
              !filters.basis || filters.basis.includes(key)
                ? "bg-teal-50 text-teal-700 border border-teal-200"
                : "bg-gray-50 text-gray-400 border border-gray-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Derivation filters */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-gray-400 mr-1">Values:</span>
        {(Object.entries(DERIVATION_LABELS) as [Derivation, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => toggleDerivation(key)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
              !filters.derivation || filters.derivation.includes(key)
                ? "bg-sky-50 text-sky-700 border border-sky-200"
                : "bg-gray-50 text-gray-400 border border-gray-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Grouped averages toggle */}
      <label className="flex items-center gap-1.5 text-xs text-gray-500">
        <input
          type="checkbox"
          checked={filters.exclude_grouped_averages || false}
          onChange={(e) =>
            onFiltersChange({ ...filters, exclude_grouped_averages: e.target.checked || undefined })
          }
          className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
        />
        Exclude grouped averages
      </label>

      {/* Clear filters */}
      {activeCount > 0 && (
        <button
          onClick={() => onFiltersChange({})}
          className="text-xs text-gray-400 hover:text-gray-600 transition"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
