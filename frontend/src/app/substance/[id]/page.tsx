"use client";

import { useState, useEffect, useMemo, useCallback, use } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getSubstance, getObservations, getSummary } from "@/lib/api";
import type { SubstanceDetail, SampleRecord, Summary, ObservationFilters, PropertyStatistics } from "@/lib/types";
import { SubstanceHeader } from "@/components/substance/SubstanceHeader";
import { PropertyCoverageMatrix } from "@/components/substance/PropertyCoverageMatrix";
import { ObservationTable } from "@/components/observations/ObservationTable";
import { FilterBar } from "@/components/observations/FilterBar";
import { StatisticsPanel } from "@/components/summary/StatisticsPanel";
import { DistributionCharts } from "@/components/summary/DistributionCharts";
import { DataQualityBanner } from "@/components/ui/DataQualityBanner";
import { QuickStats } from "@/components/summary/QuickStats";
import { ComparisonStats } from "@/components/summary/ComparisonStats";
import { GroupEditor, type SubstanceGroup } from "@/components/summary/GroupEditor";
import { listUserSamplesForSubstance, userSampleToSampleRecord } from "@/lib/userData";
import { mergeSummaries } from "@/lib/mergeSummaries";
import { SelectionBasket } from "@/components/search/SelectionBasket";
import { useBasket } from "@/lib/basket";
import { useExcludedSamples } from "@/lib/exclusions";
import { UnitSystemToggle } from "@/components/ui/UnitSystemToggle";
import { useUnitSystem, convertSummary } from "@/lib/unitConversion";
import { ReferencesPanel } from "@/components/observations/ReferencesPanel";
import { MyDataModal } from "@/components/ui/MyDataModal";

type ViewMode = "observations" | "synthesis";

