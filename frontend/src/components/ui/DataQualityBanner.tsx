import type { ObservationFilters } from "@/lib/types";
import { formatBasis } from "@/lib/formatters";

interface DataQualityBannerProps {
  totalObservations: number;
  totalSources: number;
  filters: ObservationFilters;
}

export function DataQualityBanner({ totalObservations, totalSources, filters }: DataQualityBannerProps) {
  const activeFilters: string[] = [];
  if (filters.basis?.length) {
    activeFilters.push(`Basis: ${filters.basis.map(formatBasis).join(", ")}`);
  }
  if (filters.derivation?.length) {
    activeFilters.push(`Derivation: ${filters.derivation.join(", ")}`);
  }
  if (filters.exclude_grouped_averages) {
    activeFilters.push("Excluding grouped averages");
  }
  if (filters.source_dataset?.length) {
    activeFilters.push(`Sources: ${filters.source_dataset.join(", ")}`);
  }

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 shadow-sm">
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-sky-900">{totalObservations}</span>
          <span className="text-sky-700">observations</span>
        </div>
        <div className="text-sky-300">|</div>
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-sky-900">{totalSources}</span>
          <span className="text-sky-700">source records</span>
        </div>
        {activeFilters.length > 0 && (
          <>
            <div className="text-sky-300">|</div>
            <div className="text-sky-600 text-xs">
              {activeFilters.join(" \u00b7 ")}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
