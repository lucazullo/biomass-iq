"use client";

import type { SearchResult, SubstanceSummary } from "@/lib/types";
import { formatSubstanceType, formatTaxonomyPath } from "@/lib/formatters";

interface SearchResultsProps {
  results: SearchResult;
  basket: SubstanceSummary[];
  onAddToBasket: (s: SubstanceSummary) => void;
  onRemoveFromBasket: (id: string) => void;
}

export function SearchResults({ results, basket, onAddToBasket, onRemoveFromBasket }: SearchResultsProps) {
  const basketIds = new Set(basket.map((s) => s.id));

  const allMatches = [
    ...results.exact_matches,
    ...results.narrower_matches,
    ...results.related_matches,
  ];
  const broaderMatches = results.broader_matches;

  // Detect name collisions — when multiple results share the same preferred_name
  const allResults = [...allMatches, ...broaderMatches];
  const nameCounts = new Map<string, number>();
  for (const s of allResults) {
    const lower = s.preferred_name.toLowerCase();
    nameCounts.set(lower, (nameCounts.get(lower) || 0) + 1);
  }
  const ambiguousNames = new Set(
    [...nameCounts.entries()].filter(([, count]) => count > 1).map(([name]) => name),
  );

  if (allMatches.length === 0 && broaderMatches.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No matching substances found.
      </div>
    );
  }

  const toggleSelect = (s: SubstanceSummary) => {
    if (basketIds.has(s.id)) onRemoveFromBasket(s.id);
    else onAddToBasket(s);
  };

  const resultsInBasket = allResults.filter((s) => basketIds.has(s.id)).length;
  const allInBasket = allResults.length > 0 && resultsInBasket === allResults.length;

  return (
    <div className="space-y-4">
      {/* Add-all toggle */}
      <div className="flex items-center justify-between px-1">
        <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
          <input
            type="checkbox"
            checked={allInBasket}
            ref={(el) => { if (el) el.indeterminate = resultsInBasket > 0 && resultsInBasket < allResults.length; }}
            onChange={() => {
              if (allInBasket) {
                for (const s of allResults) onRemoveFromBasket(s.id);
              } else {
                for (const s of allResults) onAddToBasket(s);
              }
            }}
            className="rounded border-gray-300 text-teal-600 focus:ring-teal-500 h-3.5 w-3.5"
          />
          {resultsInBasket === 0
            ? "Add all to basket"
            : allInBasket
              ? "Remove all from basket"
              : `${resultsInBasket} of ${allResults.length} in basket`}
        </label>
        <p className="text-[10px] text-gray-400">Check items to accumulate across searches</p>
      </div>

      {/* Material list with checkboxes — scrollable */}
      <div className="max-h-[50vh] overflow-y-auto space-y-0.5">
        {allMatches.map((s) => (
          <SubstanceRow
            key={s.id}
            substance={s}
            selected={basketIds.has(s.id)}
            onToggle={() => toggleSelect(s)}
            isAmbiguous={ambiguousNames.has(s.preferred_name.toLowerCase())}
          />
        ))}

        {/* Broader categories */}
        {broaderMatches.length > 0 && (
          <div className="pt-2 mt-1 border-t border-gray-100">
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1 px-2">
              Broader categories
            </p>
            {broaderMatches.map((s) => (
              <SubstanceRow
                key={s.id}
                substance={s}
                selected={basketIds.has(s.id)}
                onToggle={() => toggleSelect(s)}
                isBroader
                isAmbiguous={ambiguousNames.has(s.preferred_name.toLowerCase())}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SubstanceRow({
  substance,
  selected,
  onToggle,
  isBroader = false,
  isAmbiguous = false,
}: {
  substance: SubstanceSummary;
  selected: boolean;
  onToggle: () => void;
  isBroader?: boolean;
  isAmbiguous?: boolean;
}) {
  // When names collide, show a qualifier from the taxonomy path
  // e.g. "MSW (other)" appears under both "char" and "RDF and MSW" — show the parent
  const qualifier = isAmbiguous && substance.taxonomy_path.length >= 2
    ? substance.taxonomy_path.slice(0, -1).join(" > ")
    : null;

  // These come from the augmented search results (optional on SubstanceSummary)
  const userCount = (substance as SubstanceSummary & { user_count?: number }).user_count ?? 0;
  const isUserDefined = (substance as SubstanceSummary & { is_user_defined?: boolean }).is_user_defined ?? false;
  // observation_count from API is PHYLIS-only. User count is additive.
  const phylisCount = isUserDefined ? 0 : substance.observation_count;

  return (
    <label
      className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 cursor-pointer transition text-sm ${
        selected
          ? "border-teal-300 bg-teal-50/50"
          : isUserDefined
            ? "border-amber-200 bg-amber-50/30 hover:border-amber-300"
            : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50"
      } ${isBroader ? "opacity-75" : ""}`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="rounded border-gray-300 text-teal-600 focus:ring-teal-500 shrink-0 h-3.5 w-3.5"
      />
      <span className="font-medium text-gray-800 truncate">
        {substance.preferred_name}
      </span>
      {isUserDefined && (
        <span className="rounded bg-amber-100 border border-amber-300 px-1 py-0 text-[10px] font-medium text-amber-800 shrink-0">
          user-defined
        </span>
      )}
      {qualifier && (
        <span className="rounded bg-amber-50 border border-amber-200 px-1 py-0 text-[10px] font-medium text-amber-700 shrink-0">
          {qualifier}
        </span>
      )}
      {!isUserDefined && (
        <span className="text-xs text-gray-400 truncate hidden sm:inline">
          {formatTaxonomyPath(substance.taxonomy_path)}
        </span>
      )}
      <span className="ml-auto flex items-center gap-1.5 shrink-0">
        {phylisCount > 0 && (
          <span className="text-xs text-gray-500 tabular-nums whitespace-nowrap">
            <span className="font-medium text-gray-700">{phylisCount}</span>{" "}
            <span className="text-[10px] text-gray-400">PHYLIS</span>
          </span>
        )}
        {userCount > 0 && (
          <span className="rounded bg-amber-50 border border-amber-200 px-1.5 py-0 text-[10px] font-medium text-amber-800 whitespace-nowrap">
            {userCount} user
          </span>
        )}
        {!isUserDefined && (
          <span className="rounded bg-teal-50 px-1.5 py-0 text-[10px] font-medium text-teal-700 border border-teal-200">
            {formatSubstanceType(substance.type)}
          </span>
        )}
      </span>
    </label>
  );
}
