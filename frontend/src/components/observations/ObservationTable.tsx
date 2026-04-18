"use client";

import { useState, useMemo } from "react";
import type { SampleRecord, ObservationFilters } from "@/lib/types";
import { formatBasis, formatDerivation, formatValue } from "@/lib/formatters";
import { getExportUrl } from "@/lib/api";
import { ProvenanceModal } from "./ProvenanceModal";

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
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-600">
          {rows.length} measurement{rows.length !== 1 ? "s" : ""} from{" "}
          {observations.length} sample record{observations.length !== 1 ? "s" : ""}
        </h3>
        <div className="flex gap-2">
          <a
            href={getExportUrl(substanceId, "csv", filters)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
          >
            Export CSV
          </a>
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
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row, i) => (
              <tr
                key={`${row.id}-${i}`}
                className={`hover:bg-gray-50 transition ${row.is_grouped_average ? "bg-amber-50/40" : ""}`}
              >
                <td className="px-3 py-2 font-medium text-gray-800">{row.property_name}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatValue(row.original_value, 3)}</td>
                <td className="px-3 py-2 text-gray-500">{row.original_unit}</td>
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
              </tr>
            ))}
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
