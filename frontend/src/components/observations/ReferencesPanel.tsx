"use client";

import { useMemo } from "react";
import type { SampleRecord } from "@/lib/types";

interface ReferencesPanelProps {
  observations: SampleRecord[];
}

interface Reference {
  citation: string;
  url: string | null;
  year: number | null;
  submitter: string | null;
  sampleCount: number;
  sampleIds: string[];
  sourceDataset: string;
}

export function ReferencesPanel({ observations }: ReferencesPanelProps) {
  const references = useMemo(() => {
    const map = new Map<string, Reference>();
    for (const record of observations) {
      // Dedupe key: citation text (or submitter if no citation)
      const key = (record.citation || record.submitter || "Unknown").trim();
      if (!map.has(key)) {
        map.set(key, {
          citation: record.citation || "(no literature cited)",
          url: record.citation_url,
          year: record.citation_year,
          submitter: record.submitter,
          sampleCount: 0,
          sampleIds: [],
          sourceDataset: record.source_dataset,
        });
      }
      const ref = map.get(key)!;
      ref.sampleCount += 1;
      ref.sampleIds.push(record.source_record_id);
    }
    // Sort by sample count desc, then year desc
    return [...map.values()].sort((a, b) => {
      if (b.sampleCount !== a.sampleCount) return b.sampleCount - a.sampleCount;
      return (b.year ?? 0) - (a.year ?? 0);
    });
  }, [observations]);

  const exportReferences = () => {
    const lines = [
      "# BiomassIQ References Export",
      `# Total references: ${references.length}`,
      `# Total samples: ${observations.length}`,
      `# Exported: ${new Date().toISOString()}`,
      "",
      ...references.map((r, i) => {
        const parts = [`[${i + 1}] ${r.citation}`];
        if (r.submitter) parts.push(`    Submitter: ${r.submitter}`);
        if (r.url) parts.push(`    URL: ${r.url}`);
        parts.push(`    Samples contributed: ${r.sampleCount}`);
        return parts.join("\n");
      }),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `biomassiq_references_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (references.length === 0) {
    return null;
  }

  return (
    <details className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <summary className="px-6 py-3 bg-slate-50 border-b border-gray-200 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-slate-100 transition flex items-center justify-between">
        <span>References &amp; Sources</span>
        <span className="text-xs font-normal text-gray-500">
          {references.length} unique citations
        </span>
      </summary>

      <div className="px-6 py-2 flex justify-end border-b border-gray-100">
        <button
          onClick={exportReferences}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          Export References
        </button>
      </div>

      <ol className="divide-y divide-gray-100">
        {references.map((ref, i) => (
          <li key={i} className="px-6 py-3">
            <div className="flex items-start gap-3">
              <span className="shrink-0 inline-flex items-center justify-center min-w-[28px] h-6 rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 leading-relaxed">{ref.citation}</p>
                <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-500">
                  {ref.submitter && (
                    <span>
                      <span className="text-gray-400">Submitter:</span> {ref.submitter}
                    </span>
                  )}
                  <span className="rounded bg-teal-50 border border-teal-200 px-1.5 py-0.5 text-teal-700 font-medium">
                    {ref.sampleCount} sample{ref.sampleCount !== 1 ? "s" : ""}
                  </span>
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600 font-medium uppercase text-[10px]">
                    {ref.sourceDataset}
                  </span>
                </div>
                {ref.url && (
                  <a
                    href={ref.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-1 text-xs text-teal-600 hover:text-teal-700 transition break-all"
                  >
                    <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                    </svg>
                    {ref.url}
                  </a>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}
