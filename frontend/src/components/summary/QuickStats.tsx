"use client";

import { useState } from "react";
import type { Summary, PropertyStatistics } from "@/lib/types";
import { formatBasis, formatValue } from "@/lib/formatters";
import { RangeChart } from "@/components/summary/RangeChart";

interface QuickStatsProps {
  summary: Summary;
}

// --- Aggregation types ---

interface PropertyAggregation {
  id: string;
  name: string; // user-provided name
  sourceKeys: string[]; // "property_code|basis" keys that were merged
}

// --- Pooled statistics math ---

function poolStats(stats: PropertyStatistics[]): Omit<PropertyStatistics, "property_code" | "display_name" | "category" | "unit"> {
  const totalN = stats.reduce((s, st) => s + st.count, 0);
  if (totalN === 0) {
    return { basis: stats[0]?.basis ?? "dry", count: 0, mean: null, median: null, std: null, min: null, max: null, q1: null, q3: null, missing_count: 0, source_count: 0, includes_derived: false };
  }

  // Weighted mean
  const pooledMean = stats.reduce((s, st) => s + (st.mean ?? 0) * st.count, 0) / totalN;

  // Pooled SD: sqrt( (sum((n_i-1)*s_i^2) + sum(n_i*(mean_i - pooled_mean)^2)) / (N-1) )
  let numerator = 0;
  for (const st of stats) {
    if (st.count > 1 && st.std != null) {
      numerator += (st.count - 1) * st.std * st.std;
    }
    if (st.mean != null) {
      numerator += st.count * (st.mean - pooledMean) ** 2;
    }
  }
  const pooledStd = totalN > 1 ? Math.sqrt(numerator / (totalN - 1)) : null;

  // Min/max across groups
  const mins = stats.filter((s) => s.min != null).map((s) => s.min!);
  const maxs = stats.filter((s) => s.max != null).map((s) => s.max!);

  return {
    basis: stats[0]?.basis ?? "dry",
    count: totalN,
    mean: pooledMean,
    median: null, // can't compute pooled median from group medians
    std: pooledStd,
    min: mins.length > 0 ? Math.min(...mins) : null,
    max: maxs.length > 0 ? Math.max(...maxs) : null,
    q1: null,
    q3: null,
    missing_count: stats.reduce((s, st) => s + st.missing_count, 0),
    source_count: stats.reduce((s, st) => s + st.source_count, 0),
    includes_derived: stats.some((s) => s.includes_derived),
  };
}

// --- CSV export ---

interface DisplayRow {
  display_name: string;
  property_code: string;
  unit: string;
  basis: string;
  count: number;
  mean: number | null;
  median: number | null;
  std: number | null;
  min: number | null;
  max: number | null;
  q1: number | null;
  q3: number | null;
  source_count: number;
  includes_derived: boolean;
  isAggregated?: boolean;
  aggregationId?: string;
}

