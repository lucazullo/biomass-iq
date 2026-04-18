"use client";

import { useEffect, useMemo, useState } from "react";
import type { SubstanceSummary, Summary } from "@/lib/types";
import { PROPERTY_CATEGORIES } from "@/lib/types";
import { GroupEditor, type SubstanceGroup } from "@/components/summary/GroupEditor";
import { ComparisonStats } from "@/components/summary/ComparisonStats";
import { mergeSummaries } from "@/lib/mergeSummaries";
import { useExcludedSamples } from "@/lib/exclusions";
import { useUnitSystem, convertSummary } from "@/lib/unitConversion";

interface CompareTabProps {
  /** The shared selection basket — drives everything in this tab. */
  basket: SubstanceSummary[];
  onRemoveFromBasket: (id: string) => void;
  onClearBasket: () => void;
  /** Jumps back to the Search tab so the user can find more substances to add. */
  onGoToSearch: () => void;
}

export function CompareTab({
  basket,
  onRemoveFromBasket,
  onClearBasket,
  onGoToSearch,
}: CompareTabProps) {
  const [perSubstanceSummaries, setPerSubstanceSummaries] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<SubstanceGroup[]>([]);
  // undefined = all properties selected (no active filter)
  const [selectedProperties, setSelectedProperties] = useState<string[] | undefined>(undefined);
  const { excluded: excludedSampleIds } = useExcludedSamples();
  const { system: unitSystem } = useUnitSystem();

  // Re-fetch whenever the basket membership or outlier-exclusion set changes.
  const basketKey = basket.map((s) => s.id).sort().join(",");
  const exclusionsKey = excludedSampleIds.slice().sort().join(",");

  useEffect(() => {
    if (basket.length < 2) {
      setPerSubstanceSummaries([]);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const { compareSubstances } = await import("@/lib/api");
        const items = basket.map((s) => ({
          substance_id: s.id,
          filters:
            excludedSampleIds.length > 0
              ? { exclude_sample_ids: excludedSampleIds }
              : undefined,
        }));
        const data = await compareSubstances(items);
        if (cancelled) return;
        setPerSubstanceSummaries(data);
      } catch {
        if (cancelled) return;
        setError("Failed to load comparison data. Please try again.");
        setPerSubstanceSummaries([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basketKey, exclusionsKey]);

  // Reset groups to "one group per substance" when the substance set changes.
  useEffect(() => {
    if (perSubstanceSummaries.length < 2) {
      setGroups([]);
      return;
    }
    const currentIds = new Set(groups.flatMap((g) => g.substance_ids));
    const newIds = new Set(perSubstanceSummaries.map((s) => s.substance_id));
    const sameSet =
      currentIds.size === newIds.size && [...currentIds].every((id) => newIds.has(id));
    if (sameSet && groups.length > 0) return;
    setGroups(
      perSubstanceSummaries.map((s) => ({
        id: `g-sub-${s.substance_id}`,
        name: s.substance_name,
        substance_ids: [s.substance_id],
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perSubstanceSummaries.map((s) => s.substance_id).join(",")]);

  // Pool each group's members into one Summary.
  const groupedSummariesAll = useMemo<Summary[]>(() => {
    if (perSubstanceSummaries.length === 0) return [];
    if (groups.length === 0) return perSubstanceSummaries;
    return groups
      .filter((g) => g.substance_ids.length > 0)
      .map((g) => {
        const members = g.substance_ids
          .map((id) => perSubstanceSummaries.find((s) => s.substance_id === id))
          .filter(Boolean) as Summary[];
        if (members.length === 0) return null;
        if (members.length === 1) {
          return { ...members[0], substance_name: g.name, substance_id: g.id };
        }
        const merged = mergeSummaries(members, {});
        return { ...merged, substance_name: g.name, substance_id: g.id };
      })
      .filter(Boolean) as Summary[];
  }, [groups, perSubstanceSummaries]);

  // Catalog of properties available across all groups (union, deduped by property_code).
  const availableProperties = useMemo(() => {
    const byCode = new Map<
      string,
      { code: string; name: string; category: string; count: number }
    >();
    for (const s of groupedSummariesAll) {
      for (const stat of s.statistics) {
        const existing = byCode.get(stat.property_code);
        if (existing) {
          existing.count += stat.count;
        } else {
          byCode.set(stat.property_code, {
            code: stat.property_code,
            name: stat.display_name,
            category: stat.category,
            count: stat.count,
          });
        }
      }
    }
    return [...byCode.values()].sort(
      (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
    );
  }, [groupedSummariesAll]);

  // Apply the property filter to each group's statistics.
  const groupedSummaries = useMemo<Summary[]>(() => {
    if (!selectedProperties) return groupedSummariesAll;
    const allow = new Set(selectedProperties);
    return groupedSummariesAll.map((s) => ({
      ...s,
      statistics: s.statistics.filter((st) => allow.has(st.property_code)),
    }));
  }, [groupedSummariesAll, selectedProperties]);

  return (
    <>
      {/* Basket panel */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Compare Substances</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Uses your selection basket. Add or remove substances from the basket to change the
              comparison scope; organize them into groups below to pool within-group data.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={onGoToSearch}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
            >
              + Search to add
            </button>
            {basket.length > 0 && (
              <button
                onClick={onClearBasket}
                className="text-xs text-gray-400 hover:text-gray-600 transition"
              >
                Clear basket
              </button>
            )}
          </div>
        </div>

        {basket.length === 0 ? (
          <EmptyState onGoToSearch={onGoToSearch} />
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {basket.map((s) => (
              <span
                key={s.id}
                className="flex items-center gap-1.5 rounded-lg bg-teal-50 border border-teal-200 pl-2.5 pr-1 py-1 text-xs text-teal-800"
                title={s.taxonomy_path.join(" > ")}
              >
                <span className="truncate max-w-[220px]">{s.preferred_name}</span>
                <span className="text-[10px] text-teal-600">{s.observation_count}</span>
                <button
                  onClick={() => onRemoveFromBasket(s.id)}
                  className="rounded-full bg-teal-200 w-4 h-4 flex items-center justify-center text-teal-700 hover:bg-teal-300 shrink-0"
                  title={`Remove ${s.preferred_name}`}
                >
                  <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        )}

        {basket.length === 1 && (
          <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Add at least one more substance to the basket to enable comparison.
          </p>
        )}
      </section>

      {/* Loading / error */}
      {loading && (
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm text-center text-sm text-gray-500">
          Loading comparison data…
        </section>
      )}
      {error && !loading && (
        <section className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </section>
      )}

      {/* Group editor */}
      {!loading && !error && perSubstanceSummaries.length >= 2 && (
        <GroupEditor
          summaries={perSubstanceSummaries}
          groups={groups}
          onGroupsChange={setGroups}
        />
      )}

      {/* Property filter */}
      {!loading && !error && availableProperties.length > 0 && groupedSummariesAll.length >= 2 && (
        <PropertyFilterPanel
          properties={availableProperties}
          selected={selectedProperties}
          onSelectedChange={setSelectedProperties}
        />
      )}

      {/* Comparison results */}
      {!loading && !error && groupedSummaries.length >= 2 && (
        <ComparisonStats
          summaries={groupedSummaries.map((s) => convertSummary(s, unitSystem))}
        />
      )}
    </>
  );
}

interface PropertyFilterPanelProps {
  properties: { code: string; name: string; category: string; count: number }[];
  selected: string[] | undefined;
  onSelectedChange: (codes: string[] | undefined) => void;
}

function PropertyFilterPanel({
  properties,
  selected,
  onSelectedChange,
}: PropertyFilterPanelProps) {
  const allCodes = properties.map((p) => p.code);
  const isAllSelected = !selected;
  const activeSet = new Set(selected || allCodes);
  const activeCount = isAllSelected ? allCodes.length : activeSet.size;

  const toggleOne = (code: string) => {
    if (isAllSelected) {
      onSelectedChange(allCodes.filter((c) => c !== code));
      return;
    }
    const next = activeSet.has(code)
      ? [...activeSet].filter((c) => c !== code)
      : [...activeSet, code];
    if (next.length === 0) onSelectedChange([]);
    else if (next.length === allCodes.length) onSelectedChange(undefined);
    else onSelectedChange(next);
  };

  const toggleGroup = (codes: string[], allOn: boolean) => {
    if (allOn) {
      const next = (isAllSelected ? allCodes : [...activeSet]).filter(
        (c) => !codes.includes(c),
      );
      onSelectedChange(next.length === allCodes.length ? undefined : next);
    } else {
      const next = [...new Set([...(isAllSelected ? allCodes : [...activeSet]), ...codes])];
      onSelectedChange(next.length === allCodes.length ? undefined : next);
    }
  };

  const grouped: Record<string, typeof properties> = {};
  for (const p of properties) {
    if (!grouped[p.category]) grouped[p.category] = [];
    grouped[p.category].push(p);
  }

  return (
    <details className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden" open>
      <summary className="px-6 py-3 bg-slate-50 border-b border-gray-200 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-slate-100 transition flex items-center justify-between">
        <span>Property filter</span>
        <span className="text-xs font-normal text-gray-500">
          {activeCount}/{allCodes.length} properties
        </span>
      </summary>
      <div className="divide-y divide-gray-100">
        {Object.entries(grouped).map(([category, props]) => {
          const codes = props.map((p) => p.code);
          const allOn = codes.every((c) => activeSet.has(c));
          return (
            <div key={category} className="px-6 py-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                  {PROPERTY_CATEGORIES[category as keyof typeof PROPERTY_CATEGORIES] || category}
                </h3>
                <button
                  onClick={() => toggleGroup(codes, allOn)}
                  className="text-[10px] text-gray-400 hover:text-teal-600 transition"
                >
                  {allOn ? "deselect group" : "select group"}
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                {props.map((p) => {
                  const isActive = activeSet.has(p.code);
                  return (
                    <button
                      key={p.code}
                      onClick={() => toggleOne(p.code)}
                      className={`rounded-md border px-2.5 py-1.5 text-left text-xs transition ${
                        isActive
                          ? "border-teal-200 bg-teal-50/60 hover:bg-teal-50 text-gray-700"
                          : "border-gray-100 bg-gray-50 opacity-50 hover:opacity-75 text-gray-600"
                      }`}
                    >
                      <div className="font-medium truncate">{p.name}</div>
                      <div className="text-[10px] text-gray-400">{p.count} obs</div>
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
            Showing {activeCount} of {allCodes.length} properties
          </span>
          <button
            onClick={() => onSelectedChange(undefined)}
            className="text-xs text-teal-600 hover:text-teal-700 transition font-medium"
          >
            Select all
          </button>
        </div>
      )}
    </details>
  );
}

function EmptyState({ onGoToSearch }: { onGoToSearch: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-6 py-8 text-center">
      <p className="text-sm text-gray-600 mb-3">
        Your basket is empty.
      </p>
      <p className="text-xs text-gray-500 mb-4">
        Search for materials and add them to the basket — the Compare tab will use the basket as
        its input and let you organize substances into groups for pooled comparison.
      </p>
      <button
        onClick={onGoToSearch}
        className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition"
      >
        Go to Search
      </button>
    </div>
  );
}