export default function SubstancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: primaryIdRaw } = use(params);
  // Next.js may leave route params URL-encoded; decode once so colons (e.g. "user:...") survive.
  const primaryId = decodeURIComponent(primaryIdRaw);
  const searchParams = useSearchParams();
  const alsoIds = searchParams.getAll("also").map(decodeURIComponent);
  const ids = useMemo(() => [primaryId, ...alsoIds], [primaryId, alsoIds.join(",")]);
  const isMulti = ids.length > 1;
  const rawId = ids.join(",");

  const router = useRouter();

  const { basket, removeFromBasket, clearBasket } = useBasket();
  const { excluded: excludedSampleIds } = useExcludedSamples();
  const { system: unitSystem } = useUnitSystem();
  const [substances, setSubstances] = useState<SubstanceDetail[]>([]);
  const [observations, setObservations] = useState<SampleRecord[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [perSubstanceSummaries, setPerSubstanceSummaries] = useState<Summary[]>([]);
  const [filters, setFilters] = useState<ObservationFilters>({});
  const [viewMode, setViewMode] = useState<ViewMode>("observations");
  const [compareMode, setCompareMode] = useState<"merged" | "compare">("merged");
  const [addDataForId, setAddDataForId] = useState<string | null>(null);
  const [groups, setGroups] = useState<SubstanceGroup[]>([]);

  // Reset groups when the set of substances changes — default: one substance per group
  useEffect(() => {
    if (perSubstanceSummaries.length < 2) {
      setGroups([]);
      return;
    }
    // Only reset if substance set changed (not on every filter change)
    const currentSubIds = new Set(groups.flatMap((g) => g.substance_ids));
    const newSubIds = new Set(perSubstanceSummaries.map((s) => s.substance_id));
    const sameSet =
      currentSubIds.size === newSubIds.size &&
      [...currentSubIds].every((id) => newSubIds.has(id));
    if (!sameSet) {
      setGroups(
        perSubstanceSummaries.map((s) => ({
          id: `g-sub-${s.substance_id}`,
          name: s.substance_name,
          substance_ids: [s.substance_id],
        })),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perSubstanceSummaries.map((s) => s.substance_id).join(",")]);
  const [loading, setLoading] = useState(true);
  const [includeSubtypes, setIncludeSubtypes] = useState(false);

  // Display-converted summaries (applied right before passing to UI components).
  // Statistical values + unit strings swap to US when the unit toggle is set to US.
  const displaySummary = useMemo(
    () => (summary ? convertSummary(summary, unitSystem) : null),
    [summary, unitSystem],
  );
  const displayPerSubstanceSummaries = useMemo(
    () => perSubstanceSummaries.map((s) => convertSummary(s, unitSystem)),
    [perSubstanceSummaries, unitSystem],
  );

  // Compute grouped summaries — each group's members pooled into one summary
  const groupedSummaries = useMemo<Summary[]>(() => {
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
        const merged = mergeSummaries(members, filters);
        return { ...merged, substance_name: g.name, substance_id: g.id };
      })
      .filter(Boolean) as Summary[];
  }, [groups, perSubstanceSummaries, filters]);

  const displayGroupedSummaries = useMemo(
    () => groupedSummaries.map((s) => convertSummary(s, unitSystem)),
    [groupedSummaries, unitSystem],
  );

  const removeSubstance = useCallback((idToRemove: string) => {
    const remaining = ids.filter((id) => id !== idToRemove);
    if (remaining.length === 0) {
      router.push("/");
    } else if (remaining.length === 1) {
      router.push(`/substance/${remaining[0]}`);
    } else {
      const [first, ...rest] = remaining;
      router.push(`/substance/${first}?${rest.map((id) => `also=${id}`).join("&")}`);
    }
  }, [ids, router]);

  // Fetch all substance details
  useEffect(() => {
    setLoading(true);
    Promise.all(
      ids.map(async (id) => {
        if (id.startsWith("user:")) return buildUserDefinedSubstanceDetail(id);
        return getSubstance(id).catch(() => null);
      }),
    )
      .then((results) => setSubstances(results.filter(Boolean) as SubstanceDetail[]))
      .finally(() => setLoading(false));
  }, [rawId]);

  // Fetch observations and summaries for all substances, then merge
  useEffect(() => {
    // For PHYLIS IDs, hit the API. For user: ids, skip.
    const phylisIds = ids.filter((id) => !id.startsWith("user:"));
    // Inject user-marked outlier exclusions into the filters sent to the API.
    const effectiveFilters = {
      ...filters,
      exclude_sample_ids:
        excludedSampleIds.length > 0
          ? [...(filters.exclude_sample_ids || []), ...excludedSampleIds]
          : filters.exclude_sample_ids,
    };
    const excludedSet = new Set(excludedSampleIds);

    Promise.all(phylisIds.map((id) => getObservations(id, effectiveFilters, 1, 200, includeSubtypes).catch(() => [])))
      .then((results) => {
        // Merge in user-contributed samples for each substance (both PHYLIS-linked and user-defined)
        const userRecords = ids.flatMap((id) =>
          listUserSamplesForSubstance(id).map(userSampleToSampleRecord),
        );
        // Apply user-marked exclusions to user samples (server already filtered PHYLIS samples).
        const filteredUserRecords = userRecords.filter((r) => !excludedSet.has(r.id));
        setObservations([...results.flat(), ...filteredUserRecords]);
      });

    Promise.all(phylisIds.map((id) => getSummary(id, effectiveFilters, includeSubtypes).catch(() => null)))
      .then((results) => {
        const valid = results.filter(Boolean) as Summary[];
        // Build summaries for user-defined substances from local data
        const userSummaries = ids
          .filter((id) => id.startsWith("user:"))
          .map((id) => buildUserDefinedSummary(id, effectiveFilters))
          .filter(Boolean) as Summary[];
        const allSummaries = [...valid, ...userSummaries];
        setPerSubstanceSummaries(allSummaries);
        if (allSummaries.length === 0) { setSummary(null); return; }
        if (allSummaries.length === 1) { setSummary(allSummaries[0]); return; }
        setSummary(mergeSummaries(allSummaries, effectiveFilters));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawId, filters, includeSubtypes, excludedSampleIds.join(",")]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-gray-500">
        Loading substance data...
      </div>
    );
  }

  if (substances.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-gray-500">
        Substance not found.
      </div>
    );
  }

  // Merge property coverage across substances
  const mergedCoverage = mergeCoverage(substances);

  // Title for multi-substance view
  const title = isMulti
    ? substances.map((s) => s.preferred_name).join(" + ")
    : substances[0].preferred_name;

  return (
    <>
      {/* Compact header with back link */}
      <header className="bg-gradient-to-b from-slate-50 to-slate-100 border-b border-slate-200 px-6 py-4">
        <div className="mx-auto max-w-4xl flex items-center gap-4">
          <a href="/" className="flex items-center gap-2 text-slate-500 hover:text-slate-700 transition">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            <span className="text-sm font-medium">Back</span>
          </a>
          <a href="/">
            <img src="/logo.png" alt="BiomassIQ" className="h-20 w-auto" />
          </a>
          <div className="ml-auto">
            <UnitSystemToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-4 px-4 py-8">
        {/* Substance info — collapsible */}
        <details className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden" open>
          <summary className="px-6 py-3 bg-slate-50 border-b border-gray-200 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-slate-100 transition">
            {title}
          </summary>
          <div className="p-6 space-y-4">
            {substances.map((substance) => (
              <div key={substance.id} className={isMulti ? "pb-4 border-b border-gray-100 last:border-0 last:pb-0" : ""}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <SubstanceHeader substance={substance} />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setAddDataForId(substance.id)}
                      className="flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-100 transition"
                      title={`Add your own measurement to ${substance.preferred_name}`}
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      Add my data
                    </button>
                    {isMulti && (
                      <button
                        onClick={() => removeSubstance(substance.id)}
                        className="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-400 hover:text-red-500 hover:border-red-200 transition"
                        title={`Remove ${substance.preferred_name}`}
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </details>

        {summary && (
          <DataQualityBanner
            totalObservations={summary.total_observations}
            totalSources={summary.total_sources}
            filters={filters}
          />
        )}

        {/* Basis selection (filters) — moved above property coverage */}
        <details className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden" open>
          <summary className="px-6 py-3 bg-slate-50 border-b border-gray-200 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-slate-100 transition">
            Basis selection
          </summary>
          <div className="p-4">
            <FilterBar filters={filters} onFiltersChange={setFilters} />
            <label className="flex items-center gap-2 text-xs text-gray-500 mt-3 pt-3 border-t border-gray-100">
              <input
                type="checkbox"
                checked={includeSubtypes}
                onChange={(e) => setIncludeSubtypes(e.target.checked)}
                className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              Include subtypes in results
            </label>
          </div>
        </details>

        {/* Property coverage — interactive filter, already collapsible */}
        <PropertyCoverageMatrix
          coverage={mergedCoverage}
          selectedProperties={filters.properties}
          onSelectedPropertiesChange={(codes) =>
            setFilters((prev) => ({ ...prev, properties: codes }))
          }
          observations={observations}
        />

        {/* Merge / Compare toggle — only when multiple substances */}
        {isMulti && (
          <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Mode:</span>
            <div className="flex rounded-lg border border-gray-300 bg-white overflow-hidden text-sm">
              <button
                onClick={() => setCompareMode("merged")}
                className={`px-3 py-1.5 font-medium transition ${
                  compareMode === "merged"
                    ? "bg-teal-600 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
                title="Pool all substances into combined statistics"
              >
                Merged
              </button>
              <button
                onClick={() => setCompareMode("compare")}
                className={`px-3 py-1.5 font-medium transition ${
                  compareMode === "compare"
                    ? "bg-teal-600 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
                title="Keep each substance's statistics separate for side-by-side comparison"
              >
                Compare
              </button>
            </div>
            <span className="text-xs text-gray-400 ml-auto">
              {compareMode === "merged"
                ? "Statistics pooled across all substances"
                : "Each substance analyzed separately"}
            </span>
          </div>
        )}

        {/* View mode tab bar — ReactionIQ style */}
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          <button
            onClick={() => setViewMode("observations")}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
              viewMode === "observations"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Observations
          </button>
          <button
            onClick={() => setViewMode("synthesis")}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
              viewMode === "synthesis"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Synthesis
          </button>
        </div>

        {/* Group editor — only in compare mode */}
        {isMulti && compareMode === "compare" && perSubstanceSummaries.length >= 2 && (
          <GroupEditor
            summaries={perSubstanceSummaries}
            groups={groups}
            onGroupsChange={setGroups}
          />
        )}

        {/* Content */}
        {viewMode === "observations" ? (
          <>
            {isMulti && compareMode === "compare" && perSubstanceSummaries.length > 0 ? (
              <ComparisonStats summaries={displayGroupedSummaries} />
            ) : (
              displaySummary && <QuickStats summary={displaySummary} />
            )}

            <details className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden" open>
              <summary className="px-6 py-3 bg-slate-50 border-b border-gray-200 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-slate-100 transition">
                Raw Observations
              </summary>
              <div className="p-6">
                <ObservationTable
                  observations={observations}
                  substanceId={rawId}
                  filters={filters}
                />
              </div>
            </details>

            <ReferencesPanel observations={observations} />
          </>
        ) : (
          <>
            {displaySummary && (
              <details className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden" open>
                <summary className="px-6 py-3 bg-slate-50 border-b border-gray-200 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-slate-100 transition">
                  Detailed Statistics
                </summary>
                <div className="p-6">
                  <StatisticsPanel summary={displaySummary} />
                </div>
              </details>
            )}
            {displaySummary && (
              <details className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden" open>
                <summary className="px-6 py-3 bg-slate-50 border-b border-gray-200 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-slate-100 transition">
                  Distribution Charts
                </summary>
                <div className="p-6">
                  <DistributionCharts summary={displaySummary} observations={observations} />
                </div>
              </details>
            )}
          </>
        )}
      </main>

      <footer className="border-t border-gray-100 py-6 text-center text-xs text-gray-400 space-y-1">
        <p>BiomassIQ — v1.0 — April 2026</p>
        <p>Biomass characterization data sourced from PHYLIS (phyllis.nl) under TNO</p>
        <p>
          Questions, suggestions, bug reports, or feature requests?{" "}
          <a
            href="mailto:luca.zullo@verdenero.com?subject=BiomassIQ%20Enquiry"
            className="text-teal-600 hover:text-teal-700 underline"
          >
            luca.zullo@verdenero.com
          </a>
        </p>
      </footer>

      {addDataForId && (() => {
        const sub = substances.find((s) => s.id === addDataForId);
        if (!sub) return null;
        return (
          <MyDataModal
            initialSubstance={{ id: sub.id, name: sub.preferred_name }}
            onClose={() => {
              setAddDataForId(null);
              // Trigger re-fetch by bumping filters (forces useEffect)
              setFilters((f) => ({ ...f }));
            }}
          />
        );
      })()}

      <SelectionBasket basket={basket} onRemove={removeFromBasket} onClear={clearBasket} />
    </>
  );
}

// --- Helpers for multi-substance merging ---

function mergeCoverage(substances: SubstanceDetail[]): Record<string, import("@/lib/types").PropertyCoverage> {
  const merged: Record<string, import("@/lib/types").PropertyCoverage> = {};
  for (const sub of substances) {
    for (const [code, cov] of Object.entries(sub.property_coverage)) {
      if (!merged[code]) {
        merged[code] = { ...cov };
      } else {
        merged[code] = {
          ...merged[code],
          observation_count: merged[code].observation_count + cov.observation_count,
          bases_available: [...new Set([...merged[code].bases_available, ...cov.bases_available])],
          sources: [...new Set([...merged[code].sources, ...cov.sources])],
        };
      }
    }
  }
  return merged;
}

function buildUserDefinedSubstanceDetail(id: string): SubstanceDetail | null {
  const samples = listUserSamplesForSubstance(id);
  if (samples.length === 0) return null;
  const first = samples[0];
  // Aggregate property coverage from measurements
  const coverage: Record<string, import("@/lib/types").PropertyCoverage> = {};
  for (const s of samples) {
    for (const m of s.measurements) {
      if (!coverage[m.property_code]) {
        coverage[m.property_code] = {
          property_code: m.property_code,
          display_name: m.property_name,
          category: "other",
          observation_count: 0,
          bases_available: [],
          sources: ["user"],
        };
      }
      coverage[m.property_code].observation_count += 1;
      if (!coverage[m.property_code].bases_available.includes(m.basis)) {
        coverage[m.property_code].bases_available.push(m.basis);
      }
    }
  }
  return {
    id,
    preferred_name: first.substance_name,
    scientific_name: null,
    type: "user_defined",
    taxonomy_path: ["User-defined", first.substance_name],
    aliases: [],
    relations: [],
    property_coverage: coverage,
  };
}

function buildUserDefinedSummary(id: string, filters: ObservationFilters): Summary | null {
  const samples = listUserSamplesForSubstance(id);
  if (samples.length === 0) return null;
  // Build stats from user measurements grouped by (property, basis)
  const groups = new Map<string, { code: string; name: string; unit: string; basis: string; values: number[] }>();
  for (const s of samples) {
    for (const m of s.measurements) {
      const key = `${m.property_code}|${m.basis}`;
      if (!groups.has(key)) {
        groups.set(key, { code: m.property_code, name: m.property_name, unit: m.unit, basis: m.basis, values: [] });
      }
      groups.get(key)!.values.push(m.value);
    }
  }
  const statistics: import("@/lib/types").PropertyStatistics[] = [];
  for (const g of groups.values()) {
    const n = g.values.length;
    const mean = n > 0 ? g.values.reduce((a, b) => a + b, 0) / n : null;
    let std: number | null = null;
    if (n > 1 && mean != null) {
      const variance = g.values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
      std = Math.sqrt(variance);
    }
    statistics.push({
      property_code: g.code,
      display_name: g.name,
      category: "other",
      unit: g.unit,
      basis: g.basis as "ar" | "dry" | "daf",
      count: n,
      mean: mean != null ? Math.round(mean * 10000) / 10000 : null,
      median: null,
      std: std != null ? Math.round(std * 10000) / 10000 : null,
      min: n > 0 ? Math.min(...g.values) : null,
      max: n > 0 ? Math.max(...g.values) : null,
      q1: null,
      q3: null,
      missing_count: 0,
      source_count: samples.length,
      includes_derived: false,
    });
  }
  return {
    substance_id: id,
    substance_name: samples[0].substance_name,
    total_observations: samples.reduce((s, x) => s + x.measurements.length, 0),
    total_sources: samples.length,
    active_filters: filters,
    statistics,
  };
}

