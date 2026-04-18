"use client";

import { useState, useMemo } from "react";
import type { SampleRecord, ObservationFilters } from "@/lib/types";
import { formatBasis, formatDerivation, formatValue } from "@/lib/formatters";
import { getExportUrl, getObservations } from "@/lib/api";
import { ProvenanceModal } from "./ProvenanceModal";
import { useExcludedSamples } from "@/lib/exclusions";
import { useUnitSystem, convertValue, type UnitSystem } from "@/lib/unitConversion";

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function exportObservationsCsvClientSide(
  substanceId: string,
  filters: ObservationFilters,
  system: UnitSystem,
) {
  // Pull a generous page so we get everything for typical substances.
  const records = await getObservations(substanceId, filters, 1, 10000, false).catch(
    () => [] as SampleRecord[],
  );
  const header = [
    "sample_id",
    "source_dataset",
    "source_record_id",
    "original_sample_name",
    "geography",
    "year",
    "property_code",
    "property_name",
    "value",
    "unit",
    "basis",
    "derivation",
    "citation",
  ].join(",");
  const rows: string[] = [];
  for (const rec of records) {
    for (const m of rec.measurements) {
      const conv = convertValue(m.original_value, m.original_unit, system);
      rows.push(
        [
          escapeCsv(rec.id),
          escapeCsv(rec.source_dataset),
          escapeCsv(rec.source_record_id),
          escapeCsv(rec.original_name),
          escapeCsv(rec.geography ?? ""),
          rec.year ?? rec.citation_year ?? "",
          escapeCsv(m.property_code),
          escapeCsv(m.property_name),
          conv.value ?? "",
          escapeCsv(conv.unit),
          escapeCsv(m.original_basis),
          escapeCsv(m.derivation),
          escapeCsv(rec.citation ?? ""),
        ].join(","),
      );
    }
  }
  const meta = [
    `# BiomassIQ Observations Export`,
    `# Unit system: ${system === "us" ? "US" : "Metric"} (values converted from source-metric)`,
    `# Exported: ${new Date().toISOString()}`,
  ].join("\n");
  const csv = `${meta}\n${header}\n${rows.join("\n")}\n`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `biomassiq_observations_${substanceId}_${system}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

interface ObservationTableProps {
  observations: SampleRecord[];
  substanceId: string;
  filters: ObservationFilters;
}

type SortField = "property_name" | "original_value" | "original_unit" | "original_basis" | "source_dataset" | "derivation" | "original_name" | "year";
type SortDir = "asc" | "desc";

export function ObservationTable({ observations, substanceId, filters }: ObservationTableProps) {
  const [sortField, setSortField] = useState<SortField>("property_name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [provenanceRecord, setProvenanceRecord] = useState<SampleRecord | null>(null);
  const { excluded, isExcluded, toggle: toggleExclude, clearAll: clearExclusions } =
    useExcludedSamples();
  const { system: unitSystem } = useUnitSystem();

  // Exclusions visible in this view — only count those that match observations we currently have
  // (exclusions persist globally but a single substance page only sees its own samples).
  const visibleRecordIds = new Set(observations.map((o) => o.id));
  const localExclusionCount = excluded.filter((id) => visibleRecordIds.has(id)).length;

  // Flatten for table display — must be before any early return (Rules of Hooks)
  const rows = useMemo(() => {
    const flat = observations.flatMap((record) =>
      record.measurements.map((m) => ({
        ...m,
        source_dataset: record.source_dataset,
        source_record_id: record.source_record_id,
        original_name: record.original_name,
        geography: record.geography,
        // Prefer explicit sample year; fall back to citation year (PHYLIS only provides the latter)
        year: record.year ?? record.citation_year ?? null,
        is_grouped_average: record.is_grouped_average,
        remarks: record.remarks,
        // Full record for provenance modal
        _record: record,
      })),
    );

    flat.sort((a, b) => {
      let cmp = 0;
      const av = a[sortField];
      const bv = b[sortField];

      if (av == null && bv == null) cmp = 0;
      else if (av == null) cmp = 1;
      else if (bv == null) cmp = -1;
      else if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv));

      return sortDir === "asc" ? cmp : -cmp;
    });

    return flat;
  }, [observations, sortField, sortDir]);

  if (observations.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No observations match the current filters.
      </div>
    );
  }

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const columns: { field: SortField; label: string; align?: "right" }[] = [
    { field: "property_name", label: "Property" },
    { field: "original_value", label: "Value", align: "right" },
    { field: "original_unit", label: "Unit" },
    { field: "original_basis", label: "Basis" },
    { field: "source_dataset", label: "Source" },
    { field: "derivation", label: "Derivation" },
    { field: "original_name", label: "Sample" },
    { field: "year", label: "Year" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-gray-600">
          {rows.length} measurement{rows.length !== 1 ? "s" : ""} from{" "}
          {observations.length} sample record{observations.length !== 1 ? "s" : ""}
          {localExclusionCount > 0 && (
            <span className="ml-2 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
              {localExclusionCount} excluded as outliers
            </span>
          )}
        </h3>
        <div className="flex gap-2 items-center">
          {localExclusionCount > 0 && (
            <button
              onClick={clearExclusions}
              className="text-xs text-gray-400 hover:text-red-600 transition"
              title="Restore all excluded observations across all substances"
            >
              Restore all excluded
            </button>
          )}
          <button
            onClick={() => exportObservationsCsvClientSide(substanceId, filters, unitSystem)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
            title={`Export CSV in ${unitSystem === "us" ? "US" : "Metric"} units`}
          >
            Export CSV ({unitSystem === "us" ? "US" : "Metric"})
          </button>
          <a
            href={getExportUrl(substanceId, "json", filters)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
          >
            Export JSON
          </a>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.field}
                  onClick={() => toggleSort(col.field)}
                  className={`px-3 py-2 font-medium text-gray-500 cursor-pointer select-none hover:text-gray-700 transition ${
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
              <th className="px-2 py-2 font-medium text-gray-500 text-center" title="Exclude this sample from statistics (outlier)">
                Use
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row, i) => {
              const recordExcluded = isExcluded(row._record.id);
              return (
              <tr
                key={`${row.id}-${i}`}
                className={`hover:bg-gray-50 transition ${
                  recordExcluded
                    ? "bg-red-50/40 line-through text-gray-400"
                    : row.is_grouped_average
                    ? "bg-amber-50/40"
                    : ""
                }`}
              >
                {(() => {
                  const conv = convertValue(row.original_value, row.original_unit, unitSystem);
                  return (
                    <>
                      <td className="px-3 py-2 font-medium text-gray-800">{row.property_name}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatValue(conv.value, 3)}</td>
                      <td className="px-3 py-2 text-gray-500">{conv.unit}</td>
                    </>
                  );
                })()}
                <td className="px-3 py-2">
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
                    {formatBasis(row.original_basis)}
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-500">{row.source_dataset}</td>
                <td className="px-3 py-2">
                  <span
                    className={`text-xs font-medium ${
                      row.derivation === "observed"
                        ? "text-teal-600"
                        : row.derivation === "converted"
                          ? "text-amber-600"
                          : "text-red-500"
                    }`}
                  >
                    {formatDerivation(row.derivation)}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="w-[220px] overflow-hidden">
                    <button
                      onClick={() => setProvenanceRecord(row._record)}
                      className="w-full flex items-center gap-1 text-teal-700 hover:text-teal-800 hover:underline transition text-left"
                      title={`View source: ${row.original_name} (#${row.source_record_id})`}
                    >
                      <span className="truncate min-w-0 flex-1">{row.original_name}</span>
                      {row.is_grouped_average && (
                        <span className="text-xs text-amber-600 shrink-0" title="Grouped average from source">
                          (avg)
                        </span>
                      )}
                      <svg className="h-3 w-3 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                    </button>
                  </div>
                </td>
                <td
                  className="px-3 py-2 text-gray-500 tabular-nums"
                  title={
                    row._record.year
                      ? "Sample year"
                      : row._record.citation_year
                        ? "Citation year (sample year not available)"
                        : undefined
                  }
                >
                  {row.year ?? "\u2014"}
                </td>
                <td className="px-2 py-2 text-center">
                  <button
                    onClick={() => toggleExclude(row._record.id)}
                    className={`inline-flex items-center justify-center h-5 w-5 rounded transition ${
                      recordExcluded
                        ? "bg-red-100 text-red-700 hover:bg-red-200"
                        : "text-gray-300 hover:text-red-500 hover:bg-red-50"
                    }`}
                    title={
                      recordExcluded
                        ? "This observation is excluded from statistics. Click to include it again."
                        : "Exclude this observation from statistics (mark as outlier)"
                    }
                    aria-pressed={recordExcluded}
                  >
                    {recordExcluded ? (
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    ) : (
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {provenanceRecord && (
        <ProvenanceModal
          record={provenanceRecord}
          onClose={() => setProvenanceRecord(null)}
        />
      )}
    </div>
  );
}
