"use client";

import React, { useState, useMemo } from "react";
import type { Summary, PropertyStatistics } from "@/lib/types";
import { formatBasis, formatValue } from "@/lib/formatters";
import { ComparisonRangeChart } from "./ComparisonRangeChart";

interface ComparisonStatsProps {
  summaries: Summary[];
}

interface ComparisonRow {
  property_code: string;
  display_name: string;
  unit: string;
  basis: string;
  perSubstance: Record<string, PropertyStatistics | null>;
}

function exportComparisonCsv(summaries: Summary[], rows: ComparisonRow[]) {
  const header = ["Property", "Unit", "Basis", ...summaries.flatMap(s => [
    `${s.substance_name} N`,
    `${s.substance_name} Mean`,
    `${s.substance_name} SD`,
    `${s.substance_name} Min`,
    `${s.substance_name} Max`,
  ])].join(",");

  const csvRows = rows.map((r) => {
    const values: (string | number)[] = [`"${r.display_name}"`, r.unit, r.basis];
    for (const s of summaries) {
      const stat = r.perSubstance[s.substance_id];
      values.push(
        stat?.count ?? "",
        stat?.mean ?? "",
        stat?.std ?? "",
        stat?.min ?? "",
        stat?.max ?? "",
      );
    }
    return values.join(",");
  });

  const meta = [
    `# BiomassIQ Comparison Export`,
    `# Substances: ${summaries.map(s => s.substance_name).join(" | ")}`,
    `# Exported: ${new Date().toISOString()}`,
  ].join("\n");

  const csv = `${meta}\n${header}\n${csvRows.join("\n")}\n`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `biomassiq_comparison_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ComparisonStats({ summaries }: ComparisonStatsProps) {
  const [sortField, setSortField] = useState<string>("display_name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showChart, setShowChart] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // Collect all unique (property_code, basis) combinations across all substances
  const rows = useMemo(() => {
    const keyMap = new Map<string, ComparisonRow>();
    for (const summary of summaries) {
      for (const stat of summary.statistics) {
        const key = `${stat.property_code}|${stat.basis}`;
        if (!keyMap.has(key)) {
          keyMap.set(key, {
            property_code: stat.property_code,
            display_name: stat.display_name,
            unit: stat.unit,
            basis: stat.basis,
            perSubstance: {},
          });
        }
        keyMap.get(key)!.perSubstance[summary.substance_id] = stat;
      }
    }
    return [...keyMap.values()];
  }, [summaries]);

  // Sort
  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortField === "display_name") cmp = a.display_name.localeCompare(b.display_name);
      else if (sortField === "basis") cmp = a.basis.localeCompare(b.basis);
      else if (sortField === "unit") cmp = a.unit.localeCompare(b.unit);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortField, sortDir]);

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const rowKey = (r: ComparisonRow) => `${r.property_code}|${r.basis}`;
  const toggleSelect = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const chartRows = selectedKeys.size > 0
    ? sorted.filter((r) => selectedKeys.has(rowKey(r)))
    : sorted;

  if (rows.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No data to compare.
      </div>
    );
  }

  return (
    <details className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden" open>
      <summary className="px-6 py-3 bg-slate-50 border-b border-gray-200 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-slate-100 transition flex items-center justify-between">
        <span>Comparison: {summaries.length} substances</span>
        <span className="text-xs font-normal text-gray-500">
          {rows.length} properties
        </span>
      </summary>

      {/* Substance legend */}
      <div className="px-6 py-2 border-b border-gray-100 flex flex-wrap gap-2 items-center">
        <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Substances:</span>
        {summaries.map((s, i) => (
          <span
            key={s.substance_id}
            className="flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium"
            style={{
              borderColor: SUBSTANCE_COLORS[i % SUBSTANCE_COLORS.length].stroke,
              backgroundColor: SUBSTANCE_COLORS[i % SUBSTANCE_COLORS.length].fill + "30",
              color: SUBSTANCE_COLORS[i % SUBSTANCE_COLORS.length].stroke,
            }}
          >
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: SUBSTANCE_COLORS[i % SUBSTANCE_COLORS.length].stroke }}
            />
            {s.substance_name}
            <span className="text-[10px] opacity-70">n={s.total_observations}</span>
          </span>
        ))}
      </div>

      {/* Toolbar */}
      <div className="px-6 py-2 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-3">
          {selectedKeys.size > 0 && (
            <span className="text-xs text-gray-500">{selectedKeys.size} selected</span>
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
            onClick={() => exportComparisonCsv(summaries, sorted)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Chart */}
      {showChart && (
        <div className="px-6 py-4 border-b border-gray-100">
          <ComparisonRangeChart
            summaries={summaries}
            rows={chartRows}
            title={selectedKeys.size > 0 ? `${chartRows.length} selected properties` : undefined}
          />
        </div>
      )}

      {/* Matrix table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-2 py-2 w-8"></th>
              <th
                onClick={() => toggleSort("display_name")}
                className="px-3 py-2 font-medium text-gray-500 cursor-pointer select-none hover:text-gray-700 whitespace-nowrap text-left sticky left-0 bg-slate-50"
              >
                Property {sortField === "display_name" && (<span className="text-teal-600">{sortDir === "asc" ? "↑" : "↓"}</span>)}
              </th>
              <th onClick={() => toggleSort("unit")} className="px-3 py-2 font-medium text-gray-500 cursor-pointer whitespace-nowrap text-left">
                Unit
              </th>
              <th onClick={() => toggleSort("basis")} className="px-3 py-2 font-medium text-gray-500 cursor-pointer whitespace-nowrap text-left">
                Basis
              </th>
              {summaries.map((s, i) => (
                <th
                  key={s.substance_id}
                  colSpan={3}
                  className="px-3 py-2 text-center font-medium border-l border-gray-200"
                  style={{ color: SUBSTANCE_COLORS[i % SUBSTANCE_COLORS.length].stroke }}
                >
                  <div className="truncate max-w-[200px] mx-auto" title={s.substance_name}>
                    {s.substance_name}
                  </div>
                </th>
              ))}
            </tr>
            <tr className="text-[10px] text-gray-400 uppercase tracking-wide">
              <th colSpan={4}></th>
              {summaries.map((s) => (
                <React.Fragment key={s.substance_id}>
                  <th className="px-2 py-1 text-right font-medium border-l border-gray-200">N</th>
                  <th className="px-2 py-1 text-right font-medium">Mean</th>
                  <th className="px-2 py-1 text-right font-medium">SD</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((row) => {
              const key = rowKey(row);
              const isSelected = selectedKeys.has(key);
              return (
                <tr key={key} className={`${isSelected ? "bg-sky-50/50" : "hover:bg-gray-50"} transition`}>
                  <td className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(key)}
                      className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                    />
                  </td>
                  <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap sticky left-0 bg-inherit">
                    {row.display_name}
                  </td>
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{row.unit}</td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
                      {formatBasis(row.basis as "ar" | "dry" | "daf")}
                    </span>
                  </td>
                  {summaries.map((s, i) => {
                    const stat = row.perSubstance[s.substance_id];
                    const bgColor = SUBSTANCE_COLORS[i % SUBSTANCE_COLORS.length].fill + "10";
                    return (
                      <React.Fragment key={s.substance_id}>
                        <td
                          className="px-2 py-2 text-right tabular-nums border-l border-gray-100 text-gray-600"
                          style={{ backgroundColor: stat ? bgColor : undefined }}
                        >
                          {stat?.count ?? "—"}
                        </td>
                        <td
                          className="px-2 py-2 text-right tabular-nums font-medium"
                          style={{ backgroundColor: stat ? bgColor : undefined }}
                        >
                          {formatValue(stat?.mean ?? null, 2)}
                        </td>
                        <td
                          className="px-2 py-2 text-right tabular-nums text-gray-500"
                          style={{ backgroundColor: stat ? bgColor : undefined }}
                        >
                          {formatValue(stat?.std ?? null, 2)}
                        </td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}

// Color palette for substances — distinct hues
export const SUBSTANCE_COLORS: { fill: string; stroke: string }[] = [
  { fill: "#5eead4", stroke: "#0d9488" }, // teal
  { fill: "#fbbf24", stroke: "#d97706" }, // amber
  { fill: "#a5b4fc", stroke: "#6366f1" }, // indigo
  { fill: "#fca5a5", stroke: "#dc2626" }, // red
  { fill: "#c4b5fd", stroke: "#7c3aed" }, // violet
  { fill: "#86efac", stroke: "#16a34a" }, // green
  { fill: "#f9a8d4", stroke: "#db2777" }, // pink
  { fill: "#7dd3fc", stroke: "#0284c7" }, // sky
];

