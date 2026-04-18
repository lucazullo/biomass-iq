"use client";

import { useState } from "react";
import { SearchBar } from "@/components/search/SearchBar";
import { ComparisonView } from "@/components/compare/ComparisonView";
import type { SubstanceSummary, Summary } from "@/lib/types";

export default function ComparePage() {
  const [selectedSubstances, setSelectedSubstances] = useState<SubstanceSummary[]>([]);
  const [searchResults, setSearchResults] = useState<SubstanceSummary[]>([]);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isComparing, setIsComparing] = useState(false);

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const { searchSubstances } = await import("@/lib/api");
      const data = await searchSubstances(query);
      const all = [
        ...data.exact_matches,
        ...data.broader_matches,
        ...data.narrower_matches,
        ...data.related_matches,
      ];
      setSearchResults(all);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const addSubstance = (s: SubstanceSummary) => {
    if (!selectedSubstances.find((x) => x.id === s.id)) {
      setSelectedSubstances([...selectedSubstances, s]);
    }
    setSearchResults([]);
  };

  const removeSubstance = (id: string) => {
    setSelectedSubstances(selectedSubstances.filter((s) => s.id !== id));
    setSummaries(summaries.filter((s) => s.substance_id !== id));
  };

  const runComparison = async () => {
    if (selectedSubstances.length < 2) return;
    setIsComparing(true);
    try {
      const { compareSubstances } = await import("@/lib/api");
      const items = selectedSubstances.map((s) => ({ substance_id: s.id }));
      const data = await compareSubstances(items);
      setSummaries(data);
    } catch {
      setSummaries([]);
    } finally {
      setIsComparing(false);
    }
  };

  return (
    <>
      {/* Header */}
      <header className="bg-gradient-to-b from-slate-50 to-slate-100 border-b border-slate-200 px-6 py-4">
        <div className="mx-auto max-w-4xl flex items-center gap-4">
          <a href="/" className="flex items-center gap-2 text-slate-500 hover:text-slate-700 transition">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            <span className="text-sm font-medium">Back</span>
          </a>
          <a href="/">
            <img src="/logo.png" alt="BiomassIQ" className="h-10 w-auto" />
          </a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-4 px-4 py-8">
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Compare Substances</h2>

          {/* Selected substances */}
          {selectedSubstances.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {selectedSubstances.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2 rounded-lg bg-teal-50 border border-teal-200 pl-3 pr-1.5 py-1.5 text-sm text-teal-700"
                >
                  {s.preferred_name}
                  <button
                    onClick={() => removeSubstance(s.id)}
                    className="rounded-full bg-teal-200 w-5 h-5 flex items-center justify-center text-teal-700 hover:bg-teal-300 text-xs transition"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Search to add */}
          <SearchBar onSearch={handleSearch} isSearching={isSearching} />

          {/* Search dropdown */}
          {searchResults.length > 0 && (
            <div className="mt-2 rounded-lg border border-gray-200 bg-white shadow-lg max-h-60 overflow-y-auto">
              {searchResults.map((s) => (
                <button
                  key={s.id}
                  onClick={() => addSubstance(s)}
                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0 transition"
                  disabled={!!selectedSubstances.find((x) => x.id === s.id)}
                >
                  <span className="font-medium text-gray-800">{s.preferred_name}</span>
                  <span className="ml-2 text-gray-400 text-xs">
                    {s.taxonomy_path.slice(-2).join(" > ")}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Compare button */}
          {selectedSubstances.length >= 2 && (
            <button
              onClick={runComparison}
              disabled={isComparing}
              className="mt-4 rounded-lg bg-teal-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-teal-700 transition disabled:opacity-50"
            >
              {isComparing ? "Comparing..." : `Compare ${selectedSubstances.length} Substances`}
            </button>
          )}
        </section>

        {/* Comparison results */}
        {summaries.length > 0 && <ComparisonView summaries={summaries} />}
      </main>
    </>
  );
}