function exportDisplayCsv(rows: DisplayRow[], summary: Summary) {
  const header = [
    "Substance", "Property", "Property Code", "Unit", "Basis",
    "N", "Mean", "Median", "SD", "Min", "Q1", "Q3", "Max",
    "Source Count", "Includes Derived",
  ].join(",");

  const csvRows = rows.map((s) =>
    [
      `"${summary.substance_name}"`,
      `"${s.display_name}"`,
      s.property_code,
      s.unit,
      s.basis,
      s.count,
      s.mean ?? "",
      s.median ?? "",
      s.std ?? "",
      s.min ?? "",
      s.q1 ?? "",
      s.q3 ?? "",
      s.max ?? "",
      s.source_count,
      s.includes_derived,
    ].join(","),
  );

  const filters = summary.active_filters;
  const meta = [
    `# BiomassIQ Summary Statistics Export`,
    `# Substance: ${summary.substance_name}`,
    `# Total observations: ${summary.total_observations}`,
    `# Total sources: ${summary.total_sources}`,
    filters.basis?.length ? `# Basis filter: ${filters.basis.join(", ")}` : null,
    filters.derivation?.length ? `# Derivation filter: ${filters.derivation.join(", ")}` : null,
    filters.properties?.length ? `# Properties filter: ${filters.properties.length} selected` : null,
    filters.exclude_grouped_averages ? `# Excluding grouped averages` : null,
    `# Exported: ${new Date().toISOString()}`,
  ]
    .filter(Boolean)
    .join("\n");

  const csv = `${meta}\n${header}\n${csvRows.join("\n")}\n`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `biomassiq_summary_${summary.substance_name.replace(/\s+/g, "_")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// --- Component ---

export function QuickStats({ summary }: QuickStatsProps) {
  const [sortField, setSortField] = useState<string>("display_name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [aggregations, setAggregations] = useState<PropertyAggregation[]>([]);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [aggregateName, setAggregateName] = useState("");
  const [showChart, setShowChart] = useState(false);

  if (summary.statistics.length === 0) {
    return null;
  }

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "display_name" ? "asc" : "desc");
    }
  };

  const statKey = (s: PropertyStatistics) => `${s.property_code}|${s.basis}`;

  const toggleSelect = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Build set of keys consumed by existing aggregations
  const consumedKeys = new Set<string>();
  for (const agg of aggregations) {
    for (const k of agg.sourceKeys) consumedKeys.add(k);
  }

  // Build display rows: original stats minus consumed, plus aggregated rows
  const displayRows: DisplayRow[] = [];

  // Add aggregated rows
  for (const agg of aggregations) {
    const sourceStats = summary.statistics.filter((s) => agg.sourceKeys.includes(statKey(s)));
    // Group by basis
    const byBasis: Record<string, PropertyStatistics[]> = {};
    for (const s of sourceStats) {
      if (!byBasis[s.basis]) byBasis[s.basis] = [];
      byBasis[s.basis].push(s);
    }
    for (const [basis, basisStats] of Object.entries(byBasis)) {
      const pooled = poolStats(basisStats);
      displayRows.push({
        display_name: `${agg.name} (combined)`,
        property_code: `agg_${agg.id}`,
        unit: basisStats[0]?.unit ?? "",
        basis,
        count: pooled.count,
        mean: pooled.mean,
        median: pooled.median,
        std: pooled.std,
        min: pooled.min,
        max: pooled.max,
        q1: pooled.q1,
        q3: pooled.q3,
        source_count: pooled.source_count,
        includes_derived: pooled.includes_derived,
        isAggregated: true,
        aggregationId: agg.id,
      });
    }
  }

  // Add non-consumed original stats
  for (const stat of summary.statistics) {
    if (!consumedKeys.has(statKey(stat))) {
      displayRows.push({
        display_name: stat.display_name,
        property_code: stat.property_code,
        unit: stat.unit,
        basis: stat.basis,
        count: stat.count,
        mean: stat.mean,
        median: stat.median,
        std: stat.std,
        min: stat.min,
        max: stat.max,
        q1: stat.q1,
        q3: stat.q3,
        source_count: stat.source_count,
        includes_derived: stat.includes_derived,
      });
    }
  }

  // Sort
  const sorted = [...displayRows].sort((a, b) => {
    let cmp = 0;
    const av = a[sortField as keyof DisplayRow];
    const bv = b[sortField as keyof DisplayRow];
    if (av == null && bv == null) cmp = 0;
    else if (av == null) cmp = 1;
    else if (bv == null) cmp = -1;
    else if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
    else cmp = String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });

  const rowKey = (r: DisplayRow) => `${r.property_code}|${r.basis}`;

  const displayRowToStat = (r: DisplayRow): PropertyStatistics => ({
    property_code: r.property_code,
    display_name: r.display_name,
    category: "",
    unit: r.unit,
    basis: r.basis as PropertyStatistics["basis"],
    count: r.count,
    mean: r.mean,
    median: r.median,
    std: r.std,
    min: r.min,
    max: r.max,
    q1: r.q1,
    q3: r.q3,
    missing_count: 0,
    source_count: r.source_count,
    includes_derived: r.includes_derived,
  });

  // Can aggregate if 2+ non-aggregated rows selected
  const selectedNonAggregated = [...selectedKeys].filter(
    (k) => !displayRows.find((r) => rowKey(r) === k && r.isAggregated),
  );
  const canAggregate = selectedNonAggregated.length >= 2;

  const handleAggregate = () => {
    if (!aggregateName.trim()) return;
    const agg: PropertyAggregation = {
      id: Date.now().toString(),
      name: aggregateName.trim(),
      sourceKeys: selectedNonAggregated,
    };
    setAggregations((prev) => [...prev, agg]);
    setSelectedKeys(new Set());
    setAggregateName("");
    setShowNamePrompt(false);
  };

  const handleDisaggregate = (aggId: string) => {
    setAggregations((prev) => prev.filter((a) => a.id !== aggId));
  };

  const columns: { field: string; label: string; align?: "right" }[] = [
    { field: "display_name", label: "Property" },
    { field: "unit", label: "Unit" },
    { field: "basis", label: "Basis" },
    { field: "count", label: "N", align: "right" },
    { field: "mean", label: "Mean", align: "right" },
    { field: "std", label: "SD", align: "right" },
    { field: "min", label: "Min", align: "right" },
    { field: "max", label: "Max", align: "right" },
  ];

  return (
    <details className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden" open>
      <summary className="px-6 py-3 bg-slate-50 border-b border-gray-200 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-slate-100 transition flex items-center justify-between">
        <span>Summary Statistics</span>
        <span className="text-xs font-normal text-gray-400">
          {displayRows.length} rows
          {aggregations.length > 0 && ` · ${aggregations.length} aggregated`}
        </span>
      </summary>

      {/* Toolbar */}
      <div className="px-6 py-2 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-2">
          {selectedKeys.size > 0 && (
            <span className="text-xs text-gray-500">{selectedKeys.size} selected</span>
          )}
          {canAggregate && !showNamePrompt && (
            <button
              onClick={() => setShowNamePrompt(true)}
              className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700 transition"
            >
              Aggregate selected
            </button>
          )}
          {showNamePrompt && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={aggregateName}
                onChange={(e) => setAggregateName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAggregate()}
                placeholder="Name for aggregated property"
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500/20"
                autoFocus
              />
              <button
                onClick={handleAggregate}
                disabled={!aggregateName.trim()}
                className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700 transition disabled:opacity-50"
              >
                Create
              </button>
              <button
                onClick={() => { setShowNamePrompt(false); setAggregateName(""); }}
                className="text-xs text-gray-400 hover:text-gray-600 transition"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowChart(!showChart)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              showChart
                ? "border-teal-300 bg-teal-50 text-teal-700"
                : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            {showChart ? "Hide chart" : selectedKeys.size > 0 ? `Graph (${selectedKeys.size})` : "Graph all"}
          </button>
          <button
            onClick={() => exportDisplayCsv(sorted, summary)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Range chart */}
      {showChart && (
        <div className="px-6 py-4 border-b border-gray-100">
          <RangeChart
            statistics={
              selectedKeys.size > 0
                ? sorted.filter((r) => selectedKeys.has(rowKey(r))).map(displayRowToStat)
                : sorted.map(displayRowToStat)
            }
            title={selectedKeys.size > 0 ? `${selectedKeys.size} selected properties` : undefined}
          />
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-2 py-2 w-8"></th>
              {columns.map((col) => (
                <th
                  key={col.field}
                  onClick={() => toggleSort(col.field)}
                  className={`px-4 py-2 font-medium text-gray-500 cursor-pointer select-none hover:text-gray-700 transition whitespace-nowrap ${
                    col.align === "right" ? "text-right" : "text-left"
                  }`}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sortField === col.field && (
                      <span className="text-teal-600">
                        {sortDir === "asc" ? "\u2191" : "\u2193"}
                      </span>
                    )}
                  </span>
                </th>
              ))}
              <th className="px-2 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((row) => {
              const key = rowKey(row);
              const isSelected = selectedKeys.has(key);
              return (
                <tr
                  key={key}
                  className={`transition ${
                    row.isAggregated
                      ? "bg-teal-50/40 hover:bg-teal-50"
                      : isSelected
                        ? "bg-sky-50/50 hover:bg-sky-50"
                        : "hover:bg-gray-50"
                  }`}
                >
                  <td className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(key)}
                      className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                    />
                  </td>
                  <td className="px-4 py-2 font-medium text-gray-800 whitespace-nowrap">
                    {row.display_name}
                    {row.includes_derived && (
                      <span className="ml-1 text-xs text-amber-500" title="Includes converted/imputed values">*</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-500">{row.unit}</td>
                  <td className="px-4 py-2">
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
                      {formatBasis(row.basis as "ar" | "dry" | "daf")}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-600">{row.count}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatValue(row.mean, 3)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-500">{formatValue(row.std, 3)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-400">{formatValue(row.min, 3)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-400">{formatValue(row.max, 3)}</td>
                  <td className="px-2 py-2 text-center">
                    {row.isAggregated && row.aggregationId && (
                      <button
                        onClick={() => handleDisaggregate(row.aggregationId!)}
                        className="text-xs text-gray-400 hover:text-red-500 transition"
                        title="Disaggregate — restore original properties"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                        </svg>
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}
