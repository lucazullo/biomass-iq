"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { AnalyticalBasis, SubstanceSummary } from "@/lib/types";
import {
  listUserSamples,
  saveUserSample,
  deleteUserSample,
  generateId,
  exportUserSamplesCsv,
  exportUserSamplesJson,
  importUserSamplesJson,
  COMMON_PROPERTIES,
  CATEGORY_LABELS,
  type UserSample,
  type UserMeasurement,
  type PropertyDef,
} from "@/lib/userData";
import { searchSubstances } from "@/lib/api";

interface MyDataModalProps {
  onClose: () => void;
  /** If provided, opens the add-sample form pre-filled with this substance */
  initialSubstance?: { id: string; name: string };
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function MyDataModal({ onClose, initialSubstance }: MyDataModalProps) {
  const [samples, setSamples] = useState<UserSample[]>([]);
  const [editing, setEditing] = useState<UserSample | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const all = listUserSamples();
    setSamples(all);

    // If opened with a pre-filled substance, show the samples for that substance
    // and offer a prefilled "add" form if none exist yet.
    if (initialSubstance && !editing) {
      const existing = all.filter((s) => s.substance_id === initialSubstance.id);
      if (existing.length === 0) {
        setEditing({
          ...blankSample(),
          substance_id: initialSubstance.id,
          substance_name: initialSubstance.name,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSubstance?.id]);

  const refresh = () => setSamples(listUserSamples());

  const handleSave = (sample: UserSample) => {
    saveUserSample(sample);
    refresh();
    setEditing(null);
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this sample?")) {
      deleteUserSample(id);
      refresh();
    }
  };

  const handleExportCsv = () => {
    const csv = exportUserSamplesCsv(samples);
    downloadFile(csv, `biomassiq_my_data_${new Date().toISOString().slice(0, 10)}.csv`, "text/csv;charset=utf-8;");
  };

  const handleExportJson = () => {
    const json = exportUserSamplesJson(samples);
    downloadFile(json, `biomassiq_my_data_${new Date().toISOString().slice(0, 10)}.json`, "application/json;charset=utf-8;");
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();

    // Ask user: merge or replace?
    let mode: "merge" | "replace" = "merge";
    if (samples.length > 0) {
      const choice = window.confirm(
        `You have ${samples.length} sample${samples.length !== 1 ? "s" : ""} currently saved.\n\n` +
        `Click OK to MERGE the imported data with existing samples.\n` +
        `Click Cancel, then use the "Clear all" option if you want to REPLACE everything.`,
      );
      if (!choice) { e.target.value = ""; return; }
      mode = "merge";
    } else {
      mode = "replace";
    }

    const result = importUserSamplesJson(text, mode);
    if (result.ok) {
      refresh();
      alert(`Imported ${result.added} sample${result.added !== 1 ? "s" : ""}${result.skipped > 0 ? ` (${result.skipped} skipped)` : ""}.`);
    } else {
      alert(`Import failed: ${result.error}`);
    }
    e.target.value = ""; // reset so the same file can be re-imported
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 px-4">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-4xl rounded-xl border border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">My Data</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              User-contributed samples — stored locally in your browser
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto">
          {editing ? (
            <SampleForm sample={editing} onSave={handleSave} onCancel={() => setEditing(null)} />
          ) : (
            <div className="px-6 py-4 space-y-4">
              {initialSubstance && (
                <div className="rounded-lg border border-teal-200 bg-teal-50/50 px-3 py-2 text-xs text-teal-800">
                  Showing samples for <strong>{initialSubstance.name}</strong>. Click <strong>+ Add sample</strong> to contribute new measurements to this dataset.
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-gray-600">
                  {(initialSubstance
                    ? samples.filter((s) => s.substance_id === initialSubstance.id).length
                    : samples.length) === 0
                    ? initialSubstance
                      ? "No samples for this substance yet."
                      : "No user samples yet."
                    : `${initialSubstance
                        ? samples.filter((s) => s.substance_id === initialSubstance.id).length
                        : samples.length} user sample${samples.length !== 1 ? "s" : ""} ${initialSubstance ? "for this substance" : "stored locally"}`}
                </p>
                <div className="flex gap-2 flex-wrap justify-end">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json,.json"
                    onChange={handleImportFile}
                    className="hidden"
                  />
                  <button
                    onClick={handleImportClick}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
                    title="Import previously saved JSON data"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    Import
                  </button>
                  {samples.length > 0 && (
                    <>
                      <button
                        onClick={handleExportJson}
                        className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
                        title="Export as JSON (preserves all fields, can be re-imported)"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                        </svg>
                        Export JSON
                      </button>
                      <button
                        onClick={handleExportCsv}
                        className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
                        title="Export as CSV (spreadsheet-friendly, not roundtrip)"
                      >
                        Export CSV
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setEditing({
                      ...blankSample(),
                      ...(initialSubstance ? { substance_id: initialSubstance.id, substance_name: initialSubstance.name } : {}),
                    })}
                    className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700 transition"
                  >
                    + Add sample
                  </button>
                </div>
              </div>

              {(initialSubstance
                ? samples.filter((s) => s.substance_id === initialSubstance.id).length === 0
                : samples.length === 0) ? (
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 py-12 text-center">
                  <p className="text-sm text-gray-500">
                    Add your own biomass samples to analyze them alongside PHYLIS data.
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Your data stays in your browser — nothing is sent to a server.
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    Or <button onClick={handleImportClick} className="text-teal-600 hover:text-teal-700 underline">import</button> a previously-saved JSON file.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(initialSubstance
                    ? samples.filter((s) => s.substance_id === initialSubstance.id)
                    : samples
                  ).map((s) => (
                    <div
                      key={s.id}
                      className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3 hover:border-gray-300 transition"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-800">{s.original_name}</span>
                          <span className="rounded-full bg-teal-50 border border-teal-200 px-2 py-0.5 text-[10px] font-medium text-teal-700">
                            {s.substance_name}
                          </span>
                          {s.year != null && (
                            <span className="text-xs text-gray-500">{s.year}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span>{s.measurements.length} measurement{s.measurements.length !== 1 ? "s" : ""}</span>
                          {s.submitter && <span>· {s.submitter}</span>}
                          {s.citation && <span className="truncate max-w-[300px]">· {s.citation}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => setEditing(s)}
                          className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(s.id)}
                          className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-red-500 hover:bg-red-50 transition"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl text-xs text-gray-400">
          User samples appear in substance detail pages tagged as &quot;user&quot; source, alongside PHYLIS data.
        </div>
      </div>
    </div>
  );
}

function blankSample(): UserSample {
  return {
    id: generateId(),
    substance_id: "",
    substance_name: "",
    original_name: "",
    year: null,
    citation: null,
    citation_url: null,
    submitter: null,
    remarks: null,
    geography: null,
    process_state: null,
    measurements: [],
    created_at: new Date().toISOString(),
  };
}

// --- Form ---

function SampleForm({
  sample,
  onSave,
  onCancel,
}: {
  sample: UserSample;
  onSave: (s: UserSample) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<UserSample>(sample);
  const [substanceQuery, setSubstanceQuery] = useState(sample.substance_name || "");
  const [substanceResults, setSubstanceResults] = useState<SubstanceSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchCompleted, setSearchCompleted] = useState(false);

  // Debounced substance search
  useEffect(() => {
    if (!substanceQuery.trim() || substanceQuery === draft.substance_name) {
      setSubstanceResults([]);
      setSearchCompleted(false);
      return;
    }
    setSearchCompleted(false);
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await searchSubstances(substanceQuery, 10);
        setSubstanceResults([...r.exact_matches, ...r.narrower_matches, ...r.related_matches].slice(0, 8));
      } finally {
        setSearching(false);
        setSearchCompleted(true);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [substanceQuery, draft.substance_name]);

  const pickSubstance = useCallback((s: SubstanceSummary) => {
    setDraft((d) => ({ ...d, substance_id: s.id, substance_name: s.preferred_name }));
    setSubstanceQuery(s.preferred_name);
    setSubstanceResults([]);
  }, []);

  const addMeasurement = () => {
    setDraft((d) => ({
      ...d,
      measurements: [
        ...d.measurements,
        { property_code: "ash", property_name: "Ash", value: 0, unit: "wt%", basis: "dry" },
      ],
    }));
  };

  const updateMeasurement = (idx: number, patch: Partial<UserMeasurement>) => {
    setDraft((d) => ({
      ...d,
      measurements: d.measurements.map((m, i) => (i === idx ? { ...m, ...patch } : m)),
    }));
  };

  const removeMeasurement = (idx: number) => {
    setDraft((d) => ({
      ...d,
      measurements: d.measurements.filter((_, i) => i !== idx),
    }));
  };

  // A substance is identified either by a picked canonical link or by a typed custom name
  const effectiveSubstanceName = draft.substance_name.trim() || substanceQuery.trim();
  const effectiveSubstanceId =
    draft.substance_id.trim() ||
    (effectiveSubstanceName ? `user:${effectiveSubstanceName.toLowerCase().replace(/\s+/g, "-")}` : "");
  const isUserDefinedSubstance = !draft.substance_id.trim() && effectiveSubstanceName !== "";

  const canSave =
    effectiveSubstanceName !== "" &&
    draft.original_name.trim() !== "" &&
    draft.measurements.length > 0 &&
    draft.measurements.every((m) => !Number.isNaN(m.value));

  const handleSaveClick = () => {
    onSave({
      ...draft,
      substance_id: effectiveSubstanceId,
      substance_name: effectiveSubstanceName,
    });
  };

  return (
    <div className="px-6 py-4 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">
          {sample.original_name ? "Edit sample" : "Add sample"}
        </h3>
        <button onClick={onCancel} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
      </div>

      {/* Substance picker */}
      <Field label="Substance name *" hint="Pick a PHYLIS substance to link your sample, or type a custom name for a user-defined substance">
        <div className="relative">
          <input
            type="text"
            value={substanceQuery}
            onChange={(e) => {
              setSubstanceQuery(e.target.value);
              if (e.target.value !== draft.substance_name) {
                setDraft((d) => ({ ...d, substance_id: "", substance_name: "" }));
              }
            }}
            placeholder="e.g. wheat straw, miscanthus, pine..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
          {substanceResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-gray-200 bg-white shadow-lg max-h-60 overflow-y-auto z-10">
              {substanceResults.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pickSubstance(s)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
                >
                  <div className="font-medium text-gray-800">{s.preferred_name}</div>
                  <div className="text-xs text-gray-400">{s.taxonomy_path.join(" > ")}</div>
                </button>
              ))}
            </div>
          )}
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 flex items-center gap-1.5">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-teal-600" />
              Searching...
            </div>
          )}
          {searchCompleted && !searching && substanceResults.length === 0 && !draft.substance_id && (
            <div className="mt-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <span className="font-medium">No PHYLIS match for &quot;{substanceQuery}&quot;.</span>{" "}
              Will save as a user-defined substance. Try shorter terms (e.g. &quot;MSW&quot;) to find linked PHYLIS substances.
            </div>
          )}
          {draft.substance_id && (
            <p className="mt-1 text-xs text-teal-600 flex items-center gap-1">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Linked to PHYLIS: <span className="font-medium">{draft.substance_name}</span>
            </p>
          )}
        </div>
      </Field>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Sample name *">
          <input
            type="text"
            value={draft.original_name}
            onChange={(e) => setDraft({ ...draft, original_name: e.target.value })}
            placeholder="e.g. Farm A 2023 harvest"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500/20"
          />
        </Field>
        <Field label="Year">
          <input
            type="number"
            value={draft.year ?? ""}
            onChange={(e) => setDraft({ ...draft, year: e.target.value ? Number(e.target.value) : null })}
            placeholder="e.g. 2024"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500/20"
          />
        </Field>
        <Field label="Submitter / lab">
          <input
            type="text"
            value={draft.submitter ?? ""}
            onChange={(e) => setDraft({ ...draft, submitter: e.target.value || null })}
            placeholder="e.g. Your lab name"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500/20"
          />
        </Field>
        <Field label="Geography">
          <input
            type="text"
            value={draft.geography ?? ""}
            onChange={(e) => setDraft({ ...draft, geography: e.target.value || null })}
            placeholder="e.g. US Midwest"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500/20"
          />
        </Field>
        <Field label="Citation / source">
          <input
            type="text"
            value={draft.citation ?? ""}
            onChange={(e) => setDraft({ ...draft, citation: e.target.value || null })}
            placeholder="e.g. Smith et al. 2024, Biomass & Bioenergy"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500/20"
          />
        </Field>
        <Field label="Citation URL / DOI">
          <input
            type="url"
            value={draft.citation_url ?? ""}
            onChange={(e) => setDraft({ ...draft, citation_url: e.target.value || null })}
            placeholder="https://doi.org/..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500/20"
          />
        </Field>
      </div>

      <Field label="Remarks">
        <textarea
          value={draft.remarks ?? ""}
          onChange={(e) => setDraft({ ...draft, remarks: e.target.value || null })}
          placeholder="Notes on collection, preparation, methods..."
          rows={2}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500/20"
        />
      </Field>

      {/* Measurements */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Measurements *
          </label>
          <button
            type="button"
            onClick={addMeasurement}
            className="text-xs text-teal-600 hover:text-teal-700 font-medium"
          >
            + Add measurement
          </button>
        </div>
        {draft.measurements.length === 0 ? (
          <p className="text-xs text-gray-400 italic">Add at least one property measurement</p>
        ) : (
          <div className="space-y-2">
            {draft.measurements.map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                {(() => {
                  const currentProp = COMMON_PROPERTIES.find((p) => p.code === m.property_code);
                  const currentCategory: PropertyDef["category"] = currentProp?.category ?? "proximate";
                  const propsInCategory = COMMON_PROPERTIES.filter((p) => p.category === currentCategory);
                  return (
                    <>
                      <select
                        value={currentCategory}
                        onChange={(e) => {
                          const newCat = e.target.value as PropertyDef["category"];
                          const firstProp = COMMON_PROPERTIES.find((p) => p.category === newCat);
                          if (firstProp) {
                            updateMeasurement(i, {
                              property_code: firstProp.code,
                              property_name: firstProp.name,
                              unit: firstProp.defaultUnit,
                            });
                          }
                        }}
                        className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm w-40 focus:border-teal-500 focus:outline-none"
                      >
                        {Object.entries(CATEGORY_LABELS).map(([cat, label]) => (
                          <option key={cat} value={cat}>{label}</option>
                        ))}
                      </select>
                      <select
                        value={m.property_code}
                        onChange={(e) => {
                          const prop = COMMON_PROPERTIES.find((p) => p.code === e.target.value);
                          updateMeasurement(i, {
                            property_code: e.target.value,
                            property_name: prop?.name ?? e.target.value,
                            unit: prop?.defaultUnit ?? m.unit,
                          });
                        }}
                        className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm flex-1 focus:border-teal-500 focus:outline-none"
                      >
                        {propsInCategory.map((p) => (
                          <option key={p.code} value={p.code}>{p.name}</option>
                        ))}
                      </select>
                    </>
                  );
                })()}
                <input
                  type="number"
                  step="0.01"
                  value={m.value}
                  onChange={(e) => updateMeasurement(i, { value: Number(e.target.value) })}
                  className="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-right tabular-nums focus:border-teal-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={m.unit}
                  onChange={(e) => updateMeasurement(i, { unit: e.target.value })}
                  className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-teal-500 focus:outline-none"
                />
                <select
                  value={m.basis}
                  onChange={(e) => updateMeasurement(i, { basis: e.target.value as AnalyticalBasis })}
                  className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-teal-500 focus:outline-none"
                >
                  <option value="ar">As Received</option>
                  <option value="dry">Dry</option>
                  <option value="daf">Dry Ash-Free</option>
                </select>
                <button
                  type="button"
                  onClick={() => removeMeasurement(i)}
                  className="text-gray-400 hover:text-red-500 transition"
                  title="Remove"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-100">
        <div className="text-xs text-gray-500">
          {!canSave ? (
            <ul className="space-y-0.5">
              {!effectiveSubstanceName && (
                <li className="flex items-center gap-1.5 text-amber-700">
                  <span className="w-1 h-1 rounded-full bg-amber-500" />
                  Type a substance name (or pick from the search suggestions)
                </li>
              )}
              {!draft.original_name.trim() && (
                <li className="flex items-center gap-1.5 text-amber-700">
                  <span className="w-1 h-1 rounded-full bg-amber-500" />
                  Enter a sample name
                </li>
              )}
              {draft.measurements.length === 0 && (
                <li className="flex items-center gap-1.5 text-amber-700">
                  <span className="w-1 h-1 rounded-full bg-amber-500" />
                  Add at least one measurement
                </li>
              )}
            </ul>
          ) : isUserDefinedSubstance ? (
            <p className="text-amber-700 flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-amber-500" />
              Will save as user-defined substance &quot;{effectiveSubstanceName}&quot; (not linked to PHYLIS)
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-gray-300 bg-white px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveClick}
            disabled={!canSave}
            className="rounded-lg bg-teal-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
            title={canSave ? "Save this sample" : "Complete the required fields above"}
          >
            Save sample
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">
        {label}
      </label>
      {children}
      {hint && <p className="text-[10px] text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}
