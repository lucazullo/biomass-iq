"use client";

import { useState } from "react";
import type { SubstanceSummary } from "@/lib/types";

interface SelectionBasketProps {
  basket: SubstanceSummary[];
  onRemove: (id: string) => void;
  onClear: () => void;
}

export function SelectionBasket({ basket, onRemove, onClear }: SelectionBasketProps) {
  const [expanded, setExpanded] = useState(false);

  if (basket.length === 0) return null;

  const totalSamples = basket.reduce((sum, s) => sum + s.observation_count, 0);

  const viewHref =
    basket.length === 1
      ? `/substance/${basket[0].id}`
      : `/substance/${basket[0].id}?${basket.slice(1).map((s) => `also=${s.id}`).join("&")}`;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 rounded-xl border border-gray-200 bg-white shadow-lg w-full max-w-4xl mx-4">
      {/* Expanded list */}
      {expanded && (
        <div className="max-h-64 overflow-y-auto border-b border-gray-100 p-3">
          <div className="flex flex-wrap gap-1.5">
            {basket.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-1.5 rounded-lg bg-teal-50 border border-teal-200 pl-2.5 pr-1 py-1 text-xs text-teal-800 max-w-full"
                title={s.taxonomy_path.join(" > ")}
              >
                <span className="truncate max-w-[200px]">{s.preferred_name}</span>
                <span className="text-[10px] text-teal-600 shrink-0">{s.observation_count}</span>
                <button
                  onClick={() => onRemove(s.id)}
                  className="rounded-full bg-teal-200 w-4 h-4 flex items-center justify-center text-teal-700 hover:bg-teal-300 shrink-0"
                  title={`Remove ${s.preferred_name}`}
                >
                  <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 transition"
        >
          <svg className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
          </svg>
          <span className="font-semibold">
            Basket: {basket.length} {basket.length === 1 ? "material" : "materials"}
          </span>
          <span className="text-xs text-gray-500">· {totalSamples} samples</span>
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={onClear}
            className="text-xs text-gray-400 hover:text-gray-600 transition"
          >
            Clear
          </button>
          <a
            href={viewHref}
            className="rounded-lg bg-teal-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-teal-700 transition"
          >
            View all {basket.length > 1 ? `(${basket.length})` : ""}
          </a>
        </div>
      </div>
    </div>
  );
}
