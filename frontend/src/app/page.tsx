"use client";

import { useState } from "react";
import { SearchBar } from "@/components/search/SearchBar";
import { SearchResults } from "@/components/search/SearchResults";
import { CompareTab } from "@/components/compare/CompareTab";
import { DatabasesModal } from "@/components/ui/DatabasesModal";
import { HelpModal } from "@/components/ui/HelpModal";
import { MyDataModal } from "@/components/ui/MyDataModal";
import { SelectionBasket } from "@/components/search/SelectionBasket";
import { DisclaimerBanner } from "@/components/ui/DisclaimerBanner";
import { TermsModal } from "@/components/ui/TermsModal";
import { useBasket } from "@/lib/basket";
import { UnitSystemToggle } from "@/components/ui/UnitSystemToggle";
import type { SearchResult } from "@/lib/types";

type ActiveTab = "search" | "compare";

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("search");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showDatabases, setShowDatabases] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showMyData, setShowMyData] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Persistent basket — backed by localStorage so it survives navigation, tab switches, and reloads.
  const { basket, addToBasket, removeFromBasket, clearBasket } = useBasket();

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setResults(null);
      setHasSearched(false);
      return;
    }
    setIsSearching(true);
    setHasSearched(true);
    try {
      const { searchSubstances } = await import("@/lib/api");
      const { augmentSearchWithUserData } = await import("@/lib/userSearch");
      const data = await searchSubstances(query);
      setResults(augmentSearchWithUserData(data, query));
    } catch {
      setResults(null);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <>
      <DisclaimerBanner />
      {/* Hero header */}
      <header className="bg-gradient-to-b from-slate-50 to-slate-100 border-b border-slate-200 px-6 py-4 text-center relative">
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <UnitSystemToggle />
          {basket.length > 0 && (
            <button
              onClick={() => {
                const ok = window.confirm(
                  `Empty your comparison basket?\n\nThis will remove all ${basket.length} selected material${basket.length === 1 ? "" : "s"}. The action cannot be undone.`,
                );
                if (ok) clearBasket();
              }}
              className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-100"
              title="Empty the selection basket"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
              Empty basket ({basket.length})
            </button>
          )}
          <button
            onClick={() => setShowMyData(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            My Data
          </button>
          <button
            onClick={() => setShowDatabases(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75" />
            </svg>
            Databases
          </button>
          <button
            onClick={() => setShowHelp(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
            </svg>
            Help
          </button>
        </div>
        <img src="/logo.png" alt="BiomassIQ" className="mx-auto mb-2 h-52 w-auto drop-shadow-sm" />
        <p className="text-sm text-slate-600 max-w-2xl mx-auto font-medium">
          Search, explore, compare — and analyze with your own data.
        </p>
        <p className="text-xs text-slate-500 max-w-2xl mx-auto mt-1">
          Biomass property data from public databases · Transparent provenance · Defensible summaries
        </p>
        {/* Tab bar */}
        <div className="mt-3 flex justify-center">
          <div className="flex rounded-lg border border-gray-300 bg-white overflow-hidden text-sm">
            <button
              onClick={() => setActiveTab("search")}
              className={`px-4 py-1.5 font-medium transition ${
                activeTab === "search"
                  ? "bg-teal-600 text-white"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              Search
            </button>
            <button
              onClick={() => setActiveTab("compare")}
              className={`px-4 py-1.5 font-medium transition ${
                activeTab === "compare"
                  ? "bg-teal-600 text-white"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              Compare
            </button>
          </div>
        </div>
      </header>

      {showDatabases && <DatabasesModal onClose={() => setShowDatabases(false)} />}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      {showMyData && <MyDataModal onClose={() => setShowMyData(false)} />}
      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-4 px-4 py-8">
        {activeTab === "search" && (
          <>
            {/* Search */}
            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Search Materials</h2>
              <SearchBar onSearch={handleSearch} isSearching={isSearching} />
            </section>

            {/* Results */}
            {hasSearched && (
              <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                {isSearching ? (
                  <div className="text-center text-gray-500 py-8">Searching...</div>
                ) : results ? (
                  <SearchResults
                    results={results}
                    basket={basket}
                    onAddToBasket={addToBasket}
                    onRemoveFromBasket={removeFromBasket}
                  />
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    No results found. Try a different search term.
                  </div>
                )}
              </section>
            )}

            {/* Info cards when no search */}
            {!hasSearched && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <InfoCard
                  title="Provenance Preserved"
                  description="Every measurement traces back to its source dataset, original sample name, basis, and citation."
                />
                <InfoCard
                  title="Basis-Aware"
                  description="As-received, dry, and dry ash-free values are never silently mixed. Conversions are explicit and documented."
                />
                <InfoCard
                  title="Transparent Summaries"
                  description="Statistics always disclose observation count, source count, active filters, and missingness."
                />
              </div>
            )}
          </>
        )}

        {activeTab === "compare" && (
          <CompareTab
            basket={basket}
            onRemoveFromBasket={removeFromBasket}
            onClearBasket={clearBasket}
            onGoToSearch={() => setActiveTab("search")}
          />
        )}
      </main>

      <footer className="border-t border-gray-100 py-6 text-center text-xs text-gray-400 space-y-1 pb-24">
        <p>BiomassIQ — v1.1 — April 2026</p>
        <p>Biomass characterization data sourced from PHYLIS (phyllis.nl) under TNO</p>
        <p>
          <button
            onClick={() => setShowTerms(true)}
            className="text-teal-600 hover:text-teal-700 underline"
          >
            Terms of Use
          </button>
        </p>
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

      <SelectionBasket
        basket={basket}
        onRemove={removeFromBasket}
        onClear={clearBasket}
      />
    </>
  );
}

function InfoCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-800 mb-2">{title}</h3>
      <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
    </div>
  );
}
