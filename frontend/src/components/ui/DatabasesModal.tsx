"use client";

import { useEffect, useState } from "react";
import { listSources, type SourceStatusOut } from "@/lib/api";

interface DatabasesModalProps {
  onClose: () => void;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function DatabasesModal({ onClose }: DatabasesModalProps) {
  const [sources, setSources] = useState<SourceStatusOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listSources()
      .then((data) => {
        if (!cancelled) setSources(data);
      })
      .catch((err) => {
        if (!cancelled) setError(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const anyNeedsUpdate = sources?.some((s) => s.needs_update) ?? false;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-xl border border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Databases</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Global warning banner when any source has drifted */}
        {anyNeedsUpdate && (
          <div className="mx-6 mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
            <div className="flex items-start gap-2">
              <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <div className="text-xs text-amber-900 leading-relaxed">
                <span className="font-semibold">Data may be out of date.</span>{" "}
                One or more sources have new records upstream that haven&rsquo;t been ingested
                yet. Summary counts and statistics for the affected sources may lag the live
                upstream database until the next refresh.
              </div>
            </div>
          </div>
        )}

        <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              Failed to load source status: {error}
            </div>
          )}
          {!sources && !error && (
            <div className="text-center text-sm text-gray-400 py-6">Loading sources…</div>
          )}
          {sources?.map((db) => (
            <div
              key={db.id}
              className={`rounded-lg border p-4 ${
                db.needs_update
                  ? "border-amber-300 bg-amber-50/40"
                  : "border-gray-200"
              }`}
            >
              <div className="flex items-center justify-between mb-2 gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-gray-800">{db.display_name}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      db.status === "active"
                        ? "bg-teal-50 text-teal-700 border border-teal-200"
                        : "bg-gray-50 text-gray-500 border border-gray-200"
                    }`}
                  >
                    {db.status === "active" ? "Active" : "Planned"}
                  </span>
                  {db.needs_update && (
                    <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                      Update needed
                    </span>
                  )}
                </div>
                {db.url && (
                  <a
                    href={db.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-teal-600 hover:text-teal-700 transition shrink-0"
                  >
                    {db.url.replace("https://", "").replace("http://", "")}
                  </a>
                )}
              </div>
              {db.description && (
                <p className="text-sm text-gray-600 mb-2">{db.description}</p>
              )}
              {db.notes && (
                <p className="text-xs text-gray-400 italic mb-2">{db.notes}</p>
              )}

              {db.status === "active" && (
                <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] text-gray-600 border-t border-gray-100 pt-2">
                  <span>
                    Last ingested:{" "}
                    <span className="font-medium text-gray-800">
                      {formatDate(db.last_ingested_at)}
                    </span>
                  </span>
                  <span>
                    Last checked:{" "}
                    <span className="font-medium text-gray-800">
                      {formatDate(db.last_checked_at)}
                    </span>
                  </span>
                  <span>
                    Records (last scrape):{" "}
                    <span className="font-medium text-gray-800 tabular-nums">
                      {db.known_record_count.toLocaleString()}
                    </span>
                  </span>
                  <span>
                    Upstream (now):{" "}
                    <span className="font-medium text-gray-800 tabular-nums">
                      {db.upstream_record_count != null
                        ? db.upstream_record_count.toLocaleString()
                        : "—"}
                    </span>
                    {db.upstream_record_count != null &&
                      db.upstream_record_count > db.known_record_count && (
                        <span className="ml-1 text-amber-700 font-semibold">
                          (+{(db.upstream_record_count - db.known_record_count).toLocaleString()})
                        </span>
                      )}
                  </span>
                </div>
              )}
              {db.last_check_error && (
                <p className="mt-2 text-[11px] text-red-600">
                  Last check error: {db.last_check_error}
                </p>
              )}
            </div>
          ))}
        </div>
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl">
          <p className="text-xs text-gray-400">
            Data is sourced from public databases. Original citations and provenance are preserved
            for all records. BiomassIQ polls each active source periodically and will flag a
            drift when new records appear upstream.
          </p>
        </div>
      </div>
    </div>
  );
}
