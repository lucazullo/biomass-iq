"use client";

import { useState, useRef, useEffect } from "react";
import {
  usePropertyColors,
  COLOR_PRESETS,
  defaultColorForProperty,
  type BasisColor,
} from "@/lib/chartColors";

export interface ChartColorProperty {
  property_code: string;
  display_name: string;
}

interface ChartColorPickerProps {
  /** Properties currently visible in the chart — one row per property in the popover. */
  properties: ChartColorProperty[];
}

/**
 * Palette icon that opens a per-property color picker. User picks a base color
 * per property; the chart automatically derives the two shades from it via
 * opacity (±2 SD lighter, ±1 SD darker).
 */
export function ChartColorPicker({ properties }: ChartColorPickerProps) {
  const { getColor, setColor, resetProperty, resetAll, isCustomized, prefs } =
    usePropertyColors();
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t)) return;
      if (btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  // De-dupe in case the same property_code appears with multiple bases.
  const seen = new Set<string>();
  const uniqueProps = properties.filter((p) => {
    if (seen.has(p.property_code)) return false;
    seen.add(p.property_code);
    return true;
  });

  return (
    <div className="relative inline-block">
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-medium transition ${
          isCustomized
            ? "border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100"
            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
        }`}
        title="Customize chart colors per property"
        type="button"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.375 18a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
        Colors
      </button>

      {open && (
        <div
          ref={popRef}
          className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-gray-200 bg-white shadow-xl"
        >
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-800">Chart Colors</h4>
            <button
              onClick={resetAll}
              disabled={!isCustomized}
              className="text-[11px] text-teal-600 hover:text-teal-700 disabled:text-gray-300 disabled:cursor-not-allowed font-medium"
            >
              Reset all
            </button>
          </div>
          <div className="px-4 py-3 space-y-3 max-h-[60vh] overflow-y-auto">
            {uniqueProps.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">
                No properties in the current chart.
              </p>
            ) : (
              uniqueProps.map((p) => (
                <PropertyRow
                  key={p.property_code}
                  displayName={p.display_name}
                  current={getColor(p.property_code)}
                  isCustom={!!prefs[p.property_code]}
                  onChange={(c) => setColor(p.property_code, c)}
                  onReset={() => resetProperty(p.property_code)}
                />
              ))
            )}
          </div>
          <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 rounded-b-xl">
            <p className="text-[10px] text-gray-500 leading-snug">
              Light and dark shades on charts are generated automatically from each base color.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function PropertyRow({
  displayName,
  current,
  isCustom,
  onChange,
  onReset,
}: {
  displayName: string;
  current: BasisColor;
  isCustom: boolean;
  onChange: (c: BasisColor) => void;
  onReset: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5 gap-2">
        <span className="text-xs font-medium text-gray-700 truncate" title={displayName}>
          {displayName}
        </span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span
            className="h-3 w-5 rounded-sm"
            style={{ backgroundColor: current.fill, opacity: 0.3 }}
            title="±2 SD shade"
          />
          <span
            className="h-3 w-5 rounded-sm"
            style={{ backgroundColor: current.fill, opacity: 0.7 }}
            title="±1 SD shade"
          />
          {isCustom && (
            <button
              onClick={onReset}
              className="text-[10px] text-gray-400 hover:text-teal-600 transition ml-1"
              title="Reset to default"
            >
              ↺
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-10 gap-1">
        {COLOR_PRESETS.map((preset) => {
          const isSelected = preset.fill === current.fill;
          return (
            <button
              key={preset.fill}
              onClick={() => onChange(preset)}
              className={`h-5 w-5 rounded-sm border transition ${
                isSelected
                  ? "border-gray-900 ring-2 ring-offset-1 ring-gray-400"
                  : "border-gray-200 hover:border-gray-400"
              }`}
              style={{ backgroundColor: preset.fill }}
              aria-label={`Set color to ${preset.fill}`}
              type="button"
            />
          );
        })}
      </div>
    </div>
  );
}

// Suppress unused import when defaults are imported elsewhere — keep available.
void defaultColorForProperty;
