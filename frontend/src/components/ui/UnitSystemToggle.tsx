"use client";

import { useUnitSystem } from "@/lib/unitConversion";

/**
 * Compact segmented control that switches the whole UI between Metric and
 * US units. Persisted via `useUnitSystem()` so the choice survives navigation
 * and reloads, and every component reading the hook re-renders on change.
 */
export function UnitSystemToggle() {
  const { system, setSystem } = useUnitSystem();
  return (
    <div
      className="flex rounded-lg border border-slate-300 bg-white overflow-hidden text-xs"
      title="Switch display units. Underlying data and conversions are unchanged; CSV exports and chart PNGs will reflect the displayed system."
    >
      <button
        onClick={() => setSystem("metric")}
        className={`px-2.5 py-1 font-medium transition ${
          system === "metric"
            ? "bg-teal-600 text-white"
            : "text-slate-600 hover:bg-slate-50"
        }`}
        aria-pressed={system === "metric"}
      >
        Metric
      </button>
      <button
        onClick={() => setSystem("us")}
        className={`px-2.5 py-1 font-medium transition ${
          system === "us"
            ? "bg-teal-600 text-white"
            : "text-slate-600 hover:bg-slate-50"
        }`}
        aria-pressed={system === "us"}
      >
        US
      </button>
    </div>
  );
}
