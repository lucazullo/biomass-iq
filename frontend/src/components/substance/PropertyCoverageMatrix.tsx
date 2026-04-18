"use client";

import type { PropertyCoverage } from "@/lib/types";
import { PROPERTY_CATEGORIES } from "@/lib/types";

interface PropertyCoverageMatrixProps {
  coverage: Record<string, PropertyCoverage>;
  selectedProperties?: string[];
  onSelectedPropertiesChange?: (codes: string[] | undefined) => void;
}

export function PropertyCoverageMatrix({
  coverage,
  selectedProperties,
  onSelectedPropertiesChange,
}: PropertyCoverageMatrixProps) {
  const entries = Object.values(coverage);
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm text-center text-gray-500">
        No property data available for this substance.
      </div>
    );
  }

  const allCodes = entries.map((e) => e.property_code);
  // undefined means "all selected" (no filter active)
  const isAllSelected = !selectedProperties;
  const activeSet = new Set(selectedProperties || allCodes);

  const toggleProperty = (code: string) => {
    if (!onSelectedPropertiesChange) return;

    if (isAllSelected) {
      // First deselection: switch from "all" to "all minus this one"
      onSelectedPropertiesChange(allCodes.filter((c) => c !== code));
    } else {
      const next = activeSet.has(code)
        ? [...activeSet].filter((c) => c !== code)
        : [...activeSet, code];
      // If all are re-selected, go back to undefined (no filter)
      onSelectedPropertiesChange(next.length === allCodes.length ? undefined : next.length === 0 ? undefined : next);
    }
  };

  const selectAll = () => onSelectedPropertiesChange?.(undefined);

  const addGroup = (groupCodes: string[]) => {
    if (!onSelectedPropertiesChange) return;
    if (isAllSelected) return; // already all selected
    const next = [...new Set([...activeSet, ...groupCodes])];
    onSelectedPropertiesChange(next.length === allCodes.length ? undefined : next);
  };

  const removeGroup = (groupCodes: string[]) => {
    if (!onSelectedPropertiesChange) return;
    const groupSet = new Set(groupCodes);
    const current = isAllSelected ? allCodes : [...activeSet];
    const next = current.filter((c) => !groupSet.has(c));
    onSelectedPropertiesChange(next.length === 0 ? undefined : next);
  };

  // Group by category
  const grouped: Record<string, PropertyCoverage[]> = {};
  for (const entry of entries) {
    const cat = entry.category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(entry);
  }

  const selectedCount = isAllSelected ? allCodes.length : activeSet.size;

  return (
    <details className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden" open>
      <summary className="px-6 py-3 bg-slate-50 border-b border-gray-200 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-slate-100 transition flex items-center justify-between">
        <span>Property Coverage</span>
        <span className="text-xs font-normal text-gray-400">
          {selectedCount}/{allCodes.length} selected
        </span>
      </summary>
      <div className="divide-y divide-gray-100">
        {Object.entries(grouped).map(([category, props]) => {
          const categoryCodes = props.map((p) => p.property_code);
          const categoryAllSelected = categoryCodes.every((c) => activeSet.has(c));
          const categoryNoneSelected = categoryCodes.every((c) => !activeSet.has(c));

          return (
            <div key={category} className="px-6 py-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                  {PROPERTY_CATEGORIES[category as keyof typeof PROPERTY_CATEGORIES] || category}
                </h3>
                <button
                  onClick={() =>
                    categoryAllSelected
                      ? removeGroup(categoryCodes)
                      : addGroup(categoryCodes)
                  }
                  className="text-[10px] text-gray-400 hover:text-teal-600 transition"
                >
                  {categoryAllSelected ? "deselect group" : "select group"}
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {props.map((prop) => {
                  const isActive = activeSet.has(prop.property_code);
                  return (
                    <button
                      key={prop.property_code}
                      onClick={() => toggleProperty(prop.property_code)}
                      className={`rounded-lg border px-3 py-2 text-left transition ${
                        isActive
                          ? "border-teal-200 bg-teal-50/50 hover:bg-teal-50"
                          : "border-gray-100 bg-gray-50 opacity-50 hover:opacity-75"
                      }`}
                    >
                      <div className="text-sm font-medium text-gray-700">{prop.display_name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {prop.observation_count} obs
                        <span className="mx-1">&middot;</span>
                        {prop.bases_available.join(", ")}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {!isAllSelected && (
        <div className="px-6 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            Showing {selectedCount} of {allCodes.length} properties
          </span>
          <button
            onClick={selectAll}
            className="text-xs text-teal-600 hover:text-teal-700 transition font-medium"
          >
            Select all
          </button>
        </div>
      )}
    </details>
  );
}
