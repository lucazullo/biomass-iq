"use client";

import type { SampleRecord } from "@/lib/types";
import { formatBasis, formatDerivation, formatValue } from "@/lib/formatters";

interface ProvenanceModalProps {
  record: SampleRecord;
  onClose: () => void;
}

// Build the source URL for the original database record
function getSourceUrl(sourceDataset: string, sourceRecordId: string): string | null {
  if (sourceDataset === "phylis") {
    return `https://phyllis.nl/Biomass/View/${sourceRecordId}`;
  }
  if (sourceDataset === "csiro") {
    // CSIRO's DAP doesn't expose per-sample direct links; point to the
    // collection landing page so the citation is at least traceable.
    return `https://doi.org/10.25919/3yhq-8a44`;
  }
  return null;
}

export function ProvenanceModal({ record, onClose }: ProvenanceModalProps) {
  const sourceUrl = getSourceUrl(record.source_dataset, record.source_record_id);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-xl border border-gray-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
              Source Record
            </div>
            <h2 className="text-lg font-semibold text-gray-800 mt-0.5">
              {record.original_name}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition shrink-0">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-4 max-h-[70vh] overflow-y-auto space-y-4">
          {/* Source link */}
          <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-xs text-teal-700 font-medium uppercase tracking-wide">
                {record.source_dataset}
              </div>
              <div className="text-sm font-mono text-gray-800 mt-0.5">
                Record #{record.source_record_id}
              </div>
            </div>
            {sourceUrl && (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700 transition"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
                View in {record.source_dataset.toUpperCase()}
              </a>
            )}
          </div>

          {/* Metadata grid */}
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
            {record.submitter && (
              <Field label="Submitter" value={record.submitter} />
            )}
            {record.year != null && (
              <Field label="Year" value={String(record.year)} />
            )}
            {record.geography && (
              <Field label="Geography" value={record.geography} />
            )}
            {record.process_state && (
              <Field label="Process state" value={record.process_state} />
            )}
            {record.citation_year != null && (
              <Field label="Citation year" value={String(record.citation_year)} />
            )}
            {record.is_grouped_average && (
              <Field label="Record type" value="Grouped average" />
            )}
          </dl>

          {/* Citation */}
          {record.citation && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">
                Literature / Reference
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{record.citation}</p>
              {record.citation_url && (
                <a
                  href={record.citation_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-xs text-teal-600 hover:text-teal-700 transition break-all"
                >
                  <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  </svg>
                  {record.citation_url}
                </a>
              )}
            </div>
          )}

          {/* Remarks */}
          {record.remarks && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="text-[10px] font-medium text-amber-700 uppercase tracking-wide mb-1">
                Remarks
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{record.remarks}</p>
            </div>
          )}

          {/* All measurements in this sample */}
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Measurements in this sample ({record.measurements.length})
            </div>
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-100 text-xs">
                <thead className="bg-slate-50">
                  <tr className="text-gray-500">
                    <th className="px-3 py-1.5 text-left font-medium">Property</th>
                    <th className="px-3 py-1.5 text-right font-medium">Value</th>
                    <th className="px-3 py-1.5 text-left font-medium">Unit</th>
                    <th className="px-3 py-1.5 text-left font-medium">Basis</th>
                    <th className="px-3 py-1.5 text-left font-medium">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {record.measurements.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-3 py-1.5 font-medium text-gray-800">{m.property_name}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatValue(m.original_value, 3)}</td>
                      <td className="px-3 py-1.5 text-gray-500">{m.original_unit}</td>
                      <td className="px-3 py-1.5">
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                          {formatBasis(m.original_basis)}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-[10px] text-gray-500">{formatDerivation(m.derivation)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl flex items-center justify-between">
          <span className="text-[10px] text-gray-400">
            Source data may be subject to licensing from {record.source_dataset.toUpperCase()}.
          </span>
          <button
            onClick={onClose}
            className="text-xs text-gray-500 hover:text-gray-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</dt>
      <dd className="text-sm text-gray-700 mt-0.5">{value}</dd>
    </div>
  );
}
